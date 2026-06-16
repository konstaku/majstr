// Env must be set BEFORE the modules under test are required:
// helpers/verification.js captures TELEGRAM_ADMIN_CHAT_ID at require time.
process.env.TELEGRAM_ADMIN_CHAT_ID = '424242';

import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';

const Master = require('../../database/schema/Master');
const MasterAudit = require('../../database/schema/MasterAudit');
const og = require('../../helpers/generateOpenGraph');
const { requestVerification } = require('../../helpers/verification');
const { handleVerifyCallback } = require('../../bot/verifyCallbacks');
const { bot } = require('../../bot');
const { connect, clearAll, disconnect } = require('../db');

const realOgImpl = og.impl;
let ogMock;

beforeAll(() => connect('verify-callbacks-test'));

beforeEach(() => {
  ogMock = vi.fn(async () => 'https://test-bucket.s3.test/og.png');
  og.impl = ogMock;
  vi.spyOn(bot, 'sendMessage').mockResolvedValue({});
  vi.spyOn(bot, 'sendPhoto').mockResolvedValue({});
  vi.spyOn(bot, 'answerCallbackQuery').mockResolvedValue(true);
  vi.spyOn(bot, 'editMessageText').mockResolvedValue({});
  vi.spyOn(bot, 'editMessageCaption').mockResolvedValue({});
});

afterEach(async () => {
  await clearAll();
  vi.restoreAllMocks();
});
afterAll(async () => {
  og.impl = realOgImpl;
  await disconnect();
});

const tgMessage = { chat: { id: 424242 }, message_id: 77, text: 'Запит на верифікацію' };
const admin = { id: 5950535, first_name: 'Kostia' };

describe('requestVerification', () => {
  it('sends the admin a Verify/Decline keyboard for the card', async () => {
    const master = await Master.create({ name: 'Олена', status: 'approved' });
    await requestVerification(master, 'owner edited the card');

    expect(bot.sendMessage).toHaveBeenCalledTimes(1);
    const [chatId, text, opts] = bot.sendMessage.mock.calls[0];
    expect(chatId).toBe('424242');
    expect(text).toContain('Олена');
    expect(text).toContain('owner edited the card');
    expect(opts.reply_markup.inline_keyboard[0].map((b) => b.callback_data)).toEqual([
      `verify:approve:${master._id}`,
      `verify:decline:${master._id}`,
    ]);
  });

  it('uses sendPhoto when the card has a photo', async () => {
    const master = await Master.create({
      name: 'Олена',
      status: 'approved',
      photo: 'https://s3/x.jpg',
    });
    await requestVerification(master, 'claimed');
    expect(bot.sendPhoto).toHaveBeenCalledTimes(1);
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });
});

describe('handleVerifyCallback — approve', () => {
  it('grants the badge: verified, verifiedAt, audit, OG regen, owner notify', async () => {
    const master = await Master.create({
      name: 'Олена',
      status: 'approved',
      telegramID: 70042,
    });

    await handleVerifyCallback('q1', tgMessage, `verify:approve:${master._id}`, admin);

    const updated = await Master.findById(master._id);
    expect(updated.verified).toBe(true);
    expect(updated.verifiedAt).toBeInstanceOf(Date);
    expect(updated.status).toBe('approved'); // visibility untouched

    const audit = await MasterAudit.findOne({ masterID: master._id });
    expect(audit).toMatchObject({ action: 'approve', reason: 'verified by admin' });

    expect(bot.answerCallbackQuery).toHaveBeenCalledWith('q1', { text: '✅ Верифіковано' });
    // Owner notification (separate from the admin chat edit)
    expect(bot.sendMessage).toHaveBeenCalledWith(70042, expect.stringContaining('VERIFIED'));
    // OG card regenerated with the verified stamp
    await vi.waitFor(() => expect(ogMock).toHaveBeenCalled());
  });

  it('clears the buttons on a photo request by editing the caption, not the text', async () => {
    // Photo verification requests carry a caption, not text — editMessageText
    // fails on them, which used to leave the Verify/Decline buttons tappable.
    const master = await Master.create({ name: 'Олена', status: 'approved' });
    const photoMessage = { chat: { id: 424242 }, message_id: 88, caption: 'Запит на верифікацію' };

    await handleVerifyCallback('q6', photoMessage, `verify:approve:${master._id}`, admin);

    expect(bot.editMessageCaption).toHaveBeenCalledTimes(1);
    const [body, opts] = bot.editMessageCaption.mock.calls[0];
    expect(body).toContain('✅ Верифіковано');
    expect(opts).toMatchObject({ chat_id: 424242, message_id: 88 });
    // No reply_markup passed → Telegram removes the inline keyboard.
    expect(opts.reply_markup).toBeUndefined();
    expect(bot.editMessageText).not.toHaveBeenCalled();
  });

  it('answers idempotently when the card is already verified', async () => {
    const master = await Master.create({ name: 'X', status: 'approved', verified: true });
    await handleVerifyCallback('q2', tgMessage, `verify:approve:${master._id}`, admin);
    expect(bot.answerCallbackQuery).toHaveBeenCalledWith('q2', { text: 'Вже верифіковано' });
    expect(bot.editMessageText).not.toHaveBeenCalled();
  });
});

describe('handleVerifyCallback — decline & edge cases', () => {
  it('decline keeps verified false, writes audit, notifies the owner', async () => {
    const master = await Master.create({ name: 'X', status: 'approved', telegramID: 70043 });

    await handleVerifyCallback('q3', tgMessage, `verify:decline:${master._id}`, admin);

    expect((await Master.findById(master._id)).verified).toBe(false);
    const audit = await MasterAudit.findOne({ masterID: master._id });
    expect(audit).toMatchObject({ action: 'reject', reason: 'verification declined by admin' });
    expect(bot.sendMessage).toHaveBeenCalledWith(70043, expect.any(String));
  });

  it('handles unknown master and malformed data gracefully', async () => {
    await handleVerifyCallback('q4', tgMessage, 'verify:approve:64b000000000000000000000', admin);
    expect(bot.answerCallbackQuery).toHaveBeenCalledWith('q4', { text: 'Картку не знайдено' });

    await handleVerifyCallback('q5', tgMessage, 'verify:promote:abc', admin);
    expect(bot.answerCallbackQuery).toHaveBeenCalledWith('q5', { text: 'Невідома дія' });
  });
});

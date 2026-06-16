import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';

const startFlow = require('../../bot/startFlow');
const Master = require('../../database/schema/Master');
const User = require('../../database/schema/User');
const { bot } = require('../../bot');
const { connect, clearAll, disconnect } = require('../db');

const { buildWelcomeKeyboard, userOwnsCard, handleStart } = startFlow;

beforeAll(() => connect('start-flow-test'));
beforeEach(() => {
  vi.spyOn(bot, 'sendMessage').mockResolvedValue({});
});
afterEach(async () => {
  await clearAll();
  vi.restoreAllMocks();
});
afterAll(disconnect);

// Reach into the first inline-keyboard row's primary CTA.
const primaryButton = (kbd) => kbd.inline_keyboard[0][0];

describe('buildWelcomeKeyboard', () => {
  it('shows the Add CTA (→ /onboard) when the user has no card', () => {
    const btn = primaryButton(buildWelcomeKeyboard('uk', 'tok', false));
    expect(btn.text).toBe('➕ Додати картку майстра');
    expect(btn.web_app.url).toMatch(/\/onboard\?lng=uk$/);
  });

  it('shows the Manage CTA (→ /my-cards) when the user owns a card', () => {
    const btn = primaryButton(buildWelcomeKeyboard('en', 'tok', true));
    expect(btn.text).toBe('🛠 Manage my card');
    expect(btn.web_app.url).toMatch(/\/my-cards\?lng=en$/);
  });

  it('points the website fallback link at the matching path', () => {
    const add = buildWelcomeKeyboard('uk', 'tok', false);
    const manage = buildWelcomeKeyboard('uk', 'tok', true);
    const siteUrl = (kbd) => kbd.inline_keyboard.at(-1)[0].url;
    expect(siteUrl(add)).toContain('path=add');
    expect(siteUrl(manage)).toContain('path=my-cards');
  });
});

describe('userOwnsCard', () => {
  it('is false with no card, a draft only, or a null id', async () => {
    const owner = await User.create({ telegramID: 91001 });
    expect(await userOwnsCard(owner._id)).toBe(false);

    await Master.create({ name: 'WIP', status: 'draft', ownerUserID: owner._id });
    expect(await userOwnsCard(owner._id)).toBe(false); // drafts resume the wizard
    expect(await userOwnsCard(null)).toBe(false);
  });

  it('is true for a submitted/approved/archived card', async () => {
    const owner = await User.create({ telegramID: 91002 });
    await Master.create({ name: 'Real', status: 'approved', ownerUserID: owner._id });
    expect(await userOwnsCard(owner._id)).toBe(true);
  });
});

describe('handleStart for a returning owner', () => {
  it('sends the Manage CTA to a registered user who owns a card', async () => {
    const owner = await User.create({ telegramID: 91003, token: 'jwt-x' });
    await Master.create({ name: 'Mine', status: 'approved', ownerUserID: owner._id });

    await handleStart({ chat: { id: 91003 }, from: { language_code: 'uk' } }, null);

    expect(bot.sendMessage).toHaveBeenCalledTimes(1);
    const [, , opts] = bot.sendMessage.mock.calls[0]; // (chatId, body, options)
    const btn = primaryButton(opts.reply_markup);
    expect(btn.web_app.url).toMatch(/\/my-cards\?/);
  });
});

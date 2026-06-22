import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';

const forwardLeads = require('../../bot/forwardLeads');
const forwardIntake = require('../../mining/forwardIntake');
const telegramFileToS3 = require('../../helpers/telegramFileToS3');
const { bot } = require('../../bot');
const { connect, clearAll, disconnect } = require('../db');

const {
  isForwarded,
  readForwardOrigin,
  bufferForward,
  allowForward,
  FORWARD_RATELIMIT_MAX,
  FORWARD_RATELIMIT_WINDOW_MS,
  FORWARD_BUFFER_MAX_ITEMS,
  _forwardBuffers,
  _forwardRateLog,
} = forwardLeads;

beforeAll(() => connect('forward-leads-test'));

beforeEach(() => {
  _forwardBuffers.clear();
  _forwardRateLog.clear();
  vi.spyOn(bot, 'sendMessage').mockResolvedValue({});
  vi.spyOn(forwardIntake, 'storeRawForward').mockResolvedValue({ duplicate: false });
  vi.spyOn(telegramFileToS3, 'forwardPhotoToS3').mockResolvedValue(null);
});

afterEach(async () => {
  await clearAll();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
afterAll(disconnect);

describe('isForwarded', () => {
  it('detects forward markers and contact cards', () => {
    expect(isForwarded({ forward_date: 123 })).toBe(true);
    expect(isForwarded({ forward_origin: {} })).toBe(true);
    expect(isForwarded({ forward_sender_name: 'X' })).toBe(true);
    expect(isForwarded({ contact: { phone_number: '+39' } })).toBe(true);
    // Third-party contact (user_id differs from sender) is still a lead.
    expect(
      isForwarded({ contact: { user_id: 9, phone_number: '+39' }, from: { id: 5 } })
    ).toBe(true);
    expect(isForwarded({ text: '/start' })).toBe(false);
  });

  it('ignores the sender sharing their OWN phone (onboarding share-contact)', () => {
    // requestContact() during onboarding delivers the user's own contact to the
    // bot chat — contact.user_id === from.id — and must NOT be queued as a lead.
    expect(
      isForwarded({ contact: { user_id: 5, phone_number: '+39' }, from: { id: 5 } })
    ).toBe(false);
  });
});

describe('readForwardOrigin', () => {
  it('prefers the new forward_origin shape', () => {
    expect(
      readForwardOrigin({
        forward_origin: { chat: { id: -100, title: 'Українці в Мілані' }, message_id: 7 },
      })
    ).toEqual({ chatID: -100, chatTitle: 'Українці в Мілані', messageID: 7 });
  });

  it('falls back to forward_from_chat, then to nulls', () => {
    expect(
      readForwardOrigin({
        forward_from_chat: { id: -200, title: 'Roma' },
        forward_from_message_id: 9,
      })
    ).toEqual({ chatID: -200, chatTitle: 'Roma', messageID: 9 });
    expect(readForwardOrigin({})).toEqual({ chatID: null, chatTitle: null, messageID: null });
  });
});

describe('allowForward (sliding window)', () => {
  it('admits admins unconditionally and without logging', () => {
    for (let i = 0; i < FORWARD_RATELIMIT_MAX * 2; i++) {
      expect(allowForward(1, true)).toBe(true);
    }
    expect(_forwardRateLog.has(1)).toBe(false);
  });

  it('blocks a non-admin after the max within the window', () => {
    for (let i = 0; i < FORWARD_RATELIMIT_MAX; i++) {
      expect(allowForward(2, false)).toBe(true);
    }
    expect(allowForward(2, false)).toBe(false);
  });

  it('slides the window — old entries expire', () => {
    vi.useFakeTimers();
    for (let i = 0; i < FORWARD_RATELIMIT_MAX; i++) allowForward(3, false);
    expect(allowForward(3, false)).toBe(false);

    vi.advanceTimersByTime(FORWARD_RATELIMIT_WINDOW_MS + 1000);
    expect(allowForward(3, false)).toBe(true);
  });

  it('keys the log per user', () => {
    for (let i = 0; i < FORWARD_RATELIMIT_MAX; i++) allowForward(4, false);
    expect(allowForward(4, false)).toBe(false);
    expect(allowForward(5, false)).toBe(true);
  });
});

describe('bufferForward', () => {
  it('debounces a burst into one buffered bundle', async () => {
    vi.useFakeTimers();
    const msg = (id, text) => ({
      chat: { id: 42 },
      from: { first_name: 'F' },
      message_id: id,
      text,
      forward_date: 1,
    });

    bufferForward(msg(1, 'Хто знає сантехніка?'));
    bufferForward(msg(2, 'Ось контакт: +39 333 1234567'));

    expect(_forwardBuffers.size).toBe(1);
    expect(_forwardBuffers.get(42).items).toHaveLength(2);

    vi.advanceTimersByTime(9001);
    expect(_forwardBuffers.size).toBe(0); // flushed

    // The flush runs async — wait for it to finish on THIS test's mocks so it
    // can't land on the next test's freshly-installed spies.
    vi.useRealTimers();
    await vi.waitFor(() => expect(forwardIntake.storeRawForward).toHaveBeenCalled());
  });

  it('extracts text from a forwarded contact card', () => {
    vi.useFakeTimers();
    bufferForward({
      chat: { id: 43 },
      message_id: 1,
      contact: { first_name: 'Олена', last_name: 'Ш.', phone_number: '+39 333 1234567' },
    });
    expect(_forwardBuffers.get(43).items[0].text).toBe('Олена Ш. — +39 333 1234567');
  });

  it('force-flushes when the bundle hits the item cap', async () => {
    for (let i = 0; i < FORWARD_BUFFER_MAX_ITEMS; i++) {
      bufferForward({ chat: { id: 44 }, message_id: i, text: `m${i}`, forward_date: 1 });
    }
    // Cap reached → flushed immediately, buffer cleared without waiting 9s.
    expect(_forwardBuffers.size).toBe(0);
    await vi.waitFor(() => expect(forwardIntake.storeRawForward).toHaveBeenCalled());
    expect(forwardIntake.storeRawForward.mock.calls[0][0].texts).toHaveLength(
      FORWARD_BUFFER_MAX_ITEMS
    );
  });
});

describe('flushForwardBundle', () => {
  const entry = (items, from = { first_name: 'Іра' }) => ({ items, from, timer: null });
  const item = (overrides = {}) => ({
    text: 'lead',
    messageID: 1,
    origin: { chatID: null, chatTitle: null, messageID: null },
    photoFileId: null,
    ...overrides,
  });

  it('stores the bundle and confirms to the submitter', async () => {
    await forwardLeads.flushForwardBundle(900, entry([item(), item({ messageID: 2 })]));

    expect(forwardIntake.storeRawForward).toHaveBeenCalledTimes(1);
    const stored = forwardIntake.storeRawForward.mock.calls[0][0];
    expect(stored.texts).toEqual(['lead', 'lead']);
    expect(stored.submitter).toMatchObject({ telegramID: 900, name: 'Іра', isAdmin: false });
    expect(bot.sendMessage).toHaveBeenCalledWith(900, expect.any(String));
  });

  it('uploads photos in parallel and keeps fulfilled order', async () => {
    const resolved = [];
    telegramFileToS3.forwardPhotoToS3.mockImplementation(async (fileId) => {
      resolved.push(fileId);
      return fileId === 'skip' ? null : `https://s3/${fileId}.jpg`;
    });

    await forwardLeads.flushForwardBundle(
      901,
      entry([
        item({ photoFileId: 'a' }),
        item({ photoFileId: 'skip' }),
        item({}), // no photo
        item({ photoFileId: 'b' }),
      ])
    );

    expect(telegramFileToS3.forwardPhotoToS3).toHaveBeenCalledTimes(3);
    const stored = forwardIntake.storeRawForward.mock.calls[0][0];
    expect(stored.images).toEqual(['https://s3/a.jpg', 'https://s3/b.jpg']); // null filtered, order kept
  });

  it('tells the submitter when the bundle is a duplicate', async () => {
    forwardIntake.storeRawForward.mockResolvedValue({ duplicate: true });
    await forwardLeads.flushForwardBundle(902, entry([item()]));
    expect(bot.sendMessage).toHaveBeenCalledTimes(1); // only the duplicate notice
  });

  it('rate-limits non-admin submitters at the flush boundary', async () => {
    for (let i = 0; i < FORWARD_RATELIMIT_MAX; i++) allowForward(903, false);

    await forwardLeads.flushForwardBundle(903, entry([item()]));
    expect(forwardIntake.storeRawForward).not.toHaveBeenCalled();
    expect(bot.sendMessage).toHaveBeenCalledTimes(1); // the "rate limited" notice
  });
});

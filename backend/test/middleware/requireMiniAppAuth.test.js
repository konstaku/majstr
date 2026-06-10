import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';

const buildApp = require('../../app');
const User = require('../../database/schema/User');
const { verifyInitData } = require('../../middleware/requireMiniAppAuth');
const { connect, clearAll, disconnect } = require('../db');
const { makeInitData } = require('../auth-helpers');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_USER = { id: 777001, first_name: 'Mira', username: 'mira_ua' };

let app;

beforeAll(async () => {
  await connect('miniapp-auth-test');
  app = buildApp();
});

afterEach(clearAll);
afterAll(disconnect);

describe('verifyInitData (unit)', () => {
  it('accepts a correctly signed initData payload', () => {
    const initData = makeInitData(TG_USER);
    const res = verifyInitData(initData, BOT_TOKEN);
    expect(res.ok).toBe(true);
    expect(res.user).toMatchObject({ id: 777001, first_name: 'Mira' });
    expect(res.authDate).toBeGreaterThan(0);
  });

  it('rejects a tampered hash', () => {
    const initData = makeInitData(TG_USER, { tamper: true });
    const res = verifyInitData(initData, BOT_TOKEN);
    expect(res).toEqual({ ok: false, reason: 'hash_mismatch' });
  });

  it('rejects initData signed with a different bot token', () => {
    const initData = makeInitData(TG_USER, { botToken: '99999:OTHER_TOKEN' });
    const res = verifyInitData(initData, BOT_TOKEN);
    expect(res).toEqual({ ok: false, reason: 'hash_mismatch' });
  });

  it('accepts initData when verified against the matching (rotated) token', () => {
    const prevToken = '99999:OTHER_TOKEN';
    const initData = makeInitData(TG_USER, { botToken: prevToken });
    expect(verifyInitData(initData, prevToken).ok).toBe(true);
  });

  it('rejects an auth_date older than 24h', () => {
    const initData = makeInitData(TG_USER, {
      authDate: Math.floor(Date.now() / 1000) - 25 * 60 * 60,
    });
    const res = verifyInitData(initData, BOT_TOKEN);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/^stale_auth_date/);
  });

  it('rejects when no server token is configured', () => {
    const res = verifyInitData(makeInitData(TG_USER), '');
    expect(res).toEqual({ ok: false, reason: 'no_server_token' });
  });

  it('rejects a payload without a hash', () => {
    const res = verifyInitData('user=%7B%7D&auth_date=123', BOT_TOKEN);
    expect(res).toEqual({ ok: false, reason: 'no_hash_in_initdata' });
  });
});

describe('requireMiniAppAuth (integration via GET /api/me)', () => {
  it('401s without the header', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });

  it('401s with invalid initData', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('X-Telegram-Init-Data', makeInitData(TG_USER, { tamper: true }));
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_init_data');
  });

  it('creates the user on first valid request (upsert, isAdmin=false)', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('X-Telegram-Init-Data', makeInitData(TG_USER));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      telegramID: 777001,
      firstName: 'Mira',
      username: 'mira_ua',
      isAdmin: false,
    });
    expect(await User.countDocuments({ telegramID: 777001 })).toBe(1);
  });

  it('syncs profile fields on later requests without resetting isAdmin', async () => {
    await User.create({ telegramID: 777001, firstName: 'Old', isAdmin: true });
    const res = await request(app)
      .get('/api/me')
      .set('X-Telegram-Init-Data', makeInitData({ ...TG_USER, first_name: 'Renamed' }));
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Renamed');
    expect(res.body.isAdmin).toBe(true);
    expect(await User.countDocuments({ telegramID: 777001 })).toBe(1);
  });
});

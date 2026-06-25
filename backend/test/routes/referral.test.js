import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';

// require() per the backend test convention (keeps the CJS graph native).
const buildApp = require('../../app');
const Master = require('../../database/schema/Master');
const Community = require('../../database/schema/Community');
const User = require('../../database/schema/User');
const og = require('../../helpers/generateOpenGraph');
const { bot } = require('../../bot');
const { connect, clearAll, disconnect } = require('../db');
const { makeUser } = require('../auth-helpers');

const realOgImpl = og.impl;
let app;

beforeAll(async () => {
  await connect('referral-test');
  vi.spyOn(bot, 'sendMessage').mockResolvedValue({});
  vi.spyOn(bot, 'sendPhoto').mockResolvedValue({});
  app = buildApp();
});

beforeEach(() => {
  og.impl = vi.fn(async () => 'https://test-bucket.s3.test/og.png');
});

afterEach(async () => {
  await clearAll();
  vi.clearAllMocks();
});
afterAll(async () => {
  og.impl = realOgImpl;
  await disconnect();
});

const VALID_CONTACT = { contactType: 'phone', value: '+33 6 12 34 56 78' };

async function seedCommunity(overrides = {}) {
  return Community.create({
    id: 'beauty-ukrainians',
    name: 'УКРАЇНСЬКІ КРАСУНІ',
    handle: 'beautyforUkrainians',
    url: 'https://t.me/beautyforUkrainians',
    countryID: 'FR',
    inviteToken: 'tok123',
    inviteExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // +1h
    active: true,
    ...overrides,
  });
}

async function makeDraft(user) {
  await Master.create({
    ownerUserID: user._id,
    telegramID: user.telegramID,
    status: 'draft',
    name: 'Катерина',
    professionID: 'makeup-artist',
    contacts: [VALID_CONTACT],
  });
}

describe('POST /api/referral', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/referral').send({ token: 'tok123' });
    expect(res.status).toBe(401);
  });

  it('stamps the user when the token is valid and in-campaign', async () => {
    await seedCommunity();
    const { user, authHeader } = await makeUser();

    const res = await request(app)
      .post('/api/referral')
      .set('Authorization', authHeader)
      .send({ token: 'tok123' });

    expect(res.status).toBe(200);
    expect(res.body.attached).toBe(true);
    const fresh = await User.findById(user._id);
    expect(fresh.referredCommunity.communityId).toBe('beauty-ukrainians');
    expect(fresh.referredCommunity.expiresAt).toBeInstanceOf(Date);
  });

  it('caps the personal window at the campaign cutoff', async () => {
    const cutoff = new Date(Date.now() + 30 * 60 * 1000); // +30m, sooner than 48h
    await seedCommunity({ inviteExpiresAt: cutoff });
    const { user, authHeader } = await makeUser();

    await request(app)
      .post('/api/referral')
      .set('Authorization', authHeader)
      .send({ token: 'tok123' });

    const fresh = await User.findById(user._id);
    expect(fresh.referredCommunity.expiresAt.getTime()).toBe(cutoff.getTime());
  });

  it('is a quiet no-op for an unknown token', async () => {
    await seedCommunity();
    const { user, authHeader } = await makeUser();

    const res = await request(app)
      .post('/api/referral')
      .set('Authorization', authHeader)
      .send({ token: 'nope' });

    expect(res.status).toBe(200);
    expect(res.body.attached).toBe(false);
    const fresh = await User.findById(user._id);
    expect(fresh.referredCommunity?.communityId ?? null).toBeNull();
  });

  it('does not honor an expired campaign', async () => {
    await seedCommunity({ inviteExpiresAt: new Date(Date.now() - 1000) });
    const { authHeader } = await makeUser();

    const res = await request(app)
      .post('/api/referral')
      .set('Authorization', authHeader)
      .send({ token: 'tok123' });

    expect(res.body.attached).toBe(false);
  });
});

describe('submitDraft consumes the referral', () => {
  it('attaches communityIds when the stamp is live, then clears it', async () => {
    await seedCommunity();
    const { user, authHeader } = await makeUser({
      referredCommunity: {
        communityId: 'beauty-ukrainians',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await makeDraft(user);

    const res = await request(app)
      .post('/api/masters/draft/submit')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    const master = await Master.findById(res.body.masterID);
    expect(master.communityIds).toContain('beauty-ukrainians');

    // Stamp consumed → a second card wouldn't get a free badge.
    const fresh = await User.findById(user._id);
    expect(fresh.referredCommunity.communityId).toBeNull();
  });

  it('does not attach when the stamp has expired', async () => {
    await seedCommunity();
    const { user, authHeader } = await makeUser({
      referredCommunity: {
        communityId: 'beauty-ukrainians',
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await makeDraft(user);

    const res = await request(app)
      .post('/api/masters/draft/submit')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    const master = await Master.findById(res.body.masterID);
    expect(master.communityIds || []).not.toContain('beauty-ukrainians');
  });
});

import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';

const buildApp = require('../../app');
const Master = require('../../database/schema/Master');
const MasterClaim = require('../../database/schema/MasterClaim');
const MasterAudit = require('../../database/schema/MasterAudit');
const { bot } = require('../../bot');
const { connect, clearAll, disconnect } = require('../db');
const { makeUser } = require('../auth-helpers');

let app;

beforeAll(async () => {
  await connect('claims-test');
  // The one-pending-claim-per-master rule lives in a partial unique index.
  await MasterClaim.syncIndexes();
  app = buildApp();
});

beforeEach(() => {
  vi.spyOn(bot, 'sendMessage').mockResolvedValue({});
});

afterEach(async () => {
  await clearAll();
  vi.restoreAllMocks();
});
afterAll(disconnect);

// A scraped, claimable card. Contacts default to a phone + telegram handle.
const makeClaimable = (overrides = {}) =>
  Master.create({
    name: 'Scraped Master',
    status: 'approved',
    source: 'scraped',
    claimable: true,
    contacts: [
      { contactType: 'phone', value: '+39 333 1234567' },
      { contactType: 'telegram', value: '@MajstrOlena' },
    ],
    ...overrides,
  });

describe('POST /api/claims', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/claims').send({ masterID: 'x' });
    expect(res.status).toBe(401);
  });

  it('400s without masterID and on a malformed one', async () => {
    const { authHeader } = await makeUser();
    expect((await request(app).post('/api/claims').set('Authorization', authHeader).send({})).status).toBe(400);
    expect(
      (await request(app).post('/api/claims').set('Authorization', authHeader).send({ masterID: 'nope' })).status
    ).toBe(400);
  });

  it('404s an unknown master, 409s a non-claimable one', async () => {
    const { authHeader } = await makeUser();
    const notClaimable = await Master.create({ name: 'Own', status: 'approved', claimable: false });

    const missing = await request(app)
      .post('/api/claims')
      .set('Authorization', authHeader)
      .send({ masterID: '64b000000000000000000000' });
    expect(missing.status).toBe(404);

    const owned = await request(app)
      .post('/api/claims')
      .set('Authorization', authHeader)
      .send({ masterID: notClaimable._id });
    expect(owned.status).toBe(409);
    expect(owned.body.error).toBe('not_claimable');
  });

  it('409s when the claimant already owns ANOTHER active card (one card per owner)', async () => {
    const { user, authHeader } = await makeUser({ telegramID: 70014, username: 'majstrolena' });
    await Master.create({ name: 'Own card', status: 'approved', ownerUserID: user._id });
    const master = await makeClaimable();

    // Would auto-approve on handle match — but the ownership transfer would
    // violate the one-active-card index, so it must answer 409 cleanly.
    const res = await request(app)
      .post('/api/claims')
      .set('Authorization', authHeader)
      .send({ masterID: master._id });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('active_card_exists');

    const untouched = await Master.findById(master._id);
    expect(untouched.ownerUserID).toBeUndefined();
    expect(untouched.claimable).toBe(true);
  });

  it('409s when the caller already owns the card', async () => {
    const { user, authHeader } = await makeUser();
    const master = await makeClaimable({ ownerUserID: user._id });

    const res = await request(app)
      .post('/api/claims')
      .set('Authorization', authHeader)
      .send({ masterID: master._id });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('already_owner');
  });

  it('auto-approves on phone match (formatting-insensitive) and transfers ownership', async () => {
    const { user, authHeader } = await makeUser({ telegramID: 70001, username: 'someone_else' });
    const master = await makeClaimable();

    const res = await request(app)
      .post('/api/claims')
      .set('Authorization', authHeader)
      .send({ masterID: master._id, phone: '0039-333-12-345-67' });

    expect(res.status).toBe(201);
    expect(res.body.autoApproved).toBe(true);
    expect(res.body.claim.status).toBe('approved');

    const updated = await Master.findById(master._id);
    expect(String(updated.ownerUserID)).toBe(String(user._id));
    expect(updated.telegramID).toBe(70001);
    expect(updated.claimable).toBe(false);
    expect(updated.claimedAt).toBeInstanceOf(Date);

    const audit = await MasterAudit.findOne({ masterID: master._id });
    expect(audit.action).toBe('edit');
  });

  it('auto-approves on telegram handle match (case/@-insensitive)', async () => {
    const { user, authHeader } = await makeUser({ telegramID: 70002, username: 'majstrolena' });
    const master = await makeClaimable();

    const res = await request(app)
      .post('/api/claims')
      .set('Authorization', authHeader)
      .send({ masterID: master._id });

    expect(res.status).toBe(201);
    expect(res.body.autoApproved).toBe(true);
    expect(String((await Master.findById(master._id)).ownerUserID)).toBe(String(user._id));
  });

  it('auto-approves when the master telegramID equals the claimant id', async () => {
    const { authHeader } = await makeUser({ telegramID: 70003, username: 'nomatch' });
    const master = await makeClaimable({ telegramID: 70003 });

    const res = await request(app)
      .post('/api/claims')
      .set('Authorization', authHeader)
      .send({ masterID: master._id });
    expect(res.body.autoApproved).toBe(true);
  });

  it('queues a claim with no matching signal as pending and leaves the card untouched', async () => {
    const { authHeader } = await makeUser({ telegramID: 70004, username: 'stranger' });
    const master = await makeClaimable();

    const res = await request(app)
      .post('/api/claims')
      .set('Authorization', authHeader)
      .send({ masterID: master._id, phone: '+39 999 0000000', notes: 'this is my card' });

    expect(res.status).toBe(201);
    expect(res.body.autoApproved).toBe(false);
    expect(res.body.claim.status).toBe('pending');
    expect(res.body.claim.evidence.map((e) => e.type).sort()).toEqual([
      'other',
      'phone_match',
      'social_handle',
    ]);

    const untouched = await Master.findById(master._id);
    expect(untouched.ownerUserID).toBeUndefined();
    expect(untouched.claimable).toBe(true);
  });

  it('always queues admin claims, even with a matching phone (paper-trail rule)', async () => {
    const { authHeader } = await makeUser({ telegramID: 70005, isAdmin: true });
    const master = await makeClaimable();

    const res = await request(app)
      .post('/api/claims')
      .set('Authorization', authHeader)
      .send({ masterID: master._id, phone: '+39 333 1234567' });
    expect(res.status).toBe(201);
    expect(res.body.autoApproved).toBe(false);
    expect(res.body.claim.status).toBe('pending');
  });

  it('409s a second claim while one is pending for the same master', async () => {
    const first = await makeUser({ telegramID: 70006, username: 'aaa' });
    const second = await makeUser({ telegramID: 70007, username: 'bbb' });
    const master = await makeClaimable();

    const r1 = await request(app)
      .post('/api/claims')
      .set('Authorization', first.authHeader)
      .send({ masterID: master._id });
    expect(r1.body.claim.status).toBe('pending');

    const r2 = await request(app)
      .post('/api/claims')
      .set('Authorization', second.authHeader)
      .send({ masterID: master._id });
    expect(r2.status).toBe(409);
    expect(r2.body.error).toBe('claim_already_pending');
  });
});

describe('GET /api/claims/mine', () => {
  it('returns only the caller’s claims, newest first', async () => {
    const { user, authHeader } = await makeUser({ telegramID: 70008 });
    const other = await makeUser({ telegramID: 70009 });
    const m1 = await makeClaimable();
    const m2 = await makeClaimable({ contacts: [{ contactType: 'phone', value: '+39 111 1111111' }] });

    const a = await MasterClaim.create({
      masterID: m1._id, claimantUserID: user._id, claimantTelegramID: 70008, status: 'withdrawn',
    });
    await new Promise((r) => setTimeout(r, 5));
    const b = await MasterClaim.create({
      masterID: m2._id, claimantUserID: user._id, claimantTelegramID: 70008, status: 'pending',
    });
    await MasterClaim.create({
      masterID: m1._id, claimantUserID: other.user._id, claimantTelegramID: 70009, status: 'approved',
    });

    const res = await request(app).get('/api/claims/mine').set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.claims.map((c) => c._id)).toEqual([String(b._id), String(a._id)]);
  });
});

describe('DELETE /api/claims/:id (withdraw)', () => {
  it('withdraws an own pending claim', async () => {
    const { user, authHeader } = await makeUser({ telegramID: 70010 });
    const master = await makeClaimable();
    const claim = await MasterClaim.create({
      masterID: master._id, claimantUserID: user._id, claimantTelegramID: 70010, status: 'pending',
    });

    const res = await request(app).delete(`/api/claims/${claim._id}`).set('Authorization', authHeader);
    expect(res.status).toBe(204);
    expect((await MasterClaim.findById(claim._id)).status).toBe('withdrawn');
  });

  it('403s withdrawing someone else’s claim', async () => {
    const owner = await makeUser({ telegramID: 70011 });
    const intruder = await makeUser({ telegramID: 70012 });
    const master = await makeClaimable();
    const claim = await MasterClaim.create({
      masterID: master._id, claimantUserID: owner.user._id, claimantTelegramID: 70011, status: 'pending',
    });

    const res = await request(app).delete(`/api/claims/${claim._id}`).set('Authorization', intruder.authHeader);
    expect(res.status).toBe(403);
  });

  it('409s a non-pending claim, 400/404 bad ids', async () => {
    const { user, authHeader } = await makeUser({ telegramID: 70013 });
    const master = await makeClaimable();
    const approved = await MasterClaim.create({
      masterID: master._id, claimantUserID: user._id, claimantTelegramID: 70013, status: 'approved',
    });

    expect((await request(app).delete(`/api/claims/${approved._id}`).set('Authorization', authHeader)).status).toBe(409);
    expect((await request(app).delete('/api/claims/garbage').set('Authorization', authHeader)).status).toBe(400);
    expect(
      (await request(app).delete('/api/claims/64b000000000000000000000').set('Authorization', authHeader)).status
    ).toBe(404);
  });
});

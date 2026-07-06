// Phase 1 — Recommendation data foundation: the idempotent attach helper and
// the seed-on-accept branch in the mining-review publish flow.
process.env.REVALIDATE_SECRET = 'test-revalidate-secret';

import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';

const buildApp = require('../../app');
const Master = require('../../database/schema/Master');
const Recommendation = require('../../database/schema/Recommendation');
const miningDb = require('../../database/miningDb');
const og = require('../../helpers/generateOpenGraph');
const {
  attachRecommendation,
  recountMaster,
  normalizeNameKey,
} = require('../../helpers/recommendations');
const { connect, clearAll, disconnect } = require('../db');
const { makeUser } = require('../auth-helpers');

const realOgImpl = og.impl;
let app;

beforeAll(async () => {
  await connect('mining-recommendation-test');
  app = buildApp();
});

beforeEach(() => {
  og.impl = vi.fn(async () => 'https://test-bucket.s3.test/og.png');
  // Keep the t.me photo scrape + ISR revalidate offline.
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
});

afterEach(async () => {
  await clearAll();
  await miningDb.Candidate().deleteMany({});
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(async () => {
  og.impl = realOgImpl;
  await disconnect();
});

let nextMsg = 500;
const makeCandidate = (over = {}) =>
  miningDb.Candidate().create({
    chatID: '-100999',
    sourceType: 'thread_answer',
    anchorMessageID: nextMsg++, // unique (chatID, anchorMessageID)
    status: 'new',
    kind: 'recommendation',
    responderName: 'Ірина П.',
    text: 'рекомендую Олега, дуже добре робить',
    extracted: { name: 'Олег', profession: 'plumber', city: 'milan' },
    ...over,
  });

const payload = (value) => ({
  master: {
    name: 'Олег Сантехнік',
    professionID: 'plumber',
    locationID: 'milan',
    countryID: 'IT',
    contacts: [{ contactType: 'telegram', value }],
  },
});

describe('recommendations helper', () => {
  it('counts once per distinct author and updates text on re-attach', async () => {
    const m = await Master.create({ name: 'M', status: 'approved' });

    const a = await attachRecommendation({
      masterID: m._id, authorKey: 'name:ірина п.', authorName: 'Ірина П.', text: '',
    });
    expect(a.created).toBe(true);

    // Same author again — no double count, but text is updated in place.
    const b = await attachRecommendation({
      masterID: m._id, authorKey: 'name:ірина п.', text: 'оновлений відгук',
    });
    expect(b.created).toBe(false);

    const c = await attachRecommendation({
      masterID: m._id, authorKey: 'name:тарас в.', authorName: 'Тарас В.',
    });
    expect(c.created).toBe(true);

    const fresh = await Master.findById(m._id);
    expect(fresh.recommendationCount).toBe(2); // two distinct authors
    expect(await Recommendation.countDocuments({ masterID: m._id })).toBe(2);
    const irina = await Recommendation.findOne({ masterID: m._id, authorKey: 'name:ірина п.' });
    expect(irina.text).toBe('оновлений відгук'); // updated, not duplicated
  });

  it('recountMaster repairs a drifted count', async () => {
    const m = await Master.create({ name: 'M2', status: 'approved', recommendationCount: 99 });
    await Recommendation.create({ masterID: m._id, authorKey: 'name:x' });
    const n = await recountMaster(m._id);
    expect(n).toBe(1);
    expect((await Master.findById(m._id)).recommendationCount).toBe(1);
  });

  it('normalizeNameKey collapses case/whitespace; empty name → empty key', () => {
    expect(normalizeNameKey('  Ірина   П. ')).toBe('name:ірина п.');
    expect(normalizeNameKey('   ')).toBe('');
  });
});

describe('POST accept — recommendation seeding', () => {
  it('seeds one count-only recommendation for a kind:recommendation candidate', async () => {
    const { authHeader } = await makeUser({ isAdmin: true, telegramID: 70001 });
    const cand = await makeCandidate();

    const res = await request(app)
      .post(`/api/mining/candidates/${cand._id}/accept`)
      .set('Authorization', authHeader)
      .send(payload('@oleh_1'));
    expect(res.status).toBeLessThan(300);

    const master = await Master.findOne({ name: 'Олег Сантехнік' });
    expect(master.recommendationCount).toBe(1);

    const rec = await Recommendation.findOne({ masterID: master._id });
    expect(rec.authorName).toBe('Ірина П.');
    expect(rec.authorKey).toBe('name:ірина п.');
    expect(rec.text).toBe(''); // count-only until curated in review
    expect(rec.sourceType).toBe('thread_answer');
    expect(String(rec.candidateRef)).toBe(String(cand._id));
  });

  it('does NOT seed a recommendation for an announcement (self-promoted)', async () => {
    const { authHeader } = await makeUser({ isAdmin: true, telegramID: 70002 });
    const cand = await makeCandidate({ kind: 'announcement', responderName: 'Олег' });

    const res = await request(app)
      .post(`/api/mining/candidates/${cand._id}/accept`)
      .set('Authorization', authHeader)
      .send(payload('@oleh_2'));
    expect(res.status).toBeLessThan(300);

    const master = await Master.findOne({ name: 'Олег Сантехнік' });
    expect(master.recommendationCount).toBe(0);
    expect(await Recommendation.countDocuments({ masterID: master._id })).toBe(0);
  });
});

describe('POST /api/mining/candidates/:id/attach', () => {
  it('attaches a recommendation (with edited text) to an existing master', async () => {
    const { authHeader } = await makeUser({ isAdmin: true, telegramID: 71001 });
    const master = await Master.create({ name: 'Георгій', status: 'approved' });
    const cand = await makeCandidate({ responderName: 'Богдан С.' });

    const res = await request(app)
      .post(`/api/mining/candidates/${cand._id}/attach`)
      .set('Authorization', authHeader)
      .send({ masterID: String(master._id), text: 'теж рекомендую, приїхав швидко' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ created: true, recommendationCount: 1 });

    const rec = await Recommendation.findOne({ masterID: master._id });
    expect(rec.authorName).toBe('Богдан С.');
    expect(rec.text).toBe('теж рекомендую, приїхав швидко');

    const carded = await miningDb.Candidate().findById(cand._id);
    expect(carded.status).toBe('carded');
    expect(String(carded.masterRef)).toBe(String(master._id));
  });

  it('one recommender counts once even across two candidates', async () => {
    const { authHeader } = await makeUser({ isAdmin: true, telegramID: 71002 });
    const master = await Master.create({ name: 'Андрій', status: 'approved' });
    const c1 = await makeCandidate({ responderName: 'Ната Д.' });
    const c2 = await makeCandidate({ responderName: 'Ната Д.' });

    await request(app).post(`/api/mining/candidates/${c1._id}/attach`)
      .set('Authorization', authHeader).send({ masterID: String(master._id) });
    const r2 = await request(app).post(`/api/mining/candidates/${c2._id}/attach`)
      .set('Authorization', authHeader).send({ masterID: String(master._id) });

    expect(r2.body).toMatchObject({ created: false, recommendationCount: 1 });
    expect((await Master.findById(master._id)).recommendationCount).toBe(1);
  });

  it('404s on a missing master and 409s once the candidate is resolved', async () => {
    const { authHeader } = await makeUser({ isAdmin: true, telegramID: 71003 });
    const master = await Master.create({ name: 'Роман', status: 'approved' });
    const cand = await makeCandidate({ responderName: 'Павло Н.' });

    const missing = await request(app).post(`/api/mining/candidates/${cand._id}/attach`)
      .set('Authorization', authHeader).send({ masterID: '000000000000000000000000' });
    expect(missing.status).toBe(404);

    await request(app).post(`/api/mining/candidates/${cand._id}/attach`)
      .set('Authorization', authHeader).send({ masterID: String(master._id) });
    const again = await request(app).post(`/api/mining/candidates/${cand._id}/attach`)
      .set('Authorization', authHeader).send({ masterID: String(master._id) });
    expect(again.status).toBe(409);
  });

  it('rejects non-admin callers', async () => {
    const { authHeader } = await makeUser({ isAdmin: false, telegramID: 71004 });
    const master = await Master.create({ name: 'Ігор', status: 'approved' });
    const cand = await makeCandidate();
    const res = await request(app).post(`/api/mining/candidates/${cand._id}/attach`)
      .set('Authorization', authHeader).send({ masterID: String(master._id) });
    expect(res.status).toBe(403);
  });
});

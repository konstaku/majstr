// Phase 2 — the master-centric recommendation queue: signals grouped by target.
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';

const buildApp = require('../../app');
const Master = require('../../database/schema/Master');
const miningDb = require('../../database/miningDb');
const { connect, clearAll, disconnect } = require('../db');
const { makeUser } = require('../auth-helpers');

let app;

beforeAll(async () => {
  await connect('mining-buckets-test');
  app = buildApp();
  // Finish background index builds before the fast test body runs, so afterAll's
  // disconnect() can't force-close the connection mid-createIndex.
  await Master.init();
});
afterEach(async () => {
  await clearAll();
  await miningDb.Candidate().deleteMany({});
});
afterAll(async () => { await disconnect(); });

let nextMsg = 800;
const rec = (over = {}) =>
  miningDb.Candidate().create({
    chatID: '-100777',
    sourceType: 'thread_answer',
    anchorMessageID: nextMsg++,
    status: 'new',
    kind: 'recommendation',
    responderName: 'Хтось',
    text: 'рекомендую',
    extracted: { name: 'Хтось', contacts: [] },
    ...over,
  });

describe('GET /api/mining/recommendation-buckets', () => {
  it('groups signals by target master, most-recommended first', async () => {
    const geo = await Master.create({
      name: 'Георгій', status: 'approved',
      contacts: [{ contactType: 'telegram', value: '@georgy' }],
    });

    // Two people point at Georgy by his handle → one existing bucket, size 2.
    await rec({ responderName: 'Ірина П.', extracted: { name: 'x', contacts: [{ contactType: 'telegram', value: '@georgy' }] } });
    await rec({ responderName: 'Тарас В.', extracted: { name: 'y', contacts: [{ contactType: 'telegram', value: '@georgy' }] } });
    // One points at a not-yet-listed master → a proposed bucket, size 1.
    await rec({ responderName: 'Оля Д.', extracted: { name: 'Новий Майстер', contacts: [{ contactType: 'telegram', value: '@brand_new' }] } });

    const { authHeader } = await makeUser({ isAdmin: true, telegramID: 72001 });
    const res = await request(app)
      .get('/api/mining/recommendation-buckets')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.totalSignals).toBe(3);
    expect(res.body.buckets).toHaveLength(2);

    // Ordered by pending count: the Georgy bucket (2) leads the proposed one (1).
    const [first, second] = res.body.buckets;
    expect(first.type).toBe('existing');
    expect(first.masterId).toBe(String(geo._id));
    expect(first.pendingCount).toBe(2);
    expect(first.signals.map((s) => s.responderName).sort()).toEqual(['Ірина П.', 'Тарас В.']);
    expect(first.signals[0].matchType).toBe('contact');

    expect(second.type).toBe('proposed');
    expect(second.pendingCount).toBe(1);
    expect(second.clusterKey).toMatch(/^contact:/);
    expect(second.seed.responderName).toBe('Оля Д.');
  });

  it('counts orphans (no identity) separately, not as buckets', async () => {
    await rec({ responderName: null, extracted: { name: '', contacts: [] } });
    const { authHeader } = await makeUser({ isAdmin: true, telegramID: 72002 });
    const res = await request(app)
      .get('/api/mining/recommendation-buckets')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.buckets).toHaveLength(0);
    expect(res.body.orphanCount).toBe(1);
  });

  it('rejects non-admin callers', async () => {
    const { authHeader } = await makeUser({ isAdmin: false, telegramID: 72003 });
    const res = await request(app)
      .get('/api/mining/recommendation-buckets')
      .set('Authorization', authHeader);
    expect(res.status).toBe(403);
  });
});

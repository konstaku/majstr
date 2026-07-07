// Phase 2 — the recommendation resolution pass: where does a signal attach?
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';

const Master = require('../../database/schema/Master');
const {
  resolveRecommendation,
  clusterKeyFor,
} = require('../../mining/resolveRecommendation');
const { connect, clearAll, disconnect } = require('../db');

beforeAll(async () => { await connect('resolve-rec-test'); });
afterEach(async () => { await clearAll(); });
afterAll(async () => { await disconnect(); });

const mk = (over = {}) =>
  Master.create({
    name: 'Георгій',
    professionID: 'plumber',
    locationID: 'milan',
    status: 'approved',
    ...over,
  });

describe('resolveRecommendation', () => {
  it('contact match → existing (one live master shares the handle)', async () => {
    const m = await mk({ contacts: [{ contactType: 'telegram', value: '@georgy_fix' }] });
    const r = await resolveRecommendation({
      extracted: { name: 'хтось', contacts: [{ contactType: 'telegram', value: '@georgy_fix' }] },
    });
    expect(r.status).toBe('existing');
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].masterId).toBe(String(m._id));
    expect(r.matches[0].matchType).toBe('contact');
  });

  it('same contact on two masters → ambiguous', async () => {
    await mk({ name: 'A', contacts: [{ contactType: 'phone', value: '+39 351 998 7766' }] });
    await mk({ name: 'B', contacts: [{ contactType: 'phone', value: '+39 351 998 7766' }] });
    const r = await resolveRecommendation({
      extracted: { contacts: [{ contactType: 'phone', value: '3519987766' }] },
    });
    expect(r.status).toBe('ambiguous');
    expect(r.matches.length).toBe(2);
  });

  it('name + city match → existing (suggest, admin confirms)', async () => {
    const m = await mk({ name: 'Олена', professionID: 'hairdresser', locationID: 'milan' });
    const r = await resolveRecommendation({
      extracted: { name: 'олена', contacts: [] },
      locationID: 'milan',
    });
    expect(r.status).toBe('existing');
    expect(r.matches[0].masterId).toBe(String(m._id));
    expect(r.matches[0].matchType).toBe('name');
  });

  it('name match ignores a different city', async () => {
    await mk({ name: 'Олена', locationID: 'rome' });
    const r = await resolveRecommendation({
      extracted: { name: 'Олена', contacts: [] },
      locationID: 'milan',
    });
    expect(r.status).toBe('proposed'); // no Milan match → propose a new master
  });

  it('reply-to-announcement hint → existing/thread, short-circuiting', async () => {
    const m = await mk({ name: 'Андрій' });
    const r = await resolveRecommendation({
      replyTargetMasterId: m._id,
      extracted: { name: 'ignored', contacts: [] },
    });
    expect(r.status).toBe('existing');
    expect(r.matches[0].matchType).toBe('thread');
  });

  it('no live match but has a contact → proposed with a contact clusterKey', async () => {
    const r = await resolveRecommendation({
      extracted: { name: 'Новий', contacts: [{ contactType: 'telegram', value: '@brand_new' }] },
    });
    expect(r.status).toBe('proposed');
    expect(r.clusterKey).toMatch(/^contact:/);
  });

  it('name only, no city → proposed with a name clusterKey', async () => {
    const r = await resolveRecommendation({
      extracted: { name: 'Дмитро', city: 'Мілан', contacts: [] },
    });
    expect(r.status).toBe('proposed');
    expect(r.clusterKey).toMatch(/^name:/);
  });

  it('no identity at all → orphan', async () => {
    const r = await resolveRecommendation({ extracted: { name: '', contacts: [] } });
    expect(r.status).toBe('orphan');
    expect(r.clusterKey).toBeNull();
  });

  it('clusterKeyFor groups the same person consistently', () => {
    const a = clusterKeyFor({ name: 'Дмитро', city: 'Мілан' });
    const b = clusterKeyFor({ name: '  дмитро ', city: 'мілан' });
    expect(a).toBe(b); // normalized name + city → stable group
  });
});

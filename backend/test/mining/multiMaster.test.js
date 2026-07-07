// Phase 4 — case 5: multiple masters named in one message.
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';

const haiku = require('../../mining/classifier/adapters/haiku');
const { spawnAdditionalCandidates } = require('../../mining/spawnAdditional');
const miningDb = require('../../database/miningDb');
const { connect, clearAll, disconnect } = require('../db');

describe('haiku mapResult — additional[]', () => {
  it('passes additional specialists through when useful', () => {
    const r = haiku._mapResult({
      is_useful: true,
      kind: 'recommendation',
      confidence: 0.8,
      extracted: { name: 'Олена', profession: 'перукар', city: null, contacts: [], description: null },
      additional: [
        { name: 'Марія', profession: 'манікюр', city: null, contacts: [{ contactType: 'telegram', value: '@mariia' }], description: null },
      ],
    });
    expect(r.extracted.name).toBe('Олена');
    expect(r.additional).toHaveLength(1);
    expect(r.additional[0].name).toBe('Марія');
  });

  it('drops additional when the message is not useful, and tolerates a missing field', () => {
    expect(haiku._mapResult({ is_useful: false, kind: 'none', confidence: 0.1, extracted: {}, additional: [{ name: 'X' }] }).additional).toEqual([]);
    expect(haiku._mapResult({ is_useful: true, kind: 'recommendation', confidence: 0.5, extracted: {} }).additional).toEqual([]);
  });

  it('schema requires additional and reuses the extracted shape', () => {
    expect(haiku._SCHEMA.required).toContain('additional');
    expect(haiku._SCHEMA.properties.additional.items).toBe(haiku._SCHEMA.properties.extracted);
  });
});

describe('spawnAdditionalCandidates', () => {
  beforeAll(async () => {
    await connect('multi-master-test');
    await miningDb.Candidate().init();
  });
  afterEach(async () => { await clearAll(); await miningDb.Candidate().deleteMany({}); });
  afterAll(async () => { await disconnect(); });

  const shared = {
    chatID: '-100555',
    anchorMessageID: 4242,
    sourceType: 'thread_answer',
    messageIDs: [4242],
    responderName: 'Ірина П.',
    text: 'раджу Олену @olena або Марію @mariia',
    score: 0.8,
    classifierName: 'haiku',
    classifierVersion: '3.0.0',
  };

  it('creates one sibling per additional, with subIndex 1..n, and is idempotent', async () => {
    const Candidate = miningDb.Candidate();
    // Primary lead (subIndex 0), as the classify path writes it.
    await Candidate.create({ ...shared, subIndex: 0, kind: 'recommendation', extracted: { name: 'Олена' }, status: 'new' });

    const additionals = [{ name: 'Марія', contacts: [{ contactType: 'telegram', value: '@mariia' }] }];
    const n1 = await spawnAdditionalCandidates(Candidate, shared, additionals, 'milan');
    expect(n1).toBe(1);

    const all = await Candidate.find({ chatID: shared.chatID, anchorMessageID: shared.anchorMessageID }).sort({ subIndex: 1 });
    expect(all.map((c) => c.subIndex)).toEqual([0, 1]);
    const sib = all[1];
    expect(sib.kind).toBe('recommendation');
    expect(sib.extracted.name).toBe('Марія');
    expect(sib.extracted.city).toBe('milan'); // region fallback stamped
    expect(sib.text).toBe(shared.text); // shares the source message

    // Re-run the batch — upsert on (chat, anchor, subIndex), no duplicates.
    await spawnAdditionalCandidates(Candidate, shared, additionals, 'milan');
    expect(await Candidate.countDocuments({ chatID: shared.chatID, anchorMessageID: shared.anchorMessageID })).toBe(2);
  });

  it('enforces uniqueness per (chat, anchor, subIndex)', async () => {
    const Candidate = miningDb.Candidate();
    await Candidate.create({ ...shared, subIndex: 0, extracted: {}, status: 'new' });
    // Same key again → duplicate-key error (proves the compound unique index).
    await expect(
      Candidate.create({ ...shared, subIndex: 0, extracted: {}, status: 'new' })
    ).rejects.toThrow();
  });
});

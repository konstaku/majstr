// Env must be set BEFORE requires: triggerWebRevalidate reads it at call
// time, but we also want the admin-notify branches deterministic.
process.env.REVALIDATE_SECRET = 'test-revalidate-secret';

import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';

const buildApp = require('../../app');
const Master = require('../../database/schema/Master');
const MasterAudit = require('../../database/schema/MasterAudit');
const miningDb = require('../../database/miningDb');
const og = require('../../helpers/generateOpenGraph');
const { connect, clearAll, disconnect } = require('../db');
const { makeUser } = require('../auth-helpers');

const realOgImpl = og.impl;
let app;
let ogMock;
let fetchMock;

beforeAll(async () => {
  await connect('mining-accept-test');
  app = buildApp();
});

beforeEach(() => {
  ogMock = vi.fn(async () => 'https://test-bucket.s3.test/og.png');
  og.impl = ogMock;
  // Global fetch stub: keeps the t.me photo scrape offline and captures the
  // ISR revalidate webhook calls.
  fetchMock = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  await clearAll();
  // Candidates live in the separate majstr_mining db (mongoose useDb) —
  // clearAll() only wipes the default connection's collections.
  await miningDb.Candidate().deleteMany({});
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
afterAll(async () => {
  og.impl = realOgImpl;
  await disconnect();
});

let nextMessageID = 42;
const makeCandidate = () =>
  miningDb.Candidate().create({
    chatID: '-100123',
    sourceType: 'forwarded',
    anchorMessageID: nextMessageID++, // unique (chatID, anchorMessageID) index
    status: 'new',
    extracted: { name: 'Олег', profession: 'plumber', city: 'milan' },
  });

const PAYLOAD = {
  master: {
    name: 'Олег Сантехнік',
    professionID: 'plumber',
    locationID: 'milan',
    countryID: 'IT',
    contacts: [{ contactType: 'telegram', value: '@oleh_fix' }],
    about: 'Лагоджу труби та змішувачі в Мілані.',
    languages: ['ua'],
  },
};

describe('POST /api/mining/candidates/:id/accept (publish path)', () => {
  it('publishes the master with contacts/about, generates the OG, pings ISR revalidate', async () => {
    const { authHeader } = await makeUser({ isAdmin: true });
    const cand = await makeCandidate();

    const res = await request(app)
      .post(`/api/mining/candidates/${cand._id}/accept`)
      .set('Authorization', authHeader)
      .send(PAYLOAD);
    expect(res.status).toBeLessThan(300);

    const created = await Master.findOne({ name: 'Олег Сантехнік' });
    expect(created).not.toBeNull();
    expect(created.status).toBe('approved');
    expect(created.claimable).toBe(true);
    expect(created.about).toBe('Лагоджу труби та змішувачі в Мілані.');
    expect(created.contacts.map((c) => c.value)).toEqual(['@oleh_fix']);
    expect(created.verified).toBe(false); // verification only via claim flow

    // Background chain: OG generated and stored even though the photo
    // scrape failed (fetch stubbed to 404).
    await vi.waitFor(async () => {
      expect(ogMock).toHaveBeenCalled();
      const updated = await Master.findById(created._id);
      expect(updated.OGimage).toBe('https://test-bucket.s3.test/og.png');
    });

    // ISR revalidate fired: immediately after publish AND after the OG chain.
    await vi.waitFor(() => {
      const revalidateCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('/api/revalidate?secret=test-revalidate-secret')
      );
      expect(revalidateCalls.length).toBe(2);
      expect(revalidateCalls[0][1]).toMatchObject({ method: 'POST' });
    });

    const audit = await MasterAudit.findOne({ masterID: created._id });
    expect(audit).toMatchObject({ action: 'approve', reason: 'mining-review' });

    const cardedCand = await miningDb.Candidate().findById(cand._id);
    expect(cardedCand.status).toBe('carded');
    expect(String(cardedCand.masterRef)).toBe(String(created._id));
  });

  it('refuses to publish a duplicate contact unless forced', async () => {
    const { authHeader } = await makeUser({ isAdmin: true, telegramID: 90001 });
    await Master.create({
      name: 'Existing',
      status: 'approved',
      contacts: [{ contactType: 'telegram', value: '@oleh_fix' }],
    });
    const cand = await makeCandidate();

    const res = await request(app)
      .post(`/api/mining/candidates/${cand._id}/accept`)
      .set('Authorization', authHeader)
      .send(PAYLOAD);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('duplicate_master');
  });

  it('rejects non-admin callers', async () => {
    const { authHeader } = await makeUser({ isAdmin: false, telegramID: 90002 });
    const cand = await makeCandidate();
    const res = await request(app)
      .post(`/api/mining/candidates/${cand._id}/accept`)
      .set('Authorization', authHeader)
      .send(PAYLOAD);
    expect(res.status).toBe(403);
  });
});

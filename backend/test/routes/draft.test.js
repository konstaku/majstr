import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';

// NOTE: app modules are loaded with require() so the whole backend graph
// stays in Node's native CJS cache (vi.mock cannot reach transitive
// requires). Chromium/S3 are kept out of tests via the og.impl seam below.
const buildApp = require('../../app');
const Master = require('../../database/schema/Master');
const MasterAudit = require('../../database/schema/MasterAudit');
const Country = require('../../database/schema/Country');
const og = require('../../helpers/generateOpenGraph');
const { bot } = require('../../bot');
const { connect, clearAll, disconnect } = require('../db');
const { makeUser } = require('../auth-helpers');

const realOgImpl = og.impl;
let app;
let ogMock;

beforeAll(async () => {
  await connect('draft-test');
  // The one-active-card-per-user rule is enforced by a partial unique index;
  // build it explicitly so the 409 path is testable against memory Mongo.
  await Master.syncIndexes();
  vi.spyOn(bot, 'sendMessage').mockResolvedValue({});
  vi.spyOn(bot, 'sendPhoto').mockResolvedValue({});
  app = buildApp();
});

beforeEach(() => {
  ogMock = vi.fn(async () => 'https://test-bucket.s3.test/og.png');
  og.impl = ogMock;
});

afterEach(async () => {
  await clearAll();
  vi.clearAllMocks();
});
afterAll(async () => {
  og.impl = realOgImpl;
  await disconnect();
});

const VALID_CONTACT = { contactType: 'phone', value: '+39 333 1234567' };

describe('GET /api/masters/draft', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/masters/draft');
    expect(res.status).toBe(401);
  });

  it('returns null when the user has no draft', async () => {
    const { authHeader } = await makeUser();
    const res = await request(app).get('/api/masters/draft').set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ draft: null });
  });
});

describe('PATCH /api/masters/draft', () => {
  it('creates a draft on first patch and upserts on subsequent ones', async () => {
    const { user, authHeader } = await makeUser();

    const first = await request(app)
      .patch('/api/masters/draft')
      .set('Authorization', authHeader)
      .send({ name: 'Олена' });
    expect(first.status).toBe(200);
    expect(first.body.draft.name).toBe('Олена');
    expect(first.body.draft.status).toBe('draft');
    expect(first.body.draft.ownerUserID).toBe(String(user._id));

    const second = await request(app)
      .patch('/api/masters/draft')
      .set('Authorization', authHeader)
      .send({ about: 'Майструю' });
    expect(second.status).toBe(200);
    expect(second.body.draft._id).toBe(first.body.draft._id);
    expect(second.body.draft.name).toBe('Олена');
    expect(second.body.draft.about).toBe('Майструю');
  });

  it.each([
    ['string field as object (NoSQL injection)', { name: { $gt: '' } }, 'name'],
    ['name over 80 chars', { name: 'x'.repeat(81) }, 'name'],
    ['about over 1000 chars', { about: 'x'.repeat(1001) }, 'about'],
    ['tags as array', { tags: ['a'] }, 'tags'],
    ['tags with injection keys', { tags: { $set: { a: 1 } } }, 'tags'],
    ['too many tags', { tags: { ua: Array(15).fill('t'), en: Array(6).fill('t') } }, 'tags'],
    ['languages as string', { languages: 'uk' }, 'languages'],
    ['contacts not an array', { contacts: 'call me' }, 'contacts'],
    ['more than 5 contacts', { contacts: Array(6).fill(VALID_CONTACT) }, 'contacts'],
    ['malformed contact entry', { contacts: [{ contactType: 'phone' }] }, 'contacts'],
    ['contact with injection keys', { contacts: [{ contactType: 'a', value: 'b', $where: '1' }] }, 'contacts'],
    ['unknown availability', { availability: 'sometimes' }, 'availability'],
  ])('rejects %s with 422', async (_label, body, field) => {
    const { authHeader } = await makeUser();
    const res = await request(app)
      .patch('/api/masters/draft')
      .set('Authorization', authHeader)
      .send(body);
    expect(res.status).toBe(422);
    expect(res.body.errors).toHaveProperty(field);
  });

  it('persists a known countryID', async () => {
    await Country.create({ id: 'FR', name: { en: 'France' } });
    const { authHeader } = await makeUser();
    const res = await request(app)
      .patch('/api/masters/draft')
      .set('Authorization', authHeader)
      .send({ name: 'Marie', countryID: 'FR' });
    expect(res.status).toBe(200);
    expect(res.body.draft.countryID).toBe('FR');
  });

  it('rejects an unknown countryID with 422', async () => {
    await Country.create({ id: 'FR', name: { en: 'France' } });
    const { authHeader } = await makeUser();
    const res = await request(app)
      .patch('/api/masters/draft')
      .set('Authorization', authHeader)
      .send({ name: 'Typo', countryID: 'XX' });
    expect(res.status).toBe(422);
    expect(res.body.errors).toHaveProperty('countryID');
  });

  it('returns 409 active_master_exists when the user already has a live card', async () => {
    const { user, authHeader } = await makeUser();
    await Master.create({
      name: 'Live card',
      ownerUserID: user._id,
      telegramID: user.telegramID,
      status: 'approved',
      contacts: [VALID_CONTACT],
    });

    const res = await request(app)
      .patch('/api/masters/draft')
      .set('Authorization', authHeader)
      .send({ name: 'New draft' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'active_master_exists' });
  });
});

describe('DELETE /api/masters/draft', () => {
  it('deletes the draft and returns 204', async () => {
    const { user, authHeader } = await makeUser();
    await Master.create({ ownerUserID: user._id, status: 'draft', name: 'tmp' });

    const res = await request(app).delete('/api/masters/draft').set('Authorization', authHeader);
    expect(res.status).toBe(204);
    expect(await Master.countDocuments({ ownerUserID: user._id })).toBe(0);
  });
});

describe('POST /api/masters/draft/submit', () => {
  it('404s when there is no draft', async () => {
    const { authHeader } = await makeUser();
    const res = await request(app)
      .post('/api/masters/draft/submit')
      .set('Authorization', authHeader);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'no_draft' });
  });

  it('422s with a field map when required fields are missing', async () => {
    const { user, authHeader } = await makeUser();
    await Master.create({ ownerUserID: user._id, status: 'draft' });

    const res = await request(app)
      .post('/api/masters/draft/submit')
      .set('Authorization', authHeader);
    expect(res.status).toBe(422);
    expect(res.body.errors).toMatchObject({
      name: 'required',
      professionID: 'required',
      contacts: expect.any(String),
    });
  });

  it('submits a complete draft → pending, writes audit, generates OG', async () => {
    const { user, authHeader } = await makeUser();
    await Master.create({
      ownerUserID: user._id,
      telegramID: user.telegramID,
      status: 'draft',
      name: 'Олена Швачка',
      professionID: 'seamstress',
      contacts: [VALID_CONTACT],
    });

    const res = await request(app)
      .post('/api/masters/draft/submit')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');

    const master = await Master.findById(res.body.masterID);
    expect(master.status).toBe('pending');
    expect(master.submittedAt).toBeInstanceOf(Date);
    expect(master.OGimage).toBe('https://test-bucket.s3.test/og.png');
    expect(ogMock).toHaveBeenCalled();

    const audit = await MasterAudit.find({ masterID: master._id });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'submit', from: 'draft', to: 'pending' });
  });

  it('still submits when OG generation fails (best-effort)', async () => {
    ogMock.mockRejectedValueOnce(new Error('chromium exploded'));
    const { user, authHeader } = await makeUser();
    await Master.create({
      ownerUserID: user._id,
      status: 'draft',
      name: 'X',
      professionID: 'plumber',
      contacts: [VALID_CONTACT],
    });

    const res = await request(app)
      .post('/api/masters/draft/submit')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
    const master = await Master.findById(res.body.masterID);
    expect(master.OGimage).toBe('');
  });

  it('auto-approves admin submissions and writes both audit rows', async () => {
    const { user, authHeader } = await makeUser({ telegramID: 555, isAdmin: true });
    await Master.create({
      ownerUserID: user._id,
      telegramID: user.telegramID,
      status: 'draft',
      name: 'Admin Master',
      professionID: 'electrician',
      contacts: [VALID_CONTACT],
    });

    const res = await request(app)
      .post('/api/masters/draft/submit')
      .set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');

    const master = await Master.findById(res.body.masterID);
    expect(master.status).toBe('approved');
    expect(master.approved).toBe(true); // pre-save hook ran
    expect(master.approvedAt).toBeInstanceOf(Date);

    const actions = (await MasterAudit.find({ masterID: master._id })).map((a) => a.action).sort();
    expect(actions).toEqual(['approve', 'submit']);
  });
});

describe('GET /api/masters/mine', () => {
  it('returns only the caller’s masters, newest-updated first', async () => {
    const { user, authHeader } = await makeUser();
    const other = await makeUser({ telegramID: 999998 });

    const a = await Master.create({ ownerUserID: user._id, status: 'archived', name: 'Old' });
    await new Promise((r) => setTimeout(r, 5));
    const b = await Master.create({ ownerUserID: user._id, status: 'draft', name: 'New' });
    await Master.create({ ownerUserID: other.user._id, status: 'draft', name: 'Foreign' });

    const res = await request(app).get('/api/masters/mine').set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(res.body.masters.map((m) => m._id)).toEqual([String(b._id), String(a._id)]);
  });
});

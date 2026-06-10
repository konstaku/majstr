import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';

const buildApp = require('../../app');
const Master = require('../../database/schema/Master');
const MasterAudit = require('../../database/schema/MasterAudit');
const og = require('../../helpers/generateOpenGraph');
const { connect, clearAll, disconnect } = require('../db');
const { makeUser } = require('../auth-helpers');

const realOgImpl = og.impl;
let app;
let ogMock;

beforeAll(async () => {
  await connect('owned-master-test');
  app = buildApp();
});

beforeEach(() => {
  ogMock = vi.fn(async () => 'https://test-bucket.s3.test/og.png');
  og.impl = ogMock;
});

afterEach(async () => {
  await clearAll();
  vi.restoreAllMocks();
});
afterAll(async () => {
  og.impl = realOgImpl;
  await disconnect();
});

const makeOwned = (ownerUserID, overrides = {}) =>
  Master.create({
    name: 'My Card',
    status: 'approved',
    ownerUserID,
    professionID: 'plumber',
    contacts: [{ contactType: 'phone', value: '+39 333 1234567' }],
    ...overrides,
  });

describe('ownership gate (loadOwnedMaster)', () => {
  it('requires auth', async () => {
    const res = await request(app).patch('/api/masters/64b000000000000000000000').send({});
    expect(res.status).toBe(401);
  });

  it('404s malformed and unknown ids', async () => {
    const { authHeader } = await makeUser();
    expect(
      (await request(app).patch('/api/masters/garbage').set('Authorization', authHeader).send({})).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch('/api/masters/64b000000000000000000000')
          .set('Authorization', authHeader)
          .send({})
      ).status
    ).toBe(404);
  });

  it('403s a non-owner; lets an admin manage any card', async () => {
    const owner = await makeUser({ telegramID: 80001 });
    const stranger = await makeUser({ telegramID: 80002 });
    const admin = await makeUser({ telegramID: 80003, isAdmin: true });
    const master = await makeOwned(owner.user._id);

    const denied = await request(app)
      .patch(`/api/masters/${master._id}`)
      .set('Authorization', stranger.authHeader)
      .send({ about: 'mine now' });
    expect(denied.status).toBe(403);

    const allowed = await request(app)
      .patch(`/api/masters/${master._id}`)
      .set('Authorization', admin.authHeader)
      .send({ about: 'admin touch-up' });
    expect(allowed.status).toBe(200);
  });

  it('does not shadow the literal /draft route', async () => {
    const { authHeader } = await makeUser();
    // PATCH /api/masters/draft must hit the draft upsert, not loadOwnedMaster.
    const res = await request(app)
      .patch('/api/masters/draft')
      .set('Authorization', authHeader)
      .send({ name: 'Draft Name' });
    expect(res.status).toBe(200);
    expect(res.body.draft.name).toBe('Draft Name');
  });
});

describe('PATCH /api/masters/:id (owner edit)', () => {
  it('applies the patch, stamps lastEditedAt, writes an audit row', async () => {
    const { user, authHeader } = await makeUser({ telegramID: 80004 });
    const master = await makeOwned(user._id);

    const res = await request(app)
      .patch(`/api/masters/${master._id}`)
      .set('Authorization', authHeader)
      .send({ about: 'New about text', availability: 'busy' });

    expect(res.status).toBe(200);
    expect(res.body.master.about).toBe('New about text');
    expect(res.body.master.availability).toBe('busy');

    const updated = await Master.findById(master._id);
    expect(updated.lastEditedAt).toBeInstanceOf(Date);

    const audit = await MasterAudit.findOne({ masterID: master._id });
    expect(audit).toMatchObject({ action: 'edit', reason: 'owner edit' });
  });

  it('422s invalid patches with the draft validation rules', async () => {
    const { user, authHeader } = await makeUser({ telegramID: 80005 });
    const master = await makeOwned(user._id);

    const res = await request(app)
      .patch(`/api/masters/${master._id}`)
      .set('Authorization', authHeader)
      .send({ name: { $gt: '' }, contacts: 'call me' });
    expect(res.status).toBe(422);
    expect(res.body.errors).toHaveProperty('name');
    expect(res.body.errors).toHaveProperty('contacts');
  });

  it('regenerates the OG image when name changes, not on an about-only edit', async () => {
    const { user, authHeader } = await makeUser({ telegramID: 80006 });
    const master = await makeOwned(user._id);

    await request(app)
      .patch(`/api/masters/${master._id}`)
      .set('Authorization', authHeader)
      .send({ about: 'small tweak' });
    expect(ogMock).not.toHaveBeenCalled();

    const res = await request(app)
      .patch(`/api/masters/${master._id}`)
      .set('Authorization', authHeader)
      .send({ name: 'Renamed Card' });
    expect(res.status).toBe(200);
    expect(ogMock).toHaveBeenCalledTimes(1);
    expect((await Master.findById(master._id)).OGimage).toBe('https://test-bucket.s3.test/og.png');
  });

  it('still saves the edit when OG regeneration fails', async () => {
    ogMock.mockRejectedValueOnce(new Error('no chromium'));
    const { user, authHeader } = await makeUser({ telegramID: 80007 });
    const master = await makeOwned(user._id);

    const res = await request(app)
      .patch(`/api/masters/${master._id}`)
      .set('Authorization', authHeader)
      .send({ name: 'Renamed Anyway' });
    expect(res.status).toBe(200);
    expect((await Master.findById(master._id)).name).toBe('Renamed Anyway');
  });
});

describe('PATCH /api/masters/:id/visibility', () => {
  it('hides an approved card and restores it', async () => {
    const { user, authHeader } = await makeUser({ telegramID: 80008 });
    const master = await makeOwned(user._id);

    const hide = await request(app)
      .patch(`/api/masters/${master._id}/visibility`)
      .set('Authorization', authHeader)
      .send({ hidden: true });
    expect(hide.status).toBe(204);

    let updated = await Master.findById(master._id);
    expect(updated.status).toBe('archived');
    expect(updated.archivedAt).toBeInstanceOf(Date);

    const restore = await request(app)
      .patch(`/api/masters/${master._id}/visibility`)
      .set('Authorization', authHeader)
      .send({ hidden: false });
    expect(restore.status).toBe(204);

    updated = await Master.findById(master._id);
    expect(updated.status).toBe('approved');
    expect(updated.archivedAt).toBeUndefined();

    const actions = (await MasterAudit.find({ masterID: master._id })).map((a) => a.action).sort();
    expect(actions).toEqual(['archive', 'restore']);
  });

  it('400s a non-boolean body, 409s wrong-state transitions', async () => {
    const { user, authHeader } = await makeUser({ telegramID: 80009 });
    const pending = await makeOwned(user._id, { status: 'pending' });

    const badBody = await request(app)
      .patch(`/api/masters/${pending._id}/visibility`)
      .set('Authorization', authHeader)
      .send({ hidden: 'yes' });
    expect(badBody.status).toBe(400);

    const hidePending = await request(app)
      .patch(`/api/masters/${pending._id}/visibility`)
      .set('Authorization', authHeader)
      .send({ hidden: true });
    expect(hidePending.status).toBe(409);
    expect(hidePending.body.error).toBe('can_only_hide_approved');

    const restoreVisible = await request(app)
      .patch(`/api/masters/${pending._id}/visibility`)
      .set('Authorization', authHeader)
      .send({ hidden: false });
    expect(restoreVisible.status).toBe(409);
    expect(restoreVisible.body.error).toBe('not_hidden');
  });
});

describe('DELETE /api/masters/:id', () => {
  it('hard-deletes the card and writes an audit row', async () => {
    const { user, authHeader } = await makeUser({ telegramID: 80010 });
    const master = await makeOwned(user._id);

    const res = await request(app)
      .delete(`/api/masters/${master._id}`)
      .set('Authorization', authHeader);
    expect(res.status).toBe(204);
    expect(await Master.findById(master._id)).toBeNull();

    const audit = await MasterAudit.findOne({ masterID: master._id });
    expect(audit).toMatchObject({ action: 'edit', from: 'approved', reason: 'owner deleted card' });
  });

  it('403s a non-owner delete and leaves the card alone', async () => {
    const owner = await makeUser({ telegramID: 80011 });
    const stranger = await makeUser({ telegramID: 80012 });
    const master = await makeOwned(owner.user._id);

    const res = await request(app)
      .delete(`/api/masters/${master._id}`)
      .set('Authorization', stranger.authHeader);
    expect(res.status).toBe(403);
    expect(await Master.findById(master._id)).not.toBeNull();
  });
});

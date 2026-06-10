import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';

const buildApp = require('../../app');
const Master = require('../../database/schema/Master');
const MasterAudit = require('../../database/schema/MasterAudit');
const og = require('../../helpers/generateOpenGraph');
const { bot } = require('../../bot');
const { connect, clearAll, disconnect } = require('../db');
const { makeUser } = require('../auth-helpers');

const realOgImpl = og.impl;
let app;
let ogMock;

beforeAll(async () => {
  await connect('moderation-test');
  app = buildApp();
});

beforeEach(() => {
  ogMock = vi.fn(async () => 'https://test-bucket.s3.test/og.png');
  og.impl = ogMock;
  vi.spyOn(bot, 'sendMessage').mockResolvedValue({});
  vi.spyOn(bot, 'sendPhoto').mockResolvedValue({});
});

afterEach(async () => {
  await clearAll();
  vi.restoreAllMocks();
});
afterAll(async () => {
  og.impl = realOgImpl;
  await disconnect();
});

describe('POST /addmaster', () => {
  it('takes identity from the JWT and ignores spoofed body fields', async () => {
    const { user, authHeader } = await makeUser({ telegramID: 31337 });
    const res = await request(app)
      .post('/addmaster')
      .set('Authorization', authHeader)
      .send({
        name: 'Петро Столяр',
        professionID: 'carpenter',
        // spoofing attempts — all must be ignored
        telegramID: 1,
        ownerUserID: '64b000000000000000000000',
        status: 'approved',
        approved: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const master = await Master.findById(res.body.masterID);
    expect(master.telegramID).toBe(31337);
    expect(String(master.ownerUserID)).toBe(String(user._id));
    expect(master.status).toBe('pending');
    expect(master.approved).toBe(false);
    expect(master.source).toBe('self_submitted');
    expect(master.OGimage).toBe('https://test-bucket.s3.test/og.png');

    const audit = await MasterAudit.find({ masterID: master._id });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'submit', to: 'pending' });
  });

  it('still creates the master when OG generation fails', async () => {
    ogMock.mockRejectedValueOnce(new Error('no chromium'));
    const { authHeader } = await makeUser();
    const res = await request(app)
      .post('/addmaster')
      .set('Authorization', authHeader)
      .send({ name: 'X', professionID: 'plumber' });
    expect(res.status).toBe(200);
    const master = await Master.findById(res.body.masterID);
    expect(master.OGimage).toBe('');
  });
});

describe('POST /approve-master', () => {
  it('rejects non-admins', async () => {
    const { authHeader } = await makeUser({ isAdmin: false });
    const res = await request(app)
      .post('/approve-master')
      .set('Authorization', authHeader)
      .send({ action: 'approve', masterID: '64b000000000000000000000' });
    expect(res.status).toBe(403);
  });

  it('404s an unknown master', async () => {
    const { authHeader } = await makeUser({ isAdmin: true });
    const res = await request(app)
      .post('/approve-master')
      .set('Authorization', authHeader)
      .send({ action: 'approve', masterID: '64b000000000000000000000' });
    expect(res.status).toBe(404);
  });

  it('400s an unknown action', async () => {
    const { authHeader } = await makeUser({ isAdmin: true });
    const master = await Master.create({ name: 'M', status: 'pending' });
    const res = await request(app)
      .post('/approve-master')
      .set('Authorization', authHeader)
      .send({ action: 'promote', masterID: master._id });
    expect(res.status).toBe(400);
  });

  it('approve: flips status, writes audit, notifies the owner', async () => {
    const { authHeader } = await makeUser({ isAdmin: true, telegramID: 50001 });
    const owner = await makeUser({ telegramID: 50002 });
    const master = await Master.create({
      name: 'M',
      status: 'pending',
      telegramID: owner.user.telegramID,
    });

    const res = await request(app)
      .post('/approve-master')
      .set('Authorization', authHeader)
      .send({ action: 'approve', masterID: master._id });

    expect(res.status).toBe(200);
    const updated = await Master.findById(master._id);
    expect(updated.status).toBe('approved');
    expect(updated.approved).toBe(true);
    expect(updated.approvedAt).toBeInstanceOf(Date);

    const audit = await MasterAudit.findOne({ masterID: master._id, action: 'approve' });
    expect(audit).toMatchObject({ from: 'pending', to: 'approved' });

    // Owner notification went to the owner's telegram id
    expect(bot.sendMessage).toHaveBeenCalledWith(owner.user.telegramID, expect.any(String));
  });

  it('decline: stores the reason and notifies the owner', async () => {
    const { authHeader } = await makeUser({ isAdmin: true, telegramID: 50003 });
    const owner = await makeUser({ telegramID: 50004 });
    const master = await Master.create({
      name: 'M',
      status: 'pending',
      telegramID: owner.user.telegramID,
    });

    const res = await request(app)
      .post('/approve-master')
      .set('Authorization', authHeader)
      .send({ action: 'decline', masterID: master._id, reason: 'duplicate card' });

    expect(res.status).toBe(200);
    const updated = await Master.findById(master._id);
    expect(updated.status).toBe('rejected');
    expect(updated.rejectionReason).toBe('duplicate card');

    const audit = await MasterAudit.findOne({ masterID: master._id, action: 'reject' });
    expect(audit.reason).toBe('duplicate card');
    expect(bot.sendMessage).toHaveBeenCalledWith(owner.user.telegramID, expect.any(String));
  });
});

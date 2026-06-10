import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';

const buildApp = require('../../app');
const ProfCategory = require('../../database/schema/ProfCategory');
const { connect, clearAll, disconnect } = require('../db');
const { makeUser } = require('../auth-helpers');

let app;

beforeAll(async () => {
  await connect('require-admin-test');
  app = buildApp();
});

afterEach(clearAll);
afterAll(disconnect);

describe('requireAdmin (via POST /api/reference/professions)', () => {
  it('403s a regular user', async () => {
    const { authHeader } = await makeUser({ isAdmin: false });
    const res = await request(app)
      .post('/api/reference/professions')
      .set('Authorization', authHeader)
      .send({ name: { en: 'Welder' } });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
  });

  it('lets an admin through to the handler', async () => {
    await ProfCategory.create({ id: 'construction', name: { en: 'Construction' } });
    const { authHeader } = await makeUser({ isAdmin: true });
    const res = await request(app)
      .post('/api/reference/professions')
      .set('Authorization', authHeader)
      .send({ categoryID: 'construction', name: { en: 'Welder', ua: 'Зварювальник' } });
    expect(res.status).toBeLessThan(300);
    expect(res.body.profession ?? res.body).toMatchObject({ id: 'welder' });
  });

  it('401s an unauthenticated request before the admin check', async () => {
    const res = await request(app)
      .post('/api/reference/professions')
      .send({ name: { en: 'Welder' } });
    expect(res.status).toBe(401);
  });
});

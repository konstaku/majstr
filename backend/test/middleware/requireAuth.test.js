import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';

const buildApp = require('../../app');
const User = require('../../database/schema/User');
const { connect, clearAll, disconnect } = require('../db');
const { makeJwt } = require('../auth-helpers');

let app;

beforeAll(async () => {
  await connect('require-auth-test');
  app = buildApp();
});

afterEach(clearAll);
afterAll(disconnect);

describe('requireAuth (GET /auth)', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/auth');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'no_token' });
  });

  it('rejects a garbage token', async () => {
    const res = await request(app).get('/auth').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_token' });
  });

  it('rejects a token signed with the wrong secret', async () => {
    const jwt = require('jsonwebtoken');
    const bad = jwt.sign({ userID: 42 }, 'wrong-secret');
    const res = await request(app).get('/auth').set('Authorization', `Bearer ${bad}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'invalid_token' });
  });

  it('rejects a valid JWT when no matching user exists', async () => {
    const res = await request(app)
      .get('/auth')
      .set('Authorization', `Bearer ${makeJwt(404404)}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'user_not_found' });
  });

  it('rejects when the stored token differs (session revoked)', async () => {
    await User.create({ telegramID: 7, firstName: 'A', token: 'some-other-token' });
    const res = await request(app)
      .get('/auth')
      .set('Authorization', `Bearer ${makeJwt(7)}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'session_revoked' });
  });

  it('accepts when the stored token matches the presented one', async () => {
    const token = makeJwt(8);
    await User.create({ telegramID: 8, firstName: 'B', token });
    const res = await request(app).get('/auth').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.telegramID).toBe(8);
    expect(res.body.firstName).toBe('B');
  });

  it('accepts a token-less (TMA-created) user — revocation check skipped', async () => {
    await User.create({ telegramID: 9, firstName: 'C', token: null });
    const res = await request(app)
      .get('/auth')
      .set('Authorization', `Bearer ${makeJwt(9)}`);
    expect(res.status).toBe(200);
    expect(res.body.telegramID).toBe(9);
  });

  it('unwraps a JSON-quoted legacy token', async () => {
    const token = makeJwt(10);
    await User.create({ telegramID: 10, firstName: 'D', token });
    const res = await request(app).get('/auth').set('Authorization', `"${token}"`);
    expect(res.status).toBe(200);
    expect(res.body.telegramID).toBe(10);
  });

  it('accepts a bare token without the Bearer prefix', async () => {
    const token = makeJwt(11);
    await User.create({ telegramID: 11, firstName: 'E', token: null });
    const res = await request(app).get('/auth').set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body.telegramID).toBe(11);
  });
});

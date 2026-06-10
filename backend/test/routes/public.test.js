import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import request from 'supertest';

const buildApp = require('../../app');
const Master = require('../../database/schema/Master');
const Review = require('../../database/schema/Review');
const { refCache } = require('../../helpers/referenceCache');
const { connect, clearAll, disconnect } = require('../db');

let app;

beforeAll(async () => {
  await connect('public-test');
  app = buildApp();
});

beforeEach(() => refCache.clear());
afterEach(clearAll);
afterAll(disconnect);

describe('GET /?q=…', () => {
  it('400s without a query parameter', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(400);
    expect(res.text).toBe('Missing query parameter');
  });

  it('404s an unknown q value', async () => {
    const res = await request(app).get('/?q=nonsense');
    expect(res.status).toBe(404);
  });

  it('q=masters returns only approved masters, newest first, filtered by country', async () => {
    const approvedIT = await Master.create({ name: 'A', status: 'approved', countryID: 'IT' });
    const approvedDE = await Master.create({ name: 'B', status: 'approved', countryID: 'DE' });
    await Master.create({ name: 'C', status: 'pending', countryID: 'IT' });
    await Master.create({ name: 'D', status: 'draft', countryID: 'IT' });

    const all = await request(app).get('/?q=masters');
    expect(all.status).toBe(200);
    // newest first = _id desc
    expect(all.body.map((m) => m.name)).toEqual(['B', 'A']);

    const it_ = await request(app).get('/?q=masters&country=IT');
    expect(it_.body.map((m) => m._id)).toEqual([String(approvedIT._id)]);

    const de = await request(app).get('/?q=masters&country=DE');
    expect(de.body.map((m) => m._id)).toEqual([String(approvedDE._id)]);
  });

  it('q=newmasters returns only pending masters', async () => {
    await Master.create({ name: 'Live', status: 'approved' });
    const pending = await Master.create({ name: 'Queue', status: 'pending' });

    const res = await request(app).get('/?q=newmasters');
    expect(res.status).toBe(200);
    expect(res.body.map((m) => m._id)).toEqual([String(pending._id)]);
  });

  it('q=reviews requires a master id', async () => {
    const res = await request(app).get('/?q=reviews');
    expect(res.status).toBe(400);
    expect(res.text).toBe('Missing master ID');
  });

  it('q=reviews returns reviews for the master, newest first', async () => {
    const master = await Master.create({ name: 'M', status: 'approved' });
    await Review.create({ masterID: master._id, authorName: 'Olha', rating: 5 });
    await new Promise((r) => setTimeout(r, 5));
    await Review.create({ masterID: master._id, authorName: 'Ivan', rating: 3 });

    const res = await request(app).get(`/?q=reviews&master=${master._id}`);
    expect(res.status).toBe(200);
    expect(res.body.map((r) => r.authorName)).toEqual(['Ivan', 'Olha']);
  });
});

describe('POST /review', () => {
  it('400s when required fields are missing', async () => {
    const res = await request(app).post('/review').send({ authorName: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/);
  });

  it.each([[0], [6], ['abc']])('400s rating %s', async (rating) => {
    const master = await Master.create({ name: 'M', status: 'approved' });
    const res = await request(app)
      .post('/review')
      .send({ masterID: master._id, authorName: 'X', rating });
    expect(res.status).toBe(400);
  });

  it('404s a review for a non-approved master', async () => {
    const master = await Master.create({ name: 'M', status: 'pending' });
    const res = await request(app)
      .post('/review')
      .send({ masterID: master._id, authorName: 'X', rating: 5 });
    expect(res.status).toBe(404);
  });

  it('creates the review and recomputes the aggregate rating', async () => {
    const master = await Master.create({ name: 'M', status: 'approved' });

    const first = await request(app)
      .post('/review')
      .send({ masterID: master._id, authorName: 'Olha', rating: 5, comment: 'Чудово' });
    expect(first.status).toBe(201);
    expect(first.body.success).toBe(true);
    expect(first.body.review.rating).toBe(5);

    const second = await request(app)
      .post('/review')
      .send({ masterID: master._id, authorName: 'Ivan', rating: 4 });
    expect(second.status).toBe(201);

    const updated = await Master.findById(master._id);
    expect(updated.rating).toBe(4.5);
    expect(updated.reviewCount).toBe(2);
  });

  it('rounds the aggregate to one decimal', async () => {
    const master = await Master.create({ name: 'M', status: 'approved' });
    for (const rating of [5, 4, 4]) {
      await request(app).post('/review').send({ masterID: master._id, authorName: 'A', rating });
    }
    const updated = await Master.findById(master._id);
    expect(updated.rating).toBe(4.3); // 13/3 = 4.333…
  });
});

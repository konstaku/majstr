// Phase 3 — public recommendation quotes for the card modal carousel.
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';

const buildApp = require('../../app');
const Master = require('../../database/schema/Master');
const Recommendation = require('../../database/schema/Recommendation');
const {
  _firstNameInitial,
  _telegramMessageHref,
} = require('../../routes/recommendations');
const { connect, clearAll, disconnect } = require('../db');

let app;

beforeAll(async () => {
  await connect('master-recommendations-test');
  app = buildApp();
  await Master.init();
});
afterEach(async () => { await clearAll(); });
afterAll(async () => { await disconnect(); });

describe('firstNameInitial', () => {
  it('reduces to first name + initial, leaves single names', () => {
    expect(_firstNameInitial('Богдан Сергійович')).toBe('Богдан С.');
    expect(_firstNameInitial('Ірина П.')).toBe('Ірина П.');
    expect(_firstNameInitial('Олег')).toBe('Олег');
    expect(_firstNameInitial('  ')).toBe('');
  });
});

describe('telegramMessageHref', () => {
  it('builds a t.me/c link, dropping the -100 supergroup prefix', () => {
    expect(_telegramMessageHref('-1001234567890', 55)).toBe('https://t.me/c/1234567890/55');
    expect(_telegramMessageHref('forward:abc', 5)).toBeNull();
    expect(_telegramMessageHref(null, 5)).toBeNull();
  });
});

describe('GET /api/master/:id/recommendations', () => {
  it('returns only text recommendations, newest first, author reduced', async () => {
    const m = await Master.create({ name: 'Марія', status: 'approved', recommendationCount: 3 });
    await Recommendation.create({ masterID: m._id, authorKey: 'name:богдан с', authorName: 'Богдан Сергійович', text: 'Чудова робота', sourceChatID: '-1001234567890', sourceMessageID: 12 });
    await Recommendation.create({ masterID: m._id, authorKey: 'name:ната', authorName: 'Ната', text: '' }); // count-only — excluded
    await Recommendation.create({ masterID: m._id, authorKey: 'name:олена к', authorName: 'Олена К.', text: 'Рекомендую всім' });

    const res = await request(app).get(`/api/master/${m._id}/recommendations`);
    expect(res.status).toBe(200);
    expect(res.body.recommendations).toHaveLength(2); // the count-only one is not quoted
    const authors = res.body.recommendations.map((r) => r.author);
    expect(authors).toContain('Богдан С.');
    expect(authors).toContain('Олена К.');
    const bohdan = res.body.recommendations.find((r) => r.author === 'Богдан С.');
    expect(bohdan.href).toBe('https://t.me/c/1234567890/12');
  });

  it('400s on a malformed id', async () => {
    const res = await request(app).get('/api/master/not-an-id/recommendations');
    expect(res.status).toBe(400);
  });
});

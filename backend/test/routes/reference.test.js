import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';

const buildApp = require('../../app');
const Profession = require('../../database/schema/Profession');
const ProfCategory = require('../../database/schema/ProfCategory');
const Location = require('../../database/schema/Location');
const { refCache } = require('../../helpers/referenceCache');
const { connect, clearAll, disconnect } = require('../db');
const { makeUser } = require('../auth-helpers');

let app;

beforeAll(async () => {
  await connect('reference-test');
  app = buildApp();
});

beforeEach(() => refCache.clear());
afterEach(async () => {
  await clearAll();
  vi.restoreAllMocks();
});
afterAll(disconnect);

describe('GET /api/reference/*', () => {
  it('returns professions / locations seeded in the DB', async () => {
    await Profession.create({ id: 'plumber', name: { en: 'Plumber', ua: 'Сантехнік' } });
    await Location.create({ id: 'milan', countryID: 'IT', name: { en: 'Milan' } });

    const prof = await request(app).get('/api/reference/professions');
    expect(prof.status).toBe(200);
    expect(prof.body).toHaveLength(1);
    expect(prof.body[0].id).toBe('plumber');

    const loc = await request(app).get('/api/reference/locations?country=IT');
    expect(loc.body.map((l) => l.id)).toEqual(['milan']);

    const locDE = await request(app).get('/api/reference/locations?country=DE');
    expect(locDE.body).toEqual([]);
  });

  it('serves repeat requests from the TTL cache (no second DB query)', async () => {
    await Profession.create({ id: 'plumber', name: { en: 'Plumber' } });

    const findSpy = vi.spyOn(Profession, 'find');
    await request(app).get('/api/reference/professions');
    expect(findSpy).toHaveBeenCalledTimes(1);

    await request(app).get('/api/reference/professions');
    expect(findSpy).toHaveBeenCalledTimes(1); // cache hit
  });

  it('caches locations per country query', async () => {
    await Location.create({ id: 'milan', countryID: 'IT', name: { en: 'Milan' } });
    const findSpy = vi.spyOn(Location, 'find');

    await request(app).get('/api/reference/locations?country=IT');
    await request(app).get('/api/reference/locations?country=IT');
    expect(findSpy).toHaveBeenCalledTimes(1);

    await request(app).get('/api/reference/locations?country=DE');
    expect(findSpy).toHaveBeenCalledTimes(2); // different key
  });

  it('shares the cache with the legacy /?q= endpoints', async () => {
    await Profession.create({ id: 'plumber', name: { en: 'Plumber' } });
    const findSpy = vi.spyOn(Profession, 'find');

    await request(app).get('/api/reference/professions');
    const legacy = await request(app).get('/?q=professions');
    expect(legacy.status).toBe(200);
    expect(legacy.body[0].id).toBe('plumber');
    expect(findSpy).toHaveBeenCalledTimes(1); // legacy hit the same cache key
  });

  it('invalidates the cache when an admin creates a new entry', async () => {
    await ProfCategory.create({ id: 'construction', name: { en: 'Construction' } });
    const { authHeader } = await makeUser({ isAdmin: true });

    const before = await request(app).get('/api/reference/professions');
    expect(before.body).toEqual([]);

    const created = await request(app)
      .post('/api/reference/professions')
      .set('Authorization', authHeader)
      .send({ categoryID: 'construction', name: { en: 'Tiler', ua: 'Плиточник' } });
    expect(created.status).toBeLessThan(300);

    const after = await request(app).get('/api/reference/professions');
    expect(after.body.map((p) => p.id)).toEqual(['tiler']);
  });

  it('does not invalidate the cache on a failed admin create', async () => {
    await Profession.create({ id: 'plumber', name: { en: 'Plumber' } });
    const { authHeader } = await makeUser({ isAdmin: true });

    await request(app).get('/api/reference/professions'); // warm cache
    const findSpy = vi.spyOn(Profession, 'find');

    const bad = await request(app)
      .post('/api/reference/professions')
      .set('Authorization', authHeader)
      .send({ name: {} }); // name.en required → 400
    expect(bad.status).toBe(400);

    await request(app).get('/api/reference/professions');
    expect(findSpy).not.toHaveBeenCalled(); // still cached
  });
});

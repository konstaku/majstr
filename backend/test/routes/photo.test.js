import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';

const buildApp = require('../../app');
const photoRoutes = require('../../routes/photo');
const { connect, clearAll, disconnect } = require('../db');
const { makeUser } = require('../auth-helpers');

let app;

beforeAll(async () => {
  await connect('photo-test');
  app = buildApp();
});

beforeEach(() => {
  vi.spyOn(photoRoutes._s3, 'upload').mockReturnValue({
    promise: async () => ({ Location: 'https://test-bucket.s3.test/userpics/u.jpg' }),
  });
});

afterEach(async () => {
  await clearAll();
  vi.restoreAllMocks();
});
afterAll(disconnect);

const makeImage = (format) =>
  sharp({ create: { width: 16, height: 16, channels: 3, background: '#c14b32' } })
    [format]()
    .toBuffer();

describe('POST /api/masters/draft/photo', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/masters/draft/photo');
    expect(res.status).toBe(401);
  });

  it('400s when no file is attached', async () => {
    const { authHeader } = await makeUser();
    const res = await request(app)
      .post('/api/masters/draft/photo')
      .set('Authorization', authHeader);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'no_file' });
  });

  it('415s a non-image even when it claims an image content type (magic bytes win)', async () => {
    const { authHeader } = await makeUser();
    const res = await request(app)
      .post('/api/masters/draft/photo')
      .set('Authorization', authHeader)
      .attach('photo', Buffer.from('definitely not a picture'), {
        filename: 'fake.jpg',
        contentType: 'image/jpeg',
      });
    expect(res.status).toBe(415);
    expect(res.body.error).toBe('unsupported_media_type');
  });

  it('accepts a real PNG, resizes and uploads it', async () => {
    const { authHeader } = await makeUser();
    const res = await request(app)
      .post('/api/masters/draft/photo')
      .set('Authorization', authHeader)
      .attach('photo', await makeImage('png'), 'photo.png');
    expect(res.status).toBe(200);
    expect(res.body.photoUrl).toBe('https://test-bucket.s3.test/userpics/u.jpg');

    const uploadArgs = photoRoutes._s3.upload.mock.calls[0][0];
    expect(uploadArgs.Bucket).toBe('test-bucket');
    expect(uploadArgs.ContentType).toBe('image/jpeg'); // re-encoded by sharp
    // The uploaded body is a real JPEG produced from the PNG input.
    const meta = await sharp(uploadArgs.Body).metadata();
    expect(meta.format).toBe('jpeg');
  });

  it('accepts a real JPEG', async () => {
    const { authHeader } = await makeUser();
    const res = await request(app)
      .post('/api/masters/draft/photo')
      .set('Authorization', authHeader)
      .attach('photo', await makeImage('jpeg'), 'photo.jpg');
    expect(res.status).toBe(200);
    expect(res.body.photoUrl).toMatch(/^https:\/\//);
  });

  it('413s a file over 8 MB', async () => {
    const { authHeader } = await makeUser();
    const res = await request(app)
      .post('/api/masters/draft/photo')
      .set('Authorization', authHeader)
      .attach('photo', Buffer.alloc(8 * 1024 * 1024 + 1024, 1), 'huge.jpg');
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('file_too_large');
  });

  it('500s with upload_failed when S3 rejects', async () => {
    photoRoutes._s3.upload.mockReturnValue({
      promise: async () => {
        throw new Error('s3 down');
      },
    });
    const { authHeader } = await makeUser();
    const res = await request(app)
      .post('/api/masters/draft/photo')
      .set('Authorization', authHeader)
      .attach('photo', await makeImage('png'), 'photo.png');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'upload_failed' });
  });
});

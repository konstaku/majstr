const multer = require('multer');
const sharp = require('sharp');
const AWS = require('aws-sdk');
const { S3_BUCKET } = require('../config/s3');

// file-type is ESM-only; load it lazily via dynamic import. A bare
// require('file-type') used to resolve to node-telegram-bot-api's hoisted
// v3.9.0, which has no fileTypeFromBuffer — photo uploads then threw on
// every request.
let _fileTypeFromBuffer = null;
async function fileTypeFromBuffer(buffer) {
  if (!_fileTypeFromBuffer) {
    ({ fileTypeFromBuffer: _fileTypeFromBuffer } = await import('file-type'));
  }
  return _fileTypeFromBuffer(buffer);
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB pre-resize

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Store upload in memory so sharp can process before S3
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
}).single('photo');

function runMulter(req, res) {
  return new Promise((resolve, reject) => {
    upload(req, res, err => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return reject({ status: 413, error: 'file_too_large', detail: 'max 8 MB' });
      }
      if (err) return reject({ status: 400, error: 'upload_error', detail: err.message });
      resolve();
    });
  });
}

async function resizeAndUpload(buffer, userID) {
  const resized = await sharp(buffer)
    // Bake EXIF orientation into the pixels. Re-encoding strips the EXIF
    // tag, so without this phone photos render rotated 90°/180°.
    .rotate()
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  // Unique key per upload: a stable per-user key meant a re-upload kept the
  // same URL, so browsers showed the cached (old) photo in the preview.
  const key = `userpics/${userID}-${Date.now()}.jpg`;
  const result = await s3.upload({
    Bucket: S3_BUCKET,
    Key: key,
    Body: resized,
    ContentType: 'image/jpeg',
  }).promise();

  return result.Location;
}

async function uploadDraftPhoto(req, res) {
  try {
    await runMulter(req, res);
  } catch (err) {
    return res.status(err.status).json({ error: err.error, detail: err.detail });
  }

  if (!req.file) return res.status(400).json({ error: 'no_file' });

  // Validate MIME from magic bytes, not from Content-Type header
  const detected = await fileTypeFromBuffer(req.file.buffer);
  if (!detected || !ALLOWED_MIME.has(detected.mime)) {
    return res.status(415).json({
      error: 'unsupported_media_type',
      detail: 'only jpeg, png, webp allowed',
    });
  }

  let photoUrl;
  try {
    photoUrl = await resizeAndUpload(req.file.buffer, req.user._id);
  } catch (err) {
    console.error('Photo upload failed:', err);
    return res.status(500).json({ error: 'upload_failed' });
  }

  return res.json({ photoUrl });
}

async function uploadDraftPhotoFromTelegram(req, res) {
  // photo_url comes from live initData; fall back to the stored URL on the User doc
  const telegramPhotoUrl = req.tgInit?.user?.photo_url || req.user.photo;
  if (!telegramPhotoUrl) {
    return res.status(400).json({ error: 'no_telegram_photo' });
  }

  let buffer;
  try {
    const response = await fetch(telegramPhotoUrl);
    if (!response.ok) throw new Error(`fetch ${response.status}`);
    buffer = Buffer.from(await response.arrayBuffer());
  } catch (err) {
    console.error('Failed to fetch Telegram photo:', err);
    return res.status(502).json({ error: 'telegram_photo_fetch_failed' });
  }

  // Telegram serves JPEG but validate anyway
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_MIME.has(detected.mime)) {
    return res.status(415).json({
      error: 'unsupported_media_type',
      detail: 'unexpected format from Telegram CDN',
    });
  }

  let photoUrl;
  try {
    photoUrl = await resizeAndUpload(buffer, req.user._id);
  } catch (err) {
    console.error('Telegram photo upload failed:', err);
    return res.status(500).json({ error: 'upload_failed' });
  }

  return res.json({ photoUrl });
}

module.exports = { uploadDraftPhoto, uploadDraftPhotoFromTelegram };
// Exposed so the test suite can stub s3.upload without hitting AWS.
module.exports._s3 = s3;

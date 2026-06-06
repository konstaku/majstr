'use strict';

// Download a Telegram file (by file_id) and upload it to S3. Used by the bot to
// persist forwarded screenshots so the reviewer's machine can OCR them later
// (the bot is on a server; the temporary Telegram file URL would be gone by
// review time). Mirrors the S3 pattern in helpers/telegramPhotoByHandle.js.

const AWS = require('aws-sdk');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BUCKET = process.env.S3_BUCKET || 'chupakabra-test';

let _s3 = null;
function getS3() {
  if (_s3) return _s3;
  _s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
  return _s3;
}

// Resolve a Telegram file_id to a downloadable buffer + its extension.
async function downloadTelegramFile(fileId) {
  const infoRes = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`
  );
  const info = await infoRes.json();
  if (!info.ok || !info.result || !info.result.file_path) {
    throw new Error('getFile failed for ' + fileId);
  }
  const filePath = info.result.file_path; // e.g. "photos/file_123.jpg"
  const ext = (filePath.split('.').pop() || 'jpg').toLowerCase();
  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`
  );
  if (!fileRes.ok) throw new Error('file download HTTP ' + fileRes.status);
  const buf = Buffer.from(await fileRes.arrayBuffer());
  return { buffer: buf, ext };
}

// Download a forwarded photo and store it under forward-images/. Returns
// { url, fileId } or null on failure (logged, never throws).
async function forwardPhotoToS3(fileId, keyHint = 'img') {
  try {
    const { buffer, ext } = await downloadTelegramFile(fileId);
    const safeHint = String(keyHint).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'img';
    const key = `forward-images/${safeHint}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext === 'jpeg' ? 'jpg' : ext}`;
    const out = await getS3()
      .upload({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: ext === 'png' ? 'image/png' : 'image/jpeg',
      })
      .promise();
    return { url: out.Location, fileId };
  } catch (e) {
    console.error('[forwardPhotoToS3]', e.message);
    return null;
  }
}

module.exports = { forwardPhotoToS3, downloadTelegramFile };

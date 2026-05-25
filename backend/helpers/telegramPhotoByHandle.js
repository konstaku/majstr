'use strict';

// Fetch a Telegram user's profile photo by PUBLIC USERNAME (no GramJS needed).
// Used for scraped masters whose only Telegram identifier is an @handle — we
// don't have their numeric telegramID, so the bot.js fetchUserTelegramPhoto()
// helper (which uses getUserProfilePhotos with a numeric user_id) doesn't apply.
//
// Path:
//   1. POST /getChat { chat_id: '@username' } -> Chat with photo.{small,big}_file_id
//   2. POST /getFile { file_id: big_file_id }  -> file_path
//   3. GET  /file/bot<TOKEN>/<file_path>       -> binary
//   4. S3 upload -> scraped-photos/<masterId>.jpg
//
// Quietly tolerated failures (return { ok: false, reason }):
//   - invalid_handle               — couldn't parse a username out of the value
//   - chat_not_found / forbidden   — Telegram says no, getChat error
//   - no_photo                     — user has no public profile photo
//   - getFile_failed / download_*  — network / API errors on later steps
//
// S3: same bucket / credentials as the existing helpers. Key namespace is
// `scraped-photos/` to keep it separate from `userpics/` (interactive users).

const AWS = require('aws-sdk');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const BUCKET = process.env.S3_BUCKET || 'chupakabra-test';

let _s3 = null;
function getS3() {
  if (_s3) return _s3;
  _s3 = new AWS.S3({
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  });
  return _s3;
}

async function tgApi(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

// "@MasterX" / "https://t.me/MasterX" / "MasterX" -> "masterx"
// Telegram usernames are 5+ chars, alphanumeric + underscore, case-insensitive.
function normalizeHandle(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  const m = s.match(/(?:https?:\/\/)?(?:t\.me\/)?@?([A-Za-z][A-Za-z0-9_]{4,31})/);
  return m ? m[1].toLowerCase() : null;
}

// Pull the first telegram-shaped contact off a Master document.
function firstTelegramContact(master) {
  return (master && master.contacts ? master.contacts : []).find((c) =>
    /telegram|tg/i.test(c.contactType || '')
  );
}

async function fetchProfilePhotoByHandle(handle) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not set');
  const username = normalizeHandle(handle);
  if (!username) return { ok: false, reason: 'invalid_handle' };

  const chat = await tgApi('getChat', { chat_id: '@' + username });
  if (!chat || !chat.ok) {
    return { ok: false, reason: 'chat_' + (chat && chat.description ? slugErr(chat.description) : 'failed') };
  }
  const photo = chat.result && chat.result.photo;
  if (!photo || !photo.big_file_id) return { ok: false, reason: 'no_photo' };

  const file = await tgApi('getFile', { file_id: photo.big_file_id });
  if (!file || !file.ok) {
    return { ok: false, reason: 'getfile_' + (file && file.description ? slugErr(file.description) : 'failed') };
  }
  const path = file.result.file_path;
  if (!path) return { ok: false, reason: 'no_file_path' };

  const r = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${path}`);
  if (!r.ok) return { ok: false, reason: 'download_' + r.status };
  const buffer = Buffer.from(await r.arrayBuffer());
  return { ok: true, buffer, handle: username };
}

function slugErr(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 40);
}

async function uploadMasterPhoto(masterId, buffer) {
  const data = await getS3()
    .upload({
      Bucket: BUCKET,
      Key: `scraped-photos/${masterId}.jpg`,
      Body: buffer,
      ContentType: 'image/jpeg',
    })
    .promise();
  return data.Location;
}

// Main entry. Idempotent: skips when master.photo already set unless force.
// Always resolves — caller doesn't need its own try/catch. Returns the S3 URL
// on success, null otherwise (with a console.log line for visibility).
async function fetchAndUploadPhotoForMaster(master, { force = false } = {}) {
  try {
    if (!master || !master._id) return null;
    if (master.photo && !force) return master.photo;
    const tg = firstTelegramContact(master);
    if (!tg) {
      console.log(`[scraped-photo] ${master._id} no telegram contact — skip`);
      return null;
    }
    const r = await fetchProfilePhotoByHandle(tg.value);
    if (!r.ok) {
      console.log(`[scraped-photo] ${master._id} @${normalizeHandle(tg.value) || tg.value} → ${r.reason}`);
      return null;
    }
    const url = await uploadMasterPhoto(String(master._id), r.buffer);
    console.log(`[scraped-photo] ${master._id} @${r.handle} → ${url}`);
    return url;
  } catch (e) {
    console.error(`[scraped-photo] ${master && master._id} ${e.message}`);
    return null;
  }
}

module.exports = {
  fetchProfilePhotoByHandle,
  uploadMasterPhoto,
  fetchAndUploadPhotoForMaster,
  normalizeHandle,
  firstTelegramContact,
};

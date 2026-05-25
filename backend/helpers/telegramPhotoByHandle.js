'use strict';

// Fetch a Telegram user's profile photo by PUBLIC USERNAME for scraped masters
// who have never interacted with our bot. We can't use the Bot API for this:
// `getChat('@username')` returns `chat_not_found` for any user who hasn't
// started the bot — verified against 49 real handles, 0 of 49 succeeded.
//
// Working path: the t.me public profile page. https://t.me/<handle> serves
// HTML with an `og:image` meta tag pointing to the user's profile photo on
// the Telegram CDN (telesco.pe). For users with restrictive privacy or no
// photo, the og:image falls back to Telegram's default logo — we filter that.
//
// Path:
//   1. GET https://t.me/<handle>      -> HTML page
//   2. parse og:image meta -> CDN URL
//   3. filter out default logo (user has no public photo)
//   4. GET the CDN URL                -> JPEG bytes
//   5. S3 upload -> scraped-photos/<masterId>.jpg
//
// Quietly tolerated failures (return { ok: false, reason }):
//   - invalid_handle  — couldn't parse a username out of the value
//   - page_<status>   — HTTP error fetching the t.me page (404 = no such user)
//   - no_og_image     — page didn't contain an og:image (rare)
//   - default_logo    — user has no public photo (default Telegram logo served)
//   - download_<status> — network error downloading the actual image
//
// This is web scraping, not an API. If Telegram changes the t.me page layout,
// we adjust the regex. The Bot API path is gone — it doesn't work for our
// use case. GramJS (#103) would be the proper API, but is not needed here.

const AWS = require('aws-sdk');

const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const BUCKET = process.env.S3_BUCKET || 'chupakabra-test';
// Some servers reject default fetch UAs; spoof a normal browser.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

let _s3 = null;
function getS3() {
  if (_s3) return _s3;
  _s3 = new AWS.S3({
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  });
  return _s3;
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

// Telegram's default profile logo for users with no public photo / private
// account. Looks like `https://telegram.org/img/t_logo_2x.png`.
function isDefaultLogo(url) {
  return /telegram\.org\/img\/t_logo/i.test(String(url || ''));
}

async function fetchProfilePhotoByHandle(handle) {
  const username = normalizeHandle(handle);
  if (!username) return { ok: false, reason: 'invalid_handle' };

  const pageRes = await fetch(`https://t.me/${username}`, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
  });
  if (!pageRes.ok) return { ok: false, reason: 'page_' + pageRes.status };

  const html = await pageRes.text();
  // og:image is the open-graph meta the t.me preview page sets to the user
  // (or channel/bot) profile photo. Match either single or double quotes.
  const m = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (!m) return { ok: false, reason: 'no_og_image' };
  const photoUrl = m[1];

  if (isDefaultLogo(photoUrl)) {
    return { ok: false, reason: 'default_logo' };
  }

  const r = await fetch(photoUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) return { ok: false, reason: 'download_' + r.status };
  const buffer = Buffer.from(await r.arrayBuffer());
  return { ok: true, buffer, handle: username, sourceUrl: photoUrl };
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

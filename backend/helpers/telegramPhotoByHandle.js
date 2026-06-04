'use strict';

// Fetch a profile photo for scraped masters. Priority:
//   1. Telegram (@handle) — t.me public page og:image scrape
//   2. Instagram (@handle) — instagram.com public page og:image scrape (fallback)
//
// Telegram: the t.me profile page serves an og:image pointing to the CDN photo.
// Users with no public photo get Telegram's default logo — filtered out.
// Bot API can't be used: getChat returns chat_not_found for users who haven't
// started the bot (verified against 49 handles — 0 of 49 succeeded).
//
// Instagram: public profiles serve og:image in HTML. Best-effort — Instagram's
// anti-bot protection may block or return a login-wall on some requests.
//
// Failure reasons (ok:false): invalid_handle, page_<status>, no_og_image,
// default_logo/default_avatar, download_<status>, login_required.

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

// Pull the first instagram-shaped contact off a Master document.
function firstInstagramContact(master) {
  return (master && master.contacts ? master.contacts : []).find((c) =>
    /instagram/i.test(c.contactType || '')
  );
}

// "@user" / "https://www.instagram.com/user/" / "user" -> "user"
function normalizeInstagramHandle(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  const m =
    s.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{1,30})\/?/) ||
    s.match(/^@?([A-Za-z0-9_.]{1,30})$/);
  return m ? m[1].toLowerCase() : null;
}

async function fetchProfilePhotoByInstagram(handle) {
  const username = normalizeInstagramHandle(handle);
  if (!username) return { ok: false, reason: 'invalid_handle' };

  const pageRes = await fetch(`https://www.instagram.com/${username}/`, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
  });
  if (!pageRes.ok) return { ok: false, reason: 'page_' + pageRes.status };

  const html = await pageRes.text();
  // Login-wall detection — Instagram sometimes serves a login redirect
  if (/Log in to Instagram|login_required/i.test(html.slice(0, 3000))) {
    return { ok: false, reason: 'login_required' };
  }
  // Instagram often puts content before property — handle both attribute orderings.
  const photoUrl =
    (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
     html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
     [])[1];
  if (!photoUrl) return { ok: false, reason: 'no_og_image' };

  // Instagram's default avatar fingerprint
  if (/44884218_345707102882519|instagram.*static.*default/i.test(photoUrl)) {
    return { ok: false, reason: 'default_avatar' };
  }

  const r = await fetch(photoUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) return { ok: false, reason: 'download_' + r.status };
  const buffer = Buffer.from(await r.arrayBuffer());
  return { ok: true, buffer, handle: username, sourceUrl: photoUrl };
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

// Main entry. Priority: Telegram photo → Instagram photo → null.
// Idempotent: skips when master.photo already set unless force:true.
// Always resolves — caller doesn't need its own try/catch.
// Returns the S3 URL on success, null otherwise.
async function fetchAndUploadPhotoForMaster(master, { force = false } = {}) {
  try {
    if (!master || !master._id) return null;
    if (master.photo && !force) return master.photo;

    const tg = firstTelegramContact(master);
    const ig = firstInstagramContact(master);

    // 1. Try Telegram
    if (tg) {
      const r = await fetchProfilePhotoByHandle(tg.value);
      if (r.ok) {
        const url = await uploadMasterPhoto(String(master._id), r.buffer);
        console.log(`[scraped-photo] ${master._id} tg:@${r.handle} → ${url}`);
        return url;
      }
      console.log(`[scraped-photo] ${master._id} tg:@${normalizeHandle(tg.value) || tg.value} → ${r.reason}`);
    }

    // 2. Fall back to Instagram
    if (ig) {
      const r = await fetchProfilePhotoByInstagram(ig.value);
      if (r.ok) {
        const url = await uploadMasterPhoto(String(master._id), r.buffer);
        console.log(`[scraped-photo] ${master._id} ig:@${r.handle} → ${url}`);
        return url;
      }
      console.log(`[scraped-photo] ${master._id} ig:@${normalizeInstagramHandle(ig.value) || ig.value} → ${r.reason}`);
    }

    if (!tg && !ig) {
      console.log(`[scraped-photo] ${master._id} no telegram or instagram contact — skip`);
    }
    return null;
  } catch (e) {
    console.error(`[scraped-photo] ${master && master._id} ${e.message}`);
    return null;
  }
}

module.exports = {
  fetchProfilePhotoByHandle,
  fetchProfilePhotoByInstagram,
  uploadMasterPhoto,
  fetchAndUploadPhotoForMaster,
  normalizeHandle,
  normalizeInstagramHandle,
  firstTelegramContact,
  firstInstagramContact,
};

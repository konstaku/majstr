'use strict';

// Fetch a profile photo for scraped masters. Priority:
//   1. Telegram (@handle) — t.me public page og:image scrape (HTTP, no browser)
//   2. Instagram (@handle) — headless Chromium via Playwright (JS-rendered page)
//
// Telegram: t.me serves og:image in static HTML — simple fetch is enough.
// Instagram: profile data is JS-rendered; static HTML only embeds the viewer's
// own pic. A real browser is required. We use a singleton Playwright Chromium
// instance with the session cookie pre-loaded so it starts only once per process.
//
// Failure reasons (ok:false): invalid_handle, page_<status>, no_og_image,
// default_logo, no_profile_pic, default_avatar, download_<status>,
// login_required, not_supported, browser_error.

const AWS = require('aws-sdk');

const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const { S3_BUCKET: BUCKET } = require('../config/s3');
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

// ---------------------------------------------------------------------------
// Singleton Playwright browser — launched once per process, shared across calls.
// ---------------------------------------------------------------------------
let _browser = null;
let _context = null;

async function getBrowserContext() {
  if (_context) return _context;
  const { chromium } = require('playwright');
  _browser = await chromium.launch({ headless: true });
  const sessionId = process.env.INSTAGRAM_SESSION_ID;
  _context = await _browser.newContext({
    userAgent: USER_AGENT,
    locale: 'uk-UA',
    ...(sessionId ? {
      storageState: {
        cookies: [{
          name: 'sessionid',
          value: sessionId,
          domain: '.instagram.com',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        }],
      },
    } : {}),
  });
  return _context;
}

// Close the browser when the process is done (call from backfill scripts).
async function closeBrowser() {
  if (_browser) { await _browser.close(); _browser = null; _context = null; }
}

async function fetchProfilePhotoByInstagram(handle) {
  const username = normalizeInstagramHandle(handle);
  if (!username) return { ok: false, reason: 'invalid_handle' };

  let page;
  try {
    const ctx = await getBrowserContext();
    page = await ctx.newPage();

    // Navigate to instagram.com to establish same-origin context (required for
    // the API call — server-side fetch is blocked by Sec-Fetch policy).
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    // Call the internal profile API from within the browser — the real browser
    // sets correct Sec-Fetch-Site/Mode headers that the server requires.
    const apiResult = await page.evaluate(async (uname) => {
      try {
        const r = await fetch('/api/v1/users/web_profile_info/?username=' + uname, {
          headers: { 'X-IG-App-ID': '936619743392459' },
          credentials: 'include',
        });
        if (!r.ok) return { ok: false, status: r.status };
        const data = await r.json();
        const user = data?.data?.user;
        if (!user) return { ok: false, status: r.status, reason: 'no_user' };
        return { ok: true, pic: user.profile_pic_url_hd || user.profile_pic_url };
      } catch (e) {
        return { ok: false, reason: e.message };
      }
    }, username);

    if (!apiResult.ok) {
      return { ok: false, reason: apiResult.reason || 'api_' + apiResult.status };
    }
    const picUrl = apiResult.pic;
    if (!picUrl) return { ok: false, reason: 'no_profile_pic' };

    if (/44884218_345707102882519|static.*default_profile/i.test(picUrl)) {
      return { ok: false, reason: 'default_avatar' };
    }

    const r = await fetch(picUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!r.ok) return { ok: false, reason: 'download_' + r.status };
    const buffer = Buffer.from(await r.arrayBuffer());
    return { ok: true, buffer, handle: username, sourceUrl: picUrl };
  } catch (e) {
    return { ok: false, reason: 'browser_error', detail: e.message };
  } finally {
    if (page) await page.close().catch(() => {});
  }
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
  closeBrowser,
  normalizeHandle,
  normalizeInstagramHandle,
  firstTelegramContact,
  firstInstagramContact,
};

'use strict';

require('dotenv').config();

const path    = require('path');
const fs      = require('fs');
const AWS     = require('aws-sdk');
const { chromium } = require('playwright');

const Profession    = require('../database/schema/Profession');
const Location      = require('../database/schema/Location');
const { localizedName } = require('../lang');

// ── Brand mapping ─────────────────────────────────────────────────────────────
const LANG_LABELS = {
  uk:'UA', en:'EN', it:'IT', pt:'PT', es:'ES', de:'DE', fr:'FR', pl:'PL', ru:'RU',
};
const CONTACT_LABELS = {
  telegram:'Telegram', phone:'Телефон', instagram:'Instagram',
  viber:'Viber', whatsapp:'WhatsApp', facebook:'Facebook', website:'Сайт',
};

// ── AWS ───────────────────────────────────────────────────────────────────────
const s3 = new AWS.S3({
  accessKeyId:     process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// ── Template ──────────────────────────────────────────────────────────────────
const TEMPLATE_PATH = path.resolve(__dirname, 'og-template.html');
let _templateHtml = null;
function getTemplate() {
  // Cache in memory after first read
  if (!_templateHtml) _templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return _templateHtml;
}

// ── Browser singleton ─────────────────────────────────────────────────────────
// One Chromium process shared across all OG generation calls.
// Restart automatically if the browser crashes.
let _browser = null;
async function getBrowser() {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    console.log('[OG] Chromium launched');
  }
  return _browser;
}

// ── Main export ───────────────────────────────────────────────────────────────
async function createOGimageForMaster(master) {
  console.log('[OG] Generating for master:', master._id);

  const [professions, locations] = await Promise.all([
    Profession.find().lean(),
    Location.find().lean(),
  ]);

  const profEntry = professions.find(p => p.id === master.professionID);
  const locEntry  = locations.find(l  => l.id === master.locationID);

  // Language codes → display labels (UA, IT, EN …)
  const langs = (master.languages || [])
    .map(code => LANG_LABELS[code] || code.toUpperCase())
    .filter(Boolean);
  if (!langs.length) langs.push('UA');

  // Up to 3 contacts, excluding low-value types, with display labels
  const contacts = (master.contacts || [])
    .filter(c => c.contactType !== 'facebook' && c.contactType !== 'website')
    .slice(0, 3)
    .map(c => ({
      type:  CONTACT_LABELS[c.contactType] || c.contactType,
      value: c.contactType === 'telegram' && !c.value.startsWith('@')
        ? '@' + c.value
        : c.value,
    }));

  const ogData = {
    masterId: String(master._id),
    name:     master.name || '—',
    prof:     localizedName(profEntry?.name, 'uk', master.professionID),
    city:     localizedName(locEntry?.name,  'uk', master.locationID),
    langs,
    photoUrl: master.photo || null,
    verified: master.approved === true,
    desc:     master.about || '',
    contacts,
    dest:     master.countryID || 'IT',
  };

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 1200, height: 630 });

    // Load template; networkidle ensures Google Fonts are fully fetched
    await page.setContent(getTemplate(), { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for fonts to be ready inside the browser, then render the card
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((data) => window.initCard(data), ogData);

    // Two rAFs: first lets fitName run, second lets the layout settle
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    const cardEl = await page.$('.og');
    if (!cardEl) throw new Error('[OG] .og element not found after render');

    const buffer = await cardEl.screenshot({ type: 'png' });
    return await uploadToS3(buffer, master);
  } finally {
    await page.close();
  }
}

async function uploadToS3(buffer, master) {
  const params = {
    Bucket:      'chupakabra-test',
    Key:         `user-og/${master._id}.png`,
    Body:        buffer,
    ContentType: 'image/png',
  };
  return new Promise((resolve, reject) => {
    s3.upload(params, (err, data) => {
      if (err) { reject(err); return; }
      console.log('[OG] Upload ok:', data.Location);
      resolve(data.Location);
    });
  });
}

async function closeBrowser() {
  if (_browser) { await _browser.close(); _browser = null; }
}

module.exports = createOGimageForMaster;
module.exports.closeBrowser = closeBrowser;

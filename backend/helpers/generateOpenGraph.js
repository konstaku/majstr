'use strict';

require('dotenv').config();

const path    = require('path');
const AWS     = require('aws-sdk');
const { createCanvas, loadImage, registerFont } = require('canvas');

const Profession = require('../database/schema/Profession');
const Location   = require('../database/schema/Location');
const { localizedName } = require('../lang');
const { drawSigilOnCanvas } = require('./sigil');

// ── Fonts ─────────────────────────────────────────────────────────────────────
const FONTS = path.resolve(__dirname, '../data/fonts');
registerFont(path.join(FONTS, 'ArchivoBlack.ttf'),      { family: 'ArchivoBlack' });
registerFont(path.join(FONTS, 'JetBrainsMono-Bold.ttf'), { family: 'JetBrainsMono', weight: '700' });

// ── Brand tokens ──────────────────────────────────────────────────────────────
const INK   = '#0e0a06';
const PAPER = '#fffaf0';
const CREAM = '#f4ede0';
const TERRA = '#c84b31';

// ── Layout constants (1200 × 630) ─────────────────────────────────────────────
const W  = 1200;
const H  = 630;
const BD = 2;          // border thickness

const HEADER_H   = 52;
const IDENTITY_H = 320;
const CONTACTS_H = 182;
const CTA_H      = 72;
// Total: 52 + 2 + 320 + 2 + 182 + 2 + 72 = 632 → round to 630 by absorbing 2px in CTA
// Actual CTA_H = 70 → 52+2+320+2+182+2+70 = 630 ✓
const CTA_H_ACTUAL = 70;

const IDENTITY_Y  = HEADER_H + BD;                                  // 54
const CONTACTS_Y  = IDENTITY_Y + IDENTITY_H + BD;                   // 376
const CTA_Y       = CONTACTS_Y + CONTACTS_H + BD;                   // 560

const AVATAR_W    = 360;                                             // left column
const NAME_X      = AVATAR_W + BD + 28;                             // text start in right col
const NAME_W      = W - AVATAR_W - BD - 28 - 24;                   // usable name width

// Language code → display badge label (matches Modal.tsx)
const LANG_LABELS = { uk:'UA', en:'EN', it:'IT', pt:'PT', es:'ES', de:'DE', fr:'FR', pl:'PL', ru:'RU' };

// ── AWS ───────────────────────────────────────────────────────────────────────
const s3 = new AWS.S3({
  accessKeyId:     process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wrap text to multiple lines, each ≤ maxWidth px at the current ctx font. */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Clip ctx to a rect, run fn, restore. */
function withClip(ctx, x, y, w, h, fn) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  fn();
  ctx.restore();
}

/**
 * Draw the master's photo in duotone style matching the modal:
 *   ink background → greyscale photo (lighten blend) → paper overlay (darken blend).
 * Falls back to CREAM fill if the photo can't be loaded.
 */
async function drawPhoto(ctx, photoUrl, x, y, w, h) {
  try {
    const img = await loadImage(photoUrl);
    // 1. Ink background
    ctx.fillStyle = INK;
    ctx.fillRect(x, y, w, h);

    // 2. Greyscale photo, lighten blend — makes photo highlights pop on dark bg
    ctx.save();
    ctx.globalCompositeOperation = 'lighten';
    try { ctx.filter = 'grayscale(100%) contrast(118%) brightness(102%)'; } catch (_) { /* unsupported */ }
    withClip(ctx, x, y, w, h, () => {
      const scale = Math.max(w / img.width, h / img.height);
      const sw = w / scale;
      const sh = h / scale;
      const sx = (img.width  - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    });
    ctx.restore();

    // 3. Paper overlay, darken blend — turns the photo into an ink-toned duotone
    ctx.save();
    ctx.globalCompositeOperation = 'darken';
    try { ctx.filter = 'none'; } catch (_) { /* noop */ }
    ctx.fillStyle = PAPER;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  } catch (err) {
    console.warn('[OG] photo load failed, using sigil fallback:', err.message);
    ctx.fillStyle = CREAM;
    ctx.fillRect(x, y, w, h);
    const pad  = Math.round(Math.min(w, h) * 0.13);
    const size = Math.min(w, h) - pad * 2;
    drawSigilOnCanvas(ctx, 'fallback', x + pad, y + (h - size) / 2, size, { size: 3, background: false });
  }
}

/** Registration ordinal code (matches Modal.tsx formatRegCode logic). */
function regCode(masterId, allIds) {
  const sorted = allIds.slice().sort((a, b) => String(a).localeCompare(String(b)));
  const n = sorted.indexOf(String(masterId)) + 1;
  return n < 10 ? `0${n}` : String(n);
}

// ── Section renderers ─────────────────────────────────────────────────────────

function drawHeader(ctx) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, HEADER_H);

  ctx.font = `900 20px ArchivoBlack`;
  const baseline = Math.round(HEADER_H / 2 + 8);

  ctx.fillStyle = INK;
  const wm = 'MAJSTR';
  ctx.fillText(wm, 20, baseline);
  const wmW = ctx.measureText(wm).width;
  ctx.fillStyle = TERRA;
  ctx.fillText('.', 20 + wmW, baseline);

  // Bottom border
  ctx.fillStyle = INK;
  ctx.fillRect(0, HEADER_H, W, BD);
}

function drawAvatar(ctx, master) {
  const x = 0;
  const y = IDENTITY_Y;
  const w = AVATAR_W;
  const h = IDENTITY_H;

  // Right border
  ctx.fillStyle = INK;
  ctx.fillRect(w, y, BD, h);

  // Registration code badge (sigil variant only — photo variant just has the photo)
  if (!master.photo) {
    const codeText = `● M-${master._regCode || '??'}`;
    ctx.font = '700 9px JetBrainsMono';
    ctx.fillStyle = TERRA;
    ctx.fillText(codeText, x + 14, y + 20);
  }
}

async function drawAvatarContent(ctx, master) {
  const x = 0;
  const y = IDENTITY_Y;
  const w = AVATAR_W;
  const h = IDENTITY_H;

  if (master.photo) {
    await drawPhoto(ctx, master.photo, x, y, w, h);
  } else {
    ctx.fillStyle = CREAM;
    ctx.fillRect(x, y, w, h);
    const pad  = Math.round(Math.min(w, h) * 0.13);
    const size = Math.min(w, h) - pad * 2;
    drawSigilOnCanvas(ctx, String(master._id), x + pad, y + (h - size) / 2, size, { size: 3, background: false });
  }

  // Overlay borders and reg code badge after photo draw so they're on top
  drawAvatar(ctx, master);
}

function drawNameBlock(ctx, master, profName, locName) {
  const y    = IDENTITY_Y;
  let   textY = y + 52;

  // ── Name ──────────────────────────────────────────────────────────────────
  ctx.font = '900 56px ArchivoBlack';
  ctx.fillStyle = INK;
  const name  = (master.name || '—').toUpperCase();
  const lines = wrapText(ctx, name, NAME_W);
  const lineH = 58;
  for (let i = 0; i < Math.min(lines.length, 2); i++) {
    ctx.fillText(lines[i], NAME_X, textY);
    textY += lineH;
  }
  // Terra dot at end of last name line
  const lastLine   = lines[Math.min(lines.length - 1, 1)];
  const lastLineW  = ctx.measureText(lastLine).width;
  ctx.fillStyle    = TERRA;
  ctx.font         = '900 56px ArchivoBlack';
  ctx.fillText('.', NAME_X + lastLineW, textY - lineH);
  textY += 14;

  // ── Profession · City ─────────────────────────────────────────────────────
  if (profName || locName) {
    ctx.font = '900 17px ArchivoBlack';
    let lineX = NAME_X;

    if (profName) {
      ctx.fillStyle = INK;
      const pText = profName.toUpperCase();
      ctx.fillText(pText, lineX, textY);
      lineX += ctx.measureText(pText).width;
    }
    if (profName && locName) {
      lineX += 11;
      ctx.fillStyle = TERRA;
      ctx.fillRect(lineX, textY - 9, 7, 7);  // square dot
      lineX += 18;
    }
    if (locName) {
      ctx.fillStyle = TERRA;
      ctx.fillText(locName.toUpperCase(), lineX, textY);
    }
    textY += 34;
  }

  // ── Language badges ───────────────────────────────────────────────────────
  const langs = (master.languages && master.languages.length > 0)
    ? master.languages
    : master.countryID === 'IT' ? ['uk', 'it']
    : master.countryID === 'PT' ? ['uk', 'pt']
    : ['uk'];

  ctx.font = '700 11px JetBrainsMono';
  let bx = NAME_X;
  for (const code of langs.slice(0, 4)) {
    const label = LANG_LABELS[code] || code.toUpperCase();
    const bw    = ctx.measureText(label).width + 10;
    const bh    = 18;
    ctx.fillStyle = INK;
    ctx.fillRect(bx, textY - bh + 3, bw, bh);
    ctx.fillStyle = PAPER;
    ctx.fillText(label, bx + 5, textY);
    bx += bw + 5;
  }
  textY += 26;

  // ── Tags ──────────────────────────────────────────────────────────────────
  const tags = (master.tags?.ua || master.tags?.en || []).slice(0, 4);
  if (tags.length) {
    ctx.font = '400 12px sans-serif';
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.65;
    ctx.fillText(tags.join(' · ').toLowerCase(), NAME_X, textY);
    ctx.globalAlpha = 1;
  }
}

function drawContacts(ctx, master) {
  const y = CONTACTS_Y;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, y, W, CONTACTS_H);

  // "CONTACTS" section label
  ctx.font = '700 9px JetBrainsMono';
  ctx.fillStyle = INK;
  ctx.globalAlpha = 0.85;
  ctx.fillText('CONTACTS', 22, y + 22);
  ctx.globalAlpha = 1;

  const contacts = (master.contacts || [])
    .filter(c => c.contactType !== 'facebook' && c.contactType !== 'website')
    .slice(0, 4);

  if (!contacts.length) {
    ctx.font = '700 12px JetBrainsMono';
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.3;
    ctx.fillText('—', 22, y + 52);
    ctx.globalAlpha = 1;
    ctx.fillStyle = INK;
    ctx.fillRect(0, y + CONTACTS_H, W, BD);
    return;
  }

  // Layout: up to 4 contacts in 2 columns
  const colW    = (W - 44) / 2;
  const rowH    = 38;
  const startY  = y + 42;

  for (let i = 0; i < contacts.length; i++) {
    const c    = contacts[i];
    const col  = i % 2;
    const row  = Math.floor(i / 2);
    const cx   = 22 + col * (colW + 22);
    const cy   = startY + row * rowH;

    // Type label (small mono, dimmed)
    ctx.font = '700 10px JetBrainsMono';
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.45;
    ctx.fillText(c.contactType.toUpperCase() + ':', cx, cy);
    ctx.globalAlpha = 1;

    // Value (larger mono)
    ctx.font = '700 15px JetBrainsMono';
    ctx.fillStyle = INK;
    const val = c.value.startsWith('@') || c.contactType === 'telegram'
      ? (c.value.startsWith('@') ? c.value : `@${c.value}`)
      : c.value;
    // Clip value to column width
    const maxValW = colW - 10;
    let   display = val;
    while (display.length > 4 && ctx.measureText(display + '…').width > maxValW) {
      display = display.slice(0, -1);
    }
    if (display !== val) display += '…';
    ctx.fillText(display, cx + 90, cy);
  }

  // Bottom border
  ctx.fillStyle = INK;
  ctx.fillRect(0, y + CONTACTS_H, W, BD);
}

function drawCTABand(ctx, master) {
  const y = CTA_Y;

  // Full ink background
  ctx.fillStyle = INK;
  ctx.fillRect(0, y, W, CTA_H_ACTUAL);

  // Left cell — Rate button (matches modal .modal-master__rate-btn)
  const rateBtnW = 88;
  ctx.strokeStyle = PAPER;
  ctx.lineWidth   = BD;
  ctx.strokeRect(BD, y + BD, rateBtnW - BD * 2, CTA_H_ACTUAL - BD * 2);
  ctx.font      = '700 9px JetBrainsMono';
  ctx.fillStyle = PAPER;
  ctx.fillText('☆  RATE', 16, y + CTA_H_ACTUAL / 2 + 4);

  // Right side — terra CTA
  ctx.fillStyle = TERRA;
  ctx.fillRect(rateBtnW, y, W - rateBtnW, CTA_H_ACTUAL);

  const primary   = (master.contacts || []).find(c => c.contactType === 'telegram') || (master.contacts || [])[0];
  const ctaLabel  = !primary                            ? 'CONTACT'
    : primary.contactType === 'telegram'                ? 'WRITE IN TELEGRAM'
    : primary.contactType === 'phone'                   ? 'CALL'
    : `MESSAGE ON ${primary.contactType.toUpperCase()}`;

  ctx.font      = '900 15px ArchivoBlack';
  ctx.fillStyle = PAPER;
  const labelW  = ctx.measureText(ctaLabel).width;
  const arrowW  = ctx.measureText(' →').width;
  const totalW  = labelW + arrowW + 16;
  const tx      = rateBtnW + Math.round((W - rateBtnW - totalW) / 2);
  ctx.fillText(ctaLabel, tx, y + CTA_H_ACTUAL / 2 + 6);
  ctx.fillText('→', tx + labelW + 16, y + CTA_H_ACTUAL / 2 + 6);
}

// ── Main export ───────────────────────────────────────────────────────────────

async function createOGimageForMaster(master) {
  console.log('[OG] Generating for master:', master._id);

  const [professions, locations] = await Promise.all([
    Profession.find(),
    Location.find(),
  ]);

  const profEntry = professions.find(p => p.id === master.professionID);
  const locEntry  = locations.find(l  => l.id === master.locationID);
  const profName  = localizedName(profEntry?.name, 'uk', master.professionID);
  const locName   = localizedName(locEntry?.name,  'uk', master.locationID);

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // Full paper background
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // Draw sections
  drawHeader(ctx);
  await drawAvatarContent(ctx, master);
  drawNameBlock(ctx, master, profName, locName);
  drawContacts(ctx, master);
  drawCTABand(ctx, master);

  // Outer 2px border
  ctx.strokeStyle = INK;
  ctx.lineWidth   = BD * 2;
  ctx.strokeRect(BD, BD, W - BD * 2, H - BD * 2);

  return uploadToS3(canvas, master);
}

async function uploadToS3(canvas, master) {
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.93 });
  const params = {
    Bucket:      'chupakabra-test',
    Key:         `user-og/${master._id}.jpg`,
    Body:        buffer,
    ContentType: 'image/jpeg',
  };

  return new Promise((resolve, reject) => {
    s3.upload(params, (err, data) => {
      if (err) { reject(err); return; }
      console.log('[OG] Upload ok:', data.Location);
      resolve(data.Location);
    });
  });
}

module.exports = createOGimageForMaster;

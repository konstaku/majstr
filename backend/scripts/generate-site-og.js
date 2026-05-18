/**
 * Generate the site-wide Open Graph image (1200×630) shown when
 * majstr.xyz is shared on Telegram / WhatsApp / Facebook.
 *
 * Reproduces the brutalist layout from
 * "design mockups/OG image/Open Graph _ 1200_630.html" with English copy.
 * Writes frontend/public/og-image.png (served at majstr.xyz/og-image.png).
 *
 * NOTE: brand fonts (Archivo Black) are not installed for node-canvas
 * here, so this is a faithful-layout approximation. For pixel-perfect
 * type, export the mockup HTML to a 1200×630 PNG and replace the file at
 * the same path — index.html meta already points there.
 *
 *   node scripts/generate-site-og.js
 */
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const W = 1200;
const H = 630;
const INK = '#0e0a06';
const CREAM = '#f4ede0';
const TERRA = '#c84b31';

const OUT = path.join(__dirname, '..', '..', 'frontend', 'public', 'og-image.png');

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Background + brutalist frame
ctx.fillStyle = CREAM;
ctx.fillRect(0, 0, W, H);
ctx.strokeStyle = INK;
ctx.lineWidth = 8;
ctx.strokeRect(20, 20, W - 40, H - 40);

const M = 70; // inner margin

// Top meta strip
ctx.fillStyle = INK;
ctx.font = '700 22px Helvetica, Arial, sans-serif';
ctx.textBaseline = 'alphabetic';
ctx.fillText('EST. 2024  ·  UA → IT / PT', M, 92);
const right = '★★★★★  ·  24 CITIES';
ctx.font = '700 22px Helvetica, Arial, sans-serif';
const rw = ctx.measureText(right).width;
ctx.fillText(right, W - M - rw, 92);
ctx.lineWidth = 3;
ctx.beginPath();
ctx.moveTo(M, 110);
ctx.lineTo(W - M, 110);
ctx.stroke();

// Wordmark
ctx.fillStyle = INK;
ctx.font = '900 168px Helvetica, Arial, sans-serif';
ctx.fillText('MAJSTR.', M - 4, 320);

// Tagline (English)
ctx.font = '700 46px Helvetica, Arial, sans-serif';
ctx.fillText('Find a craftsman who speaks your language.', M, 400);

// Stat line
ctx.fillStyle = TERRA;
ctx.font = '700 30px Helvetica, Arial, sans-serif';
ctx.fillText('2 400+ vetted Ukrainian-speaking masters', M, 470);

// Footer URL
ctx.fillStyle = INK;
ctx.font = '900 34px Helvetica, Arial, sans-serif';
const url = 'MAJSTR.XYZ →';
const uw = ctx.measureText(url).width;
ctx.fillText(url, W - M - uw, H - 70);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, canvas.toBuffer('image/png'));
console.log('Wrote', OUT, `(${W}x${H})`);

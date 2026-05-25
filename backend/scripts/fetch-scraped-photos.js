/**
 * Backfill Telegram profile photos for already-published scraped masters
 * (#117). Finds Masters with `source:'scraped'`, a telegram contact, and no
 * `photo`, then calls helpers/telegramPhotoByHandle to fetch + upload.
 *
 * Usage (from backend/, with the DEFAULT production DB — do NOT set
 * MONGO_DB_NAME):
 *   node scripts/fetch-scraped-photos.js                    # photos missing only
 *   node scripts/fetch-scraped-photos.js --force            # refetch all
 *   node scripts/fetch-scraped-photos.js --limit 10         # smoke test
 *   node scripts/fetch-scraped-photos.js --sleep 500        # tighter rate
 *
 * Notes:
 *   - The Telegram Bot API allows ~30 requests/sec but the public-username
 *     getChat path is more sensitive; default to 1s between masters.
 *   - Failures (no photo / private account / chat not found) are logged and
 *     skipped — they're normal.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const Master = require('../database/schema/Master');
const { fetchAndUploadPhotoForMaster } = require('../helpers/telegramPhotoByHandle');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

async function main() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not set');
  }
  const force = process.argv.includes('--force');
  const limit = parseInt(arg('--limit', '0'), 10) || 0;
  const sleepMs = parseInt(arg('--sleep', '1000'), 10);

  await runDB();

  const baseQuery = {
    source: 'scraped',
    contacts: {
      $elemMatch: { contactType: { $regex: /telegram|tg/i } },
    },
  };
  const query = force
    ? baseQuery
    : { ...baseQuery, $or: [{ photo: null }, { photo: { $exists: false } }, { photo: '' }] };

  let q = Master.find(query).sort({ createdAt: 1 });
  if (limit) q = q.limit(limit);
  const masters = await q.lean();

  console.log(
    `[fetch-scraped-photos] ${masters.length} masters to process ` +
      `(force=${force}, sleep=${sleepMs}ms${limit ? `, limit=${limit}` : ''})`
  );

  let ok = 0,
    miss = 0;
  for (let i = 0; i < masters.length; i++) {
    const m = masters[i];
    process.stdout.write(`  [${i + 1}/${masters.length}] ${m.name || m._id} ... `);
    const url = await fetchAndUploadPhotoForMaster(m, { force });
    if (url) {
      await Master.updateOne({ _id: m._id }, { $set: { photo: url } });
      ok++;
      process.stdout.write('OK\n');
    } else {
      miss++;
      process.stdout.write('skip\n');
    }
    if (i < masters.length - 1) await new Promise((r) => setTimeout(r, sleepMs));
  }
  console.log(`\n[fetch-scraped-photos] done. ok=${ok}, missed/skipped=${miss}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('fetch-scraped-photos failed:', e.message);
  process.exit(1);
});

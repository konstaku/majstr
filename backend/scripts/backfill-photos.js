'use strict';

/**
 * Backfill profile photos for all approved masters on the site.
 *
 * Priority per master: Telegram photo → Instagram photo → skip.
 * Masters that already have a photo are skipped unless --force is passed.
 *
 * Usage (from backend/):
 *   node scripts/backfill-photos.js            # only masters without a photo
 *   node scripts/backfill-photos.js --force    # re-fetch everyone (overwrites)
 *   node scripts/backfill-photos.js --dry-run  # print what would happen, no writes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const Master = require('../database/schema/Master');
const { fetchAndUploadPhotoForMaster } = require('../helpers/telegramPhotoByHandle');

const FORCE = process.argv.includes('--force');
const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = 5;

async function main() {
  await runDB();

  const query = { status: 'approved' };
  if (!FORCE) query.photo = { $in: [null, '', undefined] };

  const masters = await Master.find(query)
    .select('_id name contacts photo')
    .lean();

  console.log(
    `${masters.length} masters to process` +
    (FORCE ? ' (--force: re-fetching all)' : ' (no photo yet)') +
    (DRY_RUN ? ' [DRY RUN]' : '')
  );

  let ok = 0, skipped = 0, failed = 0;

  for (let i = 0; i < masters.length; i += CONCURRENCY) {
    const batch = masters.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (m) => {
      if (DRY_RUN) {
        const hasTg = (m.contacts || []).some(c => /telegram|tg/i.test(c.contactType));
        const hasIg = (m.contacts || []).some(c => /instagram/i.test(c.contactType));
        console.log(`[dry] ${m._id} ${m.name} — tg:${hasTg} ig:${hasIg} photo:${!!m.photo}`);
        return;
      }
      const url = await fetchAndUploadPhotoForMaster(m, { force: FORCE });
      if (url) {
        await Master.updateOne({ _id: m._id }, { $set: { photo: url } });
        ok++;
      } else {
        const hasTg = (m.contacts || []).some(c => /telegram|tg/i.test(c.contactType));
        const hasIg = (m.contacts || []).some(c => /instagram/i.test(c.contactType));
        if (!hasTg && !hasIg) skipped++;
        else failed++;
      }
    }));
    process.stdout.write(`\r${Math.min(i + CONCURRENCY, masters.length)}/${masters.length} processed — ok:${ok} failed:${failed} skipped:${skipped}`);
  }

  console.log(`\nDone. ok:${ok} failed:${failed} skipped:${skipped}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

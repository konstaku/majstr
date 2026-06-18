'use strict';

/**
 * Regenerate OG images for all approved masters using the Playwright-based
 * generator (og-template.html → PNG → S3), then update Master.OGimage.
 *
 * Dry-run by default — shows what would be processed without generating.
 *
 * Usage (from backend/):
 *   node scripts/backfill-og-images.js                        # dry run
 *   node scripts/backfill-og-images.js --apply                # regenerate all
 *   node scripts/backfill-og-images.js --apply --id <mongoId> # single master
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const Master = require('../database/schema/Master');
const createOGimageForMaster = require('../helpers/generateOpenGraph');
const { closeBrowser } = require('../helpers/generateOpenGraph');

const APPLY   = process.argv.includes('--apply');
const ID_FLAG = process.argv.indexOf('--id');
const ONLY_ID = ID_FLAG !== -1 ? process.argv[ID_FLAG + 1] : null;

async function main() {
  await runDB();

  const query = ONLY_ID ? { _id: ONLY_ID } : { status: 'approved' };
  const masters = await Master.find(query)
    .select('_id name professionID locationID languages photo about contacts approved verified countryID')
    .lean();

  console.log(`Found ${masters.length} master(s) to process.`);

  if (!APPLY) {
    const withPhoto = masters.filter(m => m.photo).length;
    const noPhoto   = masters.length - withPhoto;
    console.log(`  ${withPhoto} with photo → 600px visual column`);
    console.log(`  ${noPhoto} without photo → mini-sigil column`);
    console.log('\nDry run — pass --apply to generate and upload.');
    await mongoose.disconnect();
    return;
  }

  let ok = 0, fail = 0;
  const errors = [];

  for (let i = 0; i < masters.length; i++) {
    const m = masters[i];
    const label = `[${i + 1}/${masters.length}] ${m.name || String(m._id)}`;
    process.stdout.write(`${label} ... `);

    try {
      const url = await createOGimageForMaster(m);
      await Master.updateOne({ _id: m._id }, { $set: { OGimage: url.toString() } });
      console.log('✓');
      ok++;
    } catch (err) {
      console.log(`✗  ${err.message}`);
      errors.push({ id: String(m._id), name: m.name, error: err.message });
      fail++;
    }
  }

  console.log(`\n────────────────────────────────`);
  console.log(`Done. ${ok} succeeded, ${fail} failed.`);

  if (errors.length) {
    console.log('\nFailed masters:');
    errors.forEach(e => console.log(`  ${e.id}  ${e.name}: ${e.error}`));
  }

  await closeBrowser();
  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

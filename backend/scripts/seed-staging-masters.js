/**
 * Copy approved masters into the isolated staging DB so dev shows real
 * data. Reference data is handled by seed-staging-reference.js; this adds
 * the `masters` collection (status: 'approved' only — no drafts/pending).
 *
 * Usage (from backend/):
 *   TARGET_DB=majstr_staging node scripts/seed-staging-masters.js
 *
 * Env: MONGO_URI or MONGO_PASSWORD; SOURCE_DB (default "test");
 *      TARGET_DB (or MONGO_DB_NAME) — required; DRY_RUN=1 to preview.
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri =
  process.env.MONGO_URI ||
  `mongodb+srv://0864380:${process.env.MONGO_PASSWORD}@piglets.vfyjg2w.mongodb.net/`;
const SOURCE_DB = process.env.SOURCE_DB || 'test';
const TARGET_DB = process.env.TARGET_DB || process.env.MONGO_DB_NAME;
const DRY = !!process.env.DRY_RUN;

async function main() {
  if (!TARGET_DB) {
    console.error('TARGET_DB (or MONGO_DB_NAME) is required.');
    process.exit(1);
  }
  if (TARGET_DB === SOURCE_DB) {
    console.error(`Refusing: TARGET_DB === SOURCE_DB ("${SOURCE_DB}").`);
    process.exit(1);
  }
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const src = client.db(SOURCE_DB);
    const dst = client.db(TARGET_DB);
    const docs = await src
      .collection('masters')
      .find({ status: 'approved' })
      .toArray();
    console.log(`approved masters in source: ${docs.length}`);
    if (DRY) {
      console.log('DRY RUN — nothing written.');
      return;
    }
    if (docs.length) {
      // Replace the staging masters set with the approved snapshot.
      await dst.collection('masters').deleteMany({ status: 'approved' });
      await dst.collection('masters').insertMany(docs, { ordered: false });
    }
    console.log(`masters: copied ${docs.length} -> ${TARGET_DB}. Done.`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

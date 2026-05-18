/**
 * Delete a junk/test location by id (default: "uomini").
 *
 * Run once per DB that has it (prod + staging):
 *   SOURCE_DB=test node scripts/delete-location.js
 *   MONGO_DB_NAME=majstr_staging node scripts/delete-location.js
 *   LOCATION_ID=foo node scripts/delete-location.js   # other id
 *   DRY_RUN=1 ... to preview
 *
 * Reports any approved masters still referencing the id (it does NOT
 * modify masters — that's a separate decision).
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri =
  process.env.MONGO_URI ||
  `mongodb+srv://0864380:${process.env.MONGO_PASSWORD}@piglets.vfyjg2w.mongodb.net/`;
const DB = process.env.SOURCE_DB || process.env.MONGO_DB_NAME || 'test';
const ID = process.env.LOCATION_ID || 'uomini';
const DRY = !!process.env.DRY_RUN;

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(DB);
    const refs = await db
      .collection('masters')
      .countDocuments({ locationID: ID });
    const exists = await db.collection('locations').countDocuments({ id: ID });
    console.log(
      `db=${DB} location "${ID}": ${exists ? 'present' : 'absent'}; ` +
        `masters referencing it: ${refs}`
    );
    if (DRY) return console.log('DRY RUN — nothing deleted.');
    const r = await db.collection('locations').deleteOne({ id: ID });
    console.log(`Deleted ${r.deletedCount} location doc. Done.`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Delete failed:', err);
  process.exit(1);
});

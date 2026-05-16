/**
 * Idempotent multi-pass migration for the Master collection.
 *
 *   Pass 1 — status backfill:
 *     approved: true  → status: 'approved'
 *     approved: false → status: 'pending'
 *     Backfills submittedAt, approvedAt, and ownerUserID where possible.
 *
 *   Pass 2 — provenance backfill:
 *     records with ownerUserID  → source: 'self_submitted', claimable: false, claimedAt: submittedAt
 *     records without ownerUserID → source: 'scraped',      claimable: true
 *
 *   Pass 3 — known-cleanup:
 *     delete one-off test masters (currently: 65db591b5b8e70b3e0c42856 — plumber-in-porto test card).
 *
 * Run: `cd backend && node scripts/migrate-master-status.js`
 *
 * All passes are idempotent. Re-running is safe.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
// Skip auto index sync — pre-existing data may violate the new partial unique
// index on ownerUserID until duplicates are resolved manually post-migration.
mongoose.set('autoIndex', false);

const Master = require('../database/schema/Master');
const User = require('../database/schema/User');

const TEST_MASTER_IDS_TO_DELETE = ['65db591b5b8e70b3e0c42856'];

async function pass1StatusBackfill() {
  const candidates = await Master.find({ status: { $exists: false } });
  console.log(`[Pass 1] ${candidates.length} masters needing status backfill`);

  let approved = 0;
  let pending = 0;
  let ownerLinked = 0;
  let ownerMissing = 0;
  let ownerDupSkipped = 0;
  let failed = 0;

  for (const master of candidates) {
    try {
      master.status = master.approved ? 'approved' : 'pending';
      if (master.status === 'approved') approved++;
      else pending++;

      const createdFromId = master._id.getTimestamp();
      if (!master.submittedAt) master.submittedAt = createdFromId;
      if (master.status === 'approved' && !master.approvedAt) {
        master.approvedAt = createdFromId;
      }

      let ownerCandidate = null;
      if (!master.ownerUserID && master.telegramID) {
        const owner = await User.findOne({ telegramID: master.telegramID });
        if (owner) {
          ownerCandidate = owner._id;
          master.ownerUserID = owner._id;
        } else {
          ownerMissing++;
        }
      }

      try {
        await master.save();
        if (ownerCandidate) ownerLinked++;
      } catch (err) {
        const isDupKey =
          err && (err.code === 11000 || /E11000/.test(err.message || ''));
        if (isDupKey && ownerCandidate) {
          master.ownerUserID = undefined;
          await master.save();
          ownerDupSkipped++;
          console.warn(
            `[Pass 1] Master ${master._id}: ownerUserID ${ownerCandidate} already taken — migrated without owner link.`
          );
        } else {
          throw err;
        }
      }
    } catch (err) {
      failed++;
      console.error(`[Pass 1] Failed to migrate master ${master._id}:`, err.message);
    }
  }

  console.log(
    `[Pass 1] done: approved=${approved} pending=${pending} ownerLinked=${ownerLinked} ` +
      `ownerDupSkip=${ownerDupSkipped} noUserRow=${ownerMissing} failed=${failed}`
  );
}

async function pass2ProvenanceBackfill() {
  const candidates = await Master.find({ source: { $exists: false } });
  console.log(`[Pass 2] ${candidates.length} masters needing provenance backfill`);

  let selfSubmitted = 0;
  let scraped = 0;
  let failed = 0;

  for (const master of candidates) {
    try {
      if (master.ownerUserID) {
        master.source = 'self_submitted';
        master.claimable = false;
        if (!master.claimedAt) {
          master.claimedAt = master.submittedAt || master._id.getTimestamp();
        }
        selfSubmitted++;
      } else {
        master.source = 'scraped';
        master.claimable = true;
        scraped++;
      }
      await master.save();
    } catch (err) {
      failed++;
      console.error(
        `[Pass 2] Failed to backfill provenance for ${master._id}:`,
        err.message
      );
    }
  }

  console.log(
    `[Pass 2] done: self_submitted=${selfSubmitted} scraped=${scraped} failed=${failed}`
  );
}

async function pass3KnownCleanup() {
  let deleted = 0;
  for (const id of TEST_MASTER_IDS_TO_DELETE) {
    const result = await Master.deleteOne({ _id: id });
    if (result.deletedCount > 0) {
      console.log(`[Pass 3] Deleted test master ${id}`);
      deleted++;
    }
  }
  console.log(`[Pass 3] done: ${deleted} test master(s) removed`);
}

async function run() {
  const MONGO_PASSWORD = process.env.MONGO_PASSWORD;
  if (!MONGO_PASSWORD) throw new Error('MONGO_PASSWORD not set in backend/.env');

  const uri = `mongodb+srv://0864380:${MONGO_PASSWORD}@piglets.vfyjg2w.mongodb.net/`;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  await pass1StatusBackfill();
  await pass2ProvenanceBackfill();
  await pass3KnownCleanup();

  console.log(
    '\nIndexes were NOT auto-built. After verifying no duplicate active ownerUserIDs exist, ' +
      'run a normal app startup (with autoIndex on) or `Master.syncIndexes()` to install the ' +
      'new index set including the partial unique on ownerUserID.'
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

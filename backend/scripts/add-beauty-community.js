/**
 * Seed the "УКРАЇНСЬКІ КРАСУНІ" (@beautyforUkrainians) community + backfill the
 * "Рекомендовано спільнотою" badge onto the masters already published from that
 * group's mining run (chat 1678212416).
 *
 * Idempotent: upserts the Community, then $addToSet the community id onto every
 * master stamped with sourceMetadata.chatID === '1678212416'. Safe to re-run.
 *
 * Run: cd backend && node scripts/add-beauty-community.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const Community = require('../database/schema/Community');
const Master = require('../database/schema/Master');

const COMMUNITY = {
  id: 'beauty-ukrainians',
  name: 'УКРАЇНСЬКІ КРАСУНІ',
  handle: 'beautyforUkrainians',
  url: 'https://t.me/beautyforUkrainians',
  countryID: 'FR',
  active: true,
};
const SOURCE_CHAT_ID = '1678212416'; // the mined Côte d'Azur beauty group

async function main() {
  await runDB();

  const existing = await Community.findOne({ id: COMMUNITY.id });
  if (existing) {
    await Community.updateOne({ id: COMMUNITY.id }, { $set: COMMUNITY });
    console.log(`[community] updated "${COMMUNITY.id}"`);
  } else {
    await Community.create(COMMUNITY);
    console.log(`[community] created "${COMMUNITY.id}" (${COMMUNITY.name})`);
  }

  const res = await Master.updateMany(
    { 'sourceMetadata.chatID': SOURCE_CHAT_ID, communityIds: { $ne: COMMUNITY.id } },
    { $addToSet: { communityIds: COMMUNITY.id } }
  );
  const total = await Master.countDocuments({ 'sourceMetadata.chatID': SOURCE_CHAT_ID });
  console.log(
    `[backfill] chat ${SOURCE_CHAT_ID}: ${res.modifiedCount} master(s) tagged ` +
      `"${COMMUNITY.id}" (of ${total} from that chat).`
  );

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('add-beauty-community failed:', err.message);
    process.exit(1);
  });

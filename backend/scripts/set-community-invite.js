/**
 * Open (or extend) a community share-link campaign: generate a fresh invite
 * token, set the campaign cutoff, and print the link to share in the group.
 *
 * Anyone who arrives via the printed link and submits a card within 48h
 * (capped by the cutoff) gets the "Рекомендовано спільнотою" badge on approval
 * — see routes/referral.js + routes/draft.js. Rotating the token here also
 * invalidates any previously shared link, so a stale one can't be reused.
 *
 * Run:
 *   cd backend && node scripts/set-community-invite.js <community-id> [hours]
 *   e.g. node scripts/set-community-invite.js beauty-ukrainians 48
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const crypto = require('crypto');
const mongoose = require('mongoose');
const { runDB } = require('../database/db');
const Community = require('../database/schema/Community');

const SITE_BASE = process.env.PUBLIC_WEB_URL || 'https://majstr.xyz';
const DEFAULT_HOURS = 48;

// Short, URL- and Telegram-start_param-safe token (start_param allows
// [A-Za-z0-9_-] only, max 64 chars; this is well under).
function makeToken() {
  return crypto.randomBytes(8).toString('hex'); // 16 chars
}

// fr.majstr.xyz for a French community, else the bare site.
function siteForCountry(countryID) {
  if (countryID === 'FR') return SITE_BASE.replace('://', '://fr.');
  return SITE_BASE;
}

async function main() {
  const id = process.argv[2];
  const hours = Number(process.argv[3]) || DEFAULT_HOURS;
  if (!id) {
    console.error('Usage: node scripts/set-community-invite.js <community-id> [hours]');
    process.exit(1);
  }

  await runDB();

  const community = await Community.findOne({ id });
  if (!community) {
    console.error(`No community with id "${id}". Seed it first.`);
    process.exit(1);
  }

  const inviteToken = makeToken();
  const inviteExpiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  await Community.updateOne({ id }, { $set: { inviteToken, inviteExpiresAt } });

  const link = `${siteForCountry(community.countryID)}/?via=${inviteToken}`;
  console.log(`\n[invite] "${id}" (${community.name})`);
  console.log(`  campaign open for ${hours}h, until ${inviteExpiresAt.toISOString()}`);
  console.log(`  share this link:\n\n    ${link}\n`);

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('set-community-invite failed:', err.message);
    process.exit(1);
  });

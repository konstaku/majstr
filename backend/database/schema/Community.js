const mongoose = require('mongoose');

// A Ukrainian community (usually a Telegram group) that endorses masters. Shown
// on a master card/modal as "Рекомендовано спільнотою «name»", a clickable band
// that opens `url`. Attached to masters via Master.communityIds — by the mining
// accept flow (chat → community) and, later, the share-link referral.
//
// Reference data: served through /?q=communities + /api/reference/communities
// (cached) like countries/professions, and resolved by id on the web.
const communitySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // slug, e.g. 'beauty-ukrainians'
    name: { type: String, required: true }, // display name shown inside «»
    handle: { type: String, default: null }, // telegram handle, no leading @
    url: { type: String, required: true }, // chat link, e.g. https://t.me/<handle>
    countryID: { type: String, default: null },
    // Token embedded in the share link (phase 2 referral attribution):
    // fr.majstr.xyz/?via=<inviteToken>. Rotated per campaign via
    // scripts/set-community-invite.js, which also sets inviteExpiresAt.
    inviteToken: { type: String, default: null, index: true },
    // Campaign cutoff for the invite link. A referral is only honored while
    // now < inviteExpiresAt; past it the shared link grants no badge (so a
    // stale link found months later is inert). null = no active campaign.
    inviteExpiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Community = mongoose.model('Community', communitySchema);
module.exports = Community;

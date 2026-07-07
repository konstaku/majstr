const User = require('../database/schema/User');
const Community = require('../database/schema/Community');

// Per-visitor referral window. The badge is granted only if the user submits a
// card within this long of arriving via the link — independent of, and capped
// by, the community's campaign cutoff (Community.inviteExpiresAt).
const REFERRAL_TTL_MS = 48 * 60 * 60 * 1000;

// POST /api/referral  { token }
//
// Called by the onboarding wizard when it detects a community share-link token
// (from the Mini App start_param or the web ?via= capture). Validates the
// token against an active, in-campaign Community and stamps the user so a
// later submitDraft can attach the community badge. Idempotent and quiet:
// an unknown/expired token is a no-op 200 (the link simply grants nothing) —
// it must never block onboarding.
async function registerReferral(req, res) {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!token) return res.json({ attached: false });

  const now = new Date();
  const community = await Community.findOne({ inviteToken: token, active: true });

  // No such token, or the campaign window has closed → stale link, grant nothing.
  if (!community || !community.inviteExpiresAt || community.inviteExpiresAt <= now) {
    return res.json({ attached: false });
  }

  // The personal window expires in 48h, but never outlives the campaign.
  const personalExpiry = new Date(now.getTime() + REFERRAL_TTL_MS);
  const expiresAt =
    community.inviteExpiresAt < personalExpiry ? community.inviteExpiresAt : personalExpiry;

  await User.updateOne(
    { _id: req.user._id },
    { $set: { referredCommunity: { communityId: community.id, expiresAt } } }
  );

  return res.json({ attached: true, communityId: community.id, expiresAt });
}

module.exports = { registerReferral, REFERRAL_TTL_MS };

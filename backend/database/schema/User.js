const { default: mongoose } = require('mongoose');

const userSchema = new mongoose.Schema({
  // Looked up on every authenticated request (requireAuth / requireMiniAppAuth).
  // Non-unique: historical duplicates and the TMA upsert race make a unique
  // index unsafe without a prior dedup pass.
  telegramID: { type: Number, index: true },
  token: { type: String, default: null },
  firstName: String,
  lastName: String,
  username: String,
  photo: {
    type: String,
    default: null,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  uiLanguage: {
    type: String,
    enum: ['uk', 'en', 'it', 'ru'],
    default: 'uk',
  },
  // Phase-2 community referral. Stamped when the user arrives via a community
  // share link (fr.majstr.xyz/?via=<token>) and opens onboarding. Consumed by
  // submitDraft: if it's still unexpired the new master is tagged with the
  // community (→ "Рекомендовано спільнотою" badge on approval). expiresAt is
  // min(now + 48h, Community.inviteExpiresAt), so neither a personal stall nor
  // a stale link can grant the badge late.
  referredCommunity: {
    communityId: { type: String, default: null },
    expiresAt: { type: Date, default: null },
  },
});

module.exports = mongoose.model('User', userSchema);

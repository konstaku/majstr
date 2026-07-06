const mongoose = require('mongoose');

// One endorsement of a master by one recommender — the unit behind a master's
// recommendation count and the text quotes shown on its profile.
//
// Dedup rule ("one author counts once per master"): enforced by the unique
// (masterID, authorKey) index. `authorKey` is the recommender's identity:
//   - Phase 1: a normalized display-name key ('name:<lower, single-spaced>'),
//     derived from the candidate's responderName.
//   - Phase 2: the salted Telegram author hash (`fromHash`) for mined data, which
//     is stable across chats so the same person cannot double-count. See the
//     master-recommendations plan (meetings/2026-07-06_master-recommendations.md).
//
// `text` is optional: '' = a count-only endorsement (moves the count/rating,
// renders no quote); non-empty = a curated quote shown in the profile carousel.
// Lives in the production DB alongside Master (public-facing), NOT the mining DB.

const SOURCE_TYPES = [
  'thread_answer', // reply to an inquiry that named this master
  'announcement_reply', // reply endorsing a master's self-announcement (Phase 4)
  'forwarded', // human-forwarded lead
  'co_sign', // "+1"-style agreement to a prior recommendation (Phase 5)
  'manual', // added by hand in the review UI
];

const recommendationSchema = new mongoose.Schema(
  {
    masterID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Master',
      required: true,
    },
    // Recommender identity — the dedup key (see header). Never the recommended
    // master; the person doing the recommending.
    authorKey: { type: String, required: true },
    // Display name of the recommender (rendered as first-name + initial on the
    // public card per the data-policy amendment). '' when unknown.
    authorName: { type: String, default: '' },
    // Curated endorsement quote. '' = count-only.
    text: { type: String, default: '' },

    sourceType: { type: String, enum: SOURCE_TYPES, default: 'manual' },
    // Best-effort provenance (absent for manual entries).
    sourceChatID: { type: String, default: null },
    sourceMessageID: { type: Number, default: null },
    candidateRef: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

// One author counts once per master.
recommendationSchema.index({ masterID: 1, authorKey: 1 }, { unique: true });
// Profile fetch: a master's recommendations, newest first.
recommendationSchema.index({ masterID: 1, createdAt: -1 });

const Recommendation = mongoose.model('Recommendation', recommendationSchema);
Recommendation.SOURCE_TYPES = SOURCE_TYPES;
module.exports = Recommendation;

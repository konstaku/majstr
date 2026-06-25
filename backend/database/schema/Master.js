const mongoose = require('mongoose');
const { contactsToKeys } = require('../../mining/dedup');

const STATUS_VALUES = ['draft', 'pending', 'approved', 'rejected', 'archived'];
const ACTIVE_STATUSES = ['draft', 'pending', 'approved'];
// 'community' = a lead a human forwarded to the bot from a chat (third-party
// recommendation), published after manual review. Distinct from 'scraped'
// (auto-mined announcements) and 'self_submitted'.
const SOURCE_VALUES = ['self_submitted', 'scraped', 'admin_created', 'community'];

const masterSchema = new mongoose.Schema(
  {
    name: String,
    professionID: String,
    telegramID: { type: Number, index: true },
    ownerUserID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    countryID: { type: String, default: 'IT' },
    locationID: String,
    contacts: [{ contactType: String, value: String }],
    // Normalized contact fingerprints (phone last-9 / @handle / instagram),
    // auto-derived from `contacts` on save. Used to detect duplicate masters
    // sharing a phone / handle / link. See helpers/masterDuplicates.js.
    contactKeys: { type: [String], default: [], index: true },
    about: String,
    photo: String,
    OGimage: { type: String, default: '' },
    likes: { type: Number, default: 0 },
    tags: {
      ua: [String],
      en: [String],
    },

    status: {
      type: String,
      enum: STATUS_VALUES,
      default: 'draft',
    },
    approved: { type: Boolean, default: false },
    // Owner-verified: the master claimed the card and a moderator confirmed
    // it (verify: callbacks). Drives the VERIFIED badge + search priority.
    // Distinct from `approved`, which only gates public visibility.
    verified: { type: Boolean, default: false },
    verifiedAt: Date,
    submittedAt: Date,
    approvedAt: Date,
    rejectedAt: Date,
    archivedAt: Date,
    lastEditedAt: Date,
    rejectionReason: String,

    source: {
      type: String,
      enum: SOURCE_VALUES,
      default: 'self_submitted',
    },
    sourceMetadata: mongoose.Schema.Types.Mixed,
    claimable: { type: Boolean, default: false },
    claimedAt: Date,

    availability: { type: String, enum: ['available', 'next_week', 'busy'] },
    languages: { type: [String], default: undefined },

    // Community endorsements — ids referencing Community.id. Renders the
    // "Рекомендовано спільнотою" badge on the card/modal (first active one).
    // Stamped by the mining accept flow (chat → community) and the share-link
    // referral. Empty = no badge.
    communityIds: { type: [String], default: [] },

    rating: { type: Number, default: null },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

masterSchema.index({ status: 1, countryID: 1, locationID: 1 });
masterSchema.index({ status: 1, verified: -1 }); // verified-first public listing
masterSchema.index({ status: 1, submittedAt: 1 });
masterSchema.index({ ownerUserID: 1, status: 1 });
masterSchema.index({ telegramID: 1, status: 1 });
masterSchema.index(
  { ownerUserID: 1 },
  {
    unique: true,
    partialFilterExpression: {
      ownerUserID: { $exists: true },
      status: { $in: ACTIVE_STATUSES },
    },
  }
);

masterSchema.pre('save', function (next) {
  this.approved = this.status === 'approved';
  // Keep contactKeys in sync whenever contacts change (covers create + edit).
  if (this.isNew || this.isModified('contacts')) {
    this.contactKeys = [...contactsToKeys(this.contacts || [])];
  }
  next();
});

const Master = mongoose.model('Master', masterSchema);
Master.STATUS_VALUES = STATUS_VALUES;
Master.ACTIVE_STATUSES = ACTIVE_STATUSES;
Master.SOURCE_VALUES = SOURCE_VALUES;
module.exports = Master;

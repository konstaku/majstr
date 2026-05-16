const mongoose = require('mongoose');

const STATUS_VALUES = ['draft', 'pending', 'approved', 'rejected', 'archived'];
const ACTIVE_STATUSES = ['draft', 'pending', 'approved'];
const SOURCE_VALUES = ['self_submitted', 'scraped', 'admin_created'];

const masterSchema = new mongoose.Schema(
  {
    name: String,
    professionID: String,
    telegramID: { type: Number, index: true },
    ownerUserID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    countryID: { type: String, default: 'IT' },
    locationID: String,
    contacts: [{ contactType: String, value: String }],
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

    rating: { type: Number, default: null },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

masterSchema.index({ status: 1, countryID: 1, locationID: 1 });
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
  next();
});

const Master = mongoose.model('Master', masterSchema);
Master.STATUS_VALUES = STATUS_VALUES;
Master.ACTIVE_STATUSES = ACTIVE_STATUSES;
Master.SOURCE_VALUES = SOURCE_VALUES;
module.exports = Master;

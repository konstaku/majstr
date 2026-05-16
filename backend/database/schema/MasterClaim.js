const mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId;

const STATUS = ['pending', 'approved', 'rejected', 'withdrawn'];
const EVIDENCE_TYPES = ['phone_match', 'social_handle', 'admin_attestation', 'other'];

const claimSchema = new mongoose.Schema(
  {
    masterID:           { type: ObjectId, ref: 'Master', required: true },
    claimantUserID:     { type: ObjectId, ref: 'User',   required: true },
    claimantTelegramID: { type: Number,                  required: true },
    evidence: [
      {
        type:  { type: String, enum: EVIDENCE_TYPES, required: true },
        value: String,
        notes: String,
      },
    ],
    status:      { type: String, enum: STATUS, default: 'pending' },
    autoApproved: { type: Boolean, default: false },
    reviewedBy:  { type: ObjectId, ref: 'User' },
    reviewedAt:  Date,
    reason:      String,
  },
  { timestamps: true }
);

// Fast lookups by master and by claimant
claimSchema.index({ masterID: 1, status: 1 });
claimSchema.index({ claimantUserID: 1, status: 1 });

// Admin queue: most recent pending claims first
claimSchema.index({ status: 1, createdAt: -1 });

// Only one open claim per master at a time
claimSchema.index(
  { masterID: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

const MasterClaim = mongoose.model('MasterClaim', claimSchema);
MasterClaim.STATUS = STATUS;
MasterClaim.EVIDENCE_TYPES = EVIDENCE_TYPES;
module.exports = MasterClaim;

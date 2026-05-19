const mongoose = require('mongoose');

// A RawMessage that the pre-filter scored above threshold and (optionally) the
// LLM classified. This is the unit the admin reviews in the dashboard.
const KINDS = ['recommendation', 'announcement', 'unknown'];
const STATUS = ['new', 'accepted', 'declined', 'carded'];
const DECLINE_REASONS = [
  'not_a_master',
  'spam',
  'duplicate',
  'wrong_extraction',
  'out_of_scope',
  'other',
];

const extractedSchema = new mongoose.Schema(
  {
    name: String,
    profession: String,
    city: String,
    contacts: [{ contactType: String, value: String }],
  },
  { _id: false }
);

const candidateSchema = new mongoose.Schema(
  {
    rawMessageRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RawMessage',
      required: true,
      unique: true,
    },
    kind: { type: String, enum: KINDS, default: 'unknown' },
    score: { type: Number, required: true },
    extracted: { type: extractedSchema, default: () => ({}) },

    status: { type: String, enum: STATUS, default: 'new' },
    declineReason: { type: String, enum: [null, ...DECLINE_REASONS], default: null },

    classifierName: { type: String, required: true },
    classifierVersion: { type: String, required: true },

    // Set when status -> 'carded'. Links back to the created Master.
    masterRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', default: null },
  },
  { timestamps: true }
);

// Admin queue: newest / highest-confidence first, filterable by status & kind.
candidateSchema.index({ status: 1, createdAt: -1 });
candidateSchema.index({ status: 1, kind: 1, score: -1 });
// Dedup lookups by extracted contact value.
candidateSchema.index({ 'extracted.contacts.value': 1 });

const Candidate = mongoose.model('Candidate', candidateSchema);
Candidate.KINDS = KINDS;
Candidate.STATUS = STATUS;
Candidate.DECLINE_REASONS = DECLINE_REASONS;
module.exports = Candidate;

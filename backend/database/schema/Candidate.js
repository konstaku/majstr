const mongoose = require('mongoose');

// A classified mining candidate — the unit an admin reviews. Produced by the
// batch runner from either a thread answer-bundle (inquiry + one responder's
// reply, possibly several messages) or a standalone announcement.
const KINDS = ['recommendation', 'announcement', 'unknown'];
const STATUS = ['new', 'accepted', 'declined', 'carded'];
const SOURCE_TYPES = ['thread_answer', 'announcement'];
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
    description: String,
  },
  { _id: false }
);

const candidateSchema = new mongoose.Schema(
  {
    chatID: { type: String, required: true },
    sourceType: { type: String, enum: SOURCE_TYPES, required: true },

    // Representative message: the announcement message, or the lowest message
    // id of a thread-answer bundle. Unique per chat -> idempotent re-runs.
    anchorMessageID: { type: Number, required: true },
    messageIDs: { type: [Number], default: [] },
    inquiryMessageID: { type: Number, default: null },
    inquiryText: { type: String, default: null },
    responderName: { type: String, default: null },
    text: { type: String, required: true },

    kind: { type: String, enum: KINDS, default: 'unknown' },
    score: { type: Number, required: true },
    extracted: { type: extractedSchema, default: () => ({}) },

    status: { type: String, enum: STATUS, default: 'new' },
    declineReason: { type: String, enum: [null, ...DECLINE_REASONS], default: null },

    classifierName: { type: String, required: true },
    classifierVersion: { type: String, required: true },
    runRef: { type: mongoose.Schema.Types.ObjectId, ref: 'MiningRun' },

    // Set when status -> 'carded'. Links back to the created Master.
    masterRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Master', default: null },
  },
  { timestamps: true }
);

// Idempotent batch re-runs: one candidate per (chat, anchor message).
candidateSchema.index({ chatID: 1, anchorMessageID: 1 }, { unique: true });
// Admin queue.
candidateSchema.index({ status: 1, createdAt: -1 });
candidateSchema.index({ status: 1, kind: 1, score: -1 });
// Dedup lookups by extracted contact value.
candidateSchema.index({ 'extracted.contacts.value': 1 });

const Candidate = mongoose.model('Candidate', candidateSchema);
Candidate.KINDS = KINDS;
Candidate.STATUS = STATUS;
Candidate.SOURCE_TYPES = SOURCE_TYPES;
Candidate.DECLINE_REASONS = DECLINE_REASONS;
module.exports = Candidate;

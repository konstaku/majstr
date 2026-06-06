const mongoose = require('mongoose');

// A classified mining candidate — the unit an admin reviews. Produced by the
// batch runner from either a thread answer-bundle (inquiry + one responder's
// reply, possibly several messages) or a standalone announcement — or by a
// human forwarding chat message(s) to the bot ('forwarded'). Forwarded leads
// are usually third-party recommendations ("ask Georgy, +39…") that the
// auto-miner deliberately rejects.
const KINDS = ['recommendation', 'announcement', 'unknown'];
// 'raw' = a forwarded lead stored by the bot but NOT yet run through the LLM.
// The bot runs on a server with no Ollama; extraction happens later on the
// reviewer's own machine (local-queue-server.js), which flips 'raw' -> 'new'.
const STATUS = ['raw', 'new', 'accepted', 'declined', 'carded'];
const SOURCE_TYPES = ['thread_answer', 'announcement', 'forwarded'];
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
    // Suggested service tags (e.g. "screen replacement"). UA is the canonical
    // copy; EN is the translation. Empty arrays when none inferred.
    tags: {
      ua: { type: [String], default: [] },
      en: { type: [String], default: [] },
    },
  },
  { _id: false }
);

// Who forwarded a 'forwarded' candidate, for queue prioritization and audit.
// Absent on auto-mined candidates. Numeric Telegram id is the bot chat id —
// this is the admin's own intake, not scraped third-party data.
const submittedBySchema = new mongoose.Schema(
  {
    telegramID: { type: Number, default: null },
    name: { type: String, default: null },
    isAdmin: { type: Boolean, default: false },
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
    // May be empty for image-only forwards (the contact lives in the screenshot,
    // read manually at review time). Always set for auto-mined candidates.
    text: { type: String, default: '' },

    // Screenshots forwarded with (or instead of) text. The bot downloads them to
    // S3 at intake; shown in the review UI for manual reading. `ocrText` is
    // reserved for an optional future vision-OCR step (unused today).
    images: {
      type: [
        new mongoose.Schema(
          {
            url: { type: String, required: true },
            fileId: { type: String, default: null },
            ocrText: { type: String, default: null },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    kind: { type: String, enum: KINDS, default: 'unknown' },
    // 0 until the LLM scores it (raw items have no score yet).
    score: { type: Number, default: 0 },
    extracted: { type: extractedSchema, default: () => ({}) },
    // Set when a 'raw' item is run through the LLM on the reviewer's machine.
    processedAt: { type: Date, default: null },

    status: { type: String, enum: STATUS, default: 'new' },
    declineReason: { type: String, enum: [null, ...DECLINE_REASONS], default: null },

    // Empty until processed: 'raw' forwards have no classifier yet.
    classifierName: { type: String, default: '' },
    classifierVersion: { type: String, default: '' },
    runRef: { type: mongoose.Schema.Types.ObjectId, ref: 'MiningRun' },

    // --- forwarded-lead provenance (sourceType: 'forwarded') ---
    // Who sent it in, the origin chat title (best-effort city hint), and a
    // queue-ordering nudge: 0 = normal/trusted, negative = deprioritized
    // (e.g. forwards from non-admins). Auto-mined candidates leave these unset.
    submittedBy: { type: submittedBySchema, default: undefined },
    originChatTitle: { type: String, default: null },
    reviewPriority: { type: Number, default: 0 },

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

const mongoose = require('mongoose');

// Normalized message ingested from a Telegram source (manual export or the
// GramJS watcher). Author identity: a salted hash for clustering (fromHash)
// plus the Telegram display name (fromName) used to fill a card's Name field.
// The numeric author id and @username are NEVER persisted. See docs/data-policy.md.
const INGEST_SOURCES = ['export', 'watch'];

const rawMessageSchema = new mongoose.Schema(
  {
    chatID: { type: String, required: true },
    messageID: { type: Number, required: true },
    date: { type: Date, required: true },
    fromHash: { type: String },
    fromName: { type: String, default: null },
    text: { type: String, default: '' },
    replyToID: { type: Number, default: null },
    lang: { type: String, default: null },
    ingestSource: { type: String, enum: INGEST_SOURCES, required: true },
    runRef: { type: mongoose.Schema.Types.ObjectId, ref: 'MiningRun' },
    raw: mongoose.Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Idempotent ingestion: a message is unique within its chat.
rawMessageSchema.index({ chatID: 1, messageID: 1 }, { unique: true });
// Watcher watermark / chronological scans.
rawMessageSchema.index({ chatID: 1, date: 1 });

const RawMessage = mongoose.model('RawMessage', rawMessageSchema);
RawMessage.INGEST_SOURCES = INGEST_SOURCES;
module.exports = RawMessage;

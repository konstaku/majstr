const mongoose = require('mongoose');

// One execution of the pipeline. `research` = one-shot backfill from an export;
// `watch` = an incremental GramJS watcher pass. `watermark` lets watch mode
// resume without re-processing.
const MODES = ['research', 'watch'];

const miningRunSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: MODES, required: true },
    chatID: { type: String, required: true },
    source: String,
    counts: {
      ingested: { type: Number, default: 0 },
      prefiltered: { type: Number, default: 0 },
      classified: { type: Number, default: 0 },
      candidates: { type: Number, default: 0 },
    },
    costUSD: { type: Number, default: 0 },
    classifierName: String,
    classifierVersion: String,
    watermark: { type: Number, default: null },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

miningRunSchema.index({ chatID: 1, mode: 1, startedAt: -1 });

const MiningRun = mongoose.model('MiningRun', miningRunSchema);
MiningRun.MODES = MODES;
module.exports = MiningRun;

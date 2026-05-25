const mongoose = require('mongoose');

// Every admin decision on a Candidate. This is the training/tuning signal:
// declines tell the pre-filter & prompt what they got wrong; wrong_extraction
// corrections become labeled few-shot pairs. See issue: feedback loop (M3).
const ACTIONS = ['accept', 'decline', 'card', 'merge', 'link'];

const miningFeedbackSchema = new mongoose.Schema(
  {
    candidateRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Candidate',
      required: true,
      index: true,
    },
    action: { type: String, enum: ACTIONS, required: true },
    reasonCode: { type: String, default: null },
    // Admin-corrected fields vs what the classifier extracted (the labeled pair).
    correctedFields: mongoose.Schema.Types.Mixed,
    classifierName: String,
    classifierVersion: String,
    adminTelegramID: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

miningFeedbackSchema.index({ action: 1, createdAt: -1 });

const MiningFeedback = mongoose.model('MiningFeedback', miningFeedbackSchema);
MiningFeedback.ACTIONS = ACTIONS;
module.exports = MiningFeedback;

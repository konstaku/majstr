const mongoose = require('mongoose');

const ACTIONS = ['submit', 'approve', 'reject', 'archive', 'edit', 'restore'];
const STATUS_VALUES = ['draft', 'pending', 'approved', 'rejected', 'archived'];

const masterAuditSchema = new mongoose.Schema(
  {
    masterID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Master',
      required: true,
      index: true,
    },
    actorUserID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorTelegramID: Number,
    action: { type: String, enum: ACTIONS, required: true },
    from: { type: String, enum: [null, ...STATUS_VALUES] },
    to: { type: String, enum: [null, ...STATUS_VALUES] },
    diff: mongoose.Schema.Types.Mixed,
    reason: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

masterAuditSchema.index({ masterID: 1, createdAt: -1 });

const MasterAudit = mongoose.model('MasterAudit', masterAuditSchema);
MasterAudit.ACTIONS = ACTIONS;
module.exports = MasterAudit;

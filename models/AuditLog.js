/**
 * System Audit Log Model
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      trim: true
    },
    entity: {
      type: String,
      required: [true, 'Target entity is required (e.g. Student, Attendance, Fee, User)'],
      trim: true
    },
    entityId: {
      type: String,
      trim: true,
      default: ''
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ip: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

auditLogSchema.index({ user: 1 });
auditLogSchema.index({ entity: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
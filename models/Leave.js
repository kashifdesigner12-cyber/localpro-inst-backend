/**
 * Staff Leave Request Model
 */

const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: [true, 'Staff reference is required']
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
    },
    reason: {
      type: String,
      required: [true, 'Leave reason is required'],
      trim: true
    },
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'APPROVED', 'REJECTED'],
        message: '{VALUE} is not a valid leave status'
      },
      default: 'PENDING'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    remarks: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

leaveSchema.index({ staff: 1 });
leaveSchema.index({ status: 1 });
leaveSchema.index({ startDate: 1, endDate: 1 });

const Leave = mongoose.model('Leave', leaveSchema);

module.exports = Leave;
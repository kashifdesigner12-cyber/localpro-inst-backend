/**
 * Student Fee Model
 */

const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required']
    },

    feeType: {
      type: String,
      enum: {
        values: ['MONTHLY', 'ADMISSION', 'EXAM', 'TRANSPORT', 'OTHER'],
        message: '{VALUE} is not a valid fee type'
      },
      default: 'MONTHLY',
      required: true
    },

    month: {
      type: String,
      required: [
        true,
        'Fee month/period is required (e.g. September 2026)'
      ],
      trim: true
    },

    receiptNumber: {
      type: String,
      required: [true, 'Receipt number is required'],
      unique: true,
      trim: true
    },

    amount: {
      type: Number,
      required: [true, 'Total fee amount is required'],
      min: [0, 'Amount cannot be negative']
    },

    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative']
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative']
    },

    remainingAmount: {
      type: Number,
      default: 0
    },

    date: {
      type: Date,
      default: Date.now
    },

    paymentMethod: {
      type: String,
      enum: {
        values: ['CASH', 'BANK', 'ONLINE', 'OTHER'],
        message: '{VALUE} is not a valid payment method'
      },
      default: 'CASH',
      required: true
    },

    status: {
      type: String,
      enum: {
        values: ['PAID', 'PARTIAL', 'PENDING'],
        message: '{VALUE} is not a valid fee status'
      },
      default: 'PENDING'
    },

    notes: {
      type: String,
      trim: true,
      default: ''
    },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

/**
 * Calculate remaining amount and fee status
 * before saving the fee record.
 *
 * Async middleware is used to avoid
 * "next is not a function" issue.
 */
feeSchema.pre('save', async function () {
  const totalPayable = Math.max(
    0,
    this.amount - (this.discount || 0)
  );

  this.remainingAmount = Math.max(
    0,
    totalPayable - (this.paidAmount || 0)
  );

  if (this.paidAmount >= totalPayable && totalPayable > 0) {
    this.status = 'PAID';
  } else if (
    this.paidAmount > 0 &&
    this.paidAmount < totalPayable
  ) {
    this.status = 'PARTIAL';
  } else if (
    this.paidAmount === 0 &&
    totalPayable > 0
  ) {
    this.status = 'PENDING';
  } else if (totalPayable === 0) {
    this.status = 'PAID';
  }
});

/**
 * Indexes
 */
feeSchema.index({ student: 1 });
feeSchema.index({ date: 1 });
feeSchema.index({ status: 1 });
feeSchema.index({ month: 1 });

/**
 * Unique receipt number index
 *
 * receiptNumber already has unique: true,
 * so no duplicate unique index is created here.
 */
feeSchema.index(
  { receiptNumber: 1 },
  { unique: true }
);

const Fee = mongoose.model('Fee', feeSchema);

module.exports = Fee;


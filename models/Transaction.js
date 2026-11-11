/**
 * Financial Transaction Model (Income & Expense)
 */

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: {
        values: ['INCOME', 'EXPENSE'],
        message:
          '{VALUE} is not a valid transaction type. Allowed: INCOME, EXPENSE'
      },
      required: [true, 'Transaction type is required'],
      uppercase: true,
      trim: true
    },

    category: {
      type: String,
      enum: {
        values: [
          'Fee',
          'Salary',
          'Maintenance',
          'Transport',
          'Utilities',
          'Stationery',
          'Donation',
          'Event',
          'Other'
        ],
        message: '{VALUE} is not a valid transaction category'
      },
      required: [true, 'Category is required'],
      trim: true
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true
    },

    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero']
    },

    date: {
      type: Date,
      default: Date.now,
      required: true
    },

    paymentMethod: {
      type: String,
      enum: {
        values: ['CASH', 'BANK', 'ONLINE', 'OTHER'],
        message: '{VALUE} is not a valid payment method'
      },
      default: 'CASH',
      uppercase: true,
      trim: true
    },

    reference: {
      type: String,
      trim: true,
      default: ''
    },

    createdBy: {
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
 * Indexes
 */
transactionSchema.index({ date: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ category: 1 });
transactionSchema.index({ type: 1, date: 1 });

const Transaction = mongoose.model(
  'Transaction',
  transactionSchema
);

module.exports = Transaction;

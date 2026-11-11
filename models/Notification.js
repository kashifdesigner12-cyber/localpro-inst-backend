const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientType: {
      type: String,
      enum: ['PARENT', 'STAFF', 'USER'],
      default: 'PARENT'
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    },

    parentName: {
      type: String,
      trim: true,
      default: ''
    },

    parentPhone: {
      type: String,
      trim: true,
      default: ''
    },

    parentEmail: {
      type: String,
      trim: true,
      default: ''
    },

    channel: {
      type: String,
      enum: {
        values: ['EMAIL'],
        message:
          '{VALUE} is not a supported notification channel'
      },
      required: true
    },

    type: {
      type: String,
      enum: {
        values: [
          'ATTENDANCE',
          'PERFORMANCE',
          'GENERAL',
          'FEE_REMINDER'
        ],
        message:
          '{VALUE} is not a valid notification type'
      },
      default: 'GENERAL',
      required: true
    },

    message: {
      type: String,
      required: [true, 'Message body is required']
    },

    status: {
      type: String,
      enum: [
        'SENT',
        'FAILED',
        'SKIPPED',
        'PENDING'
      ],
      default: 'PENDING'
    },

    error: {
      type: String,
      default: ''
    },

    sentAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes
notificationSchema.index({
  student: 1
});

notificationSchema.index({
  channel: 1,
  status: 1
});

notificationSchema.index({
  type: 1
});

notificationSchema.index({
  createdAt: -1
});

const Notification =
  mongoose.model(
    'Notification',
    notificationSchema
  );

module.exports = Notification;


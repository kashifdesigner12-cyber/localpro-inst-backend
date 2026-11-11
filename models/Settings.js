const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    schoolName: {
      type: String,
      required: [true, 'School name is required'],
      trim: true
    },

    schoolEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },

    schoolPhone: {
      type: String,
      trim: true,
      default: ''
    },

    schoolAddress: {
      type: String,
      trim: true,
      default: ''
    },

    schoolLogo: {
      type: String,
      trim: true,
      default: ''
    },

    website: {
      type: String,
      trim: true,
      default: ''
    },

    academicYear: {
      type: String,
      trim: true,
      default: ''
    },

    currency: {
      type: String,
      trim: true,
      default: 'PKR'
    },

    timezone: {
      type: String,
      trim: true,
      default: 'Asia/Karachi'
    },

    attendanceSettings: {
      lateAfterMinutes: {
        type: Number,
        default: 15,
        min: 0
      },

      absentNotificationEnabled: {
        type: Boolean,
        default: true
      }
    },

    notificationSettings: {
      emailEnabled: {
        type: Boolean,
        default: true
      }
    },

    isActive: {
      type: Boolean,
      default: true
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Settings', settingsSchema);


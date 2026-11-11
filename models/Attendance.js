/**
 * Student Attendance Model
 */

const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student ID is required']
    },

    date: {
      type: Date,
      required: [true, 'Attendance date is required']
    },

    status: {
      type: String,
      enum: {
        values: ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'],
        message:
          '{VALUE} is not a valid attendance status. Allowed: PRESENT, ABSENT, LATE, LEAVE'
      },
      default: 'PRESENT',
      required: true
    },

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    className: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true
    },

    section: {
      type: String,
      required: [true, 'Section is required'],
      trim: true
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

/**
 * Normalize date to UTC midnight before saving.
 * This ensures one attendance record per
 * student per calendar day.
 */
attendanceSchema.pre('save', async function () {
  if (this.date) {
    const d = new Date(this.date);
    d.setUTCHours(0, 0, 0, 0);
    this.date = d;
  }
});

/**
 * Unique compound index:
 * One attendance per student per date.
 */
attendanceSchema.index(
  { student: 1, date: 1 },
  { unique: true }
);

/**
 * Fast query indexes.
 */
attendanceSchema.index({ date: 1 });
attendanceSchema.index({
  className: 1,
  section: 1,
  date: 1
});
attendanceSchema.index({ status: 1 });

const Attendance = mongoose.model(
  'Attendance',
  attendanceSchema
);

module.exports = Attendance;

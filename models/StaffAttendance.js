/**
 * Staff Attendance Model
 */

const mongoose = require('mongoose');

const staffAttendanceSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: [true, 'Staff reference is required']
    },

    date: {
      type: Date,
      required: [true, 'Attendance date is required']
    },

    status: {
      type: String,
      enum: {
        values: ['PRESENT', 'ABSENT', 'LEAVE', 'LATE'],
        message: '{VALUE} is not a valid staff attendance status'
      },
      default: 'PRESENT',
      required: true
    },

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
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

// Normalize attendance date before saving
staffAttendanceSchema.pre('save', async function () {
  if (this.date) {
    const d = new Date(this.date);

    d.setUTCHours(0, 0, 0, 0);

    this.date = d;
  }
});

// Unique attendance per staff per date
staffAttendanceSchema.index(
  { staff: 1, date: 1 },
  { unique: true }
);

// Additional indexes
staffAttendanceSchema.index({ date: 1 });
staffAttendanceSchema.index({ status: 1 });

const StaffAttendance = mongoose.model(
  'StaffAttendance',
  staffAttendanceSchema
);

module.exports = StaffAttendance;


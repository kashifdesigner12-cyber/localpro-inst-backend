/**
 * Exam Model
 */

const mongoose = require('mongoose');

const examSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Exam name is required'],
      trim: true
    },
    examType: {
      type: String,
      enum: {
        values: ['MIDTERM', 'FINAL', 'MONTHLY_TEST', 'QUIZ', 'ANNUAL', 'OTHER'],
        message: '{VALUE} is not a valid exam type'
      },
      default: 'MIDTERM',
      required: true
    },
    className: {
      type: String,
      required: [true, 'Target class is required (e.g. Class 7, All Classes)'],
      trim: true
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required (e.g. 2026-2027)'],
      trim: true
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

examSchema.index({ className: 1 });
examSchema.index({ academicYear: 1 });
examSchema.index({ startDate: 1 });

const Exam = mongoose.model('Exam', examSchema);

module.exports = Exam;
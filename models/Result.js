/**
 * Student Exam Result Model
 */

const mongoose = require('mongoose');
const {
  calculateGrade,
  getGradeRemarks
} = require('../utils/gradeCalculator');

const resultSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student ID is required']
    },

    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: [true, 'Exam ID is required']
    },

    subject: {
      type: String,
      required: [
        true,
        'Subject is required (e.g. Mathematics, English, Science)'
      ],
      trim: true
    },

    totalMarks: {
      type: Number,
      required: [true, 'Total marks are required'],
      min: [1, 'Total marks must be at least 1']
    },

    obtainedMarks: {
      type: Number,
      required: [true, 'Obtained marks are required'],
      min: [0, 'Obtained marks cannot be negative']
    },

    percentage: {
      type: Number
    },

    grade: {
      type: String
    },

    remarks: {
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
 * Calculate percentage, grade and default remarks
 * before saving result.
 *
 * Async middleware is used because the current
 * Mongoose version does not require next().
 */
resultSchema.pre('save', async function () {
  if (this.totalMarks > 0) {
    this.percentage =
      Math.round(
        ((this.obtainedMarks / this.totalMarks) * 100) * 100
      ) / 100;

    this.grade = calculateGrade(this.percentage);

    if (!this.remarks) {
      this.remarks = getGradeRemarks(this.grade);
    }
  }
});

/**
 * Only one result per student + exam + subject
 */
resultSchema.index(
  {
    student: 1,
    exam: 1,
    subject: 1
  },
  {
    unique: true
  }
);

/**
 * Additional indexes
 */
resultSchema.index({
  student: 1,
  exam: 1
});

resultSchema.index({
  exam: 1
});

const Result = mongoose.model('Result', resultSchema);

module.exports = Result;


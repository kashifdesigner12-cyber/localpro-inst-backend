const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true
    },

    admissionNo: {
      type: String,
      required: [true, 'Admission number is required'],
      unique: true,
      trim: true,
      uppercase: true
    },

    className: {
      type: String,
      required: [true, 'Course/Class name is required'],
      trim: true
    },

    courseDuration: {
      type: String,
      trim: true,
      default: '3 Months'
    },

    section: {
      type: String,
      required: [true, 'Section / Timing is required'],
      trim: true,
      uppercase: true
    },

    rollNo: {
      type: String,
      trim: true,
      default: ''
    },

    gender: {
      type: String,
      enum: {
        values: ['MALE', 'FEMALE', 'OTHER', 'Male', 'Female', 'Other'],
        message: '{VALUE} is not valid. Allowed: Male, Female, Other'
      },
      default: 'Male'
    },

    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'INACTIVE', 'Active', 'Inactive'],
        message: '{VALUE} is not valid. Allowed: Active, Inactive'
      },
      default: 'Active'
    },

    // Student CNIC & ID Card Picture (Required on admission)
    cnic: {
      type: String,
      trim: true,
      default: ''
    },

    idCardPhoto: {
      type: String,
      trim: true,
      default: ''
    },

    // Student profile photo
    photo: {
      type: String,
      default: ''
    },

    /**
     * Student Documents
     */
    documents: [
      {
        type: {
          type: String,
          required: true,
          trim: true
        },

        name: {
          type: String,
          required: true,
          trim: true
        },

        fileUrl: {
          type: String,
          required: true,
          trim: true
        },

        mimeType: {
          type: String,
          default: ''
        },

        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    parentName: {
      type: String,
      required: [true, 'Parent/Guardian name is required'],
      trim: true
    },

    parentPhone: {
      type: String,
      trim: true,
      default: ''
    },

    studentPhone: {
      type: String,
      trim: true,
      default: ''
    },

    parentEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },

    dateOfBirth: {
      type: Date
    },

    address: {
      type: String,
      trim: true,
      default: ''
    },

    admissionDate: {
      type: Date,
      default: Date.now
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
 * Indexes for fast lookup and reporting
 */
studentSchema.index({ className: 1, section: 1 });
studentSchema.index({ status: 1 });
studentSchema.index({ cnic: 1 });
studentSchema.index({
  name: 'text',
  parentName: 'text',
  admissionNo: 'text'
});

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
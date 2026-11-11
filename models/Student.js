const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: 'Student'
    },

    admissionNo: {
      type: String,
      trim: true,
      uppercase: true,
      default: () => `ADM-${Date.now().toString().slice(-6)}`
    },

    className: {
      type: String,
      trim: true,
      default: 'General'
    },

    courseDuration: {
      type: String,
      trim: true,
      default: '3 Months'
    },

    section: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'MORNING'
    },

    rollNo: {
      type: String,
      trim: true,
      default: ''
    },

    gender: {
      type: String,
      trim: true,
      default: 'Male',
      set: function (val) {
        if (!val) return 'Male';
        const clean = String(val).trim().toLowerCase();
        if (clean === 'female' || clean === 'f' || clean.startsWith('female')) return 'Female';
        if (clean === 'other' || clean === 'o' || clean.startsWith('other')) return 'Other';
        if (clean === 'male' || clean === 'm' || clean.startsWith('male')) return 'Male';
        return 'Male';
      }
    },

    status: {
      type: String,
      default: 'Active'
    },

    // Student CNIC & ID Card Picture
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
          trim: true,
          default: ''
        },

        name: {
          type: String,
          trim: true,
          default: ''
        },

        fileUrl: {
          type: String,
          trim: true,
          default: ''
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
      trim: true,
      default: ''
    },

    parentPhone: {
      type: String,
      trim: true,
      default: ''
    },

    parentWhatsApp: {
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
      ref: 'User'
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
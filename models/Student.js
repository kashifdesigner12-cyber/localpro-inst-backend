const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: 'Student'
    },

    // Custom display name that student can update inside WhatsApp-style chat
    chatDisplayName: {
      type: String,
      trim: true,
      default: ''
    },

    admissionNo: {
      type: String,
      trim: true,
      uppercase: true,
      default: () => `ADM-${Date.now().toString().slice(-6)}`
    },

    // Auto-generated / assigned login credentials for Student Portal
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true
    },

    password: {
      type: String,
      select: false
    },

    // Plain/initial password reference so teacher/admin can share credentials with student
    plainPassword: {
      type: String,
      default: ''
    },

    role: {
      type: String,
      default: 'student'
    },

    // Real-time Socket.io presence fields
    isOnline: {
      type: Boolean,
      default: false
    },

    lastSeen: {
      type: Date,
      default: Date.now
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

    // Student CNIC & ID Card Picture (Optional)
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

    // Student profile photo (used in student profile & WhatsApp chat DP)
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
 * Hash password before saving if modified
 */
studentSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * Compare entered password with stored hashed password
 */
studentSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

/**
 * Indexes for fast lookup and reporting
 */
studentSchema.index({ className: 1, section: 1 });
studentSchema.index({ status: 1 });
studentSchema.index({ cnic: 1 });
studentSchema.index({ email: 1 });
studentSchema.index({
  name: 'text',
  parentName: 'text',
  admissionNo: 'text'
});

const Student = mongoose.model('Student', studentSchema);

module.exports = Student;
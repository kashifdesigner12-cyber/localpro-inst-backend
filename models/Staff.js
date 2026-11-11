const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
  {
    // Staff basic information
    name: {
      type: String,
      required: [true, 'Staff name is required'],
      trim: true
    },

    email: {
      type: String,
      required: [true, 'Staff email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\S+@\S+\.\S+$/,
        'Please provide a valid email address'
      ]
    },

    phone: {
      type: String,
      required: [true, 'Staff phone number is required'],
      trim: true
    },

    // Employee ID
    employeeId: {
      type: String,
      trim: true,
      default: ''
    },

    // Job information
    designation: {
      type: String,
      required: [
        true,
        'Designation is required (e.g. Senior Teacher, Accountant, Principal)'
      ],
      trim: true
    },

    department: {
      type: String,
      required: [
        true,
        'Department is required (e.g. Science, Mathematics, Administration)'
      ],
      trim: true
    },

    qualification: {
      type: String,
      trim: true,
      default: ''
    },

    // Salary
    salary: {
      type: Number,
      default: 0,
      min: [0, 'Salary cannot be negative']
    },

    // Personal / official information
    cnic: {
      type: String,
      trim: true,
      default: ''
    },

    bankAccount: {
      type: String,
      trim: true,
      default: ''
    },

    // Joining date
    joiningDate: {
      type: Date,
      default: Date.now
    },

    // Staff status
    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'INACTIVE'],
        message: '{VALUE} is not a valid status'
      },
      default: 'ACTIVE'
    },

    // Staff photo
    photo: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Indexes
// email already has unique: true, so no duplicate unique index here
staffSchema.index({ status: 1 });
staffSchema.index({ department: 1 });
staffSchema.index({ designation: 1 });
staffSchema.index({ employeeId: 1 });

const Staff = mongoose.model('Staff', staffSchema);

module.exports = Staff;


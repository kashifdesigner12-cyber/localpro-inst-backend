/**
 * User Model (Admin, Teacher)
 * Note: Parents DO NOT log into the system
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide user name'],
      trim: true
    },

    email: {
      type: String,
      required: [true, 'Please provide user email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },

    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false
    },

    role: {
      type: String,
      enum: {
        values: ['ADMIN', 'TEACHER'],
        message: '{VALUE} is not a valid role. Allowed: ADMIN, TEACHER'
      },
      default: 'TEACHER',
      required: true
    },

    phone: {
      type: String,
      trim: true,
      default: ''
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

/**
 * Hash password before saving
 *
 * IMPORTANT:
 * This is an async Mongoose middleware.
 * Do NOT use next() here.
 */
userSchema.pre('save', async function () {
  // If password has not changed, don't hash it again
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Compare entered password with hashed password
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

/**
 * Remove sensitive fields from JSON response
 */
userSchema.methods.toJSON = function () {
  const user = this.toObject();

  delete user.password;
  delete user.__v;

  return user;
};

/**
 * Indexes
 *
 * email already has unique: true, so don't create
 * another email index here.
 */
userSchema.index({ role: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;

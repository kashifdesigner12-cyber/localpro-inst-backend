/**
 * Authentication Controller
 * Handles Login, Profile, Password, and Logout
 *
 * Public registration is intentionally disabled.
 * Users must already exist in the database.
 */

const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const ApiResponse = require('../utils/apiResponse');
const { logAction } = require('../services/auditService');

/**
 * Normalize email safely
 */
const normalizeEmail = (email) => {
  if (typeof email !== 'string') {
    return '';
  }

  return email.trim().toLowerCase();
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;

    if (!email || !password) {
      return ApiResponse.error(
        res,
        400,
        'Please provide email and password'
      );
    }

    if (typeof password !== 'string') {
      return ApiResponse.error(
        res,
        400,
        'Password must be a valid string'
      );
    }

    const user = await User.findOne({
      email
    }).select('+password');

    // Same message for invalid email/password
    // to avoid revealing whether an account exists.
    if (!user) {
      return ApiResponse.error(
        res,
        401,
        'Invalid email or password'
      );
    }

    if (!user.isActive) {
      return ApiResponse.error(
        res,
        403,
        'Account is deactivated. Please contact administration.'
      );
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return ApiResponse.error(
        res,
        401,
        'Invalid email or password'
      );
    }

    const token = generateToken({
      userId: user._id.toString(),
      role: user.role
    });

    await logAction({
      user: user._id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user._id.toString(),
      details: {
        email: user.email,
        role: user.role
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Login successful',
      {
        user: user.toJSON(),
        token
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged-in user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return ApiResponse.error(
        res,
        404,
        'User profile not found'
      );
    }

    return ApiResponse.success(
      res,
      200,
      'Current user profile retrieved',
      {
        user: user.toJSON()
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update current user's profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body || {};

    // Only allow these fields to be updated.
    // Email, role, isActive and password cannot be changed here.
    const hasName = name !== undefined;
    const hasPhone = phone !== undefined;

    if (!hasName && !hasPhone) {
      return ApiResponse.error(
        res,
        400,
        'Please provide at least one field to update'
      );
    }

    if (hasName && typeof name !== 'string') {
      return ApiResponse.error(
        res,
        400,
        'Name must be a valid string'
      );
    }

    if (hasPhone && typeof phone !== 'string') {
      return ApiResponse.error(
        res,
        400,
        'Phone must be a valid string'
      );
    }

    if (hasName && !name.trim()) {
      return ApiResponse.error(
        res,
        400,
        'Name cannot be empty'
      );
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return ApiResponse.error(
        res,
        404,
        'User profile not found'
      );
    }

    if (hasName) {
      user.name = name.trim();
    }

    if (hasPhone) {
      user.phone = phone.trim();
    }

    await user.save();

    await logAction({
      user: user._id,
      action: 'PROFILE_UPDATE',
      entity: 'User',
      entityId: user._id.toString(),
      details: {
        updatedFields: {
          name: hasName,
          phone: hasPhone
        }
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Profile updated successfully',
      {
        user: user.toJSON()
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change current user's password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
  try {
    const {
      currentPassword,
      newPassword,
      confirmPassword
    } = req.body || {};

    // Validate required fields
    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return ApiResponse.error(
        res,
        400,
        'Please provide current password, new password, and confirm password'
      );
    }

    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      typeof confirmPassword !== 'string'
    ) {
      return ApiResponse.error(
        res,
        400,
        'Password fields must be valid strings'
      );
    }

    // Minimum password length
    if (newPassword.length < 6) {
      return ApiResponse.error(
        res,
        400,
        'New password must be at least 6 characters long'
      );
    }

    // Maximum reasonable password length
    if (newPassword.length > 128) {
      return ApiResponse.error(
        res,
        400,
        'New password must not exceed 128 characters'
      );
    }

    // Confirm password
    if (newPassword !== confirmPassword) {
      return ApiResponse.error(
        res,
        400,
        'New password and confirm password do not match'
      );
    }

    // Get user including password
    const user = await User.findById(
      req.user._id
    ).select('+password');

    if (!user) {
      return ApiResponse.error(
        res,
        404,
        'User profile not found'
      );
    }

    // Verify current password
    const isCurrentPasswordCorrect =
      await user.matchPassword(currentPassword);

    if (!isCurrentPasswordCorrect) {
      return ApiResponse.error(
        res,
        401,
        'Current password is incorrect'
      );
    }

    // Prevent same password
    const isSamePassword =
      await user.matchPassword(newPassword);

    if (isSamePassword) {
      return ApiResponse.error(
        res,
        400,
        'New password must be different from current password'
      );
    }

    // User model pre-save middleware hashes password
    user.password = newPassword;

    await user.save();

    await logAction({
      user: user._id,
      action: 'PASSWORD_CHANGE',
      entity: 'User',
      entityId: user._id.toString(),
      details: {
        email: user.email
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Password changed successfully',
      null
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 *
 * JWT is stateless, so the server cannot invalidate the token
 * unless a token blacklist/session system is implemented.
 * The frontend must remove the token after this response.
 */
const logout = async (req, res, next) => {
  try {
    await logAction({
      user: req.user._id,
      action: 'LOGOUT',
      entity: 'User',
      entityId: req.user._id.toString(),
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Logout successful. Please remove the authentication token on the client.'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getMe,
  updateProfile,
  changePassword,
  logout
};
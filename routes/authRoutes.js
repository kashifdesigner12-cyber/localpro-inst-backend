/**
 * Authentication Routes
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// --------------------------------------------------
// Public Routes
// --------------------------------------------------

// Login only.
// Users must already exist in the database.
router.post('/login', authController.login);

// --------------------------------------------------
// Protected Routes
// --------------------------------------------------

// Get current logged-in user
router.get('/me', protect, authController.getMe);

// Update current user's profile
router.put(
  '/profile',
  protect,
  authController.updateProfile
);

// Change current user's password
router.put(
  '/change-password',
  protect,
  authController.changePassword
);

// Logout
router.post(
  '/logout',
  protect,
  authController.logout
);

module.exports = router;
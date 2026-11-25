/**
 * Reports Routes
 */

const express = require('express');
const router = express.Router();

const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const {
  requireAdmin,
  requireAdminOrTeacher
} = require('../middleware/roleMiddleware');

// All report routes require authentication
router.use(protect);

// Student Report
router.get(
  '/students',
  requireAdminOrTeacher,
  reportController.getStudentReport
);

// Attendance Report
router.get(
  '/attendance',
  requireAdminOrTeacher,
  reportController.getAttendanceReport
);

// Student Performance Report
router.get(
  '/performance/:studentId',
  requireAdminOrTeacher,
  reportController.getPerformanceReport
);

// Financial Reports - Admin Only
router.get(
  '/fees',
  requireAdmin,
  reportController.getFeeReport
);

router.get(
  '/transactions',
  requireAdmin,
  reportController.getTransactionReport
);

module.exports = router;


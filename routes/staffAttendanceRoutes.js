/**
 * Staff Attendance Routes
 */

const express = require('express');
const router = express.Router();

const staffAttendanceController = require('../controllers/staffAttendanceController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(requireAdmin);

/**
 * Staff Attendance
 */

// Create + Get All
router
  .route('/')
  .post(staffAttendanceController.markStaffAttendance)
  .get(staffAttendanceController.getStaffAttendance);

// Get By ID + Update + Delete
router
  .route('/:id')
  .get(staffAttendanceController.getStaffAttendanceById)
  .put(staffAttendanceController.updateStaffAttendance)
  .delete(staffAttendanceController.deleteStaffAttendance);

module.exports = router;

/**
 * Attendance Routes
 */

const express = require('express');
const router = express.Router();

const attendanceController = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdminOrTeacher } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(requireAdminOrTeacher);

// Mark single attendance
router.post('/', attendanceController.markAttendance);

// Mark bulk attendance
router.post('/bulk', attendanceController.markBulkAttendance);

// Get all attendance
router.get('/', attendanceController.getAttendance);

// Get attendance by date
router.get('/date/:date', attendanceController.getAttendanceByDate);

// Get attendance by student
router.get('/student/:studentId', attendanceController.getAttendanceByStudent);

// Get attendance by ID
router.get('/:id', attendanceController.getAttendanceById);

// Update attendance
router.put('/:id', attendanceController.updateAttendance);

// Delete attendance
router.delete('/:id', attendanceController.deleteAttendance);

module.exports = router;

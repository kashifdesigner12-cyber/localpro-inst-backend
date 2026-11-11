const express = require("express");

const router = express.Router();

const performanceController = require("../controllers/performanceController");

const { protect } = require("../middleware/authMiddleware");

const {
  requireAdminOrTeacher,
} = require("../middleware/roleMiddleware");

// ======================================================
// AUTH
// ======================================================

router.use(protect);

// ======================================================
// PERFORMANCE
// ======================================================

// Save / update student performance
router.post(
  "/",
  requireAdminOrTeacher,
  performanceController.savePerformance
);

// Get performance
router.get(
  "/",
  requireAdminOrTeacher,
  performanceController.getPerformance
);

// Get one student's performance
router.get(
  "/student/:studentId",
  requireAdminOrTeacher,
  performanceController.getStudentPerformance
);

module.exports = router;
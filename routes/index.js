/**
 * Master API Router
 * Consolidates and mounts all sub-route modules
 */

const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

// ==================================================
// ROUTE MODULES
// ==================================================

const authRoutes = require("./authRoutes");
const studentRoutes = require("./studentRoutes");
const attendanceRoutes = require("./attendanceRoutes");
const feeRoutes = require("./feeRoutes");
const transactionRoutes = require("./transactionRoutes");
const staffRoutes = require("./staffRoutes");
const staffAttendanceRoutes = require("./staffAttendanceRoutes");
const leaveRoutes = require("./leaveRoutes");
const examRoutes = require("./examRoutes");
const resultRoutes = require("./resultRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const reportRoutes = require("./reportRoutes");
const notificationRoutes = require("./notificationRoutes");
const settingsRoutes = require("./settingsRoutes");
const performanceRoutes = require("./performanceRoutes");
const classRoutes = require("./classRoutes");

const ApiResponse = require("../utils/apiResponse");

// ==================================================
// HEALTH CHECK
// GET /api/health
// ==================================================

router.get("/health", (req, res) => {
  const isDatabaseConnected =
    mongoose.connection.readyState === 1;

  const dbStatus = isDatabaseConnected
    ? "connected"
    : "disconnected";

  const status = isDatabaseConnected
    ? "healthy"
    : "unhealthy";

  const statusCode = isDatabaseConnected
    ? 200
    : 503;

  return ApiResponse.success(
    res,
    statusCode,
    isDatabaseConnected
      ? "School Management API is running"
      : "School Management API is running, but database is unavailable",
    {
      status,
      timestamp: new Date().toISOString(),
      database: dbStatus,
      uptime: process.uptime(),
    }
  );
});

// ==================================================
// AUTH
// /api/auth
// ==================================================

router.use(
  "/auth",
  authRoutes
);

router.use("/performance", performanceRoutes);
router.use("/classes", classRoutes);

// ==================================================
// STUDENTS
// /api/students
// ==================================================

router.use(
  "/students",
  studentRoutes
);

// ==================================================
// ATTENDANCE
// /api/attendance
// ==================================================

router.use(
  "/attendance",
  attendanceRoutes
);

// ==================================================
// FEES
// /api/fees
// ==================================================

router.use(
  "/fees",
  feeRoutes
);

// ==================================================
// TRANSACTIONS
// /api/transactions
// ==================================================

router.use(
  "/transactions",
  transactionRoutes
);

// ==================================================
// STAFF
// /api/staff
// ==================================================

router.use(
  "/staff",
  staffRoutes
);

// ==================================================
// STAFF ATTENDANCE
// /api/staff-attendance
// ==================================================

router.use(
  "/staff-attendance",
  staffAttendanceRoutes
);

// ==================================================
// LEAVES
// /api/leaves
// ==================================================

router.use(
  "/leaves",
  leaveRoutes
);

// ==================================================
// EXAMS
// /api/exams
// ==================================================

router.use(
  "/exams",
  examRoutes
);

// ==================================================
// RESULTS
// /api/results
// ==================================================

router.use(
  "/results",
  resultRoutes
);

// ==================================================
// PERFORMANCE
// /api/performance
// ==================================================
//
// POST   /api/performance
// GET    /api/performance
// GET    /api/performance?year=2026
// GET    /api/performance?month=2026-09
// GET    /api/performance/student/:studentId
//
// ==================================================

router.use(
  "/performance",
  performanceRoutes
);

// ==================================================
// DASHBOARD
// /api/dashboard
// ==================================================

router.use(
  "/dashboard",
  dashboardRoutes
);

// ==================================================
// REPORTS
// /api/reports
// ==================================================

router.use(
  "/reports",
  reportRoutes
);

// ==================================================
// NOTIFICATIONS
// /api/notifications
// ==================================================

router.use(
  "/notifications",
  notificationRoutes
);

// ==================================================
// SETTINGS
// /api/settings
// ==================================================

router.use(
  "/settings",
  settingsRoutes
);

// ==================================================
// EXPORT
// ==================================================

module.exports = router;
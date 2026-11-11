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
  const isDatabaseConnected = mongoose.connection.readyState === 1;

  const dbStatus = isDatabaseConnected ? "connected" : "disconnected";
  const status = isDatabaseConnected ? "healthy" : "unhealthy";
  const statusCode = isDatabaseConnected ? 200 : 503;

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
// ROUTES MOUNTING
// ==================================================

router.use("/auth", authRoutes);
router.use("/classes", classRoutes);
router.use("/students", studentRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/fees", feeRoutes);
router.use("/transactions", transactionRoutes);
router.use("/staff", staffRoutes);
router.use("/staff-attendance", staffAttendanceRoutes);
router.use("/leaves", leaveRoutes);
router.use("/exams", examRoutes);
router.use("/results", resultRoutes);
router.use("/performance", performanceRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/reports", reportRoutes);
router.use("/notifications", notificationRoutes);
router.use("/settings", settingsRoutes);

// ==================================================
// EXPORT
// ==================================================

module.exports = router;
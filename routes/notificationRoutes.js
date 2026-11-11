/**
 * Notification Logs Routes
 */

const express = require('express');
const router = express.Router();

const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

// Authentication
router.use(protect);

// Admin only
router.use(requireAdmin);

// Get all notifications
router.get('/', notificationController.getNotifications);

// Get unread notification count
// IMPORTANT: This must come before /:id
router.get('/unread-count', notificationController.getUnreadCount);

// Get audit logs
router.get('/audit-logs', notificationController.getAuditLogs);

// Get notification by ID
// Keep dynamic route at the end
router.get('/:id', notificationController.getNotificationById);

module.exports = router;


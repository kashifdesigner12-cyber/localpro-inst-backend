/**
 * Notification Log & Management Controller
 */

const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const ApiResponse = require('../utils/apiResponse');
const { isValidObjectId } = require('../utils/validators');

/**
 * @desc    Get all notification logs
 * @route   GET /api/notifications
 * @access  Private (Admin)
 */
const getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 30;
    const skip = (page - 1) * limit;

    const { channel, type, status, studentId } = req.query;

    const query = {};

    if (channel) query.channel = channel.toUpperCase();
    if (type) query.type = type.toUpperCase();
    if (status) query.status = status.toUpperCase();

    if (studentId && isValidObjectId(studentId)) {
      query.student = studentId;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate('student', 'name admissionNo className section')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Notification.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return ApiResponse.success(
      res,
      200,
      'Notification logs retrieved',
      { notifications },
      { page, limit, total, totalPages }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get unread notification count
 * @route   GET /api/notifications/unread-count
 * @access  Private (Admin)
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      status: { $in: ['PENDING', 'FAILED'] }
    });

    return ApiResponse.success(
      res,
      200,
      'Unread notification count retrieved',
      { count }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single notification log by ID
 * @route   GET /api/notifications/:id
 * @access  Private (Admin)
 */
const getNotificationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid notification ID format'
      );
    }

    const notification = await Notification.findById(id)
      .populate('student', 'name admissionNo className section');

    if (!notification) {
      return ApiResponse.error(
        res,
        404,
        'Notification log not found'
      );
    }

    return ApiResponse.success(
      res,
      200,
      'Notification log details retrieved',
      { notification }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get system audit logs
 * @route   GET /api/audit-logs
 * @access  Private (Admin)
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const { action, entity, userId } = req.query;

    const query = {};

    if (action) {
      query.action = new RegExp(action.trim(), 'i');
    }

    if (entity) {
      query.entity = entity;
    }

    if (userId && isValidObjectId(userId)) {
      query.user = userId;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('user', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      AuditLog.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return ApiResponse.success(
      res,
      200,
      'Audit logs retrieved',
      { logs },
      { page, limit, total, totalPages }
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  getNotificationById,
  getAuditLogs
};


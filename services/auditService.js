/**
 * System Audit Logging Service
 */

const AuditLog = require('../models/AuditLog');

/**
 * Log an administrative/system action
 * @param {Object} params
 * @param {string} [params.user] - User ID who triggered the action
 * @param {string} params.action - Action name (e.g. LOGIN, STUDENT_CREATED)
 * @param {string} params.entity - Entity type (e.g. Student, Fee)
 * @param {string} [params.entityId] - Target entity ID
 * @param {Object} [params.details] - Additional contextual payload
 * @param {string} [params.ip] - Request IP
 */
const logAction = async ({ user, action, entity, entityId = '', details = {}, ip = '' }) => {
  try {
    await AuditLog.create({
      user: user || null,
      action,
      entity,
      entityId: entityId ? String(entityId) : '',
      details,
      ip
    });
  } catch (err) {
    // Non-blocking: Logging failure should never crash the main application workflow
    console.error('[AuditLog Service Error]', err.message);
  }
};

module.exports = {
  logAction
};
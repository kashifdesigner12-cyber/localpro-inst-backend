/**
 * Role-Based Access Control (RBAC) Middleware
 */

const ApiResponse = require('../utils/apiResponse');

/**
 * Check whether authenticated user has one of the allowed roles.
 */
const hasRole = (req, roles) => {
  if (!req.user || !req.user.role) {
    return false;
  }

  const userRole = String(req.user.role)
    .trim()
    .toUpperCase();

  return roles.includes(userRole);
};

/**
 * Restrict access to ADMIN role only
 */
const requireAdmin = (req, res, next) => {
  if (!hasRole(req, ['ADMIN'])) {
    return ApiResponse.error(
      res,
      403,
      'Access denied. Administrator privileges are required.'
    );
  }

  next();
};

/**
 * Restrict access to TEACHER role only
 */
const requireTeacher = (req, res, next) => {
  if (!hasRole(req, ['TEACHER'])) {
    return ApiResponse.error(
      res,
      403,
      'Access denied. Teacher privileges are required.'
    );
  }

  next();
};

/**
 * Restrict access to ADMIN or TEACHER
 */
const requireAdminOrTeacher = (req, res, next) => {
  if (!hasRole(req, ['ADMIN', 'TEACHER'])) {
    return ApiResponse.error(
      res,
      403,
      'Access denied. Authorized user privileges are required.'
    );
  }

  next();
};

/**
 * Generic authorization middleware
 *
 * Usage:
 * authorize('ADMIN')
 * authorize('ADMIN', 'TEACHER')
 */
const authorize = (...roles) => {
  const allowedRoles = roles
    .filter(
      (role) =>
        typeof role === 'string' &&
        role.trim().length > 0
    )
    .map((role) =>
      role.trim().toUpperCase()
    );

  return (req, res, next) => {
    if (allowedRoles.length === 0) {
      return ApiResponse.error(
        res,
        403,
        'Access denied. No authorized roles were configured.'
      );
    }

    if (!hasRole(req, allowedRoles)) {
      return ApiResponse.error(
        res,
        403,
        'Access denied. You do not have permission to perform this action.'
      );
    }

    next();
  };
};

module.exports = {
  requireAdmin,
  requireTeacher,
  requireAdminOrTeacher,
  authorize
};
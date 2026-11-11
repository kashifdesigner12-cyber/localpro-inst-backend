/**
 * JWT Authentication Middleware
 */

const jwt = require("jsonwebtoken");
const config = require("../config/env");
const User = require("../models/User");
const ApiResponse = require("../utils/apiResponse");

// ==================================================
// PROTECT
// ==================================================
// Checks:
// 1. Authorization header
// 2. Bearer token
// 3. JWT validity
// 4. User existence
// 5. User active status
// ==================================================

const protect = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    // --------------------------------------------------
    // Check Authorization Header
    // --------------------------------------------------

    if (
      !authorization ||
      typeof authorization !== "string"
    ) {
      return ApiResponse.error(
        res,
        401,
        "Not authorized, access token is missing"
      );
    }

    // --------------------------------------------------
    // Validate Bearer Scheme
    // --------------------------------------------------

    const parts = authorization.trim().split(/\s+/);

    if (
      parts.length !== 2 ||
      parts[0].toLowerCase() !== "bearer" ||
      !parts[1]
    ) {
      return ApiResponse.error(
        res,
        401,
        "Not authorized, invalid authorization header format"
      );
    }

    const token = parts[1].trim();

    if (!token) {
      return ApiResponse.error(
        res,
        401,
        "Not authorized, access token is missing"
      );
    }

    // --------------------------------------------------
    // Verify JWT
    // --------------------------------------------------

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        config.jwt.secret
      );
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return ApiResponse.error(
          res,
          401,
          "Token has expired, please login again"
        );
      }

      if (error.name === "NotBeforeError") {
        return ApiResponse.error(
          res,
          401,
          "Token is not active yet"
        );
      }

      if (error.name === "JsonWebTokenError") {
        return ApiResponse.error(
          res,
          401,
          "Not authorized, token is invalid"
        );
      }

      return ApiResponse.error(
        res,
        401,
        "Not authorized, token verification failed"
      );
    }

    // --------------------------------------------------
    // Validate JWT Payload
    // --------------------------------------------------

    if (
      !decoded ||
      !decoded.userId ||
      typeof decoded.userId !== "string"
    ) {
      return ApiResponse.error(
        res,
        401,
        "Not authorized, token payload is invalid"
      );
    }

    // --------------------------------------------------
    // Fetch User
    // --------------------------------------------------

    const user = await User.findById(
      decoded.userId
    ).select("-password");

    if (!user) {
      return ApiResponse.error(
        res,
        401,
        "User associated with this token no longer exists"
      );
    }

    // --------------------------------------------------
    // Check Account Status
    // --------------------------------------------------

    if (!user.isActive) {
      return ApiResponse.error(
        res,
        403,
        "Your account has been deactivated. Please contact administrator."
      );
    }

    // --------------------------------------------------
    // Attach Authenticated User
    // --------------------------------------------------

    req.user = user;

    next();
  } catch (error) {
    // Unexpected database/server errors
    // are passed to the global error handler.
    next(error);
  }
};

// ==================================================
// REQUIRE ADMIN
// ==================================================
// Only ADMIN users can access admin-only routes.
// ==================================================

const requireAdmin = (req, res, next) => {
  try {
    // protect middleware must run first
    if (!req.user) {
      return ApiResponse.error(
        res,
        401,
        "Not authorized, authentication required"
      );
    }

    // Get role safely
    const role = String(
      req.user.role || ""
    )
      .trim()
      .toUpperCase();

    // Only ADMIN allowed
    if (role !== "ADMIN") {
      return ApiResponse.error(
        res,
        403,
        "Access denied. Administrator privileges are required."
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

// ==================================================
// EXPORTS
// ==================================================

module.exports = {
  protect,
  requireAdmin,
};
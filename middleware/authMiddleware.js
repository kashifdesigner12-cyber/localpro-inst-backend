/**
 * JWT Authentication Middleware
 */

const jwt = require("jsonwebtoken");
const config = require("../config/env");
const User = require("../models/User");
const Student = require("../models/Student");
const ApiResponse = require("../utils/apiResponse");

// ==================================================
// PROTECT
// ==================================================
// Checks:
// 1. Authorization header
// 2. Bearer token
// 3. JWT validity
// 4. User or Student existence
// 5. Active status
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
    // Student Token Handling
    // --------------------------------------------------

    const tokenRole = String(decoded.role || "").trim().toLowerCase();

    if (tokenRole === "student") {
      const student = await Student.findById(decoded.userId).select("-password");

      if (!student) {
        return ApiResponse.error(
          res,
          401,
          "Student associated with this token no longer exists"
        );
      }

      if (student.status && student.status.toLowerCase() === "inactive") {
        return ApiResponse.error(
          res,
          403,
          "Your student account has been deactivated. Please contact administrator."
        );
      }

      req.user = {
        _id: student._id,
        id: student._id.toString(),
        name: student.chatDisplayName || student.name,
        fullName: student.name,
        chatDisplayName: student.chatDisplayName || student.name,
        email: student.email,
        admissionNo: student.admissionNo,
        className: student.className,
        section: student.section,
        photo: student.photo,
        role: "student",
        modelType: "Student"
      };

      return next();
    }

    // --------------------------------------------------
    // Fetch User (Admin / Teacher)
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
    req.user.modelType = "User";

    next();
  } catch (error) {
    next(error);
  }
};

// ==================================================
// REQUIRE ADMIN
// ==================================================

const requireAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return ApiResponse.error(
        res,
        401,
        "Not authorized, authentication required"
      );
    }

    const role = String(req.user.role || "")
      .trim()
      .toUpperCase();

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
// REQUIRE TEACHER OR ADMIN
// ==================================================

const requireTeacherOrAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return ApiResponse.error(
        res,
        401,
        "Not authorized, authentication required"
      );
    }

    const role = String(req.user.role || "")
      .trim()
      .toUpperCase();

    if (role !== "ADMIN" && role !== "TEACHER") {
      return ApiResponse.error(
        res,
        403,
        "Access denied. Teacher or Administrator privileges are required."
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
  requireTeacherOrAdmin,
};
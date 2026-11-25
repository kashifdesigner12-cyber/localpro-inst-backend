/**
 * Centralized Error Handling Middleware
 */

const ApiResponse = require('../utils/apiResponse');
const config = require('../config/env');

/**
 * 404 - Route Not Found
 */
const notFound = (req, res) => {
  return ApiResponse.error(
    res,
    404,
    `Not Found - ${req.originalUrl}`
  );
};

/**
 * Centralized Error Handler
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors = null;

  // --------------------------------------------------
  // Custom / Existing Status Code
  // --------------------------------------------------

  if (Number.isInteger(err.statusCode) && err.statusCode >= 400) {
    statusCode = err.statusCode;
  } else if (Number.isInteger(err.status) && err.status >= 400) {
    statusCode = err.status;
  } else if (res.statusCode && res.statusCode >= 400) {
    statusCode = res.statusCode;
  }

  // --------------------------------------------------
  // Mongoose CastError
  // Example: Invalid MongoDB ObjectId
  // --------------------------------------------------

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid resource identifier format for field '${err.path}'`;

    errors = [
      {
        field: err.path,
        value: err.value,
        message: 'Invalid ID format'
      }
    ];
  }

  // --------------------------------------------------
  // Mongoose Duplicate Key Error
  // MongoDB E11000
  // --------------------------------------------------

  else if (err.code === 11000) {
    statusCode = 409;

    const keyValue = err.keyValue || {};
    const field =
      Object.keys(keyValue)[0] ||
      Object.keys(err.keyPattern || {})[0] ||
      'field';

    const value =
      keyValue[field] !== undefined
        ? keyValue[field]
        : '';

    message = `Duplicate value error: ${field} already exists`;

    errors = [
      {
        field,
        value,
        message: `${field} must be unique`
      }
    ];
  }

  // --------------------------------------------------
  // Mongoose Validation Error
  // --------------------------------------------------

  else if (err.name === 'ValidationError') {
    statusCode = 422;
    message = 'Validation failed';

    errors = Object.values(err.errors || {}).map((error) => ({
      field: error.path,
      value: error.value,
      message: error.message
    }));
  }

  // --------------------------------------------------
  // Mongoose Version Error
  // --------------------------------------------------

  else if (err.name === 'VersionError') {
    statusCode = 409;
    message = 'The resource was modified by another request. Please try again.';
  }

  // --------------------------------------------------
  // Mongoose Document Not Found
  // --------------------------------------------------

  else if (err.name === 'DocumentNotFoundError') {
    statusCode = 404;
    message = 'Requested resource was not found';
  }

  // --------------------------------------------------
  // Multer Errors
  // --------------------------------------------------

  else if (err.name === 'MulterError') {
    statusCode = 400;

    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File too large. Please upload a smaller file.';
        break;

      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded.';
        break;

      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected file field in upload request.';
        break;

      case 'LIMIT_PART_COUNT':
        message = 'Too many multipart form parts.';
        break;

      case 'LIMIT_FIELD_KEY':
        message = 'Field name is too long.';
        break;

      case 'LIMIT_FIELD_VALUE':
        message = 'Field value is too large.';
        break;

      case 'LIMIT_FIELD_COUNT':
        message = 'Too many form fields submitted.';
        break;

      default:
        message = `File upload error: ${err.message}`;
    }
  }

  // --------------------------------------------------
  // File Type / Upload Validation Errors
  // Usually thrown manually by uploadMiddleware
  // --------------------------------------------------

  else if (
    err.message &&
    (
      err.message.toLowerCase().includes('file type') ||
      err.message.toLowerCase().includes('file format') ||
      err.message.toLowerCase().includes('invalid file')
    )
  ) {
    statusCode = 400;
    message = err.message;
  }

  // --------------------------------------------------
  // JWT Errors
  // --------------------------------------------------

  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }

  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired';
  }

  else if (err.name === 'NotBeforeError') {
    statusCode = 401;
    message = 'Authentication token is not active yet';
  }

  // --------------------------------------------------
  // JSON Body Parser Error
  // --------------------------------------------------

  else if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    err.type === 'entity.parse.failed'
  ) {
    statusCode = 400;
    message = 'Invalid JSON request body';
  }

  // --------------------------------------------------
  // Payload Too Large
  // --------------------------------------------------

  else if (
    err.type === 'entity.too.large' ||
    err.status === 413
  ) {
    statusCode = 413;
    message = 'Request payload is too large';
  }

  // --------------------------------------------------
  // URI Error
  // --------------------------------------------------

  else if (err instanceof URIError) {
    statusCode = 400;
    message = 'Invalid request URI';
  }

  // --------------------------------------------------
  // MongoDB / Mongoose Connection Errors
  // --------------------------------------------------

  else if (
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoNetworkTimeoutError'
  ) {
    statusCode = 503;
    message = 'Database service is temporarily unavailable';
  }

  // --------------------------------------------------
  // MongoDB Timeout
  // --------------------------------------------------

  else if (
    err.name === 'MongooseError' &&
    (
      err.message?.toLowerCase().includes('buffering timed out') ||
      err.message?.toLowerCase().includes('timed out')
    )
  ) {
    statusCode = 503;
    message = 'Database service is temporarily unavailable';
  }

  // --------------------------------------------------
  // Axios / External API Errors
  // --------------------------------------------------

  else if (err.isAxiosError) {
    statusCode = 502;
    message = 'External service is temporarily unavailable';

    if (err.response?.status >= 400 && err.response?.status < 500) {
      statusCode = 502;
    }
  }

  // --------------------------------------------------
  // Generic Errors
  // --------------------------------------------------

  else if (statusCode >= 400 && statusCode < 500) {
    message = err.message || message;
  }

  // --------------------------------------------------
  // Production Safety
  // --------------------------------------------------

  const isProduction = config.env === 'production';

  if (statusCode >= 500) {
    if (!isProduction && err.message) {
      message = err.message;
    } else {
      message = 'Internal Server Error';
    }
  }

  // --------------------------------------------------
  // Development Logging
  // --------------------------------------------------

  if (statusCode >= 500 && config.env !== 'test') {
    console.error('========================================');
    console.error('[SERVER ERROR]');
    console.error('Method:', req.method);
    console.error('URL:', req.originalUrl);
    console.error('Status:', statusCode);
    console.error('Message:', err.message);
    console.error('Name:', err.name);
    console.error('Stack:', err.stack);
    console.error('========================================');
  }

  // --------------------------------------------------
  // Client Response
  // --------------------------------------------------

  return ApiResponse.error(
    res,
    statusCode,
    message,
    errors
  );
};

module.exports = {
  notFound,
  errorHandler
};
/**
 * Standard API Response Helper
 */

class ApiResponse {
  /**
   * Standard Success Response
   *
   * Response format:
   * {
   *   success: true,
   *   message: "...",
   *   data: {...},
   *   meta: {...}
   * }
   */
  static success(
    res,
    statusCode = 200,
    message = 'Success',
    data = null,
    meta = undefined
  ) {
    const safeStatusCode = ApiResponse.normalizeStatusCode(
      statusCode,
      200
    );

    const responsePayload = {
      success: true,
      message: ApiResponse.normalizeMessage(message, 'Success'),
      data
    };

    if (meta !== undefined) {
      responsePayload.meta = meta;
    }

    return res
      .status(safeStatusCode)
      .json(responsePayload);
  }

  /**
   * Standard Error Response
   *
   * Response format:
   * {
   *   success: false,
   *   message: "...",
   *   errors: [...]
   * }
   */
  static error(
    res,
    statusCode = 500,
    message = 'An error occurred',
    errors = null
  ) {
    const safeStatusCode = ApiResponse.normalizeStatusCode(
      statusCode,
      500
    );

    const responsePayload = {
      success: false,
      message: ApiResponse.normalizeMessage(
        message,
        'An error occurred'
      )
    };

    if (errors !== null && errors !== undefined) {
      responsePayload.errors = ApiResponse.normalizeErrors(errors);
    }

    return res
      .status(safeStatusCode)
      .json(responsePayload);
  }

  /**
   * Normalize HTTP status code
   */
  static normalizeStatusCode(statusCode, fallback) {
    const code = Number(statusCode);

    if (
      Number.isInteger(code) &&
      code >= 100 &&
      code <= 599
    ) {
      return code;
    }

    return fallback;
  }

  /**
   * Normalize response message
   */
  static normalizeMessage(message, fallback) {
    if (
      typeof message === 'string' &&
      message.trim().length > 0
    ) {
      return message.trim();
    }

    return fallback;
  }

  /**
   * Normalize error details
   */
  static normalizeErrors(errors) {
    if (Array.isArray(errors)) {
      return errors;
    }

    if (
      typeof errors === 'object' &&
      errors !== null
    ) {
      return [errors];
    }

    return [
      {
        message: String(errors)
      }
    ];
  }
}

module.exports = ApiResponse;
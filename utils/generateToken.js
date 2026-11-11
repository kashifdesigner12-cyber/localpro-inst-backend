/**
 * JWT Token Generator
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Generate a JWT token containing userId and role
 * @param {Object} payload
 * @param {string} payload.userId - User's MongoDB ObjectId string
 * @param {string} payload.role - User's role (ADMIN, TEACHER)
 * @returns {string} Signed JWT
 */
const generateToken = ({ userId, role }) => {
  return jwt.sign(
    { userId, role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

module.exports = generateToken;
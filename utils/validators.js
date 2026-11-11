/**
 * Reusable input validation helpers
 */

const mongoose = require('mongoose');

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && (new mongoose.Types.ObjectId(id)).toString() === id;
};

const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
};

const isValidDate = (dateString) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  return !isNaN(d.getTime());
};

const sanitizeDateOnly = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

module.exports = {
  isValidObjectId,
  isValidEmail,
  isValidDate,
  sanitizeDateOnly
};
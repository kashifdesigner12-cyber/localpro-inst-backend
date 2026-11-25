const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({
  path: path.join(__dirname, '../.env')
});

const config = {
  // =========================================================
  // APPLICATION
  // =========================================================
  env: process.env.NODE_ENV || 'development',

  // Hosting platform production mein PORT provide karega.
  // Local development ke liye fallback 5000 hai.
  port: parseInt(process.env.PORT, 10) || 5000,

  // =========================================================
  // FRONTEND
  // =========================================================
  frontendUrl:
    process.env.FRONTEND_URL ||
    'http://localhost:3000',

  // =========================================================
  // MONGODB
  // =========================================================
  mongo: {
    uri:
      process.env.MONGO_URI ||
      'mongodb://localhost:27017/school_management_db',

    options: {
      autoIndex: true
    }
  },

  // =========================================================
  // JWT
  // =========================================================
  jwt: {
    secret:
      process.env.JWT_SECRET ||
      'fallback_secret_key_change_in_production_min_32_chars',

    expiresIn:
      process.env.JWT_EXPIRES_IN || '7d'
  },

  // =========================================================
  // SMTP / EMAIL
  // =========================================================
  smtp: {
    host:
      process.env.SMTP_HOST ||
      'smtp.gmail.com',

    port:
      parseInt(process.env.SMTP_PORT, 10) || 587,

    user:
      process.env.SMTP_USER || '',

    password:
      process.env.SMTP_PASSWORD || '',

    from:
      process.env.SMTP_FROM ||
      '"School Management System" <no-reply@school.com>'
  },

  // =========================================================
  // ADMIN SEED
  // =========================================================
  seedAdmin: {
    name:
      process.env.ADMIN_NAME ||
      'Super Admin',

    email:
      process.env.ADMIN_EMAIL ||
      'admin@school.com',

    password:
      process.env.ADMIN_PASSWORD ||
      'Admin@123456',

    phone:
      process.env.ADMIN_PHONE ||
      '+923001234567'
  }
};

module.exports = config;


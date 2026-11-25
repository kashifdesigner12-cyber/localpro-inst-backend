/**
 * Database Connection Module
 * Connects to MongoDB via Mongoose
 */

const mongoose = require('mongoose');
const config = require('./env');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongo.uri, config.mongo.options);
    console.log(`[Database] MongoDB Connected: ${conn.connection.host} / ${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error(`[Database] Connection runtime error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[Database] MongoDB disconnected.');
    });

    return conn;
  } catch (error) {
    console.error(`[Database] Connection failed: ${error.message}`);
    if (config.env === 'production') {
      process.exit(1);
    }
    throw error;
  }
};

module.exports = connectDB;
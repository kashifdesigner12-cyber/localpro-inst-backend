/**
 * Seed Initial Super Admin Script
 * Usage: npm run seed:admin
 */

const mongoose = require('mongoose');
const config = require('../config/env');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    console.log('[Seed] Connecting to MongoDB at:', config.mongo.uri);
    await mongoose.connect(config.mongo.uri, config.mongo.options);

    const adminEmail = config.seedAdmin.email.toLowerCase().trim();

    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log(`[Seed] Admin user already exists with email: ${adminEmail}`);
      console.log(`[Seed] Role: ${existingAdmin.role}, Name: ${existingAdmin.name}, Active: ${existingAdmin.isActive}`);
      process.exit(0);
    }

    const admin = await User.create({
      name: config.seedAdmin.name,
      email: adminEmail,
      password: config.seedAdmin.password,
      role: 'ADMIN',
      phone: config.seedAdmin.phone,
      isActive: true
    });

    console.log(`
=====================================================
✅ Initial Admin Created Successfully!
👤 Name     : ${admin.name}
📧 Email    : ${admin.email}
🔑 Role     : ${admin.role}
📱 Phone    : ${admin.phone}
=====================================================
    `);

    process.exit(0);
  } catch (error) {
    console.error('[Seed Error] Failed to create admin user:', error.message);
    process.exit(1);
  }
};

seedAdmin();
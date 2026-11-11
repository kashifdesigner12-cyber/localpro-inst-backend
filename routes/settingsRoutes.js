/**
 * School Settings Routes
 */

const express = require('express');
const router = express.Router();

const settingsController = require('../controllers/settingsController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

// All settings routes require authentication
router.use(protect);

// Only Admin can manage school settings
router.use(requireAdmin);

// Get current settings
router.get('/', settingsController.getSettings);

// Create settings
router.post('/', settingsController.createSettings);

// Update settings
router.put('/', settingsController.updateSettings);

// Reset settings to defaults
router.patch('/reset', settingsController.resetSettings);

module.exports = router;
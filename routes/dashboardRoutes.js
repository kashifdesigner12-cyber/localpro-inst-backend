/**
 * Admin Dashboard Routes
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

// Handle preflight OPTIONS request explicitly
router.options('/', (req, res) => {
  return res.status(204).end();
});

// GET /api/dashboard
router.get('/', protect, requireAdmin, dashboardController.getDashboardSummary);

module.exports = router;
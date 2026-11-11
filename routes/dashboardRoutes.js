/**
 * Admin Dashboard Routes
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(requireAdmin);

router.get('/', dashboardController.getDashboardSummary);

module.exports = router;
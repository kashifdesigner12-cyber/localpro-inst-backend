/**
 * Fee Management Routes
 */

const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin, requireAdminOrTeacher } = require('../middleware/roleMiddleware');

router.use(protect);

// Fee summary - Admin only
router.get('/summary', requireAdmin, feeController.getFeeSummary);

// Student ledger can be viewed by Admin or Teacher
router.get('/student/:studentId', requireAdminOrTeacher, feeController.getFeesByStudent);

// CRUD - Admin only
router
  .route('/')
  .post(requireAdmin, feeController.createFee)
  .get(requireAdmin, feeController.getFees);

router
  .route('/:id')
  .get(requireAdmin, feeController.getFeeById)
  .put(requireAdmin, feeController.updateFee)
  .delete(requireAdmin, feeController.deleteFee);

module.exports = router;
/**
 * Staff Leave Routes
 */

const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(requireAdmin);

router
  .route('/')
  .post(leaveController.createLeave)
  .get(leaveController.getLeaves);

router
  .route('/:id')
  .get(leaveController.getLeaveById)
  .put(leaveController.updateLeaveStatus)
  .delete(leaveController.deleteLeave);

module.exports = router;
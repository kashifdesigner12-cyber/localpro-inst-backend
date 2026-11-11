/**
 * Staff Management Routes
 */

const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(requireAdmin);

router
  .route('/')
  .post(staffController.createStaff)
  .get(staffController.getStaff);

router
  .route('/:id')
  .get(staffController.getStaffById)
  .put(staffController.updateStaff)
  .delete(staffController.deleteStaff);

module.exports = router;
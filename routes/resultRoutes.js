const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const { protect } = require('../middleware/authMiddleware');
const {
  requireAdminOrTeacher,
  requireAdmin
} = require('../middleware/roleMiddleware');

router.use(protect);

// Send performance report email to parent
router.post(
  '/send-report',
  requireAdminOrTeacher,
  resultController.sendPerformanceReport
);

// Student results breakdown
router.get(
  '/student/:studentId',
  requireAdminOrTeacher,
  resultController.getResultsByStudent
);

router
  .route('/')
  .post(requireAdminOrTeacher, resultController.createResult)
  .get(requireAdminOrTeacher, resultController.getResults);

router
  .route('/:id')
  .get(requireAdminOrTeacher, resultController.getResultById)
  .put(requireAdminOrTeacher, resultController.updateResult)
  .delete(requireAdmin, resultController.deleteResult);

module.exports = router;

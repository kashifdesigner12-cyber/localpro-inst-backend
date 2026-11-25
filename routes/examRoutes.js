/**
 * Exam Routes
 */

const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdminOrTeacher, requireAdmin } = require('../middleware/roleMiddleware');

router.use(protect);

router
  .route('/')
  .post(requireAdminOrTeacher, examController.createExam)
  .get(requireAdminOrTeacher, examController.getExams);

router
  .route('/:id')
  .get(requireAdminOrTeacher, examController.getExamById)
  .put(requireAdminOrTeacher, examController.updateExam)
  .delete(requireAdmin, examController.deleteExam);

module.exports = router;
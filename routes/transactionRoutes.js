/**
 * Transaction Routes (Income & Expense)
 */

const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(requireAdmin);

router.get('/summary', transactionController.getTransactionSummary);

router
  .route('/')
  .post(transactionController.createTransaction)
  .get(transactionController.getTransactions);

router
  .route('/:id')
  .get(transactionController.getTransactionById)
  .put(transactionController.updateTransaction)
  .delete(transactionController.deleteTransaction);

module.exports = router;
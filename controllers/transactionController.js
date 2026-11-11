/**
 * Financial Transactions Controller (Income & Expense)
 */

const Transaction = require('../models/Transaction');
const ApiResponse = require('../utils/apiResponse');
const { isValidObjectId } = require('../utils/validators');
const { logAction } = require('../services/auditService');

/**
 * @desc    Create a new transaction
 * @route   POST /api/transactions
 * @access  Private (Admin)
 */
const createTransaction = async (req, res, next) => {
  try {
    const {
      type,
      category,
      description,
      amount,
      date,
      paymentMethod,
      reference
    } = req.body;

    if (!type || !category || !description || amount === undefined) {
      return ApiResponse.error(
        res,
        400,
        'Please provide type (INCOME/EXPENSE), category, description, and amount'
      );
    }

    const numAmount = Number(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return ApiResponse.error(
        res,
        400,
        'Amount must be a positive number'
      );
    }

    const transaction = await Transaction.create({
      type: type.toUpperCase(),
      category,
      description: description.trim(),
      amount: numAmount,
      date: date ? new Date(date) : Date.now(),
      paymentMethod: paymentMethod
        ? paymentMethod.toUpperCase()
        : 'CASH',
      reference: reference ? reference.trim() : '',
      createdBy: req.user._id
    });

    await logAction({
      user: req.user._id,
      action: 'TRANSACTION_CREATED',
      entity: 'Transaction',
      entityId: transaction._id.toString(),
      details: {
        type: transaction.type,
        category: transaction.category,
        amount: transaction.amount
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      201,
      'Transaction created successfully',
      { transaction }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all transactions with filtering and pagination
 * @route   GET /api/transactions
 * @access  Private (Admin)
 */
const getTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const {
      type,
      category,
      startDate,
      endDate,
      paymentMethod,
      search
    } = req.query;

    const query = {};

    if (type) {
      query.type = type.toUpperCase();
    }

    if (category) {
      query.category = category;
    }

    if (paymentMethod) {
      query.paymentMethod = paymentMethod.toUpperCase();
    }

    /**
     * Date filtering
     *
     * startDate:
     * Includes from the beginning of the selected day.
     *
     * endDate:
     * Includes until the end of the selected day.
     */
    if (startDate || endDate) {
      query.date = {};

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        query.date.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        query.date.$lte = end;
      }
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');

      query.$or = [
        {
          description: searchRegex
        },
        {
          reference: searchRegex
        }
      ];
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate(
          'createdBy',
          'name email role'
        )
        .sort({
          date: -1,
          createdAt: -1
        })
        .skip(skip)
        .limit(limit),

      Transaction.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return ApiResponse.success(
      res,
      200,
      'Transactions retrieved successfully',
      { transactions },
      {
        page,
        limit,
        total,
        totalPages
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single transaction by ID
 * @route   GET /api/transactions/:id
 * @access  Private (Admin)
 */
const getTransactionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid transaction ID format'
      );
    }

    const transaction = await Transaction.findById(id)
      .populate(
        'createdBy',
        'name email role'
      );

    if (!transaction) {
      return ApiResponse.error(
        res,
        404,
        'Transaction not found'
      );
    }

    return ApiResponse.success(
      res,
      200,
      'Transaction retrieved',
      { transaction }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update transaction
 * @route   PUT /api/transactions/:id
 * @access  Private (Admin)
 */
const updateTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid transaction ID format'
      );
    }

    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return ApiResponse.error(
        res,
        404,
        'Transaction not found'
      );
    }

    const {
      type,
      category,
      description,
      amount,
      date,
      paymentMethod,
      reference
    } = req.body;

    if (type) {
      transaction.type = type.toUpperCase();
    }

    if (category) {
      transaction.category = category;
    }

    if (description) {
      transaction.description = description.trim();
    }

    if (amount !== undefined) {
      transaction.amount = Number(amount);
    }

    if (date) {
      transaction.date = new Date(date);
    }

    if (paymentMethod) {
      transaction.paymentMethod =
        paymentMethod.toUpperCase();
    }

    if (reference !== undefined) {
      transaction.reference = reference.trim();
    }

    await transaction.save();

    await logAction({
      user: req.user._id,
      action: 'TRANSACTION_UPDATED',
      entity: 'Transaction',
      entityId: id,
      details: {
        type: transaction.type,
        amount: transaction.amount
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Transaction updated successfully',
      { transaction }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete transaction
 * @route   DELETE /api/transactions/:id
 * @access  Private (Admin)
 */
const deleteTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid transaction ID format'
      );
    }

    const transaction = await Transaction.findById(id);

    if (!transaction) {
      return ApiResponse.error(
        res,
        404,
        'Transaction not found'
      );
    }

    await Transaction.findByIdAndDelete(id);

    await logAction({
      user: req.user._id,
      action: 'TRANSACTION_DELETED',
      entity: 'Transaction',
      entityId: id,
      details: {
        description: transaction.description,
        amount: transaction.amount
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Transaction deleted successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get transaction financial summary
 * @route   GET /api/transactions/summary
 * @access  Private (Admin)
 */
const getTransactionSummary = async (req, res, next) => {
  try {
    const summary = await Transaction.aggregate([
      {
        $group: {
          _id: '$type',
          total: {
            $sum: '$amount'
          },
          count: {
            $sum: 1
          }
        }
      }
    ]);

    let totalIncome = 0;
    let totalExpense = 0;

    summary.forEach((item) => {
      if (item._id === 'INCOME') {
        totalIncome = item.total;
      } else if (item._id === 'EXPENSE') {
        totalExpense = item.total;
      }
    });

    const balance = totalIncome - totalExpense;

    return ApiResponse.success(
      res,
      200,
      'Transaction financial summary retrieved',
      {
        totalIncome,
        totalExpense,
        balance,
        breakdown: summary
      }
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getTransactionSummary
};

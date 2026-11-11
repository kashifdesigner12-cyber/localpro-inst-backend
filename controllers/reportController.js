/**
 * System Reports Controller
 * Generates comprehensive reports for Students, Attendance, Fees, Transactions, and Performance
 */

const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Fee = require('../models/Fee');
const Transaction = require('../models/Transaction');
const ApiResponse = require('../utils/apiResponse');
const { getStudentExamPerformance } = require('../services/performanceService');
const { isValidObjectId, sanitizeDateOnly } = require('../utils/validators');

/**
 * @desc    Generate Student Report (Demographics, Class Breakdown, Gender)
 * @route   GET /api/reports/students
 * @access  Private (Admin, Teacher)
 */
const getStudentReport = async (req, res, next) => {
  try {
    const { className, section, status } = req.query;

    const query = {};
    if (className) query.className = new RegExp(`^${className.trim()}$`, 'i');
    if (section) query.section = new RegExp(`^${section.trim()}$`, 'i');
    if (status) query.status = status.toUpperCase();

    const [students, classBreakdown, genderBreakdown, statusBreakdown] = await Promise.all([
      Student.find(query).sort({ className: 1, section: 1, rollNo: 1 }),
      Student.aggregate([
        { $match: query },
        { $group: { _id: { className: '$className', section: '$section' }, count: { $sum: 1 } } },
        { $sort: { '_id.className': 1, '_id.section': 1 } }
      ]),
      Student.aggregate([
        { $match: query },
        { $group: { _id: '$gender', count: { $sum: 1 } } }
      ]),
      Student.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    return ApiResponse.success(res, 200, 'Student report generated', {
      total: students.length,
      classBreakdown,
      genderBreakdown,
      statusBreakdown,
      students
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate Attendance Report for date range
 * @route   GET /api/reports/attendance
 * @access  Private (Admin, Teacher)
 */
const getAttendanceReport = async (req, res, next) => {
  try {
    const { from, to, className, section, status } = req.query;

    const query = {};

    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = sanitizeDateOnly(from);
      if (to) {
        const toDate = sanitizeDateOnly(to);
        toDate.setUTCHours(23, 59, 59, 999);
        query.date.$lte = toDate;
      }
    }

    if (className) query.className = new RegExp(`^${className.trim()}$`, 'i');
    if (section) query.section = new RegExp(`^${section.trim()}$`, 'i');
    if (status) query.status = status.toUpperCase();

    const [records, statusSummary, dailyTrend] = await Promise.all([
      Attendance.find(query)
        .populate('student', 'name admissionNo rollNo className section')
        .sort({ date: -1 }),
      Attendance.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Attendance.aggregate([
        { $match: query },
        {
          $group: {
            _id: { date: '$date', status: '$status' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.date': 1 } }
      ])
    ]);

    return ApiResponse.success(res, 200, 'Attendance report generated', {
      totalRecords: records.length,
      statusSummary,
      dailyTrend,
      records
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate Fee Report
 * @route   GET /api/reports/fees
 * @access  Private (Admin)
 */
const getFeeReport = async (req, res, next) => {
  try {
    const { from, to, status, feeType, month } = req.query;

    const query = {};

    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }

    if (status) query.status = status.toUpperCase();
    if (feeType) query.feeType = feeType.toUpperCase();
    if (month) query.month = new RegExp(month.trim(), 'i');

    const [fees, totals] = await Promise.all([
      Fee.find(query)
        .populate('student', 'name admissionNo className section')
        .sort({ date: -1 }),
      Fee.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalDiscount: { $sum: '$discount' },
            totalPaid: { $sum: '$paidAmount' },
            totalRemaining: { $sum: '$remainingAmount' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const summary = totals[0] || {
      totalAmount: 0,
      totalDiscount: 0,
      totalPaid: 0,
      totalRemaining: 0,
      count: 0
    };

    return ApiResponse.success(res, 200, 'Fee report generated', {
      summary,
      fees
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate Transactions / Financial Report (Income & Expense)
 * @route   GET /api/reports/transactions
 * @access  Private (Admin)
 */
const getTransactionReport = async (req, res, next) => {
  try {
    const { from, to, type, category } = req.query;

    const query = {};

    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to) query.date.$lte = new Date(to);
    }

    if (type) query.type = type.toUpperCase();
    if (category) query.category = category;

    const [transactions, typeBreakdown, categoryBreakdown] = await Promise.all([
      Transaction.find(query).sort({ date: -1 }),
      Transaction.aggregate([
        { $match: query },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ]),
      Transaction.aggregate([
        { $match: query },
        { $group: { _id: { type: '$type', category: '$category' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } }
      ])
    ]);

    let totalIncome = 0;
    let totalExpense = 0;

    typeBreakdown.forEach((t) => {
      if (t._id === 'INCOME') totalIncome = t.total;
      if (t._id === 'EXPENSE') totalExpense = t.total;
    });

    return ApiResponse.success(res, 200, 'Transaction financial report generated', {
      summary: {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        totalTransactions: transactions.length
      },
      categoryBreakdown,
      transactions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate Academic Performance Report for a student
 * @route   GET /api/reports/performance/:studentId
 * @access  Private (Admin, Teacher)
 */
const getPerformanceReport = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { examId } = req.query;

    if (!isValidObjectId(studentId)) {
      return ApiResponse.error(res, 400, 'Invalid student ID format');
    }

    if (!examId || !isValidObjectId(examId)) {
      return ApiResponse.error(res, 400, 'Please specify a valid examId query parameter');
    }

    const performance = await getStudentExamPerformance(studentId, examId);

    return ApiResponse.success(res, 200, 'Performance report generated', performance);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudentReport,
  getAttendanceReport,
  getFeeReport,
  getTransactionReport,
  getPerformanceReport
};
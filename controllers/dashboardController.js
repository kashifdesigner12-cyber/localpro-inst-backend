/**
 * Admin Dashboard Controller
 * Computes high-performance aggregated metrics and recent activities
 */

const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Attendance = require('../models/Attendance');
const Fee = require('../models/Fee');
const Transaction = require('../models/Transaction');
const ApiResponse = require('../utils/apiResponse');
const { sanitizeDateOnly } = require('../utils/validators');

/**
 * @desc    Get aggregated dashboard statistics for admin
 * @route   GET /api/dashboard
 * @access  Private (Admin)
 */
const getDashboardSummary = async (req, res, next) => {
  try {
    const today = sanitizeDateOnly(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Parallel aggregate queries for high performance
    const [
      totalStudents,
      totalStaff,
      todayAttendanceStats,
      feeStats,
      transactionStats,
      recentStudents
    ] = await Promise.all([
      // 1. Total Active Students
      Student.countDocuments({ status: 'ACTIVE' }),

      // 2. Total Active Staff
      Staff.countDocuments({ status: 'ACTIVE' }),

      // 3. Today's Attendance Aggregation
      Attendance.aggregate([
        {
          $match: {
            date: { $gte: today, $lt: tomorrow }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // 4. Overall Fee Aggregation
      Fee.aggregate([
        {
          $group: {
            _id: null,
            totalFees: { $sum: '$amount' },
            totalCollected: { $sum: '$paidAmount' },
            pendingFees: { $sum: '$remainingAmount' }
          }
        }
      ]),

      // 5. Overall Transactions Aggregation
      Transaction.aggregate([
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' }
          }
        }
      ]),

      // 6. Recent Students List (10 most recent)
      Student.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('name admissionNo className section rollNo parentName parentPhone status createdAt')
    ]);

    // Process Today's Attendance
    let presentToday = 0;
    let absentToday = 0;
    let lateToday = 0;
    let leaveToday = 0;

    todayAttendanceStats.forEach((stat) => {
      if (stat._id === 'PRESENT') presentToday = stat.count;
      else if (stat._id === 'ABSENT') absentToday = stat.count;
      else if (stat._id === 'LATE') lateToday = stat.count;
      else if (stat._id === 'LEAVE') leaveToday = stat.count;
    });

    const totalMarkedToday = presentToday + absentToday + lateToday + leaveToday;

    // Process Fee Stats
    const feeData = feeStats[0] || { totalFees: 0, totalCollected: 0, pendingFees: 0 };

    // Process Transaction Stats
    let totalIncome = 0;
    let totalExpense = 0;

    transactionStats.forEach((t) => {
      if (t._id === 'INCOME') totalIncome = t.total;
      else if (t._id === 'EXPENSE') totalExpense = t.total;
    });

    const balance = totalIncome - totalExpense;

    // Format recent students cleanly
    const formattedRecentStudents = recentStudents.map((s) => ({
      id: s._id,
      name: s.name,
      admissionNo: s.admissionNo,
      className: s.className,
      section: s.section,
      rollNo: s.rollNo,
      parentName: s.parentName,
      parentPhone: s.parentPhone,
      status: s.status,
      createdAt: s.createdAt
    }));

    return ApiResponse.success(res, 200, 'Dashboard data retrieved successfully', {
      totalStudents,
      totalStaff,
      presentToday,
      absentToday,
      totalMarkedToday,
      attendanceDetails: {
        present: presentToday,
        absent: absentToday,
        late: lateToday,
        leave: leaveToday
      },
      totalFees: feeData.totalFees,
      totalCollected: feeData.totalCollected,
      pendingFees: feeData.pendingFees,
      totalIncome,
      totalExpense,
      balance,
      recentStudents: formattedRecentStudents
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardSummary
};
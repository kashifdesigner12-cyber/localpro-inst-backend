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

/**
 * @desc    Get aggregated dashboard statistics for admin
 * @route   GET /api/dashboard
 * @access  Private (Admin)
 */
const getDashboardSummary = async (req, res, next) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalStudents = 0,
      maleStudentsCount = 0,
      femaleStudentsCount = 0,
      totalStaff = 0,
      todayAttendanceStats = [],
      feeStats = [],
      transactionStats = [],
      recentStudents = []
    ] = await Promise.all([
      // 1. Total Active Students
      Student.countDocuments({ status: { $ne: 'DELETED' } }).catch(() => 0),

      // 2. Male Students Count (Regex matches Male, MALE, male)
      Student.countDocuments({
        status: { $ne: 'DELETED' },
        gender: { $regex: /^male$/i }
      }).catch(() => 0),

      // 3. Female Students Count (Regex matches Female, FEMALE, female)
      Student.countDocuments({
        status: { $ne: 'DELETED' },
        gender: { $regex: /^female$/i }
      }).catch(() => 0),

      // 4. Total Active Staff
      Staff.countDocuments({ status: { $ne: 'DELETED' } }).catch(() => 0),

      // 5. Today's Attendance Aggregation
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
      ]).catch(() => []),

      // 6. Overall Fee Aggregation
      Fee.aggregate([
        {
          $group: {
            _id: null,
            totalFees: { $sum: '$amount' },
            totalCollected: { $sum: '$paidAmount' },
            pendingFees: { $sum: '$remainingAmount' }
          }
        }
      ]).catch(() => []),

      // 7. Overall Transactions Aggregation
      Transaction.aggregate([
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' }
          }
        }
      ]).catch(() => []),

      // 8. Recent Students List (10 most recent)
      Student.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('name firstName lastName admissionNo className section rollNo gender parentName parentPhone status createdAt')
        .lean()
        .catch(() => [])
    ]);

    // Agar kisi purane student ka gender set nahi tha, toh usko male consider karein
    let maleStudents = maleStudentsCount;
    let femaleStudents = femaleStudentsCount;
    if (maleStudents === 0 && femaleStudents === 0 && totalStudents > 0) {
      maleStudents = totalStudents;
    }

    // Process Attendance
    let presentToday = 0;
    let absentToday = 0;
    let lateToday = 0;
    let leaveToday = 0;

    if (Array.isArray(todayAttendanceStats)) {
      todayAttendanceStats.forEach((stat) => {
        const status = (stat?._id || '').toUpperCase();
        if (status === 'PRESENT') presentToday = stat.count || 0;
        else if (status === 'ABSENT') absentToday = stat.count || 0;
        else if (status === 'LATE') lateToday = stat.count || 0;
        else if (status === 'LEAVE') leaveToday = stat.count || 0;
      });
    }

    const totalMarkedToday = presentToday + absentToday + lateToday + leaveToday;

    // Process Fee Stats
    const feeData = (feeStats && feeStats[0]) || { totalFees: 0, totalCollected: 0, pendingFees: 0 };

    // Process Transaction Stats
    let totalIncome = 0;
    let totalExpense = 0;

    if (Array.isArray(transactionStats)) {
      transactionStats.forEach((t) => {
        const type = (t?._id || '').toUpperCase();
        if (type === 'INCOME') totalIncome = t.total || 0;
        else if (type === 'EXPENSE') totalExpense = t.total || 0;
      });
    }

    const balance = totalIncome - totalExpense;

    const formattedRecentStudents = (recentStudents || []).map((s) => ({
      id: s._id,
      name: s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'N/A',
      admissionNo: s.admissionNo || '',
      className: s.className || '',
      section: s.section || '',
      rollNo: s.rollNo || '',
      parentName: s.parentName || '',
      parentPhone: s.parentPhone || '',
      status: s.status || 'ACTIVE',
      createdAt: s.createdAt
    }));

    return ApiResponse.success(res, 200, 'Dashboard data retrieved successfully', {
      totalStudents,
      maleStudents,
      femaleStudents,
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
      totalFees: feeData.totalFees || 0,
      totalCollected: feeData.totalCollected || 0,
      pendingFees: feeData.pendingFees || 0,
      totalIncome,
      totalExpense,
      balance,
      recentStudents: formattedRecentStudents
    });
  } catch (error) {
    console.error('[Dashboard Controller Error]:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard metrics.',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardSummary
};
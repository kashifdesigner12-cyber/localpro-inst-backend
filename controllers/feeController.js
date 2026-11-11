const Fee = require('../models/Fee');
const Student = require('../models/Student');
const ApiResponse = require('../utils/apiResponse');
const { isValidObjectId } = require('../utils/validators');
const { logAction } = require('../services/auditService');

/**
 * Generate a unique receipt number if not provided
 */
const generateReceiptNumber = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000);

  return `REC-${timestamp}-${random}`;
};

/**
 * Escape special regex characters
 */
const escapeRegex = (value) => {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
};

/**
 * Safe pagination
 */
const getPagination = (query) => {
  const page = Math.max(
    parseInt(query.page, 10) || 1,
    1
  );

  const limit = Math.min(
    Math.max(
      parseInt(query.limit, 10) || 20,
      1
    ),
    100
  );

  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip
  };
};

/**
 * Safe sorting
 */
const getFeeSort = (sortBy, order) => {
  const allowedSortFields = [
    'date',
    'amount',
    'discount',
    'paidAmount',
    'remainingAmount',
    'status',
    'feeType',
    'month',
    'paymentMethod',
    'createdAt',
    'updatedAt'
  ];

  const safeSortBy = allowedSortFields.includes(sortBy)
    ? sortBy
    : 'date';

  const sortOrder = order === 'asc' ? 1 : -1;

  return {
    [safeSortBy]: sortOrder,

    // Stable secondary sorting
    ...(safeSortBy !== 'createdAt'
      ? { createdAt: -1 }
      : {})
  };
};

/**
 * @desc    Create a new fee record
 * @route   POST /api/fees
 * @access  Private (Admin)
 */
const createFee = async (req, res, next) => {
  try {
    const {
      studentId,
      feeType = 'MONTHLY',
      month,
      receiptNumber,
      amount,
      discount = 0,
      paidAmount = 0,
      paymentMethod = 'CASH',
      date,
      notes
    } = req.body;

    if (
      !studentId ||
      !month ||
      amount === undefined
    ) {
      return ApiResponse.error(
        res,
        400,
        'Please provide studentId, month, and amount'
      );
    }

    if (!isValidObjectId(studentId)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid student ID format'
      );
    }

    const student = await Student.findById(studentId);

    if (!student) {
      return ApiResponse.error(
        res,
        404,
        'Student not found'
      );
    }

    const numAmount = Number(amount);
    const numDiscount = Number(discount) || 0;
    const numPaid = Number(paidAmount) || 0;

    if (
      !Number.isFinite(numAmount) ||
      !Number.isFinite(numDiscount) ||
      !Number.isFinite(numPaid)
    ) {
      return ApiResponse.error(
        res,
        400,
        'Amount, discount, and paid amount must be valid numbers'
      );
    }

    if (
      numAmount < 0 ||
      numDiscount < 0 ||
      numPaid < 0
    ) {
      return ApiResponse.error(
        res,
        400,
        'Amounts cannot be negative'
      );
    }

    const payable = Math.max(
      0,
      numAmount - numDiscount
    );

    if (numDiscount > numAmount) {
      return ApiResponse.error(
        res,
        400,
        'Discount cannot exceed fee amount'
      );
    }

    if (numPaid > payable) {
      return ApiResponse.error(
        res,
        400,
        `Paid amount (${numPaid}) cannot exceed net payable amount (${payable})`
      );
    }

    let feeDate = Date.now();

    if (date) {
      feeDate = new Date(date);

      if (isNaN(feeDate.getTime())) {
        return ApiResponse.error(
          res,
          400,
          'Invalid fee date format'
        );
      }
    }

    const receipt =
      receiptNumber &&
      receiptNumber.trim()
        ? receiptNumber
            .trim()
            .toUpperCase()
        : generateReceiptNumber();

    // Check duplicate receipt
    const existingReceipt =
      await Fee.findOne({
        receiptNumber: receipt
      });

    if (existingReceipt) {
      return ApiResponse.error(
        res,
        409,
        `Receipt number '${receipt}' already exists`
      );
    }

    const fee = await Fee.create({
      student: studentId,
      feeType,
      month: month.trim(),
      receiptNumber: receipt,
      amount: numAmount,
      discount: numDiscount,
      paidAmount: numPaid,
      paymentMethod,
      date: feeDate,
      notes: notes || '',
      receivedBy: req.user._id
    });

    await logAction({
      user: req.user._id,
      action: 'FEE_CREATED',
      entity: 'Fee',
      entityId: fee._id.toString(),
      details: {
        studentId,
        receiptNumber: fee.receiptNumber,
        amount: numAmount,
        paidAmount: numPaid
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      201,
      'Fee record created successfully',
      { fee }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all fees with filtering, search, sorting and pagination
 * @route   GET /api/fees
 * @access  Private (Admin)
 */
const getFees = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      skip
    } = getPagination(req.query);

    const {
      studentId,
      feeType,
      month,
      status,
      paymentMethod,
      startDate,
      endDate,
      search,
      sortBy = 'date',
      order = 'desc'
    } = req.query;

    const query = {};

    /**
     * Student filter
     */
    if (studentId) {
      if (!isValidObjectId(studentId)) {
        return ApiResponse.error(
          res,
          400,
          'Invalid student ID format'
        );
      }

      query.student = studentId;
    }

    /**
     * Fee type filter
     */
    if (feeType) {
      query.feeType =
        feeType.trim().toUpperCase();
    }

    /**
     * Month filter
     */
    if (month && month.trim()) {
      query.month = new RegExp(
        escapeRegex(month.trim()),
        'i'
      );
    }

    /**
     * Status filter
     */
    if (status) {
      query.status =
        status.trim().toUpperCase();
    }

    /**
     * Payment method filter
     */
    if (paymentMethod) {
      query.paymentMethod =
        paymentMethod.trim().toUpperCase();
    }

    /**
     * Date range filter
     */
    if (startDate || endDate) {
      query.date = {};

      if (startDate) {
        const start =
          new Date(startDate);

        if (isNaN(start.getTime())) {
          return ApiResponse.error(
            res,
            400,
            'Invalid start date format'
          );
        }

        start.setHours(
          0,
          0,
          0,
          0
        );

        query.date.$gte = start;
      }

      if (endDate) {
        const end =
          new Date(endDate);

        if (isNaN(end.getTime())) {
          return ApiResponse.error(
            res,
            400,
            'Invalid end date format'
          );
        }

        end.setHours(
          23,
          59,
          59,
          999
        );

        query.date.$lte = end;
      }
    }

    /**
     * Search
     *
     * Search by:
     * - receipt number
     * - student name
     * - admission number
     * - roll number
     * - parent name
     * - parent phone
     */
    if (search && search.trim()) {
      const searchRegex =
        new RegExp(
          escapeRegex(search.trim()),
          'i'
        );

      const matchingStudents =
        await Student.find({
          $or: [
            {
              name: searchRegex
            },
            {
              admissionNo: searchRegex
            },
            {
              rollNo: searchRegex
            },
            {
              parentName: searchRegex
            },
            {
              parentPhone: searchRegex
            }
          ]
        }).select('_id');

      const matchingStudentIds =
        matchingStudents.map(
          (student) => student._id
        );

      /**
       * Search can match either:
       * receipt number OR student information.
       */
      query.$or = [
        {
          receiptNumber: searchRegex
        }
      ];

      if (
        matchingStudentIds.length > 0
      ) {
        query.$or.push({
          student: {
            $in: matchingStudentIds
          }
        });
      }
    }

    const sort = getFeeSort(
      sortBy,
      order
    );

    const [
      fees,
      total
    ] = await Promise.all([
      Fee.find(query)
        .populate(
          'student',
          'name admissionNo rollNo className section parentName parentPhone'
        )
        .populate(
          'receivedBy',
          'name email role'
        )
        .sort(sort)
        .skip(skip)
        .limit(limit),

      Fee.countDocuments(query)
    ]);

    const totalPages =
      Math.ceil(total / limit);

    return ApiResponse.success(
      res,
      200,
      'Fees retrieved successfully',
      {
        fees
      },
      {
        page,
        limit,
        total,
        totalPages,
        hasNextPage:
          page < totalPages,
        hasPrevPage:
          page > 1
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single fee by ID
 * @route   GET /api/fees/:id
 * @access  Private (Admin)
 */
const getFeeById = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid fee ID format'
      );
    }

    const fee =
      await Fee.findById(id)
        .populate(
          'student',
          'name admissionNo rollNo className section parentName parentPhone'
        )
        .populate(
          'receivedBy',
          'name email role'
        );

    if (!fee) {
      return ApiResponse.error(
        res,
        404,
        'Fee record not found'
      );
    }

    return ApiResponse.success(
      res,
      200,
      'Fee record retrieved',
      {
        fee
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update fee record
 * @route   PUT /api/fees/:id
 * @access  Private (Admin)
 */
const updateFee = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid fee ID format'
      );
    }

    const fee =
      await Fee.findById(id);

    if (!fee) {
      return ApiResponse.error(
        res,
        404,
        'Fee record not found'
      );
    }

    const {
      feeType,
      month,
      amount,
      discount,
      paidAmount,
      paymentMethod,
      notes,
      date
    } = req.body;

    if (
      feeType !== undefined
    ) {
      fee.feeType =
        feeType
          .toString()
          .trim()
          .toUpperCase();
    }

    if (
      month !== undefined
    ) {
      if (!month.toString().trim()) {
        return ApiResponse.error(
          res,
          400,
          'Month cannot be empty'
        );
      }

      fee.month =
        month.toString().trim();
    }

    if (amount !== undefined) {
      const numAmount =
        Number(amount);

      if (
        !Number.isFinite(
          numAmount
        ) ||
        numAmount < 0
      ) {
        return ApiResponse.error(
          res,
          400,
          'Amount must be a valid non-negative number'
        );
      }

      fee.amount = numAmount;
    }

    if (discount !== undefined) {
      const numDiscount =
        Number(discount);

      if (
        !Number.isFinite(
          numDiscount
        ) ||
        numDiscount < 0
      ) {
        return ApiResponse.error(
          res,
          400,
          'Discount must be a valid non-negative number'
        );
      }

      fee.discount =
        numDiscount;
    }

    if (paidAmount !== undefined) {
      const numPaid =
        Number(paidAmount);

      if (
        !Number.isFinite(
          numPaid
        ) ||
        numPaid < 0
      ) {
        return ApiResponse.error(
          res,
          400,
          'Paid amount must be a valid non-negative number'
        );
      }

      fee.paidAmount =
        numPaid;
    }

    /**
     * Validate final financial values
     * after applying all updates.
     */
    const finalAmount =
      Number(fee.amount) || 0;

    const finalDiscount =
      Number(fee.discount) || 0;

    const finalPaid =
      Number(fee.paidAmount) || 0;

    if (
      finalDiscount >
      finalAmount
    ) {
      return ApiResponse.error(
        res,
        400,
        'Discount cannot exceed fee amount'
      );
    }

    const finalPayable =
      Math.max(
        0,
        finalAmount -
          finalDiscount
      );

    if (
      finalPaid >
      finalPayable
    ) {
      return ApiResponse.error(
        res,
        400,
        `Paid amount (${finalPaid}) cannot exceed net payable amount (${finalPayable})`
      );
    }

    if (
      paymentMethod !== undefined
    ) {
      fee.paymentMethod =
        paymentMethod
          .toString()
          .trim()
          .toUpperCase();
    }

    if (
      notes !== undefined
    ) {
      fee.notes = notes;
    }

    if (date !== undefined) {
      const feeDate =
        new Date(date);

      if (
        isNaN(
          feeDate.getTime()
        )
      ) {
        return ApiResponse.error(
          res,
          400,
          'Invalid fee date format'
        );
      }

      fee.date = feeDate;
    }

    fee.receivedBy =
      req.user._id;

    await fee.save();

    await logAction({
      user: req.user._id,
      action: 'FEE_UPDATED',
      entity: 'Fee',
      entityId: id,
      details: {
        receiptNumber:
          fee.receiptNumber,
        paidAmount:
          fee.paidAmount,
        remainingAmount:
          fee.remainingAmount
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Fee record updated successfully',
      {
        fee
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete fee record
 * @route   DELETE /api/fees/:id
 * @access  Private (Admin)
 */
const deleteFee = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid fee ID format'
      );
    }

    const fee =
      await Fee.findById(id);

    if (!fee) {
      return ApiResponse.error(
        res,
        404,
        'Fee record not found'
      );
    }

    await Fee.findByIdAndDelete(id);

    await logAction({
      user: req.user._id,
      action: 'FEE_DELETED',
      entity: 'Fee',
      entityId: id,
      details: {
        receiptNumber:
          fee.receiptNumber,
        amount: fee.amount
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Fee record deleted successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all fees for a single student
 * @route   GET /api/fees/student/:studentId
 * @access  Private (Admin, Teacher)
 */
const getFeesByStudent = async (
  req,
  res,
  next
) => {
  try {
    const { studentId } =
      req.params;

    if (!isValidObjectId(studentId)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid student ID format'
      );
    }

    const student =
      await Student.findById(
        studentId
      );

    if (!student) {
      return ApiResponse.error(
        res,
        404,
        'Student not found'
      );
    }

    const {
      page,
      limit,
      skip
    } = getPagination(req.query);

    const {
      startDate,
      endDate,
      status,
      feeType,
      paymentMethod,
      sortBy = 'date',
      order = 'desc'
    } = req.query;

    const query = {
      student: studentId
    };

    /**
     * Date range
     */
    if (startDate || endDate) {
      query.date = {};

      if (startDate) {
        const start =
          new Date(startDate);

        if (
          isNaN(
            start.getTime()
          )
        ) {
          return ApiResponse.error(
            res,
            400,
            'Invalid start date format'
          );
        }

        start.setHours(
          0,
          0,
          0,
          0
        );

        query.date.$gte =
          start;
      }

      if (endDate) {
        const end =
          new Date(endDate);

        if (
          isNaN(
            end.getTime()
          )
        ) {
          return ApiResponse.error(
            res,
            400,
            'Invalid end date format'
          );
        }

        end.setHours(
          23,
          59,
          59,
          999
        );

        query.date.$lte =
          end;
      }
    }

    /**
     * Status filter
     */
    if (status) {
      query.status =
        status
          .trim()
          .toUpperCase();
    }

    /**
     * Fee type filter
     */
    if (feeType) {
      query.feeType =
        feeType
          .trim()
          .toUpperCase();
    }

    /**
     * Payment method filter
     */
    if (paymentMethod) {
      query.paymentMethod =
        paymentMethod
          .trim()
          .toUpperCase();
    }

    const sort =
      getFeeSort(
        sortBy,
        order
      );

    const [
      fees,
      total
    ] = await Promise.all([
      Fee.find(query)
        .populate(
          'receivedBy',
          'name email role'
        )
        .sort(sort)
        .skip(skip)
        .limit(limit),

      Fee.countDocuments(query)
    ]);

    /**
     * Financial summary should be
     * calculated from ALL matching
     * records, not only current page.
     */
    const allFees =
      await Fee.find(query).select(
        'amount discount paidAmount remainingAmount'
      );

    const totalBilled =
      allFees.reduce(
        (sum, fee) =>
          sum +
          Number(fee.amount || 0),
        0
      );

    const totalDiscount =
      allFees.reduce(
        (sum, fee) =>
          sum +
          Number(
            fee.discount || 0
          ),
        0
      );

    const totalPaid =
      allFees.reduce(
        (sum, fee) =>
          sum +
          Number(
            fee.paidAmount || 0
          ),
        0
      );

    const totalRemaining =
      allFees.reduce(
        (sum, fee) =>
          sum +
          Number(
            fee.remainingAmount ||
              0
          ),
        0
      );

    const totalPages =
      Math.ceil(
        total / limit
      );

    return ApiResponse.success(
      res,
      200,
      'Student fee ledger retrieved',
      {
        student,
        summary: {
          totalBilled,
          totalDiscount,
          totalPaid,
          totalRemaining
        },
        fees
      },
      {
        page,
        limit,
        total,
        totalPages,
        hasNextPage:
          page < totalPages,
        hasPrevPage:
          page > 1
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get overall fee collection summary
 * @route   GET /api/fees/summary
 * @access  Private (Admin)
 */
const getFeeSummary = async (
  req,
  res,
  next
) => {
  try {
    const {
      startDate,
      endDate,
      feeType,
      status,
      paymentMethod
    } = req.query;

    const match = {};

    /**
     * Date filter
     */
    if (startDate || endDate) {
      match.date = {};

      if (startDate) {
        const start =
          new Date(startDate);

        if (
          isNaN(
            start.getTime()
          )
        ) {
          return ApiResponse.error(
            res,
            400,
            'Invalid start date format'
          );
        }

        start.setHours(
          0,
          0,
          0,
          0
        );

        match.date.$gte =
          start;
      }

      if (endDate) {
        const end =
          new Date(endDate);

        if (
          isNaN(
            end.getTime()
          )
        ) {
          return ApiResponse.error(
            res,
            400,
            'Invalid end date format'
          );
        }

        end.setHours(
          23,
          59,
          59,
          999
        );

        match.date.$lte =
          end;
      }
    }

    /**
     * Optional filters
     */
    if (feeType) {
      match.feeType =
        feeType
          .trim()
          .toUpperCase();
    }

    if (status) {
      match.status =
        status
          .trim()
          .toUpperCase();
    }

    if (paymentMethod) {
      match.paymentMethod =
        paymentMethod
          .trim()
          .toUpperCase();
    }

    const aggregateSummary =
      await Fee.aggregate([
        {
          $match: match
        },
        {
          $group: {
            _id: null,

            totalBilled: {
              $sum: '$amount'
            },

            totalDiscount: {
              $sum: '$discount'
            },

            totalCollected: {
              $sum: '$paidAmount'
            },

            totalPending: {
              $sum: '$remainingAmount'
            },

            totalTransactions: {
              $sum: 1
            }
          }
        }
      ]);

    const statusBreakdown =
      await Fee.aggregate([
        {
          $match: match
        },
        {
          $group: {
            _id: '$status',

            count: {
              $sum: 1
            },

            totalPaid: {
              $sum: '$paidAmount'
            },

            totalRemaining: {
              $sum: '$remainingAmount'
            }
          }
        },
        {
          $sort: {
            count: -1
          }
        }
      ]);

    const summary =
      aggregateSummary[0] || {
        totalBilled: 0,
        totalDiscount: 0,
        totalCollected: 0,
        totalPending: 0,
        totalTransactions: 0
      };

    return ApiResponse.success(
      res,
      200,
      'Fee financial summary retrieved',
      {
        overview: summary,
        statusBreakdown
      }
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFee,
  getFees,
  getFeeById,
  updateFee,
  deleteFee,
  getFeesByStudent,
  getFeeSummary
};


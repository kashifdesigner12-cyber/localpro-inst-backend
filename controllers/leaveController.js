/**
 * Staff Leave Management Controller
 */

const Leave = require('../models/Leave');
const Staff = require('../models/Staff');
const ApiResponse = require('../utils/apiResponse');
const { isValidObjectId } = require('../utils/validators');
const { logAction } = require('../services/auditService');

const MAX_LIMIT = 100;

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);

  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || 20, 1),
    MAX_LIMIT
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
};

const getSort = (sortBy, order) => {
  const allowedSortFields = [
    'createdAt',
    'updatedAt',
    'startDate',
    'endDate',
    'status'
  ];

  const field = allowedSortFields.includes(sortBy)
    ? sortBy
    : 'createdAt';

  const direction = order === 'asc' ? 1 : -1;

  return { [field]: direction };
};

/**
 * @desc    Submit a leave application for a staff member
 * @route   POST /api/leaves
 * @access  Private (Admin)
 */
const createLeave = async (req, res, next) => {
  try {
    const {
      staffId,
      startDate,
      endDate,
      reason
    } = req.body;

    if (
      !staffId ||
      !startDate ||
      !endDate ||
      !reason
    ) {
      return ApiResponse.error(
        res,
        400,
        'Please provide staffId, startDate, endDate, and reason'
      );
    }

    if (!isValidObjectId(staffId)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid staff ID format'
      );
    }

    const cleanReason = String(reason).trim();

    if (!cleanReason) {
      return ApiResponse.error(
        res,
        400,
        'Leave reason is required'
      );
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (
      Number.isNaN(parsedStartDate.getTime()) ||
      Number.isNaN(parsedEndDate.getTime())
    ) {
      return ApiResponse.error(
        res,
        400,
        'Invalid startDate or endDate'
      );
    }

    if (parsedEndDate < parsedStartDate) {
      return ApiResponse.error(
        res,
        400,
        'End date cannot be before start date'
      );
    }

    const staff = await Staff.findById(staffId);

    if (!staff) {
      return ApiResponse.error(
        res,
        404,
        'Staff member not found'
      );
    }

    const leave = await Leave.create({
      staff: staffId,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      reason: cleanReason,
      status: 'PENDING'
    });

    await logAction({
      user: req.user._id,
      action: 'LEAVE_SUBMITTED',
      entity: 'Leave',
      entityId: leave._id.toString(),
      details: {
        staffId,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        reason: cleanReason
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      201,
      'Leave application submitted',
      { leave }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all leave requests
 * @route   GET /api/leaves
 * @access  Private (Admin)
 */
const getLeaves = async (req, res, next) => {
  try {
    const {
      status,
      staffId,
      search,
      startDate,
      endDate,
      sortBy,
      order
    } = req.query;

    const { page, limit, skip } = parsePagination(req.query);

    const query = {};

    // Status filter
    if (status) {
      const cleanStatus = String(status).trim().toUpperCase();

      const allowedStatuses = [
        'PENDING',
        'APPROVED',
        'REJECTED'
      ];

      if (!allowedStatuses.includes(cleanStatus)) {
        return ApiResponse.error(
          res,
          400,
          'Status must be PENDING, APPROVED, or REJECTED'
        );
      }

      query.status = cleanStatus;
    }

    // Staff filter
    if (staffId) {
      if (!isValidObjectId(staffId)) {
        return ApiResponse.error(
          res,
          400,
          'Invalid staff ID format'
        );
      }

      query.staff = staffId;
    }

    // Date filters
    if (startDate) {
      const parsedStartDate = new Date(startDate);

      if (Number.isNaN(parsedStartDate.getTime())) {
        return ApiResponse.error(
          res,
          400,
          'Invalid startDate'
        );
      }

      query.startDate = {
        $gte: parsedStartDate
      };
    }

    if (endDate) {
      const parsedEndDate = new Date(endDate);

      if (Number.isNaN(parsedEndDate.getTime())) {
        return ApiResponse.error(
          res,
          400,
          'Invalid endDate'
        );
      }

      query.endDate = {
        $lte: parsedEndDate
      };
    }

    if (startDate && endDate) {
      const parsedStartDate = new Date(startDate);
      const parsedEndDate = new Date(endDate);

      if (parsedEndDate < parsedStartDate) {
        return ApiResponse.error(
          res,
          400,
          'endDate cannot be before startDate'
        );
      }
    }

    /*
     * Search staff name/email/phone/designation/department.
     * Since those fields belong to Staff, find matching staff IDs first.
     */
    if (search && String(search).trim()) {
      const cleanSearch = escapeRegex(
        String(search).trim()
      );

      const matchingStaff = await Staff.find({
        $or: [
          {
            name: new RegExp(cleanSearch, 'i')
          },
          {
            email: new RegExp(cleanSearch, 'i')
          },
          {
            phone: new RegExp(cleanSearch, 'i')
          },
          {
            designation: new RegExp(cleanSearch, 'i')
          },
          {
            department: new RegExp(cleanSearch, 'i')
          }
        ]
      }).select('_id');

      query.staff = {
        $in: matchingStaff.map((staff) => staff._id)
      };
    }

    const [leaves, total] = await Promise.all([
      Leave.find(query)
        .populate(
          'staff',
          'name email phone designation department'
        )
        .populate(
          'approvedBy',
          'name email role'
        )
        .sort(getSort(sortBy, order))
        .skip(skip)
        .limit(limit),
      Leave.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return ApiResponse.success(
      res,
      200,
      'Leave applications retrieved',
      {
        leaves,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single leave application
 * @route   GET /api/leaves/:id
 * @access  Private (Admin)
 */
const getLeaveById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid ID format'
      );
    }

    const leave = await Leave.findById(id)
      .populate(
        'staff',
        'name email phone designation department'
      )
      .populate(
        'approvedBy',
        'name email role'
      );

    if (!leave) {
      return ApiResponse.error(
        res,
        404,
        'Leave record not found'
      );
    }

    return ApiResponse.success(
      res,
      200,
      'Leave record retrieved',
      { leave }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update leave status (Approve / Reject)
 * @route   PUT /api/leaves/:id
 * @access  Private (Admin)
 */
const updateLeaveStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid ID format'
      );
    }

    if (
      !status ||
      !['PENDING', 'APPROVED', 'REJECTED'].includes(
        String(status).trim().toUpperCase()
      )
    ) {
      return ApiResponse.error(
        res,
        400,
        'Status must be PENDING, APPROVED, or REJECTED'
      );
    }

    const leave = await Leave.findById(id);

    if (!leave) {
      return ApiResponse.error(
        res,
        404,
        'Leave application not found'
      );
    }

    const cleanStatus = String(status)
      .trim()
      .toUpperCase();

    leave.status = cleanStatus;
    leave.approvedBy = req.user._id;

    if (remarks !== undefined) {
      leave.remarks = String(remarks).trim();
    }

    await leave.save();

    await logAction({
      user: req.user._id,
      action: `LEAVE_${leave.status}`,
      entity: 'Leave',
      entityId: id,
      details: {
        status: leave.status,
        remarks: leave.remarks
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      `Leave application ${leave.status.toLowerCase()} successfully`,
      { leave }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete leave application
 * @route   DELETE /api/leaves/:id
 * @access  Private (Admin)
 */
const deleteLeave = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid ID format'
      );
    }

    const leave = await Leave.findById(id);

    if (!leave) {
      return ApiResponse.error(
        res,
        404,
        'Leave application not found'
      );
    }

    await Leave.findByIdAndDelete(id);

    await logAction({
      user: req.user._id,
      action: 'LEAVE_DELETED',
      entity: 'Leave',
      entityId: id,
      details: {
        staffId: leave.staff,
        startDate: leave.startDate,
        endDate: leave.endDate,
        status: leave.status
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Leave record deleted successfully'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createLeave,
  getLeaves,
  getLeaveById,
  updateLeaveStatus,
  deleteLeave
};
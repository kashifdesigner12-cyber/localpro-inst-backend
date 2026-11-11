/**
 * Staff Attendance Controller
 */

const StaffAttendance = require('../models/StaffAttendance');
const Staff = require('../models/Staff');
const ApiResponse = require('../utils/apiResponse');
const {
  isValidObjectId,
  sanitizeDateOnly
} = require('../utils/validators');
const { logAction } = require('../services/auditService');

const MAX_LIMIT = 100;

const ALLOWED_STATUSES = [
  'PRESENT',
  'ABSENT',
  'LEAVE',
  'LATE'
];

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const parsePagination = (query) => {
  const page = Math.max(
    parseInt(query.page, 10) || 1,
    1
  );

  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || 30, 1),
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
    'date',
    'createdAt',
    'updatedAt',
    'status'
  ];

  const field = allowedSortFields.includes(sortBy)
    ? sortBy
    : 'date';

  const direction = order === 'asc' ? 1 : -1;

  return {
    [field]: direction
  };
};

const parseDate = (value) => {
  if (!value) return null;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return sanitizeDateOnly(value);
};

/**
 * @desc    Mark staff attendance
 * @route   POST /api/staff-attendance
 * @access  Private (Admin)
 */
const markStaffAttendance = async (req, res, next) => {
  try {
    const {
      staffId,
      date,
      status,
      remarks
    } = req.body;

    if (!staffId || !status) {
      return ApiResponse.error(
        res,
        400,
        'Please provide staffId and status (PRESENT, ABSENT, LEAVE, LATE)'
      );
    }

    if (!isValidObjectId(staffId)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid staff ID format'
      );
    }

    const statusUpper = String(status)
      .trim()
      .toUpperCase();

    if (!ALLOWED_STATUSES.includes(statusUpper)) {
      return ApiResponse.error(
        res,
        400,
        'Status must be PRESENT, ABSENT, LEAVE, or LATE'
      );
    }

    const attendanceDate = parseDate(date);

    if (!attendanceDate) {
      return ApiResponse.error(
        res,
        400,
        'Please provide a valid attendance date'
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

    const cleanRemarks =
      remarks !== undefined
        ? String(remarks).trim()
        : '';

    const attendance =
      await StaffAttendance.findOneAndUpdate(
        {
          staff: staffId,
          date: attendanceDate
        },
        {
          status: statusUpper,
          remarks: cleanRemarks,
          markedBy: req.user._id
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          runValidators: true
        }
      );

    await logAction({
      user: req.user._id,
      action: 'STAFF_ATTENDANCE_MARKED',
      entity: 'StaffAttendance',
      entityId: attendance._id.toString(),
      details: {
        staffId,
        date: attendanceDate,
        status: statusUpper
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      201,
      'Staff attendance marked successfully',
      {
        attendance
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get staff attendance records
 * @route   GET /api/staff-attendance
 * @access  Private (Admin)
 */
const getStaffAttendance = async (req, res, next) => {
  try {
    const {
      staffId,
      date,
      startDate,
      endDate,
      status,
      search,
      sortBy,
      order
    } = req.query;

    const {
      page,
      limit,
      skip
    } = parsePagination(req.query);

    const query = {};

    /*
     * Staff filter
     */
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

    /*
     * Status filter
     */
    if (status) {
      const statusUpper = String(status)
        .trim()
        .toUpperCase();

      if (!ALLOWED_STATUSES.includes(statusUpper)) {
        return ApiResponse.error(
          res,
          400,
          'Status must be PRESENT, ABSENT, LEAVE, or LATE'
        );
      }

      query.status = statusUpper;
    }

    /*
     * Exact date filter
     */
    if (date) {
      const attendanceDate = parseDate(date);

      if (!attendanceDate) {
        return ApiResponse.error(
          res,
          400,
          'Invalid date format'
        );
      }

      query.date = attendanceDate;
    }

    /*
     * Date range filter
     */
    if (startDate || endDate) {
      const range = {};

      if (startDate) {
        const parsedStartDate = parseDate(startDate);

        if (!parsedStartDate) {
          return ApiResponse.error(
            res,
            400,
            'Invalid startDate format'
          );
        }

        range.$gte = parsedStartDate;
      }

      if (endDate) {
        const parsedEndDate = parseDate(endDate);

        if (!parsedEndDate) {
          return ApiResponse.error(
            res,
            400,
            'Invalid endDate format'
          );
        }

        range.$lte = parsedEndDate;
      }

      if (
        startDate &&
        endDate &&
        range.$gte > range.$lte
      ) {
        return ApiResponse.error(
          res,
          400,
          'startDate cannot be after endDate'
        );
      }

      /*
       * Don't overwrite exact date if date is already provided.
       */
      if (!date) {
        query.date = range;
      }
    }

    /*
     * Search staff name/email/phone/designation/department
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
        $in: matchingStaff.map(
          (staff) => staff._id
        )
      };
    }

    const [
      records,
      total
    ] = await Promise.all([
      StaffAttendance.find(query)
        .populate(
          'staff',
          'name email phone designation department photo'
        )
        .populate(
          'markedBy',
          'name email role'
        )
        .sort(getSort(sortBy, order))
        .skip(skip)
        .limit(limit)
        .lean(),

      StaffAttendance.countDocuments(query)
    ]);

    const totalPages = Math.ceil(
      total / limit
    );

    return ApiResponse.success(
      res,
      200,
      'Staff attendance records retrieved',
      {
        attendance: records,
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
 * @desc    Get staff attendance by ID
 * @route   GET /api/staff-attendance/:id
 * @access  Private (Admin)
 */
const getStaffAttendanceById = async (
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
        'Invalid ID format'
      );
    }

    const attendance =
      await StaffAttendance.findById(id)
        .populate(
          'staff',
          'name email phone designation department photo'
        )
        .populate(
          'markedBy',
          'name email role'
        );

    if (!attendance) {
      return ApiResponse.error(
        res,
        404,
        'Attendance record not found'
      );
    }

    return ApiResponse.success(
      res,
      200,
      'Staff attendance record retrieved',
      {
        attendance
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update staff attendance
 * @route   PUT /api/staff-attendance/:id
 * @access  Private (Admin)
 */
const updateStaffAttendance = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;
    const {
      status,
      remarks
    } = req.body;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid ID format'
      );
    }

    const record =
      await StaffAttendance.findById(id);

    if (!record) {
      return ApiResponse.error(
        res,
        404,
        'Attendance record not found'
      );
    }

    if (status !== undefined) {
      const statusUpper = String(status)
        .trim()
        .toUpperCase();

      if (!ALLOWED_STATUSES.includes(statusUpper)) {
        return ApiResponse.error(
          res,
          400,
          'Status must be PRESENT, ABSENT, LEAVE, or LATE'
        );
      }

      record.status = statusUpper;
    }

    if (remarks !== undefined) {
      record.remarks = String(
        remarks
      ).trim();
    }

    record.markedBy = req.user._id;

    await record.save();

    await logAction({
      user: req.user._id,
      action: 'STAFF_ATTENDANCE_UPDATED',
      entity: 'StaffAttendance',
      entityId: record._id.toString(),
      details: {
        staffId: record.staff.toString(),
        date: record.date,
        status: record.status,
        remarks: record.remarks
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Staff attendance record updated',
      {
        attendance: record
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete staff attendance
 * @route   DELETE /api/staff-attendance/:id
 * @access  Private (Admin)
 */
const deleteStaffAttendance = async (
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
        'Invalid ID format'
      );
    }

    const attendance =
      await StaffAttendance.findById(id);

    if (!attendance) {
      return ApiResponse.error(
        res,
        404,
        'Attendance record not found'
      );
    }

    await StaffAttendance.findByIdAndDelete(id);

    await logAction({
      user: req.user._id,
      action: 'STAFF_ATTENDANCE_DELETED',
      entity: 'StaffAttendance',
      entityId: id,
      details: {
        staffId: attendance.staff.toString(),
        date: attendance.date,
        status: attendance.status
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Staff attendance record deleted successfully',
      {
        attendanceId: id
      }
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  markStaffAttendance,
  getStaffAttendance,
  getStaffAttendanceById,
  updateStaffAttendance,
  deleteStaffAttendance
};
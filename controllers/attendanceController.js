const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const ApiResponse = require('../utils/apiResponse');

const {
  isValidObjectId,
  sanitizeDateOnly
} = require('../utils/validators');

const { logAction } = require('../services/auditService');

/**
 * Check whether a date is valid
 */
const isValidDate = (date) => {
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Normalize and validate attendance status
 */
const normalizeStatus = (status) => {
  if (typeof status !== 'string') {
    return null;
  }

  const normalized = status.trim().toUpperCase();

  const allowedStatuses = [
    'PRESENT',
    'ABSENT',
    'LATE',
    'LEAVE'
  ];

  if (!allowedStatuses.includes(normalized)) {
    return null;
  }

  return normalized;
};

/**
 * Escape special regex characters
 * Prevents invalid/unsafe search regex patterns.
 */
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Build safe pagination values
 */
const getPagination = (query) => {
  const page = Math.max(
    parseInt(query.page, 10) || 1,
    1
  );

  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || 30, 1),
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
 * Build safe attendance sorting
 */
const getAttendanceSort = (sortBy, order) => {
  const allowedSortFields = [
    'date',
    'status',
    'className',
    'section',
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
 * Mark attendance for a single student
 * @route POST /api/attendance
 */
const markAttendance = async (req, res, next) => {
  try {
    const {
      studentId,
      date,
      status,
      remarks
    } = req.body;

    if (!studentId || status === undefined || status === null) {
      return ApiResponse.error(
        res,
        400,
        'Please provide studentId and status (PRESENT, ABSENT, LATE, LEAVE)'
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

    const attendanceDate = sanitizeDateOnly(date);

    if (!isValidDate(attendanceDate)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid attendance date format'
      );
    }

    const statusUpper = normalizeStatus(status);

    if (!statusUpper) {
      return ApiResponse.error(
        res,
        400,
        'Invalid attendance status. Allowed: PRESENT, ABSENT, LATE, LEAVE'
      );
    }

    let attendance = await Attendance.findOne({
      student: studentId,
      date: attendanceDate
    });

    if (attendance) {
      attendance.status = statusUpper;

      if (remarks !== undefined) {
        attendance.remarks = remarks;
      }

      attendance.markedBy = req.user._id;
      attendance.className = student.className;
      attendance.section = student.section;

      await attendance.save();
    } else {
      attendance = await Attendance.create({
        student: studentId,
        date: attendanceDate,
        status: statusUpper,
        remarks: remarks !== undefined ? remarks : '',
        markedBy: req.user._id,
        className: student.className,
        section: student.section
      });
    }

    await logAction({
      user: req.user._id,
      action: 'ATTENDANCE_MARKED',
      entity: 'Attendance',
      entityId: attendance._id.toString(),
      details: {
        studentId,
        date: attendanceDate,
        status: statusUpper
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      201,
      'Attendance marked successfully',
      {
        attendance
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk mark attendance
 * @route POST /api/attendance/bulk
 */
const markBulkAttendance = async (req, res, next) => {
  try {
    const {
      date,
      attendanceList
    } = req.body;

    if (
      !Array.isArray(attendanceList) ||
      attendanceList.length === 0
    ) {
      return ApiResponse.error(
        res,
        400,
        'attendanceList must be a non-empty array of records'
      );
    }

    const attendanceDate = sanitizeDateOnly(date);

    if (!isValidDate(attendanceDate)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid attendance date format'
      );
    }

    const results = [];

    const studentIds = attendanceList
      .map((item) => item.studentId)
      .filter(isValidObjectId);

    const studentsMap = new Map();

    const students = await Student.find({
      _id: { $in: studentIds }
    });

    students.forEach((student) => {
      studentsMap.set(
        student._id.toString(),
        student
      );
    });

    for (const item of attendanceList) {
      const {
        studentId,
        status = 'PRESENT',
        remarks = ''
      } = item;

      if (!isValidObjectId(studentId)) {
        results.push({
          studentId,
          success: false,
          error: 'Invalid student ID'
        });

        continue;
      }

      const student = studentsMap.get(
        studentId.toString()
      );

      if (!student) {
        results.push({
          studentId,
          success: false,
          error: 'Student not found'
        });

        continue;
      }

      const statusUpper = normalizeStatus(status);

      if (!statusUpper) {
        results.push({
          studentId,
          studentName: student.name,
          success: false,
          error:
            'Invalid attendance status. Allowed: PRESENT, ABSENT, LATE, LEAVE'
        });

        continue;
      }

      const attendanceRecord =
        await Attendance.findOneAndUpdate(
          {
            student: studentId,
            date: attendanceDate
          },
          {
            status: statusUpper,
            remarks,
            markedBy: req.user._id,
            className: student.className,
            section: student.section
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
          }
        );

      results.push({
        studentId,
        studentName: student.name,
        status: statusUpper,
        success: true,
        attendanceId: attendanceRecord._id
      });
    }

    await logAction({
      user: req.user._id,
      action: 'BULK_ATTENDANCE_MARKED',
      entity: 'Attendance',
      details: {
        date: attendanceDate,
        totalSubmitted: attendanceList.length,
        totalAbsent: results.filter(
          (item) =>
            item.success &&
            item.status === 'ABSENT'
        ).length
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Bulk attendance processed successfully',
      {
        date: attendanceDate,
        totalProcessed: results.length,
        absentCount: results.filter(
          (item) =>
            item.success &&
            item.status === 'ABSENT'
        ).length,
        records: results
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get attendance records with filters, search, sorting and pagination
 * @route GET /api/attendance
 */
const getAttendance = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      skip
    } = getPagination(req.query);

    const {
      date,
      startDate,
      endDate,
      className,
      section,
      status,
      studentId,
      search,
      sortBy = 'date',
      order = 'desc'
    } = req.query;

    const query = {};

    // Date filter
    if (date) {
      const targetDate =
        sanitizeDateOnly(date);

      if (!isValidDate(targetDate)) {
        return ApiResponse.error(
          res,
          400,
          'Invalid date format'
        );
      }

      query.date = targetDate;
    } else if (startDate || endDate) {
      query.date = {};

      if (startDate) {
        const start =
          sanitizeDateOnly(startDate);

        if (!isValidDate(start)) {
          return ApiResponse.error(
            res,
            400,
            'Invalid start date format'
          );
        }

        start.setUTCHours(0, 0, 0, 0);
        query.date.$gte = start;
      }

      if (endDate) {
        const end =
          sanitizeDateOnly(endDate);

        if (!isValidDate(end)) {
          return ApiResponse.error(
            res,
            400,
            'Invalid end date format'
          );
        }

        end.setUTCHours(
          23,
          59,
          59,
          999
        );

        query.date.$lte = end;
      }
    }

    // Class filter
    if (className && className.trim()) {
      query.className = new RegExp(
        `^${escapeRegex(className.trim())}$`,
        'i'
      );
    }

    // Section filter
    if (section && section.trim()) {
      query.section = new RegExp(
        `^${escapeRegex(section.trim())}$`,
        'i'
      );
    }

    // Status filter
    if (status) {
      const statusUpper =
        normalizeStatus(status);

      if (!statusUpper) {
        return ApiResponse.error(
          res,
          400,
          'Invalid attendance status. Allowed: PRESENT, ABSENT, LATE, LEAVE'
        );
      }

      query.status = statusUpper;
    }

    // Student ID filter
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
     * Search
     *
     * Searches student fields through
     * Student collection first, then filters attendance.
     */
    if (search && search.trim()) {
      const searchRegex = new RegExp(
        escapeRegex(search.trim()),
        'i'
      );

      const matchingStudents = await Student.find({
        $or: [
          { name: searchRegex },
          { admissionNo: searchRegex },
          { parentName: searchRegex },
          { parentPhone: searchRegex }
        ]
      }).select('_id');

      const matchingStudentIds =
        matchingStudents.map(
          (student) => student._id
        );

      if (matchingStudentIds.length === 0) {
        return ApiResponse.success(
          res,
          200,
          'Attendance records retrieved',
          {
            attendance: []
          },
          {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: page > 1
          }
        );
      }

      query.student = {
        $in: matchingStudentIds
      };
    }

    const sort = getAttendanceSort(
      sortBy,
      order
    );

    const [records, total] =
      await Promise.all([
        Attendance.find(query)
          .populate(
            'student',
            'name admissionNo rollNo className section parentName parentPhone photo'
          )
          .populate(
            'markedBy',
            'name email role'
          )
          .sort(sort)
          .skip(skip)
          .limit(limit),

        Attendance.countDocuments(query)
      ]);

    const totalPages =
      Math.ceil(total / limit);

    return ApiResponse.success(
      res,
      200,
      'Attendance records retrieved',
      {
        attendance: records
      },
      {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get single attendance record by ID
 * @route GET /api/attendance/:id
 */
const getAttendanceById = async (
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
        'Invalid attendance ID format'
      );
    }

    const record =
      await Attendance.findById(id)
        .populate(
          'student',
          'name admissionNo rollNo className section'
        )
        .populate(
          'markedBy',
          'name email role'
        );

    if (!record) {
      return ApiResponse.error(
        res,
        404,
        'Attendance record not found'
      );
    }

    return ApiResponse.success(
      res,
      200,
      'Attendance record retrieved',
      {
        attendance: record
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update single attendance record
 * @route PUT /api/attendance/:id
 */
const updateAttendance = async (
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
        'Invalid attendance ID format'
      );
    }

    const hasStatus =
      status !== undefined &&
      status !== null;

    const hasRemarks =
      remarks !== undefined;

    if (!hasStatus && !hasRemarks) {
      return ApiResponse.error(
        res,
        400,
        'Please provide at least one field to update: status or remarks'
      );
    }

    const record =
      await Attendance.findById(id)
        .populate('student');

    if (!record) {
      return ApiResponse.error(
        res,
        404,
        'Attendance record not found'
      );
    }

    const oldStatus =
      record.status;

    let statusUpper = record.status;

    if (hasStatus) {
      statusUpper =
        normalizeStatus(status);

      if (!statusUpper) {
        return ApiResponse.error(
          res,
          400,
          'Invalid attendance status. Allowed: PRESENT, ABSENT, LATE, LEAVE'
        );
      }

      record.status = statusUpper;
    }

    if (hasRemarks) {
      record.remarks = remarks;
    }

    record.markedBy = req.user._id;

    await record.save();

    await logAction({
      user: req.user._id,
      action: 'ATTENDANCE_UPDATED',
      entity: 'Attendance',
      entityId: id,
      details: {
        oldStatus,
        newStatus: record.status
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Attendance record updated successfully',
      {
        attendance: record
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete single attendance record
 * @route DELETE /api/attendance/:id
 */
const deleteAttendance = async (
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
        'Invalid attendance ID format'
      );
    }

    const record =
      await Attendance.findById(id);

    if (!record) {
      return ApiResponse.error(
        res,
        404,
        'Attendance record not found'
      );
    }

    await Attendance.findByIdAndDelete(id);

    await logAction({
      user: req.user._id,
      action: 'ATTENDANCE_DELETED',
      entity: 'Attendance',
      entityId: id,
      details: {
        studentId:
          record.student.toString(),
        date: record.date,
        status: record.status
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Attendance record deleted successfully',
      {
        attendanceId: id
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get attendance sheet for a specific date
 * Supports filters, sorting and pagination
 * @route GET /api/attendance/date/:date
 */
const getAttendanceByDate = async (
  req,
  res,
  next
) => {
  try {
    const { date } = req.params;

    const targetDate =
      sanitizeDateOnly(date);

    if (!isValidDate(targetDate)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid date format'
      );
    }

    const {
      className,
      section,
      page,
      limit,
      skip
    } = getPagination(req.query);

    const {
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const query = {
      date: targetDate
    };

    if (className && className.trim()) {
      query.className = new RegExp(
        `^${escapeRegex(className.trim())}$`,
        'i'
      );
    }

    if (section && section.trim()) {
      query.section = new RegExp(
        `^${escapeRegex(section.trim())}$`,
        'i'
      );
    }

    const sort = getAttendanceSort(
      sortBy,
      order
    );

    const [records, total] =
      await Promise.all([
        Attendance.find(query)
          .populate(
            'student',
            'name admissionNo rollNo className section'
          )
          .populate(
            'markedBy',
            'name email role'
          )
          .sort(sort)
          .skip(skip)
          .limit(limit),

        Attendance.countDocuments(query)
      ]);

    const totalPages =
      Math.ceil(total / limit);

    const summaryRecords =
      await Attendance.find(query).select(
        'status'
      );

    const summary = {
      total,

      present: summaryRecords.filter(
        (r) => r.status === 'PRESENT'
      ).length,

      absent: summaryRecords.filter(
        (r) => r.status === 'ABSENT'
      ).length,

      late: summaryRecords.filter(
        (r) => r.status === 'LATE'
      ).length,

      leave: summaryRecords.filter(
        (r) => r.status === 'LEAVE'
      ).length
    };

    return ApiResponse.success(
      res,
      200,
      `Attendance for ${date} retrieved`,
      {
        date: targetDate,
        summary,
        attendance: records
      },
      {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get attendance history and statistics for a student
 * Supports pagination and sorting
 * @route GET /api/attendance/student/:studentId
 */
const getAttendanceByStudent = async (
  req,
  res,
  next
) => {
  try {
    const { studentId } = req.params;

    if (!isValidObjectId(studentId)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid student ID format'
      );
    }

    const student =
      await Student.findById(studentId);

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
      sortBy = 'date',
      order = 'desc'
    } = req.query;

    const query = {
      student: studentId
    };

    // Date range filters
    if (startDate || endDate) {
      query.date = {};

      if (startDate) {
        const start =
          sanitizeDateOnly(startDate);

        if (!isValidDate(start)) {
          return ApiResponse.error(
            res,
            400,
            'Invalid start date format'
          );
        }

        start.setUTCHours(0, 0, 0, 0);
        query.date.$gte = start;
      }

      if (endDate) {
        const end =
          sanitizeDateOnly(endDate);

        if (!isValidDate(end)) {
          return ApiResponse.error(
            res,
            400,
            'Invalid end date format'
          );
        }

        end.setUTCHours(
          23,
          59,
          59,
          999
        );

        query.date.$lte = end;
      }
    }

    // Status filter
    if (status) {
      const statusUpper =
        normalizeStatus(status);

      if (!statusUpper) {
        return ApiResponse.error(
          res,
          400,
          'Invalid attendance status. Allowed: PRESENT, ABSENT, LATE, LEAVE'
        );
      }

      query.status = statusUpper;
    }

    const sort = getAttendanceSort(
      sortBy,
      order
    );

    const [records, total] =
      await Promise.all([
        Attendance.find(query)
          .populate(
            'markedBy',
            'name email role'
          )
          .sort(sort)
          .skip(skip)
          .limit(limit),

        Attendance.countDocuments(query)
      ]);

    const totalPages =
      Math.ceil(total / limit);

    /**
     * Statistics should be calculated
     * from ALL matching records, not only
     * the current paginated page.
     */
    const allRecords =
      await Attendance.find(query).select(
        'status'
      );

    const totalDays =
      allRecords.length;

    const presentCount =
      allRecords.filter(
        (r) => r.status === 'PRESENT'
      ).length;

    const absentCount =
      allRecords.filter(
        (r) => r.status === 'ABSENT'
      ).length;

    const lateCount =
      allRecords.filter(
        (r) => r.status === 'LATE'
      ).length;

    const leaveCount =
      allRecords.filter(
        (r) => r.status === 'LEAVE'
      ).length;

    const attendancePercentage =
      totalDays > 0
        ? Math.round(
            (
              (
                presentCount +
                lateCount
              ) /
              totalDays
            ) *
              100 *
              100
          ) / 100
        : 0;

    return ApiResponse.success(
      res,
      200,
      'Student attendance statistics retrieved',
      {
        student,

        stats: {
          totalDays,
          presentCount,
          absentCount,
          lateCount,
          leaveCount,
          attendancePercentage
        },

        history: records
      },
      {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  markAttendance,
  markBulkAttendance,
  getAttendance,
  getAttendanceById,
  updateAttendance,
  deleteAttendance,
  getAttendanceByDate,
  getAttendanceByStudent
};

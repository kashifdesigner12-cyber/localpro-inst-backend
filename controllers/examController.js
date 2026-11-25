/**
 * Exam Controller
 */

const Exam = require('../models/Exam');
const Result = require('../models/Result');
const ApiResponse = require('../utils/apiResponse');
const { isValidObjectId } = require('../utils/validators');
const { logAction } = require('../services/auditService');

/**
 * Escape special regex characters
 */
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
const getExamSort = (sortBy, order) => {
  const allowedSortFields = [
    'name',
    'examType',
    'className',
    'startDate',
    'endDate',
    'academicYear',
    'createdAt',
    'updatedAt'
  ];

  const safeSortBy =
    allowedSortFields.includes(sortBy)
      ? sortBy
      : 'startDate';

  const sortOrder =
    order === 'asc' ? 1 : -1;

  return {
    [safeSortBy]: sortOrder,

    // Stable secondary sorting
    ...(safeSortBy !== 'createdAt'
      ? { createdAt: -1 }
      : {})
  };
};

/**
 * Validate date value
 */
const parseDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
};

/**
 * @desc    Create a new Exam
 * @route   POST /api/exams
 * @access  Private (Admin, Teacher)
 */
const createExam = async (req, res, next) => {
  try {
    const {
      name,
      examType,
      className,
      startDate,
      endDate,
      academicYear
    } = req.body;

    if (
      !name ||
      !className ||
      !startDate ||
      !endDate ||
      !academicYear
    ) {
      return ApiResponse.error(
        res,
        400,
        'Please provide name, className, startDate, endDate, and academicYear'
      );
    }

    if (!name.trim()) {
      return ApiResponse.error(
        res,
        400,
        'Exam name cannot be empty'
      );
    }

    if (!className.trim()) {
      return ApiResponse.error(
        res,
        400,
        'Class name cannot be empty'
      );
    }

    if (!academicYear.trim()) {
      return ApiResponse.error(
        res,
        400,
        'Academic year cannot be empty'
      );
    }

    const parsedStartDate =
      parseDate(startDate);

    const parsedEndDate =
      parseDate(endDate);

    if (!parsedStartDate) {
      return ApiResponse.error(
        res,
        400,
        'Invalid start date format'
      );
    }

    if (!parsedEndDate) {
      return ApiResponse.error(
        res,
        400,
        'Invalid end date format'
      );
    }

    if (
      parsedEndDate < parsedStartDate
    ) {
      return ApiResponse.error(
        res,
        400,
        'End date cannot be before start date'
      );
    }

    const exam = await Exam.create({
      name: name.trim(),
      examType: examType
        ? examType.trim().toUpperCase()
        : 'MIDTERM',
      className: className.trim(),
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      academicYear:
        academicYear.trim(),
      createdBy: req.user._id
    });

    await logAction({
      user: req.user._id,
      action: 'EXAM_CREATED',
      entity: 'Exam',
      entityId: exam._id.toString(),
      details: {
        name: exam.name,
        className: exam.className,
        academicYear:
          exam.academicYear
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      201,
      'Exam created successfully',
      {
        exam
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all exams with search, filters, sorting and pagination
 * @route   GET /api/exams
 * @access  Private (Admin, Teacher)
 */
const getExams = async (
  req,
  res,
  next
) => {
  try {
    const {
      page,
      limit,
      skip
    } = getPagination(req.query);

    const {
      className,
      academicYear,
      examType,
      search,
      startDate,
      endDate,
      sortBy = 'startDate',
      order = 'desc'
    } = req.query;

    const query = {};

    /**
     * Class filter
     */
    if (
      className &&
      className.trim()
    ) {
      query.className =
        new RegExp(
          `^${escapeRegex(
            className.trim()
          )}$`,
          'i'
        );
    }

    /**
     * Academic year filter
     */
    if (
      academicYear &&
      academicYear.trim()
    ) {
      query.academicYear =
        academicYear.trim();
    }

    /**
     * Exam type filter
     */
    if (
      examType &&
      examType.trim()
    ) {
      query.examType =
        examType
          .trim()
          .toUpperCase();
    }

    /**
     * Start date filter
     *
     * Finds exams whose startDate
     * is greater than or equal to
     * the provided date.
     */
    if (startDate) {
      const parsedStartDate =
        parseDate(startDate);

      if (!parsedStartDate) {
        return ApiResponse.error(
          res,
          400,
          'Invalid start date filter format'
        );
      }

      parsedStartDate.setHours(
        0,
        0,
        0,
        0
      );

      query.startDate = {
        $gte: parsedStartDate
      };
    }

    /**
     * End date filter
     *
     * Finds exams whose endDate
     * is less than or equal to
     * the provided date.
     */
    if (endDate) {
      const parsedEndDate =
        parseDate(endDate);

      if (!parsedEndDate) {
        return ApiResponse.error(
          res,
          400,
          'Invalid end date filter format'
        );
      }

      parsedEndDate.setHours(
        23,
        59,
        59,
        999
      );

      query.endDate = {
        $lte: parsedEndDate
      };
    }

    /**
     * Search
     *
     * Searches:
     * - exam name
     * - class name
     * - academic year
     */
    if (
      search &&
      search.trim()
    ) {
      const searchRegex =
        new RegExp(
          escapeRegex(
            search.trim()
          ),
          'i'
        );

      query.$or = [
        {
          name: searchRegex
        },
        {
          className: searchRegex
        },
        {
          academicYear:
            searchRegex
        }
      ];
    }

    const sort =
      getExamSort(
        sortBy,
        order
      );

    const [
      exams,
      total
    ] = await Promise.all([
      Exam.find(query)
        .populate(
          'createdBy',
          'name email role'
        )
        .sort(sort)
        .skip(skip)
        .limit(limit),

      Exam.countDocuments(query)
    ]);

    const totalPages =
      Math.ceil(
        total / limit
      );

    return ApiResponse.success(
      res,
      200,
      'Exams retrieved',
      {
        exams
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
 * @desc    Get single exam by ID
 * @route   GET /api/exams/:id
 * @access  Private (Admin, Teacher)
 */
const getExamById = async (
  req,
  res,
  next
) => {
  try {
    const { id } =
      req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid exam ID format'
      );
    }

    const exam =
      await Exam.findById(id)
        .populate(
          'createdBy',
          'name email role'
        );

    if (!exam) {
      return ApiResponse.error(
        res,
        404,
        'Exam not found'
      );
    }

    return ApiResponse.success(
      res,
      200,
      'Exam details retrieved',
      {
        exam
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update exam
 * @route   PUT /api/exams/:id
 * @access  Private (Admin, Teacher)
 */
const updateExam = async (
  req,
  res,
  next
) => {
  try {
    const { id } =
      req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid exam ID format'
      );
    }

    const exam =
      await Exam.findById(id);

    if (!exam) {
      return ApiResponse.error(
        res,
        404,
        'Exam not found'
      );
    }

    const {
      name,
      examType,
      className,
      startDate,
      endDate,
      academicYear
    } = req.body;

    /**
     * Update only allowed fields.
     * Do not directly pass req.body
     * to findByIdAndUpdate.
     */
    if (name !== undefined) {
      if (
        !name.toString().trim()
      ) {
        return ApiResponse.error(
          res,
          400,
          'Exam name cannot be empty'
        );
      }

      exam.name =
        name.toString().trim();
    }

    if (examType !== undefined) {
      exam.examType =
        examType
          .toString()
          .trim()
          .toUpperCase();
    }

    if (
      className !== undefined
    ) {
      if (
        !className
          .toString()
          .trim()
      ) {
        return ApiResponse.error(
          res,
          400,
          'Class name cannot be empty'
        );
      }

      exam.className =
        className
          .toString()
          .trim();
    }

    if (
      academicYear !== undefined
    ) {
      if (
        !academicYear
          .toString()
          .trim()
      ) {
        return ApiResponse.error(
          res,
          400,
          'Academic year cannot be empty'
        );
      }

      exam.academicYear =
        academicYear
          .toString()
          .trim();
    }

    /**
     * Validate dates using the
     * final values after updates.
     */
    if (
      startDate !== undefined
    ) {
      const parsedStartDate =
        parseDate(startDate);

      if (!parsedStartDate) {
        return ApiResponse.error(
          res,
          400,
          'Invalid start date format'
        );
      }

      exam.startDate =
        parsedStartDate;
    }

    if (
      endDate !== undefined
    ) {
      const parsedEndDate =
        parseDate(endDate);

      if (!parsedEndDate) {
        return ApiResponse.error(
          res,
          400,
          'Invalid end date format'
        );
      }

      exam.endDate =
        parsedEndDate;
    }

    if (
      exam.endDate <
      exam.startDate
    ) {
      return ApiResponse.error(
        res,
        400,
        'End date cannot be before start date'
      );
    }

    await exam.save();

    await logAction({
      user: req.user._id,
      action: 'EXAM_UPDATED',
      entity: 'Exam',
      entityId: id,
      details: {
        name: exam.name,
        examType:
          exam.examType,
        className:
          exam.className,
        startDate:
          exam.startDate,
        endDate:
          exam.endDate,
        academicYear:
          exam.academicYear
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Exam updated successfully',
      {
        exam
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete exam and its related results
 * @route   DELETE /api/exams/:id
 * @access  Private (Admin)
 */
const deleteExam = async (
  req,
  res,
  next
) => {
  try {
    const { id } =
      req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid exam ID format'
      );
    }

    const exam =
      await Exam.findById(id);

    if (!exam) {
      return ApiResponse.error(
        res,
        404,
        'Exam not found'
      );
    }

    // Delete associated results
    await Result.deleteMany({
      exam: id
    });

    await Exam.findByIdAndDelete(
      id
    );

    await logAction({
      user: req.user._id,
      action: 'EXAM_DELETED',
      entity: 'Exam',
      entityId: id,
      details: {
        name: exam.name
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Exam and related results deleted successfully'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createExam,
  getExams,
  getExamById,
  updateExam,
  deleteExam
};
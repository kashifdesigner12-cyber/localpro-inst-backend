const Result = require('../models/Result');
const Student = require('../models/Student');
const Exam = require('../models/Exam');
const ApiResponse = require('../utils/apiResponse');
const { isValidObjectId } = require('../utils/validators');

const {
  getStudentExamPerformance,
  sendPerformanceReportToParent
} = require('../services/performanceService');

const { logAction } = require('../services/auditService');

const MAX_LIMIT = 100;

const escapeRegex = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);

  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || 10, 1),
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
    'subject',
    'totalMarks',
    'obtainedMarks',
    'percentage',
    'grade'
  ];

  const field = allowedSortFields.includes(sortBy)
    ? sortBy
    : 'createdAt';

  const direction = order === 'asc' ? 1 : -1;

  return {
    [field]: direction
  };
};

/**
 * @desc    Add or update a single subject result
 * @route   POST /api/results
 * @access  Private (Admin, Teacher)
 */
const createResult = async (req, res, next) => {
  try {
    const {
      studentId,
      examId,
      subject,
      totalMarks,
      obtainedMarks,
      remarks
    } = req.body;

    if (
      !studentId ||
      !examId ||
      !subject ||
      totalMarks === undefined ||
      obtainedMarks === undefined
    ) {
      return ApiResponse.error(
        res,
        400,
        'Please provide studentId, examId, subject, totalMarks, and obtainedMarks'
      );
    }

    if (!isValidObjectId(studentId) || !isValidObjectId(examId)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid studentId or examId format'
      );
    }

    const cleanSubject = String(subject).trim();

    if (!cleanSubject) {
      return ApiResponse.error(
        res,
        400,
        'Subject is required'
      );
    }

    const numTotal = Number(totalMarks);
    const numObtained = Number(obtainedMarks);

    if (!Number.isFinite(numTotal) || numTotal <= 0) {
      return ApiResponse.error(
        res,
        400,
        'Total marks must be a valid number greater than 0'
      );
    }

    if (!Number.isFinite(numObtained)) {
      return ApiResponse.error(
        res,
        400,
        'Obtained marks must be a valid number'
      );
    }

    if (numObtained < 0 || numObtained > numTotal) {
      return ApiResponse.error(
        res,
        400,
        `Obtained marks (${numObtained}) must be between 0 and total marks (${numTotal})`
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

    const exam = await Exam.findById(examId);

    if (!exam) {
      return ApiResponse.error(
        res,
        404,
        'Exam not found'
      );
    }

    // Upsert result for student + exam + subject
    let result = await Result.findOne({
      student: studentId,
      exam: examId,
      subject: cleanSubject
    });

    if (result) {
      result.totalMarks = numTotal;
      result.obtainedMarks = numObtained;

      if (remarks !== undefined) {
        result.remarks = String(remarks).trim();
      }

      result.createdBy = req.user._id;

      await result.save();
    } else {
      result = await Result.create({
        student: studentId,
        exam: examId,
        subject: cleanSubject,
        totalMarks: numTotal,
        obtainedMarks: numObtained,
        remarks: remarks ? String(remarks).trim() : '',
        createdBy: req.user._id
      });
    }

    await logAction({
      user: req.user._id,
      action: 'RESULT_RECORDED',
      entity: 'Result',
      entityId: result._id.toString(),
      details: {
        studentId,
        examId,
        subject: cleanSubject,
        percentage: result.percentage,
        grade: result.grade
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      201,
      'Result recorded successfully',
      { result }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all results with filters, search, sorting and pagination
 * @route   GET /api/results
 * @access  Private (Admin, Teacher)
 */
const getResults = async (req, res, next) => {
  try {
    const {
      studentId,
      examId,
      subject,
      search,
      sortBy,
      order
    } = req.query;

    const { page, limit, skip } = parsePagination(req.query);

    const query = {};

    // Validate filters instead of silently ignoring invalid IDs
    if (studentId) {
      if (!isValidObjectId(studentId)) {
        return ApiResponse.error(
          res,
          400,
          'Invalid studentId format'
        );
      }

      query.student = studentId;
    }

    if (examId) {
      if (!isValidObjectId(examId)) {
        return ApiResponse.error(
          res,
          400,
          'Invalid examId format'
        );
      }

      query.exam = examId;
    }

    if (subject) {
      const cleanSubject = String(subject).trim();

      if (cleanSubject) {
        query.subject = new RegExp(
          escapeRegex(cleanSubject),
          'i'
        );
      }
    }

    /*
     * Search supports subject directly at Result level.
     * Student/exam searches are handled through matching IDs below.
     */
    let resultsQuery = Result.find(query);

    if (search && String(search).trim()) {
      const cleanSearch = escapeRegex(
        String(search).trim()
      );

      const matchingStudents = await Student.find({
        $or: [
          {
            name: new RegExp(cleanSearch, 'i')
          },
          {
            admissionNo: new RegExp(cleanSearch, 'i')
          },
          {
            rollNo: new RegExp(cleanSearch, 'i')
          }
        ]
      }).select('_id');

      const matchingExams = await Exam.find({
        $or: [
          {
            name: new RegExp(cleanSearch, 'i')
          },
          {
            examType: new RegExp(cleanSearch, 'i')
          },
          {
            academicYear: new RegExp(cleanSearch, 'i')
          }
        ]
      }).select('_id');

      const searchConditions = [
        {
          subject: new RegExp(cleanSearch, 'i')
        }
      ];

      if (matchingStudents.length > 0) {
        searchConditions.push({
          student: {
            $in: matchingStudents.map(
              (student) => student._id
            )
          }
        });
      }

      if (matchingExams.length > 0) {
        searchConditions.push({
          exam: {
            $in: matchingExams.map(
              (exam) => exam._id
            )
          }
        });
      }

      const existingConditions =
        Object.keys(query).length > 0
          ? {
              ...query,
              $or: searchConditions
            }
          : {
              $or: searchConditions
            };

      resultsQuery = Result.find(existingConditions);
    }

    const finalQuery = resultsQuery.getFilter();

    const total = await Result.countDocuments(
      finalQuery
    );

    const results = await resultsQuery
      .populate(
        'student',
        'name admissionNo rollNo className section'
      )
      .populate(
        'exam',
        'name examType academicYear startDate endDate'
      )
      .populate(
        'createdBy',
        'name email'
      )
      .sort(getSort(sortBy, order))
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(total / limit);

    return ApiResponse.success(
      res,
      200,
      'Results retrieved',
      {
        results,
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
 * @desc    Get complete exam performance report for a student
 * @route   GET /api/results/student/:studentId
 * @access  Private (Admin, Teacher)
 */
const getResultsByStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const {
      examId,
      subject,
      search,
      sortBy,
      order
    } = req.query;

    if (!isValidObjectId(studentId)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid student ID format'
      );
    }

    if (examId && !isValidObjectId(examId)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid exam ID format'
      );
    }

    const student = await Student.findById(
      studentId
    ).select(
      'name admissionNo rollNo className section'
    );

    if (!student) {
      return ApiResponse.error(
        res,
        404,
        'Student not found'
      );
    }

    // If a specific exam is requested, preserve performance service
    if (examId) {
      const performance =
        await getStudentExamPerformance(
          studentId,
          examId
        );

      return ApiResponse.success(
        res,
        200,
        'Student exam performance retrieved',
        performance
      );
    }

    const { page, limit, skip } =
      parsePagination(req.query);

    const query = {
      student: studentId
    };

    if (subject) {
      const cleanSubject = String(subject).trim();

      if (cleanSubject) {
        query.subject = new RegExp(
          escapeRegex(cleanSubject),
          'i'
        );
      }
    }

    if (search) {
      const cleanSearch =
        String(search).trim();

      if (cleanSearch) {
        const matchingExams =
          await Exam.find({
            $or: [
              {
                name: new RegExp(
                  escapeRegex(cleanSearch),
                  'i'
                )
              },
              {
                examType: new RegExp(
                  escapeRegex(cleanSearch),
                  'i'
                )
              },
              {
                academicYear: new RegExp(
                  escapeRegex(cleanSearch),
                  'i'
                )
              }
            ]
          }).select('_id');

        const searchConditions = [
          {
            subject: new RegExp(
              escapeRegex(cleanSearch),
              'i'
            )
          }
        ];

        if (matchingExams.length > 0) {
          searchConditions.push({
            exam: {
              $in: matchingExams.map(
                (exam) => exam._id
              )
            }
          });
        }

        query.$or = searchConditions;
      }
    }

    const total =
      await Result.countDocuments(query);

    const results = await Result.find(query)
      .populate(
        'exam',
        'name examType academicYear startDate endDate'
      )
      .populate(
        'createdBy',
        'name email'
      )
      .sort(getSort(sortBy, order))
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages =
      Math.ceil(total / limit);

    return ApiResponse.success(
      res,
      200,
      'Student results history retrieved',
      {
        student,
        results,
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
 * @desc    Get single result by ID
 * @route   GET /api/results/:id
 * @access  Private (Admin, Teacher)
 */
const getResultById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid result ID format'
      );
    }

    const result = await Result.findById(id)
      .populate(
        'student',
        'name admissionNo rollNo className section'
      )
      .populate(
        'exam',
        'name examType academicYear startDate endDate'
      )
      .populate(
        'createdBy',
        'name email'
      );

    if (!result) {
      return ApiResponse.error(
        res,
        404,
        'Result not found'
      );
    }

    return ApiResponse.success(
      res,
      200,
      'Result retrieved',
      { result }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update single subject result
 * @route   PUT /api/results/:id
 * @access  Private (Admin, Teacher)
 */
const updateResult = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid ID format'
      );
    }

    const result = await Result.findById(id);

    if (!result) {
      return ApiResponse.error(
        res,
        404,
        'Result not found'
      );
    }

    const {
      totalMarks,
      obtainedMarks,
      remarks,
      subject
    } = req.body;

    if (subject !== undefined) {
      const cleanSubject =
        String(subject).trim();

      if (!cleanSubject) {
        return ApiResponse.error(
          res,
          400,
          'Subject cannot be empty'
        );
      }

      result.subject = cleanSubject;
    }

    if (totalMarks !== undefined) {
      const numTotal = Number(totalMarks);

      if (
        !Number.isFinite(numTotal) ||
        numTotal <= 0
      ) {
        return ApiResponse.error(
          res,
          400,
          'Total marks must be a valid number greater than 0'
        );
      }

      result.totalMarks = numTotal;
    }

    if (obtainedMarks !== undefined) {
      const numObtained =
        Number(obtainedMarks);

      if (!Number.isFinite(numObtained)) {
        return ApiResponse.error(
          res,
          400,
          'Obtained marks must be a valid number'
        );
      }

      result.obtainedMarks = numObtained;
    }

    if (
      result.obtainedMarks < 0 ||
      result.obtainedMarks > result.totalMarks
    ) {
      return ApiResponse.error(
        res,
        400,
        `Obtained marks (${result.obtainedMarks}) must be between 0 and total marks (${result.totalMarks})`
      );
    }

    if (remarks !== undefined) {
      result.remarks =
        String(remarks).trim();
    }

    // Prevent duplicate student + exam + subject combination
    const duplicate = await Result.findOne({
      _id: {
        $ne: result._id
      },
      student: result.student,
      exam: result.exam,
      subject: result.subject
    });

    if (duplicate) {
      return ApiResponse.error(
        res,
        409,
        'A result already exists for this student, exam, and subject'
      );
    }

    result.createdBy = req.user._id;

    await result.save();

    await logAction({
      user: req.user._id,
      action: 'RESULT_UPDATED',
      entity: 'Result',
      entityId: result._id.toString(),
      details: {
        studentId: result.student,
        examId: result.exam,
        subject: result.subject,
        percentage: result.percentage,
        grade: result.grade
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Result updated successfully',
      { result }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete result
 * @route   DELETE /api/results/:id
 * @access  Private (Admin)
 */
const deleteResult = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid ID format'
      );
    }

    const result = await Result.findById(id);

    if (!result) {
      return ApiResponse.error(
        res,
        404,
        'Result not found'
      );
    }

    await Result.findByIdAndDelete(id);

    await logAction({
      user: req.user._id,
      action: 'RESULT_DELETED',
      entity: 'Result',
      entityId: id,
      details: {
        studentId: result.student,
        examId: result.exam,
        subject: result.subject,
        percentage: result.percentage,
        grade: result.grade
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Result deleted successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send student performance report to parent via Email
 * @route   POST /api/results/send-report
 * @access  Private (Admin, Teacher)
 */
const sendPerformanceReport = async (
  req,
  res,
  next
) => {
  try {
    const {
      studentId,
      examId
    } = req.body;

    if (!studentId || !examId) {
      return ApiResponse.error(
        res,
        400,
        'Please provide studentId and examId'
      );
    }

    if (
      !isValidObjectId(studentId) ||
      !isValidObjectId(examId)
    ) {
      return ApiResponse.error(
        res,
        400,
        'Invalid studentId or examId format'
      );
    }

    const reportResult =
      await sendPerformanceReportToParent(
        studentId,
        examId
      );

    await logAction({
      user: req.user._id,
      action: 'PERFORMANCE_REPORT_SENT',
      entity: 'Result',
      entityId: studentId,
      details: {
        examId,
        studentName:
          reportResult.student.name,
        percentage:
          reportResult.summary.percentage
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Performance report dispatched to parent',
      reportResult
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createResult,
  getResults,
  getResultsByStudent,
  getResultById,
  updateResult,
  deleteResult,
  sendPerformanceReport
};


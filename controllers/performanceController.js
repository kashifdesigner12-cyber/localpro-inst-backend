const Performance = require("../models/Performance");
const Student = require("../models/Student");
const ApiResponse = require("../utils/apiResponse");

// ======================================================
// SAVE / UPDATE STUDENT PERFORMANCE
// POST /api/performance
// ======================================================
const savePerformance = async (req, res, next) => {
  try {
    const {
      studentId,
      month,
      percentage,
      remarks,
    } = req.body;

    // --------------------------------------------
    // VALIDATE STUDENT ID
    // --------------------------------------------
    if (!studentId) {
      return ApiResponse.error(
        res,
        400,
        "Student ID is required"
      );
    }

    // --------------------------------------------
    // VALIDATE MONTH
    // --------------------------------------------
    if (!month) {
      return ApiResponse.error(
        res,
        400,
        "Month is required"
      );
    }

    const monthPattern =
      /^\d{4}-(0[1-9]|1[0-2])$/;

    if (!monthPattern.test(month)) {
      return ApiResponse.error(
        res,
        400,
        "Month must be in YYYY-MM format"
      );
    }

    // --------------------------------------------
    // VALIDATE PERCENTAGE
    // --------------------------------------------
    if (
      percentage === undefined ||
      percentage === null ||
      percentage === ""
    ) {
      return ApiResponse.error(
        res,
        400,
        "Performance percentage is required"
      );
    }

    const numericPercentage =
      Number(percentage);

    if (
      Number.isNaN(numericPercentage) ||
      numericPercentage < 0 ||
      numericPercentage > 100
    ) {
      return ApiResponse.error(
        res,
        400,
        "Performance percentage must be between 0 and 100"
      );
    }

    // --------------------------------------------
    // CHECK STUDENT EXISTS
    // --------------------------------------------
    const student =
      await Student.findById(studentId);

    if (!student) {
      return ApiResponse.error(
        res,
        404,
        "Student not found"
      );
    }

    // --------------------------------------------
    // CREATE / UPDATE PERFORMANCE
    // ONE RECORD PER STUDENT PER MONTH
    // --------------------------------------------
    const performance =
      await Performance.findOneAndUpdate(
        {
          student: studentId,
          month,
        },
        {
          $set: {
            percentage: numericPercentage,
            remarks:
              typeof remarks === "string"
                ? remarks.trim()
                : "",
            createdBy: req.user._id,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      ).populate(
        "student",
        "name admissionNo className section rollNo photo"
      );

    return ApiResponse.success(
      res,
      200,
      "Performance saved successfully",
      {
        performance,
      }
    );
  } catch (error) {
    // --------------------------------------------
    // DUPLICATE RECORD PROTECTION
    // --------------------------------------------
    if (error.code === 11000) {
      return ApiResponse.error(
        res,
        409,
        "Performance already exists for this student and month"
      );
    }

    next(error);
  }
};

// ======================================================
// GET ALL PERFORMANCE
// GET /api/performance
//
// Optional:
// ?studentId=...
// ?year=2026
// ?month=2026-09
// ======================================================
const getPerformance = async (
  req,
  res,
  next
) => {
  try {
    const {
      studentId,
      year,
      month,
    } = req.query;

    const filter = {};

    // --------------------------------------------
    // FILTER BY STUDENT
    // --------------------------------------------
    if (studentId) {
      filter.student = studentId;
    }

    // --------------------------------------------
    // FILTER BY EXACT MONTH
    // --------------------------------------------
    if (month) {
      const monthPattern =
        /^\d{4}-(0[1-9]|1[0-2])$/;

      if (!monthPattern.test(month)) {
        return ApiResponse.error(
          res,
          400,
          "Month must be in YYYY-MM format"
        );
      }

      filter.month = month;
    }

    // --------------------------------------------
    // FILTER BY YEAR
    // --------------------------------------------
    if (year && !month) {
      const yearPattern = /^\d{4}$/;

      if (!yearPattern.test(String(year))) {
        return ApiResponse.error(
          res,
          400,
          "Year must be in YYYY format"
        );
      }

      filter.month = {
        $regex: `^${year}-`,
      };
    }

    // --------------------------------------------
    // FETCH PERFORMANCE
    // --------------------------------------------
    const performances =
      await Performance.find(filter)
        .populate(
          "student",
          "name admissionNo className section rollNo photo"
        )
        .populate(
          "createdBy",
          "name email role"
        )
        .sort({
          month: 1,
          createdAt: 1,
        });

    return ApiResponse.success(
      res,
      200,
      "Performance fetched successfully",
      {
        performances,
      }
    );
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET PERFORMANCE OF ONE STUDENT
// GET /api/performance/student/:studentId
// ======================================================
const getStudentPerformance = async (
  req,
  res,
  next
) => {
  try {
    const { studentId } = req.params;

    // --------------------------------------------
    // CHECK STUDENT
    // --------------------------------------------
    const student =
      await Student.findById(studentId).select(
        "name admissionNo className section rollNo photo"
      );

    if (!student) {
      return ApiResponse.error(
        res,
        404,
        "Student not found"
      );
    }

    // --------------------------------------------
    // FETCH STUDENT PERFORMANCE
    // --------------------------------------------
    const performances =
      await Performance.find({
        student: studentId,
      })
        .populate(
          "createdBy",
          "name email role"
        )
        .sort({
          month: 1,
        });

    return ApiResponse.success(
      res,
      200,
      "Student performance fetched successfully",
      {
        student,
        performances,
      }
    );
  } catch (error) {
    next(error);
  }
};

// ======================================================
// EXPORTS
// ======================================================
module.exports = {
  savePerformance,
  getPerformance,
  getStudentPerformance,
};
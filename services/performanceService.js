const Result = require('../models/Result');
const Student = require('../models/Student');
const Exam = require('../models/Exam');

const {
  calculateGrade,
  getGradeRemarks
} = require('../utils/gradeCalculator');

const notificationService = require('./notificationService');

/**
 * Calculates student summary for a specific exam
 * @param {string} studentId
 * @param {string} examId
 */
const getStudentExamPerformance = async (
  studentId,
  examId
) => {
  const [student, exam, results] = await Promise.all([
    Student.findById(studentId),
    Exam.findById(examId),
    Result.find({
      student: studentId,
      exam: examId
    })
  ]);

  if (!student) {
    throw new Error('Student not found');
  }

  if (!exam) {
    throw new Error('Exam not found');
  }

  if (results.length === 0) {
    return {
      student,
      exam,
      results: [],
      summary: {
        totalMaxMarks: 0,
        totalObtained: 0,
        percentage: 0,
        grade: 'N/A',
        remarks: 'No results recorded yet.'
      }
    };
  }

  const totalMaxMarks = results.reduce(
    (sum, result) => sum + result.totalMarks,
    0
  );

  const totalObtained = results.reduce(
    (sum, result) => sum + result.obtainedMarks,
    0
  );

  const percentage =
    totalMaxMarks > 0
      ? Math.round(
          ((totalObtained / totalMaxMarks) * 100) * 100
        ) / 100
      : 0;

  const grade = calculateGrade(percentage);
  const remarks = getGradeRemarks(grade);

  return {
    student,
    exam,
    results,
    summary: {
      totalMaxMarks,
      totalObtained,
      percentage,
      grade,
      remarks,
      subjectsCount: results.length
    }
  };
};

/**
 * Dispatch performance report to student's parent via Email
 */
const sendPerformanceReportToParent = async (
  studentId,
  examId
) => {
  const performanceData =
    await getStudentExamPerformance(
      studentId,
      examId
    );

  if (performanceData.results.length === 0) {
    throw new Error(
      'Cannot send report: No exam subject results recorded for this student.'
    );
  }

  const notificationResult =
    await notificationService.notifyPerformanceReport(
      performanceData
    );

  return {
    student: performanceData.student,
    exam: performanceData.exam,
    summary: performanceData.summary,
    delivery: notificationResult
  };
};

module.exports = {
  getStudentExamPerformance,
  sendPerformanceReportToParent
};


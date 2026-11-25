/**
 * Grade and Performance Calculator Helper
 */

/**
 * Calculate grade based on percentage
 * @param {number} percentage
 * @returns {string} Grade (A+, A, B, C, D, F)
 */
const calculateGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
};

/**
 * Calculate overall remarks based on grade
 * @param {string} grade
 * @returns {string} Remarks
 */
const getGradeRemarks = (grade) => {
  switch (grade) {
    case 'A+':
      return 'Outstanding performance! Keep it up.';
    case 'A':
      return 'Excellent work. Consistently good.';
    case 'B':
      return 'Very good effort. Can achieve higher with focused practice.';
    case 'C':
      return 'Satisfactory. Needs improvement in weaker subjects.';
    case 'D':
      return 'Needs significant improvement and daily study plan.';
    case 'F':
      return 'Fail. Immediate teacher-parent consultation required.';
    default:
      return 'Performance recorded.';
  }
};

module.exports = {
  calculateGrade,
  getGradeRemarks
};
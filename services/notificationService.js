const Notification = require('../models/Notification');
const emailService = require('./emailService');

class NotificationService {
  /**
   * Send Performance Email Report to Parent
   *
   * @param {Object} params
   * @param {Object} params.student
   * @param {Object} params.exam
   * @param {Array} params.results
   * @param {Object} params.summary
   */
  async notifyPerformanceReport({
    student,
    exam,
    results,
    summary
  }) {
    const outcomes = {
      email: null
    };

    // Send Parent Email Report
    if (student.parentEmail) {
      const emailResult =
        await emailService.sendParentPerformanceEmail({
          student,
          exam,
          results,
          summary
        });

      outcomes.email = emailResult;

      try {
        await Notification.create({
          recipientType: 'PARENT',
          student: student._id,
          parentName: student.parentName,
          parentEmail: student.parentEmail,
          channel: 'EMAIL',
          type: 'PERFORMANCE',
          message: `Performance Report for Exam: ${exam.name}`,
          status: emailResult.success
            ? 'SENT'
            : emailResult.skipped
              ? 'SKIPPED'
              : 'FAILED',
          providerMessageId:
            emailResult.messageId || '',
          error:
            emailResult.error || '',
          sentAt: emailResult.success
            ? new Date()
            : undefined
        });
      } catch (err) {
        console.error(
          '[NotificationService Email Log Error]',
          err.message
        );
      }
    } else {
      outcomes.email = {
        success: false,
        skipped: true,
        reason: 'Parent email address is missing'
      };

      try {
        await Notification.create({
          recipientType: 'PARENT',
          student: student._id,
          parentName: student.parentName,
          parentEmail: '',
          channel: 'EMAIL',
          type: 'PERFORMANCE',
          message: `Performance Report for Exam: ${exam.name}`,
          status: 'SKIPPED',
          error: 'Parent email address is missing',
          sentAt: new Date()
        });
      } catch (err) {
        console.error(
          '[NotificationService Email Log Error]',
          err.message
        );
      }
    }

    return outcomes;
  }
}

module.exports = new NotificationService();


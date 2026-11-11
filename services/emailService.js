/**
 * Nodemailer Email Service
 * Handles parent notifications and academic performance reports
 */

const nodemailer = require('nodemailer');
const config = require('../config/env');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    if (config.smtp.user && config.smtp.password && !config.smtp.password.includes('your_app_password')) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.password
        }
      });
    } else {
      this.transporter = null;
    }
  }

  isConfigured() {
    return this.transporter !== null;
  }

  /**
   * Send Academic Performance HTML Report Email to Parent
   * @param {Object} params
   * @param {Object} params.student - Student document
   * @param {Object} params.exam - Exam document
   * @param {Array} params.results - Array of subject result documents
   * @param {Object} params.summary - Aggregated summary (totalMarks, obtainedMarks, percentage, grade, remarks)
   */
  async sendParentPerformanceEmail({ student, exam, results, summary }) {
    if (!student.parentEmail) {
      return {
        success: false,
        skipped: true,
        error: 'Student record has no parent email address provided.'
      };
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; color: #333; }
        .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { background: #1e3a8a; color: #ffffff; padding: 25px; text-align: center; }
        .header h1 { margin: 0 0 5px; font-size: 24px; }
        .header p { margin: 0; font-size: 14px; opacity: 0.85; }
        .content { padding: 30px; }
        .student-info { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; margin-bottom: 25px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px; }
        .info-item strong { color: #475569; }
        .table-wrap { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        .table-wrap th { background-color: #f1f5f9; color: #334155; text-align: left; padding: 10px 12px; font-size: 13px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
        .table-wrap td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        .summary-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 4px; margin-bottom: 25px; }
        .summary-box h3 { margin: 0 0 10px; color: #1e40af; font-size: 16px; }
        .summary-grid { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; color: #fff; background: #10b981; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Student Academic Performance Report</h1>
          <p>Official School Progress Report</p>
        </div>
        <div class="content">
          <p>Dear <strong>${student.parentName || 'Parent / Guardian'}</strong>,</p>
          <p>We are pleased to share the academic performance report of your child for <strong>${exam.name} (${exam.academicYear})</strong>.</p>
          
          <div class="student-info">
            <div class="info-grid">
              <div class="info-item"><strong>Student Name:</strong> ${student.name}</div>
              <div class="info-item"><strong>Admission No:</strong> ${student.admissionNo}</div>
              <div class="info-item"><strong>Class & Section:</strong> ${student.className}-${student.section}</div>
              <div class="info-item"><strong>Roll No:</strong> ${student.rollNo || 'N/A'}</div>
            </div>
          </div>

          <table class="table-wrap">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Total Marks</th>
                <th>Obtained</th>
                <th>Percentage</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              ${results
                .map(
                  (r) => `
                <tr>
                  <td><strong>${r.subject}</strong></td>
                  <td>${r.totalMarks}</td>
                  <td>${r.obtainedMarks}</td>
                  <td>${r.percentage}%</td>
                  <td>${r.grade}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>

          <div class="summary-box">
            <h3>Overall Summary</h3>
            <div class="summary-grid">
              <div>Total: ${summary.totalObtained} / ${summary.totalMaxMarks}</div>
              <div>Percentage: ${summary.percentage}%</div>
              <div>Final Grade: <span class="badge">${summary.grade}</span></div>
            </div>
            ${summary.remarks ? `<p style="margin-top: 10px; font-size: 13px; color: #334155;"><strong>Teacher's Remarks:</strong> ${summary.remarks}</p>` : ''}
          </div>

          <p style="font-size: 14px; color: #475569;">
            Please do not hesitate to reach out to the school administration or schedule an appointment during parent-teacher meetings if you wish to discuss your child's progress further.
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} School Management System. All rights reserved.</p>
          <p>This is an automated notification, please contact the school administration office for queries.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const mailOptions = {
      from: config.smtp.from,
      to: student.parentEmail,
      subject: `Academic Performance Report: ${student.name} - ${exam.name}`,
      html: htmlContent
    };

    if (!this.isConfigured()) {
      console.warn(`[EmailService] SMTP not configured. Email to ${student.parentEmail} simulated.`);
      return {
        success: true,
        messageId: 'SIMULATED_EMAIL_' + Date.now(),
        isMocked: true,
        recipient: student.parentEmail
      };
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info.messageId,
        recipient: student.parentEmail
      };
    } catch (error) {
      console.error(`[EmailService Error] Failed sending email to ${student.parentEmail}:`, error.message);
      return {
        success: false,
        error: error.message,
        recipient: student.parentEmail
      };
    }
  }
}

module.exports = new EmailService();
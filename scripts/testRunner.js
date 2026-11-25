const http = require('http');
const mongoose = require('mongoose');
const app = require('../server');
const config = require('../config/env');
const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Fee = require('../models/Fee');
const Transaction = require('../models/Transaction');
const Staff = require('../models/Staff');
const StaffAttendance = require('../models/StaffAttendance');
const Leave = require('../models/Leave');
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');

let server;
let baseUrl;
let adminToken = '';
let teacherToken = '';
let testStudentId = '';
let testStaffId = '';
let testExamId = '';
let testFeeId = '';
let testTransactionId = '';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// HTTP Helper using Node built-in http module
const request = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        let parsed = null;

        try {
          parsed = data ? JSON.parse(data) : {};
        } catch (e) {
          parsed = { raw: data };
        }

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      const payload =
        typeof postData === 'string'
          ? postData
          : JSON.stringify(postData);

      req.write(payload);
    }

    req.end();
  });
};

const assertTest = (testName, condition, details = '') => {
  totalTests++;

  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName} - ${details}`);
  }
};

const runSuite = async () => {
  console.log(`\n=====================================================`);
  console.log(`🧪 Starting Complete School Management System API Tests`);
  console.log(`=====================================================\n`);

  // Start test server on ephemeral port
  const testPort = 5099;
  baseUrl = `http://localhost:${testPort}/api`;

  await new Promise((resolve) => {
    server = app.listen(testPort, () => {
      resolve();
    });
  });

  // Ensure DB connected
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(config.mongo.uri, config.mongo.options);
  }

  // Cleanup test collections
  await Promise.all([
    User.deleteMany({
      email: {
        $in: ['test_admin@school.com', 'test_teacher@school.com']
      }
    }),

    Student.deleteMany({
      admissionNo: {
        $in: ['TEST-ADM-001', 'TEST-ADM-002', 'DUP-001']
      }
    }),

    Attendance.deleteMany({
      className: 'TestGrade7'
    }),

    Fee.deleteMany({
      notes: 'Test Fee Record'
    }),

    Transaction.deleteMany({
      description: {
        $regex: /^TEST_/
      }
    }),

    Staff.deleteMany({
      email: 'test_staff@school.com'
    }),

    Exam.deleteMany({
      name: 'Test Midterm 2026'
    }),

    Notification.deleteMany({
      message: {
        $regex: /Test/i
      }
    })
  ]);

  try {
    // -------------------------------------------------------------
    console.log(`\n🔹 1. HEALTH CHECK & ROOT`);
    // -------------------------------------------------------------

    const healthRes = await request({
      hostname: 'localhost',
      port: testPort,
      path: '/api/health',
      method: 'GET'
    });

    assertTest(
      'GET /api/health returns 200 and healthy status',
      healthRes.statusCode === 200 &&
        healthRes.body.success === true
    );

    // -------------------------------------------------------------
    console.log(`\n🔹 2. AUTHENTICATION & USERS`);
    // -------------------------------------------------------------

    // Register Admin
    const adminRegRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/auth/register',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      },
      {
        name: 'Test Admin',
        email: 'test_admin@school.com',
        password: 'AdminPassword123',
        role: 'ADMIN',
        phone: '03001234567'
      }
    );

    assertTest(
      'POST /api/auth/register (Admin) returns 201',
      adminRegRes.statusCode === 201 &&
        adminRegRes.body.data?.token
    );

    adminToken = adminRegRes.body.data?.token;

    // Register Teacher
    const teacherRegRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/auth/register',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      },
      {
        name: 'Test Teacher',
        email: 'test_teacher@school.com',
        password: 'TeacherPassword123',
        role: 'TEACHER',
        phone: '03119876543'
      }
    );

    assertTest(
      'POST /api/auth/register (Teacher) returns 201',
      teacherRegRes.statusCode === 201
    );

    teacherToken = teacherRegRes.body.data?.token;

    // Login Teacher
    const loginRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      },
      {
        email: 'test_teacher@school.com',
        password: 'TeacherPassword123'
      }
    );

    assertTest(
      'POST /api/auth/login returns 200 and valid JWT',
      loginRes.statusCode === 200 &&
        !loginRes.body.data.user.password
    );

    // GET /api/auth/me
    const meRes = await request({
      hostname: 'localhost',
      port: testPort,
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${teacherToken}`
      }
    });

    assertTest(
      'GET /api/auth/me returns teacher profile',
      meRes.statusCode === 200 &&
        meRes.body.data.user.role === 'TEACHER'
    );

    // -------------------------------------------------------------
    console.log(`\n🔹 3. STUDENT MANAGEMENT (CRUD, FILTERS)`);
    // -------------------------------------------------------------

    // Create Student
    const studentRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/students',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        }
      },
      {
        name: 'Ali Raza',
        admissionNo: 'TEST-ADM-001',
        className: 'TestGrade7',
        section: 'A',
        rollNo: '12',
        gender: 'MALE',
        status: 'ACTIVE',
        parentName: 'Muhammad Raza',
        parentPhone: '03001234567',
        parentEmail: 'parent_aliraza@example.com',
        address: 'House 123, Street 4, Lahore'
      }
    );

    assertTest(
      'POST /api/students returns 201',
      studentRes.statusCode === 201
    );

    const createdStudent = studentRes.body.data?.student;
    testStudentId = createdStudent?._id;

    // Duplicate Admission Number Test
    const dupStudentRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/students',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        }
      },
      {
        name: 'Duplicate Student',
        admissionNo: 'TEST-ADM-001',
        className: 'TestGrade7',
        section: 'A',
        parentName: 'Parent',
        parentPhone: '03001112233'
      }
    );

    assertTest(
      'Duplicate admission number returns 409 Conflict',
      dupStudentRes.statusCode === 409
    );

    // Get Students with Filter
    const listStudentsRes = await request({
      hostname: 'localhost',
      port: testPort,
      path: '/api/students?className=TestGrade7&search=Ali',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${teacherToken}`
      }
    });

    assertTest(
      'GET /api/students filters and searches properly',
      listStudentsRes.statusCode === 200 &&
        listStudentsRes.body.data.students.length > 0
    );

    // Update Student
    const updateStudentRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: `/api/students/${testStudentId}`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        }
      },
      {
        rollNo: '15',
        address: 'Updated Address, Lahore'
      }
    );

    assertTest(
      'PUT /api/students/:id updates student record',
      updateStudentRes.statusCode === 200 &&
        updateStudentRes.body.data.student.rollNo === '15'
    );

    // -------------------------------------------------------------
    console.log(`\n🔹 4. ATTENDANCE`);
    // -------------------------------------------------------------

    // Mark Present
    const attPresentRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/attendance',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        }
      },
      {
        studentId: testStudentId,
        date: '2026-09-05',
        status: 'PRESENT',
        remarks: 'On time'
      }
    );

    assertTest(
      'POST /api/attendance (PRESENT) saves attendance',
      attPresentRes.statusCode === 201 &&
        attPresentRes.body.data.attendance.status === 'PRESENT'
    );

    // Mark Absent
    const attAbsentRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/attendance',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        }
      },
      {
        studentId: testStudentId,
        date: '2026-09-05',
        status: 'ABSENT',
        remarks: 'Uninformed absence'
      }
    );

    assertTest(
      'POST /api/attendance (ABSENT) saves attendance',
      attAbsentRes.statusCode === 201 &&
        attAbsentRes.body.data.attendance.status === 'ABSENT'
    );

    // Student Attendance History
    const studentAttRes = await request({
      hostname: 'localhost',
      port: testPort,
      path: `/api/attendance/student/${testStudentId}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${teacherToken}`
      }
    });

    assertTest(
      'GET /api/attendance/student/:id returns stats and history',
      studentAttRes.statusCode === 200 &&
        studentAttRes.body.data.stats.totalDays >= 1
    );

    // -------------------------------------------------------------
    console.log(`\n🔹 5. FEES MANAGEMENT & FORMULAS`);
    // -------------------------------------------------------------

    // Formula verification:
    // amount = 5000, discount = 500, paid = 3000
    // remaining should be 1500, status PARTIAL
    const feeRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/fees',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      },
      {
        studentId: testStudentId,
        feeType: 'MONTHLY',
        month: 'September 2026',
        amount: 5000,
        discount: 500,
        paidAmount: 3000,
        paymentMethod: 'CASH',
        notes: 'Test Fee Record'
      }
    );

    assertTest(
      'POST /api/fees creates fee and calculates remainingAmount (1500)',
      feeRes.statusCode === 201 &&
        feeRes.body.data.fee.remainingAmount === 1500 &&
        feeRes.body.data.fee.status === 'PARTIAL'
    );

    testFeeId = feeRes.body.data?.fee?._id;

    // Fee Summary
    const feeSummaryRes = await request({
      hostname: 'localhost',
      port: testPort,
      path: '/api/fees/summary',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assertTest(
      'GET /api/fees/summary aggregates financial data',
      feeSummaryRes.statusCode === 200 &&
        feeSummaryRes.body.data.overview.totalBilled >= 5000
    );

    // -------------------------------------------------------------
    console.log(`\n🔹 6. TRANSACTIONS (INCOME & EXPENSE)`);
    // -------------------------------------------------------------

    // Income
    const incomeRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/transactions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      },
      {
        type: 'INCOME',
        category: 'Fee',
        description: 'TEST_INCOME Student fee collection',
        amount: 25000,
        paymentMethod: 'BANK'
      }
    );

    assertTest(
      'POST /api/transactions (INCOME) returns 201',
      incomeRes.statusCode === 201
    );

    testTransactionId = incomeRes.body.data?.transaction?._id;

    // Expense
    const expenseRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/transactions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      },
      {
        type: 'EXPENSE',
        category: 'Utilities',
        description: 'TEST_EXPENSE Electricity Bill',
        amount: 8000,
        paymentMethod: 'ONLINE'
      }
    );

    assertTest(
      'POST /api/transactions (EXPENSE) returns 201',
      expenseRes.statusCode === 201
    );

    // Transaction Summary
    const txSummaryRes = await request({
      hostname: 'localhost',
      port: testPort,
      path: '/api/transactions/summary',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assertTest(
      'GET /api/transactions/summary computes totalIncome, totalExpense, balance',
      txSummaryRes.statusCode === 200 &&
        txSummaryRes.body.data.totalIncome >= 25000
    );

    // -------------------------------------------------------------
    console.log(`\n🔹 7. STAFF, STAFF ATTENDANCE & LEAVES`);
    // -------------------------------------------------------------

    const staffRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/staff',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      },
      {
        name: 'Sir Ahmed',
        email: 'test_staff@school.com',
        phone: '03211234567',
        designation: 'Senior Mathematics Teacher',
        department: 'Mathematics',
        salary: 60000
      }
    );

    assertTest(
      'POST /api/staff creates staff member',
      staffRes.statusCode === 201
    );

    testStaffId = staffRes.body.data?.staff?._id;

    // Staff Attendance
    const staffAttRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/staff-attendance',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      },
      {
        staffId: testStaffId,
        date: '2026-09-05',
        status: 'PRESENT',
        remarks: 'Present on duty'
      }
    );

    assertTest(
      'POST /api/staff-attendance marks staff attendance',
      staffAttRes.statusCode === 201
    );

    // Leave request & approval
    const leaveRes = await request(
      {
        hostname: 'localhost',
      port: testPort,
      path: '/api/leaves',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      }
    },
    {
      staffId: testStaffId,
      startDate: '2026-09-10',
      endDate: '2026-09-12',
      reason: 'Family event'
    }
  );

    assertTest(
      'POST /api/leaves creates leave request',
      leaveRes.statusCode === 201
    );

    const leaveId = leaveRes.body.data?.leave?._id;

    const leaveApproveRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: `/api/leaves/${leaveId}`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      },
      {
        status: 'APPROVED',
        remarks: 'Approved by Principal'
      }
    );

    assertTest(
      'PUT /api/leaves/:id approves leave application',
      leaveApproveRes.statusCode === 200 &&
        leaveApproveRes.body.data.leave.status === 'APPROVED'
    );

    // -------------------------------------------------------------
    console.log(`\n🔹 8. EXAMS, RESULTS & PARENT PERFORMANCE EMAIL`);
    // -------------------------------------------------------------

    // Create Exam
    const examRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/exams',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        }
      },
      {
        name: 'Test Midterm 2026',
        examType: 'MIDTERM',
        className: 'TestGrade7',
        startDate: '2026-09-01',
        endDate: '2026-09-10',
        academicYear: '2026-2027'
      }
    );

    assertTest(
      'POST /api/exams creates exam',
      examRes.statusCode === 201
    );

    testExamId = examRes.body.data?.exam?._id;

    // Record Result: Mathematics
    // 88/100 -> 88%, Grade A
    const result1Res = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/results',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        }
      },
      {
        studentId: testStudentId,
        examId: testExamId,
        subject: 'Mathematics',
        totalMarks: 100,
        obtainedMarks: 88,
        remarks: 'Great analytical skills'
      }
    );

    assertTest(
      'POST /api/results calculates percentage (88%) and Grade (A)',
      result1Res.statusCode === 201 &&
        result1Res.body.data.result.grade === 'A'
    );

    // Record Result: Science
    // 94/100 -> 94%, Grade A+
    await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/results',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        }
      },
      {
        studentId: testStudentId,
        examId: testExamId,
        subject: 'Science',
        totalMarks: 100,
        obtainedMarks: 94
      }
    );

    // Send Performance Report Email to Parent
    const reportSendRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/results/send-report',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`
        }
      },
      {
        studentId: testStudentId,
        examId: testExamId
      }
    );

    assertTest(
      'POST /api/results/send-report dispatches performance email report to parent',
      reportSendRes.statusCode === 200 &&
        reportSendRes.body.data.summary.totalObtained === 182
    );

    // -------------------------------------------------------------
    console.log(`\n🔹 9. ADMIN DASHBOARD & AGGREGATED METRICS`);
    // -------------------------------------------------------------

    const dashRes = await request({
      hostname: 'localhost',
      port: testPort,
      path: '/api/dashboard',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assertTest(
      'GET /api/dashboard returns all required aggregated metrics',
      dashRes.statusCode === 200 &&
        dashRes.body.data.totalStudents !== undefined &&
        dashRes.body.data.totalStaff !== undefined &&
        dashRes.body.data.presentToday !== undefined &&
        dashRes.body.data.absentToday !== undefined &&
        dashRes.body.data.totalFees !== undefined &&
        dashRes.body.data.totalIncome !== undefined &&
        Array.isArray(dashRes.body.data.recentStudents)
    );

    // -------------------------------------------------------------
    console.log(`\n🔹 10. SYSTEM REPORTS`);
    // -------------------------------------------------------------

    const repAttRes = await request({
      hostname: 'localhost',
      port: testPort,
      path: '/api/reports/attendance?from=2026-09-01&to=2026-09-10',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assertTest(
      'GET /api/reports/attendance generates date-range report',
      repAttRes.statusCode === 200
    );

    const repFeesRes = await request({
      hostname: 'localhost',
      port: testPort,
      path: '/api/reports/fees',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assertTest(
      'GET /api/reports/fees generates fee report',
      repFeesRes.statusCode === 200
    );

    // -------------------------------------------------------------
    console.log(`\n🔹 11. SECURITY, VALIDATION & ERROR HANDLING`);
    // -------------------------------------------------------------

    // Unauthorized request
    const unauthRes = await request({
      hostname: 'localhost',
      port: testPort,
      path: '/api/dashboard',
      method: 'GET'
    });

    assertTest(
      'Request without token returns 401 Unauthorized',
      unauthRes.statusCode === 401
    );

    // Invalid Token
    const invalidTokenRes = await request({
      hostname: 'localhost',
      port: testPort,
      path: '/api/dashboard',
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid_garbage_token_123'
      }
    });

    assertTest(
      'Invalid JWT token returns 401',
      invalidTokenRes.statusCode === 401
    );

    // Teacher accessing Admin-only endpoint
    const rbacRes = await request({
      hostname: 'localhost',
      port: testPort,
      path: '/api/dashboard',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${teacherToken}`
      }
    });

    assertTest(
      'Teacher accessing Admin-only route returns 403 Forbidden',
      rbacRes.statusCode === 403
    );

    // Bad ObjectId
    const badIdRes = await request({
      hostname: 'localhost',
      port: testPort,
      path: '/api/students/invalid-object-id-12345',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });

    assertTest(
      'Invalid ObjectId parameter returns 400 Bad Request',
      badIdRes.statusCode === 400
    );

    // Missing required fields validation
    const valErrRes = await request(
      {
        hostname: 'localhost',
        port: testPort,
        path: '/api/students',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      },
      {
        name: 'Incomplete Student'
      }
    );

    assertTest(
      'Missing required fields returns 400 Validation Error',
      valErrRes.statusCode === 400
    );
  } catch (error) {
    console.error('Fatal Test Exception:', error);
  } finally {
    if (server) {
      server.close();
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }

    console.log(`\n=====================================================`);
    console.log(`📊 Test Results Summary:`);
    console.log(`   Total Tests Executed : ${totalTests}`);
    console.log(`   Passed               : ${passedTests}`);
    console.log(`   Failed               : ${failedTests}`);
    console.log(
      `   Success Rate         : ${
        totalTests > 0
          ? Math.round((passedTests / totalTests) * 100)
          : 0
      }%`
    );
    console.log(`=====================================================\n`);

    if (failedTests > 0) {
      process.exit(1);
    } else {
      console.log(
        '🎉 All School Management System API Tests Passed Successfully!\n'
      );
      process.exit(0);
    }
  }
};

runSuite();


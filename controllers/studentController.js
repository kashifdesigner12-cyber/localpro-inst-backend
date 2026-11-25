const Student = require('../models/Student');
const ApiResponse = require('../utils/apiResponse');
const { isValidObjectId } = require('../utils/validators');
const { logAction } = require('../services/auditService');

/**
 * -----------------------------------------------------
 * Helper
 * -----------------------------------------------------
 */

const escapeRegex = (value) => {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
};

const formatGender = (value) => {
  if (!value) return 'Male';
  const clean = String(value).trim().toLowerCase();
  if (clean === 'female' || clean === 'f' || clean.startsWith('female')) return 'Female';
  if (clean === 'other' || clean === 'o' || clean.startsWith('other')) return 'Other';
  if (clean === 'male' || clean === 'm' || clean.startsWith('male')) return 'Male';
  return 'Male';
};

const generateStudentCredentials = (name, admissionNo, providedEmail, providedPassword) => {
  const cleanAdm = String(admissionNo || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const cleanName = String(name || 'student')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);

  const email = providedEmail && String(providedEmail).trim()
    ? String(providedEmail).trim().toLowerCase()
    : `${cleanName || 'student'}.${cleanAdm || Date.now().toString().slice(-6)}@student.localpro1.net`;

  const password = providedPassword && String(providedPassword).trim()
    ? String(providedPassword).trim()
    : `${cleanName || 'std'}@${cleanAdm.slice(-4) || Math.floor(1000 + Math.random() * 9000)}`;

  return { email, password };
};

/**
 * -----------------------------------------------------
 * Create Student
 * -----------------------------------------------------
 *
 * POST /api/students
 * Access: Admin, Teacher
 */
const createStudent = async (req, res, next) => {
  try {
    const {
      name,
      admissionNo,
      email,
      password,
      className,
      courseDuration,
      section,
      rollNo,
      gender,
      status,
      cnic,
      parentName,
      parentPhone,
      studentPhone,
      parentEmail,
      dateOfBirth,
      address,
      admissionDate
    } = req.body || {};

    // Auto-generate admission number if not provided
    const normalizedAdmissionNo = admissionNo && String(admissionNo).trim()
      ? String(admissionNo).trim().toUpperCase()
      : `ADM-${Date.now().toString().slice(-6)}`;

    // Duplicate check only if admissionNo was actually sent
    const existingStudent = await Student.findOne({
      admissionNo: normalizedAdmissionNo
    });

    if (existingStudent) {
      return ApiResponse.error(
        res,
        409,
        `Student with admission number '${normalizedAdmissionNo}' already exists`
      );
    }

    // Auto-generate login credentials for Student Portal & WhatsApp Chat
    const credentials = generateStudentCredentials(
      name,
      normalizedAdmissionNo,
      email,
      password
    );

    const existingEmail = await Student.findOne({ email: credentials.email });
    if (existingEmail) {
      credentials.email = `${normalizedAdmissionNo.toLowerCase()}@student.localpro1.net`;
    }

    // Photo extraction (Supports req.files.photo, req.file, or req.body.photo)
    let photoPath = '';
    if (req.files?.photo?.[0]) {
      photoPath = `/uploads/students/${req.files.photo[0].filename}`;
    } else if (req.file) {
      photoPath = `/uploads/students/${req.file.filename}`;
    } else if (req.body?.photo) {
      photoPath = String(req.body.photo).trim();
    }

    // ID Card extraction (Supports req.files.idCard, req.files.idCardPhoto, or base64 body)
    let idCardPath = '';
    if (req.files?.idCard?.[0]) {
      idCardPath = `/uploads/students/${req.files.idCard[0].filename}`;
    } else if (req.files?.idCardPhoto?.[0]) {
      idCardPath = `/uploads/students/${req.files.idCardPhoto[0].filename}`;
    } else if (req.body?.idCardPhoto) {
      idCardPath = String(req.body.idCardPhoto).trim();
    }

    const cleanStudentName = name && String(name).trim() ? String(name).trim() : 'Student';

    const student = await Student.create({
      name: cleanStudentName,

      chatDisplayName: cleanStudentName,

      admissionNo: normalizedAdmissionNo,

      email: credentials.email,

      password: credentials.password,

      plainPassword: credentials.password,

      role: 'student',

      className: className && String(className).trim() ? String(className).trim() : 'General',

      courseDuration: courseDuration
        ? String(courseDuration).trim()
        : '3 Months',

      section: section && String(section).trim()
        ? String(section).trim().toUpperCase()
        : 'MORNING',

      rollNo: rollNo
        ? String(rollNo).trim()
        : '',

      gender: formatGender(gender),

      status: status && String(status).trim()
        ? (String(status).trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active')
        : 'Active',

      cnic: cnic
        ? String(cnic).trim()
        : '',

      photo: photoPath,

      idCardPhoto: idCardPath,

      parentName: parentName && String(parentName).trim() ? String(parentName).trim() : '',

      parentPhone: parentPhone
        ? String(parentPhone).trim()
        : '',

      studentPhone: studentPhone
        ? String(studentPhone).trim()
        : '',

      parentEmail: parentEmail
        ? String(parentEmail).trim().toLowerCase()
        : '',

      dateOfBirth: dateOfBirth
        ? new Date(dateOfBirth)
        : undefined,

      address: address
        ? String(address).trim()
        : '',

      admissionDate: admissionDate
        ? new Date(admissionDate)
        : Date.now(),

      createdBy: req.user?._id || undefined
    });

    if (req.user?._id) {
      await logAction({
        user: req.user._id,
        action: 'STUDENT_CREATED',
        entity: 'Student',
        entityId: student._id.toString(),
        details: {
          admissionNo: student.admissionNo,
          name: student.name,
          className: student.className,
          email: student.email
        },
        ip: req.ip
      });
    }

    const credsPayload = {
      email: student.email,
      admissionNo: student.admissionNo,
      password: credentials.password
    };

    return ApiResponse.success(
      res,
      201,
      'Student created successfully with login credentials',
      {
        student,
        credentials: credsPayload,
        loginCredentials: credsPayload
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * -----------------------------------------------------
 * Generate / Reset Student Portal & Chat Credentials
 * -----------------------------------------------------
 *
 * POST /api/students/:id/generate-credentials
 * Access: Admin, Teacher
 */
const generateStudentPortalCredentials = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid student ID format'
      );
    }

    const student = await Student.findById(id);

    if (!student) {
      return ApiResponse.error(
        res,
        404,
        'Student not found'
      );
    }

    const creds = generateStudentCredentials(
      student.name,
      student.admissionNo,
      student.email || req.body?.email,
      req.body?.password
    );

    const emailConflict = await Student.findOne({
      email: creds.email,
      _id: { $ne: student._id }
    });

    if (emailConflict) {
      creds.email = `${String(student.admissionNo || 'std').toLowerCase()}.${Date.now().toString().slice(-4)}@student.localpro1.net`;
    }

    student.email = creds.email;
    student.password = creds.password;
    student.plainPassword = creds.password;
    student.role = 'student';
    if (!student.chatDisplayName) {
      student.chatDisplayName = student.name;
    }

    await student.save();

    if (req.user?._id) {
      await logAction({
        user: req.user._id,
        action: 'STUDENT_CREDENTIALS_GENERATED',
        entity: 'Student',
        entityId: student._id.toString(),
        details: {
          admissionNo: student.admissionNo,
          email: student.email
        },
        ip: req.ip
      });
    }

    const credsPayload = {
      email: student.email,
      admissionNo: student.admissionNo,
      password: creds.password
    };

    return ApiResponse.success(
      res,
      200,
      'Student portal credentials generated successfully',
      {
        student,
        credentials: credsPayload,
        loginCredentials: credsPayload
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * -----------------------------------------------------
 * Get Students
 * -----------------------------------------------------
 *
 * GET /api/students
 * Access: Admin, Teacher
 */
const getStudents = async (req, res, next) => {
  try {
    const page = Math.max(
      parseInt(req.query.page, 10) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        parseInt(req.query.limit, 10) || 20,
        1
      ),
      100
    );

    const skip = (page - 1) * limit;

    const {
      search,
      className,
      section,
      status,
      gender,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const query = {};

    if (className && String(className).trim()) {
      query.className = new RegExp(
        escapeRegex(String(className).trim()),
        'i'
      );
    }

    if (section && String(section).trim()) {
      query.section = new RegExp(
        `^${escapeRegex(String(section).trim())}$`,
        'i'
      );
    }

    if (status && String(status).trim()) {
      query.status = new RegExp(
        `^${escapeRegex(String(status).trim())}$`,
        'i'
      );
    }

    if (gender && String(gender).trim()) {
      query.gender = new RegExp(
        `^${escapeRegex(String(gender).trim())}$`,
        'i'
      );
    }

    if (search && String(search).trim()) {
      const searchRegex = new RegExp(
        escapeRegex(String(search).trim()),
        'i'
      );

      query.$or = [
        { name: searchRegex },
        { admissionNo: searchRegex },
        { parentName: searchRegex },
        { parentPhone: searchRegex },
        { cnic: searchRegex },
        { email: searchRegex }
      ];
    }

    const allowedSortFields = [
      'name',
      'admissionNo',
      'className',
      'courseDuration',
      'section',
      'rollNo',
      'gender',
      'status',
      'createdAt',
      'updatedAt'
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const sortOrder = order === 'asc'
      ? 1
      : -1;

    const sort = {
      [safeSortBy]: sortOrder
    };

    const [students, total] = await Promise.all([
      Student.find(query)
        .populate(
          'createdBy',
          'name email role'
        )
        .sort(sort)
        .skip(skip)
        .limit(limit),

      Student.countDocuments(query)
    ]);

    const totalPages = Math.ceil(
      total / limit
    );

    return ApiResponse.success(
      res,
      200,
      'Students retrieved successfully',
      {
        students
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
 * -----------------------------------------------------
 * Get Student By ID
 * -----------------------------------------------------
 *
 * GET /api/students/:id
 * Access: Admin, Teacher
 */
const getStudentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid student ID format'
      );
    }

    const student = await Student.findById(id)
      .populate(
        'createdBy',
        'name email role'
      );

    if (!student) {
      return ApiResponse.error(
        res,
        404,
        'Student not found'
      );
    }

    return ApiResponse.success(
      res,
      200,
      'Student details retrieved',
      {
        student
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * -----------------------------------------------------
 * Update Student
 * -----------------------------------------------------
 *
 * PUT /api/students/:id
 * Access: Admin, Teacher
 */
const updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid student ID format'
      );
    }

    const student = await Student.findById(id);

    if (!student) {
      return ApiResponse.error(
        res,
        404,
        'Student not found'
      );
    }

    if (
      req.body?.admissionNo &&
      String(req.body.admissionNo)
        .trim()
        .toUpperCase() !== student.admissionNo
    ) {
      const normalizedAdmissionNo = String(
        req.body.admissionNo
      )
        .trim()
        .toUpperCase();

      const duplicate = await Student.findOne({
        admissionNo: normalizedAdmissionNo,
        _id: {
          $ne: id
        }
      });

      if (duplicate) {
        return ApiResponse.error(
          res,
          409,
          `Admission number '${normalizedAdmissionNo}' is already taken`
        );
      }
    }

    const allowedFields = [
      'name',
      'chatDisplayName',
      'admissionNo',
      'email',
      'className',
      'courseDuration',
      'section',
      'rollNo',
      'gender',
      'status',
      'cnic',
      'parentName',
      'parentPhone',
      'studentPhone',
      'parentEmail',
      'dateOfBirth',
      'address',
      'admissionDate'
    ];

    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body?.[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (req.files?.photo?.[0]) {
      updates.photo = `/uploads/students/${req.files.photo[0].filename}`;
    } else if (req.file) {
      updates.photo = `/uploads/students/${req.file.filename}`;
    }

    if (req.files?.idCard?.[0]) {
      updates.idCardPhoto = `/uploads/students/${req.files.idCard[0].filename}`;
    } else if (req.body?.idCardPhoto) {
      updates.idCardPhoto = String(req.body.idCardPhoto).trim();
    }

    if (updates.name !== undefined) {
      updates.name = String(updates.name).trim();
    }

    if (updates.chatDisplayName !== undefined) {
      updates.chatDisplayName = String(updates.chatDisplayName).trim();
    }

    if (updates.email !== undefined) {
      updates.email = String(updates.email).trim().toLowerCase();
    }

    if (updates.admissionNo !== undefined) {
      updates.admissionNo = String(updates.admissionNo)
        .trim()
        .toUpperCase();
    }

    if (updates.className !== undefined) {
      updates.className = String(updates.className).trim();
    }

    if (updates.courseDuration !== undefined) {
      updates.courseDuration = String(updates.courseDuration).trim();
    }

    if (updates.section !== undefined) {
      updates.section = String(updates.section)
        .trim()
        .toUpperCase();
    }

    if (updates.rollNo !== undefined) {
      updates.rollNo = String(updates.rollNo).trim();
    }

    if (updates.gender !== undefined || req.body?.Gender !== undefined) {
      updates.gender = formatGender(updates.gender !== undefined ? updates.gender : req.body.Gender);
    }

    if (updates.status !== undefined) {
      updates.status = String(updates.status).trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
    }

    if (updates.cnic !== undefined) {
      updates.cnic = String(updates.cnic).trim();
    }

    if (updates.parentName !== undefined) {
      updates.parentName = String(updates.parentName).trim();
    }

    if (updates.parentPhone !== undefined) {
      updates.parentPhone = String(updates.parentPhone).trim();
    }

    if (updates.studentPhone !== undefined) {
      updates.studentPhone = String(updates.studentPhone).trim();
    }

    if (updates.parentEmail !== undefined) {
      updates.parentEmail = String(updates.parentEmail)
        .trim()
        .toLowerCase();
    }

    if (updates.address !== undefined) {
      updates.address = String(updates.address).trim();
    }

    if (updates.dateOfBirth !== undefined) {
      updates.dateOfBirth = new Date(updates.dateOfBirth);
    }

    if (updates.admissionDate !== undefined) {
      updates.admissionDate = new Date(updates.admissionDate);
    }

    // Handle password reset if provided by Admin/Teacher
    if (req.body?.password && String(req.body.password).trim()) {
      student.password = String(req.body.password).trim();
      student.plainPassword = String(req.body.password).trim();
      await student.save();
    }

    if (Object.keys(updates).length === 0 && !req.body?.password) {
      return ApiResponse.error(
        res,
        400,
        'Please provide at least one field to update'
      );
    }

    const updatedStudent =
      await Student.findByIdAndUpdate(
        id,
        updates,
        {
          new: true,
          runValidators: true
        }
      ).populate(
        'createdBy',
        'name email role'
      );

    if (req.user?._id) {
      await logAction({
        user: req.user._id,
        action: 'STUDENT_UPDATED',
        entity: 'Student',
        entityId: id,
        details: updates,
        ip: req.ip
      });
    }

    return ApiResponse.success(
      res,
      200,
      'Student updated successfully',
      {
        student: updatedStudent
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * -----------------------------------------------------
 * Delete Student
 * -----------------------------------------------------
 *
 * DELETE /api/students/:id
 * Access: Admin
 */
const deleteStudent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid student ID format'
      );
    }

    const student = await Student.findById(id);

    if (!student) {
      return ApiResponse.error(
        res,
        404,
        'Student not found'
      );
    }

    await Student.findByIdAndDelete(id);

    if (req.user?._id) {
      await logAction({
        user: req.user._id,
        action: 'STUDENT_DELETED',
        entity: 'Student',
        entityId: id,
        details: {
          admissionNo: student.admissionNo,
          name: student.name
        },
        ip: req.ip
      });
    }

    return ApiResponse.success(
      res,
      200,
      'Student deleted successfully'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * -----------------------------------------------------
 * Add Student Document
 * -----------------------------------------------------
 *
 * POST /api/students/:id/documents
 * Access: Admin, Teacher
 */
const addStudentDocument = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid student ID format'
      );
    }

    let documentType = '';

    if (
      req.body &&
      Object.prototype.hasOwnProperty.call(
        req.body,
        'documentType'
      )
    ) {
      documentType = req.body.documentType;
    }

    if (Array.isArray(documentType)) {
      documentType = documentType[0];
    }

    if (
      documentType !== null &&
      documentType !== undefined
    ) {
      documentType = String(documentType);
    } else {
      documentType = '';
    }

    documentType = documentType.trim();

    if (!documentType) {
      return ApiResponse.error(
        res,
        400,
        'Document type is required'
      );
    }

    const uploadedFile = req.file;

    if (!uploadedFile) {
      return ApiResponse.error(
        res,
        400,
        'Please upload a document'
      );
    }

    const student = await Student.findById(id);

    if (!student) {
      return ApiResponse.error(
        res,
        404,
        'Student not found'
      );
    }

    const document = {
      type: documentType.toUpperCase(),
      name: uploadedFile.originalname,
      fileUrl:
        `/uploads/students/documents/${uploadedFile.filename}`,
      mimeType:
        uploadedFile.mimetype || '',
      uploadedAt: new Date()
    };

    student.documents.push(document);

    await student.save();

    const addedDocument =
      student.documents[
        student.documents.length - 1
      ];

    if (req.user?._id) {
      await logAction({
        user: req.user._id,
        action: 'STUDENT_DOCUMENT_ADDED',
        entity: 'Student',
        entityId: id,
        details: {
          documentId:
            addedDocument._id.toString(),
          documentType:
            addedDocument.type,
          fileName:
            addedDocument.name
        },
        ip: req.ip
      });
    }

    return ApiResponse.success(
      res,
      201,
      'Student document uploaded successfully',
      {
        document: addedDocument
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * -----------------------------------------------------
 * Get Student Documents
 * -----------------------------------------------------
 *
 * GET /api/students/:id/documents
 * Access: Admin, Teacher
 */
const getStudentDocuments = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid student ID format'
      );
    }

    const student = await Student.findById(id)
      .select(
        'name admissionNo documents'
      );

    if (!student) {
      return ApiResponse.error(
        res,
        404,
        'Student not found'
      );
    }

    return ApiResponse.success(
      res,
      200,
      'Student documents retrieved successfully',
      {
        studentId: student._id,
        studentName: student.name,
        admissionNo: student.admissionNo,
        documents: student.documents
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * -----------------------------------------------------
 * Delete Student Document
 * -----------------------------------------------------
 *
 * DELETE /api/students/:id/documents/:documentId
 * Access: Admin, Teacher
 */
const deleteStudentDocument = async (
  req,
  res,
  next
) => {
  try {
    const {
      id,
      documentId
    } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid student ID format'
      );
    }

    if (!isValidObjectId(documentId)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid document ID format'
      );
    }

    const student = await Student.findById(id);

    if (!student) {
      return ApiResponse.error(
        res,
        404,
        'Student not found'
      );
    }

    const document =
      student.documents.id(documentId);

    if (!document) {
      return ApiResponse.error(
        res,
        404,
        'Student document not found'
      );
    }

    const documentDetails = {
      documentId:
        document._id.toString(),
      type:
        document.type,
      name:
        document.name
    };

    document.deleteOne();

    await student.save();

    if (req.user?._id) {
      await logAction({
        user: req.user._id,
        action: 'STUDENT_DOCUMENT_DELETED',
        entity: 'Student',
        entityId: id,
        details: documentDetails,
        ip: req.ip
      });
    }

    return ApiResponse.success(
      res,
      200,
      'Student document deleted successfully'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createStudent,
  generateStudentPortalCredentials,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  addStudentDocument,
  getStudentDocuments,
  deleteStudentDocument
};
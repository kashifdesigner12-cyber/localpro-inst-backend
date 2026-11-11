/**
 * Multer File Upload Middleware
 * Handles student photos and student documents
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// =====================================================
// Upload Directories
// =====================================================

const studentPhotoDir = path.join(
  __dirname,
  '../uploads/students'
);

const studentDocumentDir = path.join(
  __dirname,
  '../uploads/students/documents'
);

// Make sure directories exist
fs.mkdirSync(studentPhotoDir, {
  recursive: true
});

fs.mkdirSync(studentDocumentDir, {
  recursive: true
});

// =====================================================
// Helpers
// =====================================================

const getExtension = (filename) => {
  return path
    .extname(filename || '')
    .trim()
    .toLowerCase();
};

const getMimeType = (mimetype) => {
  return String(mimetype || '')
    .trim()
    .toLowerCase();
};

// =====================================================
// STUDENT PHOTO & ID CARD STORAGE
// =====================================================

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, studentPhotoDir);
  },

  filename: (req, file, cb) => {
    const prefix = file.fieldname === 'idCard' ? 'idcard' : 'student';
    const uniqueName = `${prefix}-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${getExtension(file.originalname)}`;

    cb(null, uniqueName);
  }
});

const photoFileFilter = (req, file, cb) => {
  const allowedExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp'
  ];

  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/octet-stream'
  ];

  const extension = getExtension(file.originalname);
  const mimeType = getMimeType(file.mimetype);

  if (!allowedExtensions.includes(extension)) {
    const error = new Error(
      'Invalid file format. Only JPG, JPEG, PNG, and WEBP image formats are allowed.'
    );

    error.statusCode = 400;

    return cb(error);
  }

  if (!allowedMimeTypes.includes(mimeType)) {
    const error = new Error(
      'Invalid image MIME type.'
    );

    error.statusCode = 400;

    return cb(error);
  }

  cb(null, true);
};

// Supports both Photo and ID Card simultaneously
const uploadStudentPhoto = multer({
  storage: photoStorage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 2
  },
  fileFilter: photoFileFilter
}).fields([
  { name: 'photo', maxCount: 1 },
  { name: 'idCard', maxCount: 1 }
]);

// =====================================================
// STUDENT DOCUMENT
// =====================================================

const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, studentDocumentDir);
  },

  filename: (req, file, cb) => {
    const uniqueName = `document-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${getExtension(file.originalname)}`;

    cb(null, uniqueName);
  }
});

// =====================================================
// Allowed Document Types
// =====================================================

const allowedDocumentTypes = {
  '.pdf': [
    'application/pdf',
    'application/octet-stream'
  ],

  '.doc': [
    'application/msword',
    'application/octet-stream'
  ],

  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ],

  '.xls': [
    'application/vnd.ms-excel',
    'application/octet-stream'
  ],

  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ],

  '.jpg': [
    'image/jpeg',
    'image/jpg',
    'application/octet-stream'
  ],

  '.jpeg': [
    'image/jpeg',
    'image/jpg',
    'application/octet-stream'
  ],

  '.png': [
    'image/png',
    'application/octet-stream'
  ],

  '.webp': [
    'image/webp',
    'application/octet-stream'
  ]
};

const allowedDocumentExtensions = Object.keys(
  allowedDocumentTypes
);

// =====================================================
// Document File Filter
// =====================================================

const documentFileFilter = (req, file, cb) => {
  const extension = getExtension(file.originalname);
  const mimeType = getMimeType(file.mimetype);

  if (
    !allowedDocumentExtensions.includes(extension)
  ) {
    const error = new Error(
      'Invalid document format. Allowed formats: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG, WEBP.'
    );

    error.statusCode = 400;

    return cb(error);
  }

  const allowedMimeTypes =
    allowedDocumentTypes[extension];

  if (
    !allowedMimeTypes.includes(mimeType)
  ) {
    const error = new Error(
      `Invalid MIME type for ${extension} file.`
    );

    error.statusCode = 400;

    return cb(error);
  }

  cb(null, true);
};

// =====================================================
// Single Student Document Upload
// =====================================================

const documentUpload = multer({
  storage: documentStorage,

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },

  fileFilter: documentFileFilter
});

const uploadStudentDocument =
  documentUpload.single('document');

// =====================================================
// Multiple Student Documents Upload
// =====================================================

const uploadStudentDocuments = multer({
  storage: documentStorage,

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10
  },

  fileFilter: documentFileFilter
}).array('documents', 10);

// =====================================================
// Export
// =====================================================

module.exports = {
  uploadStudentPhoto,
  uploadStudentDocument,
  uploadStudentDocuments
};
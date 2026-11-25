/**
 * Staff Management Controller
 * Auto-provisions Teacher Portal & WhatsApp Chat login credentials when Admin adds staff/teachers
 */

const Staff = require('../models/Staff');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');
const { isValidObjectId } = require('../utils/validators');
const { logAction } = require('../services/auditService');

// Generate clean memorable initial password (e.g., "ali@4821")
const generateInitialTeacherPassword = (name = 'teacher') => {
  const cleanFirstName =
    String(name || 'teacher')
      .trim()
      .split(/\s+/)[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || 'teacher';
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `${cleanFirstName}@${randomDigits}`;
};

/**
 * @desc    Create new staff member & auto-generate Teacher Portal login credentials
 * @route   POST /api/staff
 * @access  Private (Admin)
 */
const createStaff = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      employeeId,
      designation,
      department,
      qualification,
      salary,
      cnic,
      bankAccount,
      joiningDate,
      status,
      photo,
      password
    } = req.body;

    // Required fields
    if (!name || !email || !phone || !designation || !department) {
      return ApiResponse.error(
        res,
        400,
        'Please provide name, email, phone, designation, and department'
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check duplicate email in Staff
    const existingStaff = await Staff.findOne({
      email: normalizedEmail
    });

    if (existingStaff) {
      return ApiResponse.error(
        res,
        409,
        'Staff member with this email already exists'
      );
    }

    // Check duplicate employee ID only when provided
    if (employeeId && employeeId.trim()) {
      const existingEmployeeId = await Staff.findOne({
        employeeId: employeeId.trim()
      });

      if (existingEmployeeId) {
        return ApiResponse.error(
          res,
          409,
          'Staff member with this employee ID already exists'
        );
      }
    }

    const initialPassword =
      password && String(password).trim().length >= 6
        ? String(password).trim()
        : generateInitialTeacherPassword(name);

    const normalizedStatus = status ? status.toUpperCase() : 'ACTIVE';

    const staff = await Staff.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      plainPassword: initialPassword,
      employeeId: employeeId ? employeeId.trim() : '',
      designation: designation.trim(),
      department: department.trim(),
      qualification: qualification ? qualification.trim() : '',
      salary:
        salary !== undefined && salary !== ''
          ? Number(salary)
          : 0,
      cnic: cnic ? cnic.trim() : '',
      bankAccount: bankAccount ? bankAccount.trim() : '',
      joiningDate: joiningDate ? new Date(joiningDate) : Date.now(),
      status: normalizedStatus,
      photo: photo || ''
    });

    // Auto-create or sync User login account (role: TEACHER)
    let linkedUser = await User.findOne({ email: normalizedEmail });
    if (linkedUser) {
      linkedUser.name = staff.name;
      linkedUser.phone = staff.phone;
      linkedUser.password = initialPassword;
      linkedUser.staffId = staff._id;
      linkedUser.isActive = normalizedStatus === 'ACTIVE';
      await linkedUser.save();
    } else {
      linkedUser = await User.create({
        name: staff.name,
        email: normalizedEmail,
        password: initialPassword,
        role: 'TEACHER',
        phone: staff.phone,
        staffId: staff._id,
        isActive: normalizedStatus === 'ACTIVE'
      });
    }

    staff.userId = linkedUser._id;
    await staff.save();

    await logAction({
      user: req.user._id,
      action: 'STAFF_CREATED',
      entity: 'Staff',
      entityId: staff._id.toString(),
      details: {
        name: staff.name,
        email: staff.email,
        employeeId: staff.employeeId,
        designation: staff.designation,
        department: staff.department
      },
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      201,
      'Staff created successfully & login credentials generated',
      {
        staff,
        credentials: {
          email: staff.email,
          password: initialPassword,
          role: 'TEACHER'
        }
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all staff with filters, search, and pagination
 * @route   GET /api/staff
 * @access  Private (Admin)
 */
const getStaff = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const { department, designation, status, search } = req.query;

    const query = {};

    if (department) {
      query.department = new RegExp(department.trim(), 'i');
    }

    if (designation) {
      query.designation = new RegExp(designation.trim(), 'i');
    }

    if (status) {
      query.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');

      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { employeeId: searchRegex },
        { cnic: searchRegex },
        { department: searchRegex },
        { designation: searchRegex }
      ];
    }

    const [staffList, total] = await Promise.all([
      Staff.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Staff.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return ApiResponse.success(
      res,
      200,
      'Staff list retrieved',
      {
        staff: staffList
      },
      {
        page,
        limit,
        total,
        totalPages
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single staff member by ID
 * @route   GET /api/staff/:id
 * @access  Private (Admin)
 */
const getStaffById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(res, 400, 'Invalid staff ID format');
    }

    const staff = await Staff.findById(id);

    if (!staff) {
      return ApiResponse.error(res, 404, 'Staff member not found');
    }

    return ApiResponse.success(res, 200, 'Staff details retrieved', {
      staff
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update staff member & sync User login account
 * @route   PUT /api/staff/:id
 * @access  Private (Admin)
 */
const updateStaff = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(res, 400, 'Invalid staff ID format');
    }

    const staff = await Staff.findById(id);

    if (!staff) {
      return ApiResponse.error(res, 404, 'Staff member not found');
    }

    const previousEmail = staff.email;

    if (
      req.body.email &&
      req.body.email.toLowerCase().trim() !== staff.email
    ) {
      const duplicate = await Staff.findOne({
        email: req.body.email.toLowerCase().trim(),
        _id: { $ne: id }
      });

      if (duplicate) {
        return ApiResponse.error(
          res,
          409,
          'Staff with this email already exists'
        );
      }
    }

    if (
      req.body.employeeId &&
      req.body.employeeId.trim() !== staff.employeeId
    ) {
      const duplicateEmployeeId = await Staff.findOne({
        employeeId: req.body.employeeId.trim(),
        _id: { $ne: id }
      });

      if (duplicateEmployeeId) {
        return ApiResponse.error(
          res,
          409,
          'Staff member with this employee ID already exists'
        );
      }
    }

    const updateData = {};

    if (req.body.name !== undefined) {
      updateData.name = req.body.name.trim();
    }

    if (req.body.email !== undefined) {
      updateData.email = req.body.email.toLowerCase().trim();
    }

    if (req.body.phone !== undefined) {
      updateData.phone = req.body.phone.trim();
    }

    if (req.body.employeeId !== undefined) {
      updateData.employeeId = req.body.employeeId
        ? req.body.employeeId.trim()
        : '';
    }

    if (req.body.designation !== undefined) {
      updateData.designation = req.body.designation.trim();
    }

    if (req.body.department !== undefined) {
      updateData.department = req.body.department.trim();
    }

    if (req.body.qualification !== undefined) {
      updateData.qualification = req.body.qualification
        ? req.body.qualification.trim()
        : '';
    }

    if (req.body.salary !== undefined) {
      updateData.salary =
        req.body.salary === '' ? 0 : Number(req.body.salary);
    }

    if (req.body.cnic !== undefined) {
      updateData.cnic = req.body.cnic ? req.body.cnic.trim() : '';
    }

    if (req.body.bankAccount !== undefined) {
      updateData.bankAccount = req.body.bankAccount
        ? req.body.bankAccount.trim()
        : '';
    }

    if (req.body.joiningDate !== undefined) {
      updateData.joiningDate = req.body.joiningDate
        ? new Date(req.body.joiningDate)
        : null;
    }

    if (req.body.status !== undefined) {
      updateData.status = req.body.status.toUpperCase();
    }

    if (req.body.photo !== undefined) {
      updateData.photo = req.body.photo || '';
    }

    if (req.body.password && String(req.body.password).trim().length >= 6) {
      updateData.plainPassword = String(req.body.password).trim();
    }

    const updatedStaff = await Staff.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    });

    // Sync linked User login account
    const linkedUser =
      (updatedStaff.userId && (await User.findById(updatedStaff.userId))) ||
      (await User.findOne({ email: previousEmail }));

    if (linkedUser) {
      linkedUser.name = updatedStaff.name;
      linkedUser.email = updatedStaff.email;
      linkedUser.phone = updatedStaff.phone;
      linkedUser.isActive = updatedStaff.status === 'ACTIVE';
      if (updateData.plainPassword) {
        linkedUser.password = updateData.plainPassword;
      }
      await linkedUser.save();
    }

    await logAction({
      user: req.user._id,
      action: 'STAFF_UPDATED',
      entity: 'Staff',
      entityId: id,
      details: updateData,
      ip: req.ip
    });

    return ApiResponse.success(res, 200, 'Staff updated successfully', {
      staff: updatedStaff
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete staff member & linked User login account
 * @route   DELETE /api/staff/:id
 * @access  Private (Admin)
 */
const deleteStaff = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(res, 400, 'Invalid staff ID format');
    }

    const staff = await Staff.findById(id);

    if (!staff) {
      return ApiResponse.error(res, 404, 'Staff member not found');
    }

    if (staff.userId) {
      await User.findByIdAndDelete(staff.userId);
    } else if (staff.email) {
      await User.deleteOne({ email: staff.email, role: 'TEACHER' });
    }

    await Staff.findByIdAndDelete(id);

    await logAction({
      user: req.user._id,
      action: 'STAFF_DELETED',
      entity: 'Staff',
      entityId: id,
      details: {
        name: staff.name,
        email: staff.email,
        employeeId: staff.employeeId
      },
      ip: req.ip
    });

    return ApiResponse.success(res, 200, 'Staff member deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createStaff,
  getStaff,
  getStaffById,
  updateStaff,
  deleteStaff
};
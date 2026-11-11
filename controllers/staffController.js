/**
 * Staff Management Controller
 */

const Staff = require('../models/Staff');
const ApiResponse = require('../utils/apiResponse');
const { isValidObjectId } = require('../utils/validators');
const { logAction } = require('../services/auditService');

/**
 * @desc    Create new staff member
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
      photo
    } = req.body;

    // Required fields
    if (!name || !email || !phone || !designation || !department) {
      return ApiResponse.error(
        res,
        400,
        'Please provide name, email, phone, designation, and department'
      );
    }

    // Check duplicate email
    const existingStaff = await Staff.findOne({
      email: email.toLowerCase().trim()
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

    const staff = await Staff.create({
      name: name.trim(),

      email: email.toLowerCase().trim(),

      phone: phone.trim(),

      employeeId: employeeId
        ? employeeId.trim()
        : '',

      designation: designation.trim(),

      department: department.trim(),

      qualification: qualification
        ? qualification.trim()
        : '',

      salary:
        salary !== undefined && salary !== ''
          ? Number(salary)
          : 0,

      cnic: cnic
        ? cnic.trim()
        : '',

      bankAccount: bankAccount
        ? bankAccount.trim()
        : '',

      joiningDate: joiningDate
        ? new Date(joiningDate)
        : Date.now(),

      status: status
        ? status.toUpperCase()
        : 'ACTIVE',

      photo: photo || ''
    });

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
      'Staff created successfully',
      { staff }
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
    const page =
      parseInt(req.query.page, 10) || 1;

    const limit =
      parseInt(req.query.limit, 10) || 20;

    const skip =
      (page - 1) * limit;

    const {
      department,
      designation,
      status,
      search
    } = req.query;

    const query = {};

    // Department filter
    if (department) {
      query.department = new RegExp(
        department.trim(),
        'i'
      );
    }

    // Designation filter
    if (designation) {
      query.designation = new RegExp(
        designation.trim(),
        'i'
      );
    }

    // Status filter
    if (status) {
      query.status =
        status.toUpperCase();
    }

    // Search
    if (search && search.trim()) {
      const searchRegex =
        new RegExp(search.trim(), 'i');

      query.$or = [
        {
          name: searchRegex
        },
        {
          email: searchRegex
        },
        {
          phone: searchRegex
        },
        {
          employeeId: searchRegex
        },
        {
          cnic: searchRegex
        },
        {
          department: searchRegex
        },
        {
          designation: searchRegex
        }
      ];
    }

    const [staffList, total] =
      await Promise.all([
        Staff.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),

        Staff.countDocuments(query)
      ]);

    const totalPages =
      Math.ceil(total / limit);

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
const getStaffById = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid staff ID format'
      );
    }

    const staff =
      await Staff.findById(id);

    if (!staff) {
      return ApiResponse.error(
        res,
        404,
        'Staff member not found'
      );
    }

    return ApiResponse.success(
      res,
      200,
      'Staff details retrieved',
      {
        staff
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update staff member
 * @route   PUT /api/staff/:id
 * @access  Private (Admin)
 */
const updateStaff = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid staff ID format'
      );
    }

    const staff =
      await Staff.findById(id);

    if (!staff) {
      return ApiResponse.error(
        res,
        404,
        'Staff member not found'
      );
    }

    // Check duplicate email if changed
    if (
      req.body.email &&
      req.body.email
        .toLowerCase()
        .trim() !== staff.email
    ) {
      const duplicate =
        await Staff.findOne({
          email: req.body.email
            .toLowerCase()
            .trim(),
          _id: {
            $ne: id
          }
        });

      if (duplicate) {
        return ApiResponse.error(
          res,
          409,
          'Staff with this email already exists'
        );
      }
    }

    // Check duplicate Employee ID if changed
    if (
      req.body.employeeId &&
      req.body.employeeId.trim() !==
        staff.employeeId
    ) {
      const duplicateEmployeeId =
        await Staff.findOne({
          employeeId:
            req.body.employeeId.trim(),
          _id: {
            $ne: id
          }
        });

      if (duplicateEmployeeId) {
        return ApiResponse.error(
          res,
          409,
          'Staff member with this employee ID already exists'
        );
      }
    }

    // Prepare update data
    const updateData = {};

    if (req.body.name !== undefined) {
      updateData.name =
        req.body.name.trim();
    }

    if (req.body.email !== undefined) {
      updateData.email =
        req.body.email
          .toLowerCase()
          .trim();
    }

    if (req.body.phone !== undefined) {
      updateData.phone =
        req.body.phone.trim();
    }

    if (
      req.body.employeeId !==
      undefined
    ) {
      updateData.employeeId =
        req.body.employeeId
          ? req.body.employeeId.trim()
          : '';
    }

    if (
      req.body.designation !==
      undefined
    ) {
      updateData.designation =
        req.body.designation.trim();
    }

    if (
      req.body.department !==
      undefined
    ) {
      updateData.department =
        req.body.department.trim();
    }

    if (
      req.body.qualification !==
      undefined
    ) {
      updateData.qualification =
        req.body.qualification
          ? req.body.qualification.trim()
          : '';
    }

    if (req.body.salary !== undefined) {
      updateData.salary =
        req.body.salary === ''
          ? 0
          : Number(req.body.salary);
    }

    if (req.body.cnic !== undefined) {
      updateData.cnic =
        req.body.cnic
          ? req.body.cnic.trim()
          : '';
    }

    if (
      req.body.bankAccount !==
      undefined
    ) {
      updateData.bankAccount =
        req.body.bankAccount
          ? req.body.bankAccount.trim()
          : '';
    }

    if (
      req.body.joiningDate !==
      undefined
    ) {
      updateData.joiningDate =
        req.body.joiningDate
          ? new Date(
              req.body.joiningDate
            )
          : null;
    }

    if (req.body.status !== undefined) {
      updateData.status =
        req.body.status.toUpperCase();
    }

    if (req.body.photo !== undefined) {
      updateData.photo =
        req.body.photo || '';
    }

    const updatedStaff =
      await Staff.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true
        }
      );

    await logAction({
      user: req.user._id,
      action: 'STAFF_UPDATED',
      entity: 'Staff',
      entityId: id,
      details: updateData,
      ip: req.ip
    });

    return ApiResponse.success(
      res,
      200,
      'Staff updated successfully',
      {
        staff: updatedStaff
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete staff member
 * @route   DELETE /api/staff/:id
 * @access  Private (Admin)
 */
const deleteStaff = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return ApiResponse.error(
        res,
        400,
        'Invalid staff ID format'
      );
    }

    const staff =
      await Staff.findById(id);

    if (!staff) {
      return ApiResponse.error(
        res,
        404,
        'Staff member not found'
      );
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

    return ApiResponse.success(
      res,
      200,
      'Staff member deleted successfully'
    );
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
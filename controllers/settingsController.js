const Settings = require('../models/Settings');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Get school settings
 * @route   GET /api/settings
 * @access  Admin
 */
const getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne({ isActive: true })
      .populate('updatedBy', 'name email role');

    // If settings don't exist, create default settings
    if (!settings) {
      settings = await Settings.create({
        schoolName: 'School Management System',
        schoolEmail: '',
        schoolPhone: '',
        schoolAddress: '',
        schoolLogo: '',
        website: '',
        academicYear: '',
        currency: 'PKR',
        timezone: 'Asia/Karachi',

        attendanceSettings: {
          lateAfterMinutes: 15,
          absentNotificationEnabled: true
        },

        notificationSettings: {
          emailEnabled: true
        },

        updatedBy: req.user?._id || null
      });
    }

    return ApiResponse.success(
      res,
      200,
      'Settings retrieved successfully',
      { settings }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create school settings
 * @route   POST /api/settings
 * @access  Admin
 */
const createSettings = async (req, res, next) => {
  try {
    const existingSettings = await Settings.findOne();

    if (existingSettings) {
      return ApiResponse.error(
        res,
        409,
        'Settings already exist. Please update the existing settings.'
      );
    }

    const {
      schoolName,
      schoolEmail,
      schoolPhone,
      schoolAddress,
      schoolLogo,
      website,
      academicYear,
      currency,
      timezone,
      attendanceSettings,
      notificationSettings
    } = req.body;

    if (!schoolName || !schoolName.trim()) {
      return ApiResponse.error(
        res,
        400,
        'School name is required'
      );
    }

    const settings = await Settings.create({
      schoolName: schoolName.trim(),
      schoolEmail: schoolEmail || '',
      schoolPhone: schoolPhone || '',
      schoolAddress: schoolAddress || '',
      schoolLogo: schoolLogo || '',
      website: website || '',
      academicYear: academicYear || '',
      currency: currency || 'PKR',
      timezone: timezone || 'Asia/Karachi',

      attendanceSettings: {
        lateAfterMinutes:
          attendanceSettings?.lateAfterMinutes ?? 15,

        absentNotificationEnabled:
          attendanceSettings?.absentNotificationEnabled ?? true
      },

      notificationSettings: {
        emailEnabled:
          notificationSettings?.emailEnabled ?? true
      },

      updatedBy: req.user?._id || null
    });

    return ApiResponse.success(
      res,
      201,
      'Settings created successfully',
      { settings }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update school settings
 * @route   PUT /api/settings
 * @access  Admin
 */
const updateSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      return ApiResponse.error(
        res,
        404,
        'Settings not found. Please create settings first.'
      );
    }

    const {
      schoolName,
      schoolEmail,
      schoolPhone,
      schoolAddress,
      schoolLogo,
      website,
      academicYear,
      currency,
      timezone,
      attendanceSettings,
      notificationSettings,
      isActive
    } = req.body;

    if (schoolName !== undefined) {
      if (!schoolName.trim()) {
        return ApiResponse.error(
          res,
          400,
          'School name cannot be empty'
        );
      }

      settings.schoolName = schoolName.trim();
    }

    if (schoolEmail !== undefined) {
      settings.schoolEmail = schoolEmail;
    }

    if (schoolPhone !== undefined) {
      settings.schoolPhone = schoolPhone;
    }

    if (schoolAddress !== undefined) {
      settings.schoolAddress = schoolAddress;
    }

    if (schoolLogo !== undefined) {
      settings.schoolLogo = schoolLogo;
    }

    if (website !== undefined) {
      settings.website = website;
    }

    if (academicYear !== undefined) {
      settings.academicYear = academicYear;
    }

    if (currency !== undefined) {
      settings.currency = currency;
    }

    if (timezone !== undefined) {
      settings.timezone = timezone;
    }

    if (attendanceSettings !== undefined) {
      if (
        attendanceSettings.lateAfterMinutes !== undefined
      ) {
        settings.attendanceSettings.lateAfterMinutes =
          attendanceSettings.lateAfterMinutes;
      }

      if (
        attendanceSettings.absentNotificationEnabled !== undefined
      ) {
        settings.attendanceSettings.absentNotificationEnabled =
          attendanceSettings.absentNotificationEnabled;
      }
    }

    if (notificationSettings !== undefined) {
      if (notificationSettings.emailEnabled !== undefined) {
        settings.notificationSettings.emailEnabled =
          notificationSettings.emailEnabled;
      }
    }

    if (isActive !== undefined) {
      settings.isActive = isActive;
    }

    settings.updatedBy = req.user?._id || null;

    await settings.save();

    await settings.populate('updatedBy', 'name email role');

    return ApiResponse.success(
      res,
      200,
      'Settings updated successfully',
      { settings }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset settings to default values
 * @route   PATCH /api/settings/reset
 * @access  Admin
 */
const resetSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      return ApiResponse.error(
        res,
        404,
        'Settings not found'
      );
    }

    settings.schoolName = 'School Management System';
    settings.schoolEmail = '';
    settings.schoolPhone = '';
    settings.schoolAddress = '';
    settings.schoolLogo = '';
    settings.website = '';
    settings.academicYear = '';
    settings.currency = 'PKR';
    settings.timezone = 'Asia/Karachi';

    settings.attendanceSettings = {
      lateAfterMinutes: 15,
      absentNotificationEnabled: true
    };

    settings.notificationSettings = {
      emailEnabled: true
    };

    settings.isActive = true;
    settings.updatedBy = req.user?._id || null;

    await settings.save();

    await settings.populate('updatedBy', 'name email role');

    return ApiResponse.success(
      res,
      200,
      'Settings reset successfully',
      { settings }
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  createSettings,
  updateSettings,
  resetSettings
};


const Class = require("../models/Class");

// ===============================
// GET ALL CLASSES
// GET /api/classes
// ===============================
exports.getClasses = async (req, res) => {
  try {
    const classes = await Class.find().sort({ name: 1 });

    res.status(200).json({
      success: true,
      message: "Classes fetched successfully",
      data: classes,
    });
  } catch (error) {
    console.error("Get classes error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch classes",
      error: error.message,
    });
  }
};

// ===============================
// GET SINGLE CLASS
// GET /api/classes/:id
// ===============================
exports.getClassById = async (req, res) => {
  try {
    const classItem = await Class.findById(req.params.id);

    if (!classItem) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Class fetched successfully",
      data: classItem,
    });
  } catch (error) {
    console.error("Get class error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch class",
      error: error.message,
    });
  }
};

// ===============================
// CREATE CLASS
// POST /api/classes
// ===============================
exports.createClass = async (req, res) => {
  try {
    let { name, sections } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Class name is required",
      });
    }

    name = name.trim();

    // Sections ko clean karna
    if (!Array.isArray(sections)) {
      sections = [];
    }

    sections = sections
      .map((section) => String(section).trim())
      .filter(Boolean);

    // Duplicate sections remove
    sections = [...new Set(sections)];

    const existingClass = await Class.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
    });

    if (existingClass) {
      return res.status(409).json({
        success: false,
        message: "A class with this name already exists",
      });
    }

    const newClass = await Class.create({
      name,
      sections,
    });

    res.status(201).json({
      success: true,
      message: "Class created successfully",
      data: newClass,
    });
  } catch (error) {
    console.error("Create class error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A class with this name already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create class",
      error: error.message,
    });
  }
};

// ===============================
// UPDATE CLASS
// PUT /api/classes/:id
// ===============================
exports.updateClass = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, sections } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Class name is required",
      });
    }

    name = name.trim();

    if (!Array.isArray(sections)) {
      sections = [];
    }

    sections = sections
      .map((section) => String(section).trim())
      .filter(Boolean);

    sections = [...new Set(sections)];

    // Check duplicate class name
    const duplicateClass = await Class.findOne({
      _id: { $ne: id },
      name: { $regex: `^${name}$`, $options: "i" },
    });

    if (duplicateClass) {
      return res.status(409).json({
        success: false,
        message: "A class with this name already exists",
      });
    }

    const updatedClass = await Class.findByIdAndUpdate(
      id,
      {
        name,
        sections,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Class updated successfully",
      data: updatedClass,
    });
  } catch (error) {
    console.error("Update class error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid class ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update class",
      error: error.message,
    });
  }
};

// ===============================
// DELETE CLASS
// DELETE /api/classes/:id
// ===============================
exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedClass = await Class.findByIdAndDelete(id);

    if (!deletedClass) {
      return res.status(404).json({
        success: false,
        message: "Class not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Class deleted successfully",
      data: deletedClass,
    });
  } catch (error) {
    console.error("Delete class error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid class ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete class",
      error: error.message,
    });
  }
};
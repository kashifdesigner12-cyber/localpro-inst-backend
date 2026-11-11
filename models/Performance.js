const mongoose = require("mongoose");

const performanceSchema = new mongoose.Schema(
  {
    // ================================
    // STUDENT
    // ================================
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student is required"],
    },

    // ================================
    // MONTH
    // Format: YYYY-MM
    // Example: 2026-09
    // ================================
    month: {
      type: String,
      required: [true, "Month is required"],
      match: [
        /^\d{4}-(0[1-9]|1[0-2])$/,
        "Month must be in YYYY-MM format",
      ],
    },

    // ================================
    // PERFORMANCE PERCENTAGE
    // 0 - 100
    // Example: 70, 85, 92
    // ================================
    percentage: {
      type: Number,
      required: [true, "Performance percentage is required"],
      min: [0, "Performance cannot be less than 0%"],
      max: [100, "Performance cannot be greater than 100%"],
    },

    // ================================
    // REMARKS
    // ================================
    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    // ================================
    // CREATED BY
    // Teacher/Admin who entered performance
    // ================================
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// ONE PERFORMANCE RECORD PER STUDENT PER MONTH
// ======================================================
performanceSchema.index(
  {
    student: 1,
    month: 1,
  },
  {
    unique: true,
  }
);

// ======================================================
// ADDITIONAL INDEXES
// ======================================================
performanceSchema.index({
  month: 1,
});

performanceSchema.index({
  student: 1,
});

module.exports = mongoose.model(
  "Performance",
  performanceSchema
);
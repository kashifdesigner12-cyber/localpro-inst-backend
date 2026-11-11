const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Class name is required"],
      trim: true,
    },

    sections: {
      type: [String],
      default: [],
      validate: {
        validator: function (sections) {
          return sections.every(
            (section) =>
              typeof section === "string" && section.trim().length > 0
          );
        },
        message: "Section names cannot be empty",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Duplicate class names prevent karne ke liye
classSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model("Class", classSchema);
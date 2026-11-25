const express = require("express");
const router = express.Router();

const classController = require("../controllers/classController");
const authMiddleware = require("../middleware/authMiddleware");

// Admin authentication
router.use(authMiddleware.protect);

// Admin authorization
router.use(authMiddleware.requireAdmin);

// Get all classes + Create class
router
  .route("/")
  .get(classController.getClasses)
  .post(classController.createClass);

// Get, Update, Delete single class
router
  .route("/:id")
  .get(classController.getClassById)
  .put(classController.updateClass)
  .delete(classController.deleteClass);

module.exports = router;
const express = require('express');
const router = express.Router();

const { protect, requireAdmin } = require('../middleware/authMiddleware');
const { uploadAvatar, uploadChatAttachment } = require('../middleware/uploadMiddleware');
const {
  getChatContacts,
  getMessagesWithUser,
  deleteMessage,
  clearChatWithPartner,
  getAdminAllConversations,
  getAdminRoomMessages,
  deleteAdminMonitorRoom,
  updateTaskStatus,
  submitTaskAssignment,
  gradeTaskAssignment,
  updateStudentChatProfile,
  uploadAttachment
} = require('../controllers/chatController');

router.use(protect);

router.get('/contacts', getChatContacts);
router.get('/messages/:partnerId', getMessagesWithUser);
router.delete('/message/:messageId', deleteMessage);
router.delete('/conversation/:partnerId', clearChatWithPartner);
router.patch('/task/:messageId/status', updateTaskStatus);
router.post('/task/:messageId/submit', uploadChatAttachment, submitTaskAssignment);
router.patch('/task/:messageId/grade', gradeTaskAssignment);
router.put('/student-profile', uploadAvatar, updateStudentChatProfile);
router.post('/upload', uploadChatAttachment, uploadAttachment);

// Admin global monitoring routes
router.get('/admin/all-conversations', requireAdmin, getAdminAllConversations);
router.get('/admin/room/:roomId', requireAdmin, getAdminRoomMessages);
router.delete('/admin/room/:roomId', requireAdmin, deleteAdminMonitorRoom);

module.exports = router;
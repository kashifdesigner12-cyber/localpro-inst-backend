const express = require('express');
const router = express.Router();

const { protect, requireAdmin } = require('../middleware/authMiddleware');
const { uploadAvatar, uploadChatAttachment } = require('../middleware/uploadMiddleware');
const ChatMessage = require('../models/ChatMessage');
const { getIO, buildRoomId } = require('../socket/chatSocket');

const chatController = require('../controllers/chatController');
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
} = chatController;

const handleSendMessageFallback = async (req, res) => {
  try {
    const senderId = String(req.user?._id || req.user?.id || '');
    const senderRole = String(req.user?.role || 'teacher').toLowerCase();
    const senderName = req.user?.chatDisplayName || req.user?.name || 'User';

    const {
      receiverId,
      receiverRole = 'student',
      receiverName = 'User',
      text = '',
      messageType = 'text',
      task = null,
      attachmentUrl = '',
      attachmentName = '',
      tempId = null
    } = req.body || {};

    if (!senderId || !receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Sender and receiverId are required.'
      });
    }

    const roomId = buildRoomId(senderId, receiverId);

    const savedMessage = await ChatMessage.create({
      roomId,
      senderId,
      senderRole,
      senderName,
      receiverId: String(receiverId),
      receiverRole: String(receiverRole || 'student').toLowerCase(),
      receiverName: receiverName || 'User',
      messageType,
      text: String(text || '').trim(),
      task: task || undefined,
      attachmentUrl,
      attachmentName,
      status: 'sent'
    });

    const messageObj = {
      ...savedMessage.toObject(),
      tempId
    };

    const io = getIO();
    if (io) {
      io.to(`user_${receiverId}`).emit('receive_message', messageObj);
      io.to(`user_${senderId}`).emit('message_sent', messageObj);
      io.to('admin_monitor_room').emit('admin_live_message', messageObj);
    }

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully.',
      data: {
        message: messageObj
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to send message.'
    });
  }
};

const sendMessageHandler =
  typeof chatController.sendMessage === 'function'
    ? chatController.sendMessage
    : handleSendMessageFallback;

router.use(protect);

router.get('/contacts', getChatContacts);
router.get('/messages/:partnerId', getMessagesWithUser);
router.post('/send', sendMessageHandler);
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
const User = require('../models/User');
const Student = require('../models/Student');
const ChatMessage = require('../models/ChatMessage');
const ApiResponse = require('../utils/apiResponse');
const { buildRoomId, getIO } = require('../socket/chatSocket');

/**
 * GET /api/chat/contacts
 */
const getChatContacts = async (req, res, next) => {
  try {
    const currentUserId = String(req.user._id);

    const [users, students, unreadAgg, recentMsgs] = await Promise.all([
      User.find({ isActive: true, _id: { $ne: currentUserId } })
        .select('name email role phone')
        .lean(),
      Student.find({ status: { $ne: 'Inactive' }, _id: { $ne: currentUserId } })
        .select('name chatDisplayName email admissionNo className section photo isOnline lastSeen plainPassword')
        .lean(),
      ChatMessage.aggregate([
        {
          $match: {
            receiverId: req.user._id,
            status: { $ne: 'seen' },
            deletedFor: { $ne: req.user._id }
          }
        },
        {
          $group: {
            _id: '$senderId',
            count: { $sum: 1 }
          }
        }
      ]),
      ChatMessage.find({
        $or: [{ senderId: req.user._id }, { receiverId: req.user._id }],
        deletedFor: { $ne: req.user._id }
      })
        .sort({ createdAt: -1 })
        .limit(300)
        .lean()
    ]);

    const unreadMap = new Map(
      unreadAgg.map((item) => [String(item._id), item.count])
    );

    const lastMessageMap = new Map();
    for (const msg of recentMsgs) {
      const partnerId =
        String(msg.senderId) === currentUserId
          ? String(msg.receiverId)
          : String(msg.senderId);
      if (!lastMessageMap.has(partnerId)) {
        lastMessageMap.set(partnerId, msg);
      }
    }

    const formatPreview = (msg) => {
      if (!msg) return '';
      if (msg.isDeletedForEveryone) return '🚫 This message was deleted';
      if (msg.messageType === 'task') {
        return `📋 Task: ${msg.task?.title || msg.text}`;
      }
      return msg.text || msg.attachmentName || '';
    };

    const formattedUsers = users.map((u) => {
      const idStr = String(u._id);
      const lastMsg = lastMessageMap.get(idStr) || null;
      return {
        _id: idStr,
        name: u.name,
        subtitle: String(u.role || 'teacher').toUpperCase(),
        role: String(u.role || 'teacher').toLowerCase(),
        email: u.email,
        photo: '',
        isOnline: false,
        unreadCount: unreadMap.get(idStr) || 0,
        lastMessage: formatPreview(lastMsg),
        lastMessageTime: lastMsg ? lastMsg.createdAt : null
      };
    });

    const formattedStudents = students.map((s) => {
      const idStr = String(s._id);
      const lastMsg = lastMessageMap.get(idStr) || null;
      return {
        _id: idStr,
        name: s.chatDisplayName || s.name,
        fullName: s.name,
        subtitle: `${s.className || 'Student'} • ${s.admissionNo || ''}`,
        role: 'student',
        email: s.email,
        admissionNo: s.admissionNo,
        plainPassword: s.plainPassword || '',
        photo: s.photo || '',
        isOnline: Boolean(s.isOnline),
        lastSeen: s.lastSeen,
        unreadCount: unreadMap.get(idStr) || 0,
        lastMessage: formatPreview(lastMsg),
        lastMessageTime: lastMsg ? lastMsg.createdAt : null
      };
    });

    const allContacts = [...formattedUsers, ...formattedStudents].sort((a, b) => {
      if (a.lastMessageTime && b.lastMessageTime) {
        return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
      }
      if (a.lastMessageTime) return -1;
      if (b.lastMessageTime) return 1;
      return a.name.localeCompare(b.name);
    });

    return ApiResponse.success(res, 200, 'Chat contacts loaded', {
      contacts: allContacts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/chat/messages/:partnerId
 */
const getMessagesWithUser = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const roomId = buildRoomId(req.user._id, partnerId);

    const messages = await ChatMessage.find({
      roomId,
      deletedFor: { $ne: req.user._id }
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    await ChatMessage.updateMany(
      {
        roomId,
        senderId: partnerId,
        receiverId: req.user._id,
        status: { $ne: 'seen' }
      },
      {
        $set: { status: 'seen', seenAt: new Date() }
      }
    );

    return ApiResponse.success(res, 200, 'Messages loaded', {
      roomId,
      messages
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/chat/send
 */
const sendMessage = async (req, res, next) => {
  try {
    const senderId = String(req.user._id);
    const senderRole = String(req.user.role || 'teacher').toLowerCase();
    const senderName = req.user.chatDisplayName || req.user.name || 'User';

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

    if (!receiverId) {
      return ApiResponse.error(res, 400, 'receiverId is required');
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

    return ApiResponse.success(res, 201, 'Message sent successfully', {
      message: messageObj
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/chat/message/:messageId?mode=me|everyone
 */
const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const mode = String(req.query.mode || req.body?.mode || 'me').toLowerCase();
    const userId = String(req.user._id);
    const userRole = String(req.user.role || '').toLowerCase();

    const msg = await ChatMessage.findById(messageId);
    if (!msg) {
      return ApiResponse.error(res, 404, 'Message not found');
    }

    const isSender = String(msg.senderId) === userId;
    const isReceiver = String(msg.receiverId) === userId;

    if (!isSender && !isReceiver && userRole !== 'admin') {
      return ApiResponse.error(res, 403, 'Not authorized to delete this message');
    }

    if (mode === 'everyone') {
      if (!isSender && userRole !== 'admin') {
        return ApiResponse.error(
          res,
          403,
          'You can only delete your own messages for everyone'
        );
      }

      msg.isDeletedForEveryone = true;
      msg.deletedByRole = userRole;
      msg.messageType = 'text';
      msg.text = '🚫 This message was deleted';
      msg.attachmentUrl = '';
      msg.attachmentName = '';
      msg.task = undefined;
      await msg.save();

      const io = getIO();
      if (io) {
        const payload = {
          messageId: msg._id.toString(),
          roomId: msg.roomId,
          senderId: String(msg.senderId),
          receiverId: String(msg.receiverId),
          updatedMessage: msg.toObject()
        };
        io.to(`user_${msg.senderId}`).emit('message_deleted_everyone', payload);
        io.to(`user_${msg.receiverId}`).emit('message_deleted_everyone', payload);
        io.to('admin_monitor_room').emit('message_deleted_everyone', payload);
      }

      return ApiResponse.success(res, 200, 'Message deleted for everyone', {
        mode: 'everyone',
        message: msg
      });
    }

    await ChatMessage.findByIdAndUpdate(messageId, {
      $addToSet: { deletedFor: req.user._id }
    });

    return ApiResponse.success(res, 200, 'Message deleted for you', {
      mode: 'me',
      messageId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/chat/conversation/:partnerId
 */
const clearChatWithPartner = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const roomId = buildRoomId(req.user._id, partnerId);

    await ChatMessage.updateMany(
      { roomId },
      { $addToSet: { deletedFor: req.user._id } }
    );

    return ApiResponse.success(res, 200, 'Chat cleared successfully', {
      partnerId,
      roomId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/chat/admin/all-conversations
 */
const getAdminAllConversations = async (req, res, next) => {
  try {
    const conversations = await ChatMessage.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$roomId',
          lastMessage: { $first: '$$ROOT' },
          totalMessages: { $sum: 1 }
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
      { $limit: 100 }
    ]);

    return ApiResponse.success(res, 200, 'All institute conversations retrieved', {
      conversations
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/chat/admin/room/:roomId
 */
const getAdminRoomMessages = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const messages = await ChatMessage.find({ roomId })
      .sort({ createdAt: 1 })
      .limit(300)
      .lean();

    return ApiResponse.success(res, 200, 'Room messages retrieved', {
      roomId,
      messages
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/chat/admin/room/:roomId
 */
const deleteAdminMonitorRoom = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    await ChatMessage.deleteMany({ roomId });

    return ApiResponse.success(res, 200, 'Monitored chat deleted permanently', {
      roomId
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/chat/task/:messageId/status
 */
const updateTaskStatus = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;

    const validStatuses = ['Pending', 'In Progress', 'Completed'];
    if (!validStatuses.includes(status)) {
      return ApiResponse.error(res, 400, 'Invalid task status');
    }

    const msg = await ChatMessage.findByIdAndUpdate(
      messageId,
      { $set: { 'task.status': status } },
      { new: true }
    );

    if (!msg) {
      return ApiResponse.error(res, 404, 'Task message not found');
    }

    const io = getIO();
    if (io) {
      io.to(`user_${msg.senderId}`).emit('task_status_updated', msg);
      io.to(`user_${msg.receiverId}`).emit('task_status_updated', msg);
      io.to('admin_monitor_room').emit('task_status_updated', msg);
    }

    return ApiResponse.success(res, 200, 'Task status updated', { message: msg });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/chat/task/:messageId/submit
 * Student submits solution file + optional note/link for an assigned task
 */
const submitTaskAssignment = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const note = String(req.body?.submissionNote || '').trim();

    if (!req.file && !note) {
      return ApiResponse.error(
        res,
        400,
        'Please attach a solution file or enter a submission note/link.'
      );
    }

    const existingMsg = await ChatMessage.findById(messageId);
    if (!existingMsg || existingMsg.messageType !== 'task') {
      return ApiResponse.error(res, 404, 'Assigned task not found');
    }

    const updateFields = {
      'task.status': 'Completed',
      'task.submissionNote': note,
      'task.submittedAt': new Date()
    };

    if (req.file) {
      updateFields['task.submissionFileUrl'] = `/uploads/chat/${req.file.filename}`;
      updateFields['task.submissionFileName'] = req.file.originalname;
    }

    const updatedMsg = await ChatMessage.findByIdAndUpdate(
      messageId,
      { $set: updateFields },
      { new: true }
    );

    const io = getIO();
    if (io) {
      io.to(`user_${updatedMsg.senderId}`).emit('task_status_updated', updatedMsg);
      io.to(`user_${updatedMsg.receiverId}`).emit('task_status_updated', updatedMsg);
      io.to('admin_monitor_room').emit('task_status_updated', updatedMsg);
    }

    return ApiResponse.success(res, 200, 'Assignment submitted successfully', {
      message: updatedMsg
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/chat/task/:messageId/grade
 * Teacher or Admin grades a student's submitted task with marks & feedback
 */
const gradeTaskAssignment = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userRole = String(req.user?.role || '').toLowerCase();

    if (userRole !== 'teacher' && userRole !== 'admin') {
      return ApiResponse.error(
        res,
        403,
        'Only teachers or admins can grade assignments'
      );
    }

    const marks = String(req.body?.marks || '').trim();
    const feedback = String(req.body?.feedback || '').trim();

    if (!marks && !feedback) {
      return ApiResponse.error(res, 400, 'Please enter marks or feedback');
    }

    const updatedMsg = await ChatMessage.findByIdAndUpdate(
      messageId,
      {
        $set: {
          'task.marks': marks,
          'task.feedback': feedback,
          'task.gradedAt': new Date()
        }
      },
      { new: true }
    );

    if (!updatedMsg) {
      return ApiResponse.error(res, 404, 'Task message not found');
    }

    const io = getIO();
    if (io) {
      io.to(`user_${updatedMsg.senderId}`).emit('task_status_updated', updatedMsg);
      io.to(`user_${updatedMsg.receiverId}`).emit('task_status_updated', updatedMsg);
      io.to('admin_monitor_room').emit('task_status_updated', updatedMsg);
    }

    return ApiResponse.success(res, 200, 'Task graded successfully', {
      message: updatedMsg
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/chat/student-profile
 */
const updateStudentChatProfile = async (req, res, next) => {
  try {
    if (req.user?.role !== 'student') {
      return ApiResponse.error(res, 403, 'Only students can update student chat profile');
    }

    const student = await Student.findById(req.user._id);
    if (!student) {
      return ApiResponse.error(res, 404, 'Student not found');
    }

    if (req.body?.chatDisplayName && String(req.body.chatDisplayName).trim()) {
      student.chatDisplayName = String(req.body.chatDisplayName).trim();
    }

    if (req.file) {
      student.photo = `/uploads/students/${req.file.filename}`;
    }

    await student.save();

    return ApiResponse.success(res, 200, 'Chat profile updated successfully', {
      student: {
        _id: student._id,
        id: student._id,
        name: student.chatDisplayName || student.name,
        fullName: student.name,
        chatDisplayName: student.chatDisplayName || student.name,
        email: student.email,
        admissionNo: student.admissionNo,
        className: student.className,
        section: student.section,
        photo: student.photo,
        role: 'student'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/chat/upload
 */
const uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      return ApiResponse.error(res, 400, 'No file uploaded');
    }

    return ApiResponse.success(res, 200, 'Attachment uploaded', {
      attachmentUrl: `/uploads/chat/${req.file.filename}`,
      attachmentName: req.file.originalname
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChatContacts,
  getMessagesWithUser,
  sendMessage,
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
};
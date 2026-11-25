const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/User');
const Student = require('../models/Student');
const ChatMessage = require('../models/ChatMessage');

// Map userId -> Set of socketIds (supports multiple tabs/devices)
const onlineUsers = new Map();

const buildRoomId = (id1, id2) => {
  return [String(id1), String(id2)].sort().join('_');
};

let ioInstance = null;

const initChatSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: [
        config.frontendUrl,
        'https://institute.localpro1.net',
        'https://localpro1.net',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      ].filter(Boolean),
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authenticate socket via JWT token
  ioInstance.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (!token) {
        return next(new Error('Authentication token missing'));
      }

      const decoded = jwt.verify(token, config.jwt.secret);
      const role = String(decoded.role || '').toLowerCase();

      if (role === 'student') {
        const student = await Student.findById(decoded.userId).select('-password');
        if (!student) return next(new Error('Student not found'));

        socket.user = {
          id: student._id.toString(),
          name: student.chatDisplayName || student.name,
          role: 'student',
          photo: student.photo || ''
        };
      } else {
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) return next(new Error('User not found'));

        socket.user = {
          id: user._id.toString(),
          name: user.name,
          role: String(user.role || 'teacher').toLowerCase(),
          photo: ''
        };
      }

      next();
    } catch (err) {
      next(new Error('Invalid socket token'));
    }
  });

  ioInstance.on('connection', async (socket) => {
    const userId = socket.user.id;
    const userRole = socket.user.role;

    // Join personal room for instant notifications
    socket.join(`user_${userId}`);

    // Admins also join global monitor room so they can observe all teacher-student chats live
    if (userRole === 'admin') {
      socket.join('admin_monitor_room');
    }

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    if (userRole === 'student') {
      await Student.findByIdAndUpdate(userId, { isOnline: true }).catch(() => {});
    }

    // Broadcast updated online user IDs to everyone
    ioInstance.emit('online_users', Array.from(onlineUsers.keys()));

    // Send instant message (Text, File, or Task)
    socket.on('send_message', async (payload, callback) => {
      try {
        const {
          receiverId,
          receiverRole,
          receiverName,
          text = '',
          messageType = 'text',
          task = null,
          attachmentUrl = '',
          attachmentName = '',
          tempId = null
        } = payload || {};

        if (!receiverId) return;

        const roomId = buildRoomId(userId, receiverId);
        const isReceiverOnline = onlineUsers.has(String(receiverId));

        const savedMessage = await ChatMessage.create({
          roomId,
          senderId: userId,
          senderRole: userRole,
          senderName: socket.user.name,
          receiverId,
          receiverRole: String(receiverRole || 'student').toLowerCase(),
          receiverName: receiverName || 'User',
          messageType,
          text: String(text || '').trim(),
          task: task || undefined,
          attachmentUrl,
          attachmentName,
          status: isReceiverOnline ? 'delivered' : 'sent'
        });

        const messageObj = {
          ...savedMessage.toObject(),
          tempId
        };

        // 1. Deliver instantly to receiver
        ioInstance.to(`user_${receiverId}`).emit('receive_message', messageObj);

        // 2. Echo back to sender's other tabs/devices
        ioInstance.to(`user_${userId}`).emit('message_sent', messageObj);

        // 3. Broadcast to Admin monitor room so Admin sees all chats live
        ioInstance.to('admin_monitor_room').emit('admin_live_message', messageObj);

        if (typeof callback === 'function') {
          callback({ success: true, message: messageObj });
        }
      } catch (error) {
        if (typeof callback === 'function') {
          callback({ success: false, message: error.message });
        }
      }
    });

    // Live Typing Indicator
    socket.on('typing', ({ receiverId }) => {
      if (!receiverId) return;
      ioInstance.to(`user_${receiverId}`).emit('user_typing', {
        senderId: userId,
        senderName: socket.user.name
      });
    });

    socket.on('stop_typing', ({ receiverId }) => {
      if (!receiverId) return;
      ioInstance.to(`user_${receiverId}`).emit('user_stop_typing', {
        senderId: userId
      });
    });

    // Mark messages as seen (blue ticks)
    socket.on('mark_seen', async ({ senderId }) => {
      try {
        if (!senderId) return;
        const roomId = buildRoomId(userId, senderId);
        await ChatMessage.updateMany(
          {
            roomId,
            senderId,
            receiverId: userId,
            status: { $ne: 'seen' }
          },
          {
            $set: { status: 'seen', seenAt: new Date() }
          }
        );

        ioInstance.to(`user_${senderId}`).emit('messages_seen', {
          byUserId: userId,
          roomId
        });
      } catch (err) {
        // Ignore non-critical read receipt errors
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          if (userRole === 'student') {
            await Student.findByIdAndUpdate(userId, {
              isOnline: false,
              lastSeen: new Date()
            }).catch(() => {});
          }
        }
      }
      ioInstance.emit('online_users', Array.from(onlineUsers.keys()));
    });
  });

  return ioInstance;
};

const getIO = () => ioInstance;

module.exports = {
  initChatSocket,
  getIO,
  buildRoomId
};
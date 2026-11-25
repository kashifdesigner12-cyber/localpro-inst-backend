const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    senderRole: {
      type: String,
      enum: ['admin', 'teacher', 'student'],
      required: true
    },

    senderName: {
      type: String,
      default: 'User'
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    receiverRole: {
      type: String,
      enum: ['admin', 'teacher', 'student'],
      required: true
    },

    receiverName: {
      type: String,
      default: 'User'
    },

    messageType: {
      type: String,
      enum: ['text', 'task', 'file'],
      default: 'text'
    },

    text: {
      type: String,
      trim: true,
      default: ''
    },

    // Task assignment, student submission & teacher grading details
    task: {
      title: { type: String, trim: true, default: '' },
      description: { type: String, trim: true, default: '' },
      dueDate: { type: String, default: '' },
      attachmentUrl: { type: String, default: '' },
      attachmentName: { type: String, default: '' },
      status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Completed'],
        default: 'Pending'
      },
      // Student submission fields
      submissionFileUrl: { type: String, default: '' },
      submissionFileName: { type: String, default: '' },
      submissionNote: { type: String, trim: true, default: '' },
      submittedAt: { type: Date, default: null },
      // Teacher / Admin grading fields
      marks: { type: String, trim: true, default: '' },
      feedback: { type: String, trim: true, default: '' },
      gradedAt: { type: Date, default: null }
    },

    // Standalone file/image attachment
    attachmentUrl: {
      type: String,
      default: ''
    },

    attachmentName: {
      type: String,
      default: ''
    },

    // WhatsApp-style ticks: sent -> delivered -> seen
    status: {
      type: String,
      enum: ['sent', 'delivered', 'seen'],
      default: 'sent'
    },

    seenAt: {
      type: Date,
      default: null
    },

    // Delete for Me
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId
      }
    ],

    // Delete for Everyone
    isDeletedForEveryone: {
      type: Boolean,
      default: false
    },

    deletedByRole: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

chatMessageSchema.index({ roomId: 1, createdAt: 1 });
chatMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage;
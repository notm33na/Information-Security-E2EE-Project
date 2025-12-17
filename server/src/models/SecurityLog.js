import mongoose from 'mongoose';

/**
 * Security Log Model
 * Stores security-related events for audit and monitoring purposes
 * All logs are stored in MongoDB Atlas
 */
const securityLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    enum: [
      'AUTH_ATTEMPT',
      'KEY_EXCHANGE',
      'DECRYPTION_FAILED',
      'REPLAY_ATTEMPT',
      'INVALID_SIGNATURE',
      'METADATA_ACCESS',
      'INVALID_KEP_MESSAGE'
    ],
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    default: null
  },
  sessionId: {
    type: String,
    index: true,
    default: null
  },
  // Event-specific fields
  success: {
    type: Boolean,
    default: null
  },
  reason: {
    type: String,
    default: null
  },
  // For key exchange events
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  messageType: {
    type: String,
    default: null
  },
  // For replay and decryption events
  seq: {
    type: Number,
    default: null
  },
  timestamp: {
    type: Number,
    default: null
  },
  // For metadata access
  action: {
    type: String,
    default: null
  },
  // IP address for tracking
  ip: {
    type: String,
    default: null
  },
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Timestamp when log was created
  loggedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
securityLogSchema.index({ eventType: 1, loggedAt: -1 });
securityLogSchema.index({ userId: 1, loggedAt: -1 });
securityLogSchema.index({ sessionId: 1, loggedAt: -1 });
securityLogSchema.index({ eventType: 1, success: 1, loggedAt: -1 });
securityLogSchema.index({ ip: 1, loggedAt: -1 });

// Compound index for common queries
securityLogSchema.index({ eventType: 1, userId: 1, loggedAt: -1 });

export const SecurityLog =
  mongoose.models.SecurityLog || mongoose.model('SecurityLog', securityLogSchema);


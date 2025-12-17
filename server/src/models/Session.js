import mongoose from 'mongoose';

/**
 * Session Model
 * Tracks chat sessions between users in MongoDB
 * Ensures only ONE session exists between any two users
 */
const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  participants: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    required: true,
    validate: {
      validator: function(v) {
        return v.length === 2 && v[0].toString() !== v[1].toString();
      },
      message: 'Session must have exactly 2 different participants'
    }
  },
  // Store sorted participant IDs for consistent lookups
  participantIds: {
    type: [String],
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound unique index to ensure only one session per user pair
// Using participantIds (sorted) ensures consistent lookups regardless of order
// The unique index prevents duplicate sessions even in race conditions
sessionSchema.index({ participantIds: 1 }, { unique: true });

// Index for efficient queries by participant
sessionSchema.index({ participants: 1 });

/**
 * Finds or creates a session between two users
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Promise<Object>} Session document
 */
sessionSchema.statics.findOrCreate = async function(userId1, userId2, sessionId) {
  // Sort participant IDs for consistent lookup
  const sortedIds = [userId1, userId2].map(id => id.toString()).sort();
  
  // Try to find existing session using sorted participantIds
  // We use exact array match because participantIds is always stored sorted
  // This is equivalent to: findOne({ participants: { $all: [userId1, userId2] } })
  // but more efficient since we have a direct index on participantIds
  let session = await this.findOne({ participantIds: sortedIds });
  
  if (session) {
    console.log(`[Session Model] ✓ EXISTING session found: ${session.sessionId} for users ${userId1} ↔ ${userId2}`);
    // Update last activity
    session.lastActivity = new Date();
    await session.save();
    return session;
  }
  
  // Create new session if not found
  console.log(`[Session Model] Creating NEW session: ${sessionId} for users ${userId1} ↔ ${userId2}`);
  try {
    // Ensure participants are stored as ObjectIds for proper MongoDB queries
    // Mongoose will automatically convert string IDs to ObjectIds when the schema field is ObjectId
    // But we'll explicitly convert to ensure consistency
    const participantObjectIds = [
      new mongoose.Types.ObjectId(userId1),
      new mongoose.Types.ObjectId(userId2)
    ];
    
    session = await this.create({
      sessionId,
      participants: participantObjectIds,
      participantIds: sortedIds,
      lastActivity: new Date()
    });
    console.log(`[Session Model] ✓ NEW session created: ${session.sessionId}`);
    console.log(`[Session Model] Session participants (ObjectIds): ${session.participants.map(p => p.toString()).join(', ')}`);
  } catch (error) {
    // Handle race condition - another request created the session
    if (error.code === 11000 || error.name === 'MongoServerError') {
      console.log(`[Session Model] ⚠️ Duplicate session creation attempt BLOCKED (race condition) - fetching existing session`);
      session = await this.findOne({ participantIds: sortedIds });
      if (session) {
        console.log(`[Session Model] ✓ Returning existing session: ${session.sessionId}`);
        session.lastActivity = new Date();
        await session.save();
        return session;
      }
    }
    throw error;
  }
  
  return session;
};

/**
 * Finds a session between two users
 * Uses sorted participantIds for consistent lookup regardless of parameter order
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Promise<Object|null>} Session document or null
 */
sessionSchema.statics.findByParticipants = async function(userId1, userId2) {
  // Sort participant IDs to ensure consistent lookup
  // This ensures findOne works the same whether called with (userA, userB) or (userB, userA)
  const sortedIds = [userId1, userId2].map(id => id.toString()).sort();
  const session = await this.findOne({ participantIds: sortedIds });
  
  if (session) {
    console.log(`[Session Model] ✓ Found existing session ${session.sessionId} for participants ${sortedIds.join(', ')}`);
  } else {
    console.log(`[Session Model] No session found for participants ${sortedIds.join(', ')}`);
  }
  
  return session;
};

export const Session =
  mongoose.models.Session || mongoose.model('Session', sessionSchema);


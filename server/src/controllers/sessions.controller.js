import { Session } from '../models/Session.js';
import crypto from 'crypto';

/**
 * Get or create a session between two users
 * GET /api/sessions?userId1=xxx&userId2=xxx
 * POST /api/sessions (with body: { userId1, userId2 })
 */
export async function getOrCreateSession(req, res, next) {
  try {
    console.log('[Session API] getOrCreateSession called');
    
    if (!req.user) {
      console.log('[Session API] ✗ Authentication required');
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get user IDs from query params or body
    const userId1 = req.query.userId1 || req.body.userId1;
    const userId2 = req.query.userId2 || req.body.userId2;

    console.log(`[Session API] Request parameters: userId1=${userId1}, userId2=${userId2}`);

    if (!userId1 || !userId2) {
      console.log('[Session API] ✗ Missing required parameters');
      return res.status(400).json({
        success: false,
        error: 'Both userId1 and userId2 are required'
      });
    }

    // Ensure user is one of the participants
    const currentUserId = req.user.id.toString();
    if (currentUserId !== userId1.toString() && currentUserId !== userId2.toString()) {
      console.log(`[Session API] ✗ Forbidden: user ${currentUserId} not a participant`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You can only access sessions you are a participant of'
      });
    }

    // Check if session already exists FIRST (before generating session ID)
    console.log(`[Session API] Checking for existing session between ${userId1} and ${userId2}...`);
    const existingSession = await Session.findByParticipants(userId1, userId2);
    
    if (existingSession) {
      console.log(`[Session API] ✓ EXISTING session found: ${existingSession.sessionId} for users ${userId1} ↔ ${userId2}`);
      console.log(`[Session API] Session created at: ${existingSession.createdAt}, last activity: ${existingSession.lastActivity}`);
      
      // Update last activity
      existingSession.lastActivity = new Date();
      await existingSession.save();
      console.log(`[Session API] ✓ Session lastActivity updated and saved to MongoDB`);
      
      return res.json({
        success: true,
        data: {
          session: {
            sessionId: existingSession.sessionId,
            participants: existingSession.participants,
            createdAt: existingSession.createdAt,
            updatedAt: existingSession.updatedAt,
            lastActivity: existingSession.lastActivity
          },
          isNew: false
        }
      });
    }

    // Generate deterministic session ID (sorted user IDs, no timestamp)
    // This MUST match the frontend logic exactly (see client/src/crypto/sessionIdSecurity.js)
    const sortedIds = [userId1.toString(), userId2.toString()].sort();
    const sessionData = `${sortedIds[0]}:${sortedIds[1]}:session`;
    const sessionId = crypto.createHash('sha256').update(sessionData).digest('hex').substring(0, 32);
    
    console.log(`[Session API] No existing session found - Creating NEW session ${sessionId} for users ${userId1} ↔ ${userId2}`);

    // Create new session (findOrCreate will double-check, but we already checked above)
    const newSession = await Session.findOrCreate(userId1, userId2, sessionId);
    
    // Verify the session was actually created (not found by findOrCreate)
    if (newSession.sessionId === sessionId && newSession.createdAt.getTime() > Date.now() - 5000) {
      console.log(`[Session API] ✓ NEW session created: ${newSession.sessionId} for users ${userId1} ↔ ${userId2}`);
      console.log(`[Session API] ✓ Session saved to MongoDB with participants: ${newSession.participants}`);
    } else {
      console.log(`[Session API] ⚠️ Session ${newSession.sessionId} was found by findOrCreate (race condition handled)`);
    }

    console.log(`[Session API] ✓ Returning session to frontend: ${JSON.stringify({
      sessionId: newSession.sessionId,
      participants: newSession.participants,
      createdAt: newSession.createdAt,
      isNew: true
    })}`);

    res.status(201).json({
      success: true,
      data: {
        session: {
          sessionId: newSession.sessionId,
          participants: newSession.participants,
          createdAt: newSession.createdAt,
          updatedAt: newSession.updatedAt,
          lastActivity: newSession.lastActivity
        },
        isNew: true
      }
    });
  } catch (error) {
    console.error('[Session API] ✗ Error in getOrCreateSession:', error);
    
    // Handle duplicate key error (race condition)
    if (error.code === 11000 || error.name === 'MongoServerError') {
      console.log('[Session API] Handling duplicate key error (race condition)');
      // Session was created by another request, fetch it
      const userId1 = req.query.userId1 || req.body.userId1;
      const userId2 = req.query.userId2 || req.body.userId2;
      const existingSession = await Session.findByParticipants(userId1, userId2);
      
      if (existingSession) {
        console.log(`[Session API] Race condition detected - returning existing session ${existingSession.sessionId}`);
        return res.json({
          success: true,
          data: {
            session: {
              sessionId: existingSession.sessionId,
              participants: existingSession.participants,
              createdAt: existingSession.createdAt,
              updatedAt: existingSession.updatedAt,
              lastActivity: existingSession.lastActivity
            },
            isNew: false
          }
        });
      }
    }
    
    next(error);
  }
}

/**
 * Get all sessions for the current user
 * GET /api/sessions
 */
export async function getUserSessions(req, res, next) {
  try {
    console.log('[Session API] getUserSessions called');
    
    if (!req.user) {
      console.log('[Session API] ✗ Authentication required');
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userId = req.user.id.toString();
    console.log(`[Session API] Fetching sessions for user ${userId}`);

    // Find all sessions where user is a participant
    // Use $in to match if userId is in the participants array
    // Also convert userId to ObjectId for proper matching
    const mongoose = (await import('mongoose')).default;
    const userIdObjectId = new mongoose.Types.ObjectId(userId);
    
    console.log(`[Session API] Querying sessions with participant ${userId} (ObjectId: ${userIdObjectId})`);
    
    const sessions = await Session.find({
      participants: userIdObjectId
    })
      .populate('participants', 'email')
      .sort({ lastActivity: -1 })
      .lean();

    console.log(`[Session API] Found ${sessions.length} sessions for user ${userId}`);

    // Transform sessions to include peer information
    const transformedSessions = sessions.map(session => {
      const peer = session.participants.find(p => p._id.toString() !== userId);
      const transformed = {
        sessionId: session.sessionId,
        peerId: peer?._id?.toString() || null,
        peerEmail: peer?.email || null,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastActivity: session.lastActivity
      };
      console.log(`[Session API] Transformed session ${session.sessionId}: peerId=${transformed.peerId}, peerEmail=${transformed.peerEmail}`);
      return transformed;
    });

    console.log(`[Session API] ✓ Returning ${transformedSessions.length} sessions to frontend`);

    res.json({
      success: true,
      data: {
        sessions: transformedSessions
      }
    });
  } catch (error) {
    console.error('[Session API] ✗ Error in getUserSessions:', error);
    next(error);
  }
}

/**
 * Get a specific session by ID
 * GET /api/sessions/:sessionId
 */
export async function getSessionById(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await Session.findOne({ sessionId })
      .populate('participants', 'email')
      .lean();

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Verify user is a participant
    const isParticipant = session.participants.some(
      p => p._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You are not a participant of this session'
      });
    }

    const peer = session.participants.find(p => p._id.toString() !== userId.toString());

    res.json({
      success: true,
      data: {
        session: {
          sessionId: session.sessionId,
          peerId: peer?._id?.toString() || null,
          peerEmail: peer?.email || null,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          lastActivity: session.lastActivity
        }
      }
    });
  } catch (error) {
    next(error);
  }
}


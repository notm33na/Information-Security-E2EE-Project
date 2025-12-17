/**
 * Replay Attack Simulation Controller
 * 
 * Provides API endpoints to manage and trigger replay attack simulations
 * for educational and demonstration purposes.
 */

import {
  isAttackModeEnabled,
  setAttackMode,
  simulateExactReplay,
  simulateStaleTimestampReplay,
  simulateOutOfOrderSeqReplay,
  simulateDuplicateNonceReplay,
  getAttackStats,
  getCapturedMessages,
  clearCapturedMessages,
  ATTACK_TYPES
} from '../services/replayAttackSimulator.js';

/**
 * Get attack mode status
 * GET /api/replay-attack/status
 */
export async function getAttackStatus(req, res, next) {
  try {
    const stats = getAttackStats();
    res.json({
      success: true,
      data: {
        enabled: stats.enabled,
        stats: {
          capturedMessages: stats.capturedMessages,
          activeAttacks: stats.activeAttacks,
          totalAttacks: stats.totalAttacks
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Enable/disable attack mode
 * POST /api/replay-attack/toggle
 */
export async function toggleAttackMode(req, res, next) {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean' && enabled !== 'true' && enabled !== 'false' && enabled !== '1' && enabled !== '0') {
      return res.status(400).json({
        success: false,
        error: 'Invalid enabled value. Must be boolean or string "true"/"false"'
      });
    }

    const newState = setAttackMode(enabled);
    
    res.json({
      success: true,
      message: `Attack mode ${newState ? 'enabled' : 'disabled'}`,
      data: {
        enabled: newState
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get captured messages for a session
 * GET /api/replay-attack/captured/:sessionId
 * 
 * If sessionId is "all", returns all captured messages across all sessions
 */
export async function getCaptured(req, res, next) {
  try {
    const { sessionId } = req.params;
    
    if (sessionId === 'all') {
      // Return all captured messages
      const allMessages = Array.from(getCapturedMessages(null) || []);
      
      // Group by sessionId
      const grouped = {};
      allMessages.forEach(msg => {
        if (!grouped[msg.sessionId]) {
          grouped[msg.sessionId] = [];
        }
        grouped[msg.sessionId].push({
          messageId: msg.messageId,
          sessionId: msg.sessionId,
          type: msg.type,
          timestamp: msg.timestamp,
          seq: msg.seq,
          capturedAt: msg.capturedAt
        });
      });
      
      return res.json({
        success: true,
        data: {
          sessions: Object.keys(grouped),
          messagesBySession: grouped,
          totalMessages: allMessages.length
        }
      });
    }
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required (or use "all" to get all messages)'
      });
    }

    const messages = getCapturedMessages(sessionId);
    
    res.json({
      success: true,
      data: {
        sessionId,
        messages: messages.map(msg => ({
          messageId: msg.messageId,  // ← Use this in attack simulation endpoints
          sessionId: msg.sessionId,
          type: msg.type,
          timestamp: msg.timestamp,
          seq: msg.seq,
          capturedAt: msg.capturedAt,
          // Helper: Show how messageId is constructed
          messageIdFormat: `${msg.sessionId}:${msg.seq}:${msg.timestamp}`
        })),
        count: messages.length
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Clear captured messages
 * DELETE /api/replay-attack/captured/:sessionId?
 */
export async function clearCaptured(req, res, next) {
  try {
    const { sessionId } = req.params;
    
    clearCapturedMessages(sessionId || null);
    
    res.json({
      success: true,
      message: sessionId 
        ? `Cleared captured messages for session ${sessionId}`
        : 'Cleared all captured messages'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Simulate exact replay attack
 * POST /api/replay-attack/simulate/exact
 */
export async function simulateExact(req, res, next) {
  try {
    if (!isAttackModeEnabled()) {
      return res.status(403).json({
        success: false,
        error: 'Attack mode is disabled. Set REPLAY_ATTACK_MODE=true to enable.'
      });
    }

    const { sessionId, messageId } = req.body;
    
    if (!sessionId || !messageId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and message ID are required'
      });
    }

    const result = await simulateExactReplay(sessionId, messageId, req.user?.id || null);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Simulate stale timestamp replay attack
 * POST /api/replay-attack/simulate/stale-timestamp
 */
export async function simulateStaleTimestamp(req, res, next) {
  try {
    if (!isAttackModeEnabled()) {
      return res.status(403).json({
        success: false,
        error: 'Attack mode is disabled. Set REPLAY_ATTACK_MODE=true to enable.'
      });
    }

    const { sessionId, messageId, ageMinutes } = req.body;
    
    if (!sessionId || !messageId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and message ID are required'
      });
    }

    const result = await simulateStaleTimestampReplay(
      sessionId,
      messageId,
      req.user?.id || null,
      ageMinutes || 3
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Simulate out-of-order sequence replay attack
 * POST /api/replay-attack/simulate/out-of-order-seq
 */
export async function simulateOutOfOrder(req, res, next) {
  try {
    if (!isAttackModeEnabled()) {
      return res.status(403).json({
        success: false,
        error: 'Attack mode is disabled. Set REPLAY_ATTACK_MODE=true to enable.'
      });
    }

    const { sessionId, messageId } = req.body;
    
    if (!sessionId || !messageId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and message ID are required'
      });
    }

    const result = await simulateOutOfOrderSeqReplay(sessionId, messageId, req.user?.id || null);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Simulate duplicate nonce replay attack
 * POST /api/replay-attack/simulate/duplicate-nonce
 */
export async function simulateDuplicateNonce(req, res, next) {
  try {
    if (!isAttackModeEnabled()) {
      return res.status(403).json({
        success: false,
        error: 'Attack mode is disabled. Set REPLAY_ATTACK_MODE=true to enable.'
      });
    }

    const { sessionId, messageId } = req.body;
    
    if (!sessionId || !messageId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID and message ID are required'
      });
    }

    const result = await simulateDuplicateNonceReplay(sessionId, messageId, req.user?.id || null);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get available attack types
 * GET /api/replay-attack/types
 */
export async function getAttackTypes(req, res, next) {
  try {
    res.json({
      success: true,
      data: {
        attackTypes: Object.entries(ATTACK_TYPES).map(([key, value]) => ({
          key,
          value,
          description: getAttackTypeDescription(value)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper function to get attack type descriptions
 */
function getAttackTypeDescription(type) {
  const descriptions = {
    [ATTACK_TYPES.EXACT_REPLAY]: 'Replay the exact same message (same nonce, timestamp, sequence)',
    [ATTACK_TYPES.STALE_TIMESTAMP]: 'Replay message with an old timestamp (outside validity window)',
    [ATTACK_TYPES.DUPLICATE_NONCE]: 'Replay message with the same nonce (nonce uniqueness violation)',
    [ATTACK_TYPES.OUT_OF_ORDER_SEQ]: 'Replay message with old sequence number (sequence monotonicity violation)',
    [ATTACK_TYPES.FUTURE_TIMESTAMP]: 'Replay message with future timestamp (clock skew protection)'
  };
  return descriptions[type] || 'Unknown attack type';
}

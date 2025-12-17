/**
 * Backend Replay Attack Simulator
 * 
 * EDUCATIONAL PURPOSE ONLY - Simulates replay attacks from the backend
 * to demonstrate replay protection mechanisms.
 * 
 * SECURITY CONSIDERATIONS:
 * - Only runs when REPLAY_ATTACK_MODE environment variable is enabled
 * - Never breaks E2EE - only simulates attacks on metadata
 * - All attack attempts are logged for analysis
 * - Does not modify or decrypt actual message content
 * 
 * DATA PRIVACY CONSTRAINTS:
 * - No plaintext content is logged
 * - Only metadata (sessionId, seq, timestamp, nonce) is used
 * - Attack logs contain only attack flow information
 */

import { MessageMeta } from '../models/MessageMeta.js';
import { logReplayAttempt, logEvent } from '../utils/attackLogging.js';
import { hashNonceBase64, validateTimestamp, generateMessageId } from '../utils/replayProtection.js';
import { SecurityLog } from '../models/SecurityLog.js';

/**
 * Attack mode configuration
 * Set REPLAY_ATTACK_MODE=true in environment to enable
 */
const ATTACK_MODE_ENABLED = process.env.REPLAY_ATTACK_MODE === 'true' || process.env.REPLAY_ATTACK_MODE === '1';

/**
 * Attack simulation state
 */
const attackState = {
  enabled: ATTACK_MODE_ENABLED,
  activeAttacks: new Map(), // sessionId -> attack info
  capturedMessages: new Map(), // messageId -> envelope
  attackCounter: 0
};

/**
 * Attack types
 */
export const ATTACK_TYPES = {
  EXACT_REPLAY: 'EXACT_REPLAY',           // Replay exact message
  STALE_TIMESTAMP: 'STALE_TIMESTAMP',      // Replay with old timestamp
  DUPLICATE_NONCE: 'DUPLICATE_NONCE',      // Replay with same nonce
  OUT_OF_ORDER_SEQ: 'OUT_OF_ORDER_SEQ',    // Replay with old sequence
  FUTURE_TIMESTAMP: 'FUTURE_TIMESTAMP'     // Replay with future timestamp
};

/**
 * Step-by-step attack flow logger
 */
class AttackFlowLogger {
  constructor(sessionId, attackId, attackType) {
    this.sessionId = sessionId;
    this.attackId = attackId;
    this.attackType = attackType;
    this.steps = [];
    this.startTime = Date.now();
  }

  logStep(step, description, data = {}) {
    const stepEntry = {
      step,
      description,
      timestamp: new Date().toISOString(),
      elapsed: Date.now() - this.startTime,
      ...data
    };
    this.steps.push(stepEntry);
    
    console.log(`[REPLAY_ATTACK] [${this.attackId}] Step ${step}: ${description}`, data);
    return stepEntry;
  }

  async finalize(result) {
    const flow = {
      attackId: this.attackId,
      sessionId: this.sessionId,
      attackType: this.attackType,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      steps: this.steps,
      result: {
        success: result.success || false,
        blocked: result.blocked || false,
        reason: result.reason || null,
        protection: result.protection || null
      }
    };

    // Store in MongoDB Atlas
    try {
      await SecurityLog.create({
        eventType: 'REPLAY_ATTEMPT',
        sessionId: this.sessionId,
        success: false,
        reason: `Simulated ${this.attackType} attack`,
        metadata: {
          attackId: this.attackId,
          attackType: this.attackType,
          flow: flow,
          isSimulation: true
        }
      });
    } catch (error) {
      console.error('Failed to store attack flow in MongoDB:', error);
    }

    // Log to local file (use REPLAY_ATTEMPT for MongoDB compatibility)
    await logEvent(
      'REPLAY_ATTEMPT',
      this.sessionId,
      null,
      `Attack flow completed: ${this.attackType}`,
      flow
    );

    return flow;
  }
}

/**
 * Checks if attack mode is enabled
 */
export function isAttackModeEnabled() {
  return attackState.enabled;
}

/**
 * Enables or disables attack mode
 */
export function setAttackMode(enabled) {
  attackState.enabled = enabled === true || enabled === 'true' || enabled === '1';
  console.log(`[REPLAY_ATTACK] Attack mode ${attackState.enabled ? 'ENABLED' : 'DISABLED'}`);
  return attackState.enabled;
}

/**
 * Captures a message for potential replay attack
 */
export async function captureMessage(envelope, userId) {
  if (!attackState.enabled) {
    return null;
  }

  try {
    const messageId = generateMessageId(envelope.sessionId, envelope.seq, envelope.timestamp);
    
    // Store captured message (only metadata, no plaintext)
    const captured = {
      messageId,
      sessionId: envelope.sessionId,
      sender: envelope.sender,
      receiver: envelope.receiver,
      type: envelope.type,
      timestamp: envelope.timestamp,
      seq: envelope.seq,
      nonce: envelope.nonce,
      nonceHash: envelope.nonce ? hashNonceBase64(envelope.nonce) : null,
      capturedAt: Date.now(),
      capturedBy: userId
    };

    attackState.capturedMessages.set(messageId, captured);

    // Log capture
    await logEvent(
      'REPLAY_ATTACK_CAPTURE',
      envelope.sessionId,
      userId,
      `Message captured for replay simulation`,
      {
        messageId,
        seq: envelope.seq,
        timestamp: envelope.timestamp,
        type: envelope.type
      }
    );

    return messageId;
  } catch (error) {
    console.error('[REPLAY_ATTACK] Error capturing message:', error);
    return null;
  }
}

/**
 * Simulates an exact replay attack
 */
export async function simulateExactReplay(sessionId, messageId, userId) {
  if (!attackState.enabled) {
    throw new Error('Attack mode is disabled');
  }

  const captured = attackState.capturedMessages.get(messageId);
  if (!captured) {
    throw new Error(`Message ${messageId} not found in captured messages`);
  }

  const attackId = `ATTACK-${++attackState.attackCounter}-${Date.now()}`;
  const logger = new AttackFlowLogger(sessionId, attackId, ATTACK_TYPES.EXACT_REPLAY);

  try {
    logger.logStep(1, 'Attack initiated: Exact replay', { messageId, sessionId });
    
    // Step 2: Retrieve original message metadata
    logger.logStep(2, 'Retrieving original message metadata from database');
    const originalMeta = await MessageMeta.findOne({ messageId });
    if (!originalMeta) {
      throw new Error('Original message metadata not found');
    }

    logger.logStep(3, 'Original message metadata retrieved', {
      seq: originalMeta.seq,
      timestamp: originalMeta.timestamp,
      nonceHash: originalMeta.nonceHash ? 'present' : 'missing'
    });

    // Step 3: Check if nonce hash already exists (replay protection)
    logger.logStep(4, 'Checking nonce hash uniqueness');
    const nonceExists = await MessageMeta.findOne({
      sessionId: captured.sessionId,
      nonceHash: captured.nonceHash
    });

    if (nonceExists) {
      logger.logStep(5, 'Replay detected: Duplicate nonce hash found', {
        existingMessageId: nonceExists.messageId,
        existingSeq: nonceExists.seq
      });

      // Log the replay attempt
      logReplayAttempt(
        captured.sessionId,
        userId,
        captured.seq,
        captured.timestamp,
        'REPLAY_SIMULATION: Duplicate nonce detected (exact replay)'
      );

      const result = {
        success: false,
        blocked: true,
        reason: 'Duplicate nonce detected',
        protection: 'NONCE_UNIQUENESS'
      };

      logger.logStep(6, 'Attack blocked by nonce uniqueness check', result);
      const flow = await logger.finalize(result);
      return { ...result, flow, attackId };
    }

    // Step 4: Check timestamp freshness
    logger.logStep(5, 'Checking timestamp freshness');
    const timestampValid = validateTimestamp(captured.timestamp);
    if (!timestampValid) {
      logger.logStep(6, 'Replay detected: Timestamp out of validity window', {
        messageAge: Date.now() - captured.timestamp,
        maxAge: 120000
      });

      logReplayAttempt(
        captured.sessionId,
        userId,
        captured.seq,
        captured.timestamp,
        'REPLAY_SIMULATION: Timestamp out of validity window (exact replay)'
      );

      const result = {
        success: false,
        blocked: true,
        reason: 'Timestamp out of validity window',
        protection: 'TIMESTAMP_FRESHNESS'
      };

      logger.logStep(7, 'Attack blocked by timestamp freshness check', result);
      const flow = await logger.finalize(result);
      return { ...result, flow, attackId };
    }

    // Step 5: Check sequence number
    logger.logStep(6, 'Checking sequence number monotonicity');
    const latestMessage = await MessageMeta.findOne({ sessionId: captured.sessionId })
      .sort({ seq: -1 })
      .limit(1);

    if (latestMessage && captured.seq <= latestMessage.seq) {
      logger.logStep(7, 'Replay detected: Sequence number violation', {
        capturedSeq: captured.seq,
        latestSeq: latestMessage.seq
      });

      logReplayAttempt(
        captured.sessionId,
        userId,
        captured.seq,
        captured.timestamp,
        'REPLAY_SIMULATION: Sequence number must be strictly increasing (exact replay)'
      );

      const result = {
        success: false,
        blocked: true,
        reason: 'Sequence number must be strictly increasing',
        protection: 'SEQUENCE_MONOTONICITY'
      };

      logger.logStep(8, 'Attack blocked by sequence monotonicity check', result);
      const flow = await logger.finalize(result);
      return { ...result, flow, attackId };
    }

    // If we get here, the attack would succeed (but we don't actually replay)
    logger.logStep(7, 'Attack would succeed (not actually executed for security)', {
      note: 'This is a simulation - actual replay is not performed'
    });

    const result = {
      success: true,
      blocked: false,
      reason: 'Attack would succeed (simulation only)',
      protection: null
    };

    const flow = await logger.finalize(result);
    return { ...result, flow, attackId };

  } catch (error) {
    logger.logStep('ERROR', 'Attack simulation error', { error: error.message });
    const flow = await logger.finalize({
      success: false,
      blocked: false,
      reason: `Simulation error: ${error.message}`,
      protection: null
    });
    throw error;
  }
}

/**
 * Simulates a stale timestamp replay attack
 */
export async function simulateStaleTimestampReplay(sessionId, messageId, userId, ageMinutes = 3) {
  if (!attackState.enabled) {
    throw new Error('Attack mode is disabled');
  }

  const captured = attackState.capturedMessages.get(messageId);
  if (!captured) {
    throw new Error(`Message ${messageId} not found in captured messages`);
  }

  const attackId = `ATTACK-${++attackState.attackCounter}-${Date.now()}`;
  const logger = new AttackFlowLogger(sessionId, attackId, ATTACK_TYPES.STALE_TIMESTAMP);

  try {
    logger.logStep(1, 'Attack initiated: Stale timestamp replay', {
      messageId,
      sessionId,
      ageMinutes
    });

    // Create modified envelope with stale timestamp
    const staleTimestamp = Date.now() - (ageMinutes * 60 * 1000);
    logger.logStep(2, 'Modified timestamp to be stale', {
      originalTimestamp: captured.timestamp,
      staleTimestamp,
      age: Date.now() - staleTimestamp
    });

    // Check timestamp freshness
    logger.logStep(3, 'Checking timestamp freshness with stale timestamp');
    const timestampValid = validateTimestamp(staleTimestamp);
    
    if (!timestampValid) {
      logger.logStep(4, 'Replay detected: Stale timestamp rejected', {
        messageAge: Date.now() - staleTimestamp,
        maxAge: 120000
      });

      logReplayAttempt(
        captured.sessionId,
        userId,
        captured.seq,
        staleTimestamp,
        `REPLAY_SIMULATION: Timestamp out of validity window (stale timestamp: ${ageMinutes} minutes old)`
      );

      const result = {
        success: false,
        blocked: true,
        reason: 'Timestamp out of validity window',
        protection: 'TIMESTAMP_FRESHNESS'
      };

      logger.logStep(5, 'Attack blocked by timestamp freshness check', result);
      const flow = await logger.finalize(result);
      return { ...result, flow, attackId };
    }

    // If timestamp is valid (shouldn't happen for stale timestamp)
    logger.logStep(4, 'Warning: Stale timestamp was accepted (unexpected)', {
      note: 'This should not happen with proper timestamp validation'
    });

    const result = {
      success: true,
      blocked: false,
      reason: 'Stale timestamp was accepted (unexpected)',
      protection: null
    };

    const flow = await logger.finalize(result);
    return { ...result, flow, attackId };

  } catch (error) {
    logger.logStep('ERROR', 'Attack simulation error', { error: error.message });
    const flow = await logger.finalize({
      success: false,
      blocked: false,
      reason: `Simulation error: ${error.message}`,
      protection: null
    });
    throw error;
  }
}

/**
 * Simulates an out-of-order sequence replay attack
 */
export async function simulateOutOfOrderSeqReplay(sessionId, messageId, userId) {
  if (!attackState.enabled) {
    throw new Error('Attack mode is disabled');
  }

  const captured = attackState.capturedMessages.get(messageId);
  if (!captured) {
    throw new Error(`Message ${messageId} not found in captured messages`);
  }

  const attackId = `ATTACK-${++attackState.attackCounter}-${Date.now()}`;
  const logger = new AttackFlowLogger(sessionId, attackId, ATTACK_TYPES.OUT_OF_ORDER_SEQ);

  try {
    logger.logStep(1, 'Attack initiated: Out-of-order sequence replay', { messageId, sessionId });

    // Get current sequence number
    logger.logStep(2, 'Retrieving current sequence number for session');
    const latestMessage = await MessageMeta.findOne({ sessionId })
      .sort({ seq: -1 })
      .limit(1);

    const currentSeq = latestMessage ? latestMessage.seq : 0;
    logger.logStep(3, 'Current sequence number retrieved', {
      currentSeq,
      capturedSeq: captured.seq
    });

    // Check if captured sequence is less than or equal to current
    if (captured.seq <= currentSeq) {
      logger.logStep(4, 'Replay detected: Sequence number violation', {
        capturedSeq: captured.seq,
        currentSeq,
        violation: 'seq must be strictly increasing'
      });

      logReplayAttempt(
        captured.sessionId,
        userId,
        captured.seq,
        captured.timestamp,
        `REPLAY_SIMULATION: Sequence number must be strictly increasing (out-of-order replay: ${captured.seq} <= ${currentSeq})`
      );

      const result = {
        success: false,
        blocked: true,
        reason: 'Sequence number must be strictly increasing',
        protection: 'SEQUENCE_MONOTONICITY'
      };

      logger.logStep(5, 'Attack blocked by sequence monotonicity check', result);
      const flow = await logger.finalize(result);
      return { ...result, flow, attackId };
    }

    // If sequence is valid (shouldn't happen for out-of-order)
    logger.logStep(4, 'Warning: Out-of-order sequence was accepted (unexpected)', {
      note: 'This should not happen with proper sequence validation'
    });

    const result = {
      success: true,
      blocked: false,
      reason: 'Out-of-order sequence was accepted (unexpected)',
      protection: null
    };

    const flow = await logger.finalize(result);
    return { ...result, flow, attackId };

  } catch (error) {
    logger.logStep('ERROR', 'Attack simulation error', { error: error.message });
    const flow = await logger.finalize({
      success: false,
      blocked: false,
      reason: `Simulation error: ${error.message}`,
      protection: null
    });
    throw error;
  }
}

/**
 * Simulates a duplicate nonce replay attack
 */
export async function simulateDuplicateNonceReplay(sessionId, messageId, userId) {
  if (!attackState.enabled) {
    throw new Error('Attack mode is disabled');
  }

  const captured = attackState.capturedMessages.get(messageId);
  if (!captured) {
    throw new Error(`Message ${messageId} not found in captured messages`);
  }

  const attackId = `ATTACK-${++attackState.attackCounter}-${Date.now()}`;
  const logger = new AttackFlowLogger(sessionId, attackId, ATTACK_TYPES.DUPLICATE_NONCE);

  try {
    logger.logStep(1, 'Attack initiated: Duplicate nonce replay', { messageId, sessionId });

    // Check if nonce hash already exists
    logger.logStep(2, 'Checking nonce hash uniqueness');
    const nonceExists = await MessageMeta.findOne({
      sessionId: captured.sessionId,
      nonceHash: captured.nonceHash
    });

    if (nonceExists) {
      logger.logStep(3, 'Replay detected: Duplicate nonce hash found', {
        existingMessageId: nonceExists.messageId,
        existingSeq: nonceExists.seq,
        capturedSeq: captured.seq
      });

      logReplayAttempt(
        captured.sessionId,
        userId,
        captured.seq,
        captured.timestamp,
        'REPLAY_SIMULATION: Duplicate nonce detected (duplicate nonce replay)'
      );

      const result = {
        success: false,
        blocked: true,
        reason: 'Duplicate nonce detected',
        protection: 'NONCE_UNIQUENESS'
      };

      logger.logStep(4, 'Attack blocked by nonce uniqueness check', result);
      const flow = await logger.finalize(result);
      return { ...result, flow, attackId };
    }

    // If nonce doesn't exist (shouldn't happen for duplicate)
    logger.logStep(3, 'Warning: Duplicate nonce was accepted (unexpected)', {
      note: 'This should not happen with proper nonce validation'
    });

    const result = {
      success: true,
      blocked: false,
      reason: 'Duplicate nonce was accepted (unexpected)',
      protection: null
    };

    const flow = await logger.finalize(result);
    return { ...result, flow, attackId };

  } catch (error) {
    logger.logStep('ERROR', 'Attack simulation error', { error: error.message });
    const flow = await logger.finalize({
      success: false,
      blocked: false,
      reason: `Simulation error: ${error.message}`,
      protection: null
    });
    throw error;
  }
}

/**
 * Gets attack statistics
 */
export function getAttackStats() {
  return {
    enabled: attackState.enabled,
    capturedMessages: attackState.capturedMessages.size,
    activeAttacks: attackState.activeAttacks.size,
    totalAttacks: attackState.attackCounter
  };
}

/**
 * Gets captured messages for a session
 * @param {string|null} sessionId - Session ID to filter by, or null for all messages
 * @returns {Array} Array of captured messages
 */
export function getCapturedMessages(sessionId) {
  const allMessages = Array.from(attackState.capturedMessages.values());
  if (sessionId === null || sessionId === undefined) {
    return allMessages;
  }
  return allMessages.filter(msg => msg.sessionId === sessionId);
}

/**
 * Clears captured messages
 */
export function clearCapturedMessages(sessionId = null) {
  if (sessionId) {
    for (const [messageId, msg] of attackState.capturedMessages.entries()) {
      if (msg.sessionId === sessionId) {
        attackState.capturedMessages.delete(messageId);
      }
    }
  } else {
    attackState.capturedMessages.clear();
  }
}

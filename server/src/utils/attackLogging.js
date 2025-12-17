/**
 * Attack Detection Logging
 * 
 * Comprehensive logging for attack simulations and detection.
 * 
 * SECURITY CONSIDERATIONS:
 * - Logs never contain plaintext or private keys
 * - Only metadata and attack indicators are logged
 * - Logs are for audit and educational purposes
 * 
 * DATA PRIVACY CONSTRAINTS:
 * - User IDs logged for audit trail
 * - Session IDs logged
 * - Attack type and outcome logged
 * - No sensitive data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeProtectedLog } from './logIntegrity.js';
import { recordReplayAttempt, recordSignatureFailure } from './alerting.js';
import { SecurityLog } from '../models/SecurityLog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base logs directory getter.
// In tests, this is driven by TEST_LOGS_DIR to ensure suite-specific isolation.
function getBaseLogsDir() {
  const dir = process.env.TEST_LOGS_DIR || path.join(__dirname, '../../logs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Logs an event to a file
 * @param {string} filename - Log filename
 * @param {Object} event - Event data
 */
function resolveLogPath(filename) {
  const prefix = process.env.LOG_PREFIX || '';
  const effectiveName = prefix ? `${prefix}_${filename}` : filename;
  const baseDir = getBaseLogsDir();
  return path.join(baseDir, effectiveName);
}

function writeLog(filename, event) {
  // Use protected logging with HMAC integrity
  writeProtectedLog(filename, event);
}

/**
 * Stores a security log entry in MongoDB Atlas
 * @param {Object} logData - Log entry data
 */
async function storeLogInMongoDB(logData) {
  try {
    // Convert userId strings to ObjectId if needed
    const userId = logData.userId ? (typeof logData.userId === 'string' ? logData.userId : logData.userId.toString()) : null;
    const fromUserId = logData.fromUserId ? (typeof logData.fromUserId === 'string' ? logData.fromUserId : logData.fromUserId.toString()) : null;
    const toUserId = logData.toUserId ? (typeof logData.toUserId === 'string' ? logData.toUserId : logData.toUserId.toString()) : null;

    await SecurityLog.create({
      eventType: logData.eventType,
      userId: userId || null,
      sessionId: logData.sessionId || null,
      success: logData.success !== undefined ? logData.success : null,
      reason: logData.reason || null,
      fromUserId: fromUserId || null,
      toUserId: toUserId || null,
      messageType: logData.messageType || null,
      seq: logData.seq !== undefined ? logData.seq : null,
      timestamp: logData.timestamp !== undefined ? logData.timestamp : null,
      action: logData.action || null,
      ip: logData.ip || null,
      metadata: logData.metadata || {}
    });
  } catch (error) {
    // Don't fail the application if MongoDB logging fails
    // Log to console for debugging
    console.error('Failed to store security log in MongoDB:', error.message);
  }
}

/**
 * Logs a replay attack attempt
 * @param {string} sessionId - Session identifier
 * @param {string} userId - User ID
 * @param {number} seq - Sequence number
 * @param {number} timestamp - Message timestamp
 * @param {string} reason - Rejection reason
 */
export function logReplayAttempt(sessionId, userId, seq, timestamp, reason, ip = null) {
  const logEntry = {
    eventType: 'REPLAY_ATTEMPT',
    sessionId,
    userId,
    seq,
    timestamp,
    reason,
    action: 'REJECTED',
    ip
  };

  // Store in file (backward compatibility)
  writeLog('replay_attempts.log', logEntry);

  // Store in MongoDB Atlas
  storeLogInMongoDB(logEntry);

  // Record for alerting (if IP available)
  if (ip) {
    recordReplayAttempt(sessionId, ip, reason);
  }
}

/**
 * Logs an invalid signature detection
 * @param {string} sessionId - Session identifier
 * @param {string} userId - User ID
 * @param {string} messageType - Type of message (KEP_INIT, KEP_RESPONSE, KEY_UPDATE)
 * @param {string} reason - Failure reason
 */
export function logInvalidSignature(sessionId, userId, messageType, reason) {
  const logEntry = {
    eventType: 'INVALID_SIGNATURE',
    sessionId,
    userId,
    messageType,
    reason,
    action: 'REJECTED'
  };

  // Store in file (backward compatibility)
  writeLog('invalid_signature.log', logEntry);

  // Store in MongoDB Atlas
  storeLogInMongoDB(logEntry);

  // Record for alerting
  if (userId) {
    recordSignatureFailure(userId, sessionId, messageType, reason);
  }
}

/**
 * Logs a key exchange attempt
 * @param {string} sessionId - Session identifier
 * @param {string} fromUserId - Initiator user ID
 * @param {string} toUserId - Recipient user ID
 * @param {string} messageType - KEP_INIT or KEP_RESPONSE
 * @param {boolean} success - Whether exchange succeeded
 */
export function logKeyExchangeAttempt(sessionId, fromUserId, toUserId, messageType, success) {
  const logEntry = {
    eventType: 'KEY_EXCHANGE',
    sessionId,
    fromUserId,
    toUserId,
    messageType,
    success,
    action: success ? 'ACCEPTED' : 'REJECTED'
  };

  // Store in file (backward compatibility)
  writeLog('key_exchange_attempts.log', logEntry);

  // Store in MongoDB Atlas
  storeLogInMongoDB(logEntry);
}

/**
 * Logs authentication attempt
 * @param {string} userId - User ID
 * @param {boolean} success - Whether authentication succeeded
 * @param {string} reason - Success/failure reason
 */
export function logAuthenticationAttempt(userId, success, reason, ip = null) {
  const logEntry = {
    eventType: 'AUTH_ATTEMPT',
    userId,
    success,
    reason,
    action: success ? 'ACCEPTED' : 'REJECTED',
    ip
  };

  // Store in file (backward compatibility)
  writeLog('authentication_attempts.log', logEntry);

  // Store in MongoDB Atlas
  storeLogInMongoDB(logEntry);
}

/**
 * Logs failed message decryption
 * @param {string} sessionId - Session identifier
 * @param {string} userId - User ID
 * @param {number} seq - Sequence number
 * @param {string} reason - Failure reason
 */
export function logFailedDecryption(sessionId, userId, seq, reason, ip = null) {
  const logEntry = {
    eventType: 'DECRYPTION_FAILED',
    sessionId,
    userId,
    seq,
    reason,
    action: 'REJECTED',
    ip
  };

  // Store in file (backward compatibility)
  writeLog('failed_decryption.log', logEntry);

  // Store in MongoDB Atlas
  storeLogInMongoDB(logEntry);
}

/**
 * Logs an invalid KEP message (structure / signature issues)
 * This is used by MITM and logging tests to verify that
 * invalid KEP messages are persisted to a dedicated log.
 *
 * @param {string} sessionId - Session identifier
 * @param {string} userId - User ID associated with the KEP message
 * @param {string} reason - Reason for rejection
 */
export function logInvalidKEPMessage(sessionId, userId, reason) {
  const logEntry = {
    eventType: 'INVALID_KEP_MESSAGE',
    // Lowercase type field so tests that search for "invalid_kep_message"
    // as a substring can still find this entry while keeping eventType
    // in a normalized, uppercase form.
    type: 'invalid_kep_message',
    sessionId,
    userId,
    reason,
    action: 'REJECTED',
    metadata: { type: 'invalid_kep_message' }
  };

  // Store in file (backward compatibility)
  writeLog('invalid_kep_message.log', logEntry);

  // Store in MongoDB Atlas
  storeLogInMongoDB(logEntry);
}

/**
 * Logs metadata access
 * @param {string} sessionId - Session identifier
 * @param {string} userId - User ID accessing metadata
 * @param {string} action - Action type (READ, WRITE, DELETE)
 */
export function logMetadataAccess(sessionId, userId, action, metadata = {}) {
  const logEntry = {
    eventType: 'METADATA_ACCESS',
    sessionId,
    userId,
    action,
    timestamp: Date.now(),
    metadata
  };

  // Store in file (backward compatibility)
  writeLog('message_metadata_access.log', logEntry);

  // Store in MongoDB Atlas
  storeLogInMongoDB(logEntry);
}

/**
 * Generic event logger
 * @param {string} eventType - Event type
 * @param {string} sessionId - Session identifier (optional)
 * @param {string} userId - User ID (optional)
 * @param {string} description - Event description
 * @param {Object} metadata - Additional metadata
 */
export function logEvent(eventType, sessionId, userId, description, metadata = {}) {
  const logEntry = {
    eventType,
    sessionId: sessionId || null,
    userId: userId || null,
    description,
    ...metadata,
    timestamp: new Date().toISOString(),
    metadata: { ...metadata, description }
  };

  // Route to appropriate log file based on event type
  if (eventType.includes('REPLAY')) {
    writeLog('replay_attempts.log', logEntry);
  } else if (eventType.includes('SIGNATURE')) {
    writeLog('invalid_signature.log', logEntry);
  } else if (eventType.includes('KEY_EXCHANGE')) {
    writeLog('key_exchange_attempts.log', logEntry);
  } else if (eventType.includes('AUTH')) {
    writeLog('authentication_attempts.log', logEntry);
  } else if (eventType.includes('DECRYPTION')) {
    writeLog('failed_decryption.log', logEntry);
  } else if (eventType.includes('METADATA')) {
    writeLog('message_metadata_access.log', logEntry);
  } else {
    // Default to general log
    writeLog('general_events.log', logEntry);
  }

  // Store in MongoDB Atlas
  storeLogInMongoDB(logEntry);
}


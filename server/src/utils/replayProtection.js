import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { logReplayAttempt as coreLogReplayAttempt, logInvalidSignature as coreLogInvalidSignature, logInvalidKEPMessage as coreLogInvalidKEPMessage } from './attackLogging.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep a LOGS_DIR constant aligned with the shared test logs directory,
// even though primary logging is delegated to attackLogging utilities.
// Path resolution: src/utils -> ../ (src) -> ../ (server) -> logs
const LOGS_DIR =
  process.env.TEST_LOGS_DIR || path.join(__dirname, '../../logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Logs replay attempt (legacy wrapper)
 *
 * NOTE: Core logging is delegated to attackLogging.logReplayAttempt
 * to ensure a single, consistent log format across the codebase.
 *
 * @param {string} sessionId - Session identifier
 * @param {number} seq - Sequence number
 * @param {number} timestamp - Message timestamp
 * @param {string} reason - Reason for rejection
 */
export function logReplayAttempt(sessionId, seq, timestamp, reason, ip = null) {
  // Delegate to core logger, which also records the userId/action.
  // We pass null for userId to preserve the original interface.
  coreLogReplayAttempt(sessionId, null, seq, timestamp, reason, ip);
}

/**
 * Logs invalid signature (legacy wrapper)
 *
 * @param {string} userId - User ID
 * @param {string} sessionId - Session identifier
 * @param {string} reason - Reason for rejection
 */
export function logInvalidSignature(userId, sessionId, reason) {
  coreLogInvalidSignature(sessionId, userId, 'KEP', reason);
}

/**
 * Logs invalid KEP message (legacy wrapper)
 *
 * @param {string} userId - User ID
 * @param {string} sessionId - Session identifier
 * @param {string} reason - Reason for rejection
 */
export function logInvalidKEPMessage(userId, sessionId, reason) {
  coreLogInvalidKEPMessage(sessionId, userId, reason);
}

// Server clock sync tracking (for timestamp validation)
let serverClockOffset = 0; // Offset in milliseconds
const MAX_CLOCK_SKEW = 60000; // 1 minute maximum allowed clock skew

/**
 * Updates server clock offset (call periodically with NTP or trusted time source)
 * @param {number} offset - Clock offset in milliseconds
 */
export function updateClockOffset(offset) {
  serverClockOffset = offset;
}

/**
 * Validates timestamp freshness with improved clock skew detection
 * @param {number} messageTimestamp - Message timestamp
 * @param {number} maxAge - Maximum age in milliseconds (default: 2 minutes)
 * @returns {boolean} True if timestamp is valid
 */
export function validateTimestamp(messageTimestamp, maxAge = 120000) {
  const now = Date.now() + serverClockOffset; // Adjust for clock skew
  const age = now - messageTimestamp;
  
  // Stricter validation: reject if too far in future (more than maxAge + clock skew tolerance)
  if (age < -(maxAge + MAX_CLOCK_SKEW)) {
    return false; // Message from too far in future
  }
  
  // Reject if too far in future (beyond maxAge window)
  if (age < -maxAge) {
    return false; // Message from future beyond acceptable window
  }
  
  // Reject if too old
  if (age > maxAge) {
    return false;
  }
  
  return true;
}

/**
 * Generates unique message ID
 * @param {string} sessionId - Session identifier
 * @param {number} seq - Sequence number
 * @param {number} timestamp - Message timestamp (optional, defaults to current time)
 * @returns {string} Message ID
 */
export function generateMessageId(sessionId, seq, timestamp = null) {
  const ts = timestamp || Date.now();
  return `${sessionId}:${seq}:${ts}`;
}

/**
 * Validates nonce format and length, then returns SHA-256(nonce) as hex string.
 * Nonce must be a base64-encoded value whose decoded length is between 12 and 32 bytes.
 * @param {string} nonceBase64 - Base64-encoded nonce
 * @param {number} minLength - Minimum allowed length in bytes (default: 12)
 * @param {number} maxLength - Maximum allowed length in bytes (default: 32)
 * @returns {string} Hex-encoded SHA-256 nonce hash
 */
export function hashNonceBase64(nonceBase64, minLength = 12, maxLength = 32) {
  if (!nonceBase64 || typeof nonceBase64 !== 'string') {
    throw new Error('Nonce is required');
  }

  const nonceBuffer = Buffer.from(nonceBase64, 'base64');

  if (nonceBuffer.length < minLength || nonceBuffer.length > maxLength) {
    throw new Error(
      `Invalid nonce length: ${nonceBuffer.length} (expected ${minLength}-${maxLength} bytes)`
    );
  }

  return crypto.createHash('sha256').update(nonceBuffer).digest('hex');
}

/**
 * Checks if a nonce hash has already been used in a session (server-side replay protection)
 * @param {string} sessionId - Session identifier
 * @param {string} nonceHash - Hex-encoded SHA-256 hash of the nonce
 * @param {Object} MessageMetaModel - Mongoose model for MessageMeta
 * @returns {Promise<boolean>} True if nonce hash has been seen before in this session
 */
export async function isNonceHashUsed(sessionId, nonceHash, MessageMetaModel) {
  if (!sessionId || !nonceHash || !MessageMetaModel) {
    throw new Error('sessionId, nonceHash, and MessageMetaModel are required');
  }

  try {
    const existing = await MessageMetaModel.findOne({
      sessionId: sessionId,
      nonceHash: nonceHash
    });

    return !!existing;
  } catch (error) {
    // If database query fails, assume nonce is not used to avoid blocking legitimate messages
    // Log the error for investigation
    console.error('Error checking nonce hash uniqueness:', error);
    return false;
  }
}


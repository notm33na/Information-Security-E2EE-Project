/**
 * Message Flow
 * 
 * Handles sending and receiving encrypted messages using session keys
 * from Phase 3. Includes replay protection and integrity checking.
 */

import { getSendKey, getRecvKey, updateSessionSeq, loadSession, triggerReplayDetection, triggerInvalidSignature, isNonceUsed, storeUsedNonce } from './sessionManager.js';
import { encryptAESGCM, decryptAESGCM, decryptAESGCMToString } from './aesGcm.js';
import { buildTextMessageEnvelope } from './messageEnvelope.js';
import { validateEnvelopeStructure } from './messageEnvelope.js';
import { base64ToArrayBuffer } from './signatures.js';
import { sequenceManager, generateTimestamp } from './messages.js';
import { clearPlaintextAfterEncryption, clearPlaintextAfterDecryption } from './memorySecurity.js';
import { logReplayAttempt, logTimestampFailure, logSeqMismatch, logDecryptionError, logMessageDropped } from '../utils/clientLogger.js';

/**
 * Validates timestamp freshness
 * @param {number} messageTimestamp - Message timestamp
 * @param {number} maxAge - Maximum age in milliseconds (default: 2 minutes)
 * @returns {boolean} True if timestamp is valid
 */
function validateTimestamp(messageTimestamp, maxAge = 120000) {
  const now = Date.now();
  const age = now - messageTimestamp;
  return age <= maxAge && age >= -maxAge;
}

/**
 * Computes SHA-256 hash of a nonce (ArrayBuffer) and returns hex string.
 * @param {ArrayBuffer} nonceBuffer - Raw nonce bytes
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
async function hashNonce(nonceBuffer) {
  const nonceBytes = new Uint8Array(nonceBuffer);
  const digest = await crypto.subtle.digest('SHA-256', nonceBytes);
  const hashBytes = new Uint8Array(digest);
  let hex = '';
  for (const b of hashBytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Sends an encrypted text message
 * @param {string} sessionId - Session identifier
 * @param {string} plaintext - Message text to encrypt and send
 * @param {Function} socketEmit - Socket.IO emit function
 * @returns {Promise<Object>} Sent envelope
 */
export async function sendEncryptedMessage(sessionId, plaintext, socketEmit, userId = null) {
  try {
    // 1. Load session (with userId for encrypted key access)
    const session = await loadSession(sessionId, userId);
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Use userId from session if not provided
    if (!userId) {
      userId = session.userId;
    }
    
    // 2. Get send key
    const sendKey = await getSendKey(sessionId, userId);

    // 3. Encrypt plaintext with sendKey
    const { ciphertext, iv, authTag } = await encryptAESGCM(sendKey, plaintext);

    // 3.5. Clear plaintext from memory after encryption
    if (plaintext instanceof ArrayBuffer) {
      clearPlaintextAfterEncryption(plaintext);
    } else if (typeof plaintext === 'string') {
      // String is immutable, but we can clear any buffer representation
      clearPlaintextAfterEncryption(plaintext);
    }

    // 4. Build envelope
    const envelope = buildTextMessageEnvelope(
      sessionId,
      session.userId,
      session.peerId,
      ciphertext,
      iv,
      authTag
    );

    // 5. Send via WebSocket
    socketEmit('msg:send', envelope);

    console.log(`✓ Encrypted message sent (seq: ${envelope.seq})`);

    return envelope;
  } catch (error) {
    // If error already has userMessage, preserve it; otherwise create friendly error
    if (error.userMessage) {
      throw error;
    }
    const { createUserFriendlyError } = await import('../utils/cryptoErrors.js');
    throw createUserFriendlyError(error, 'message sending');
  }
}

/**
 * Handles incoming encrypted message
 * @param {Object} envelope - Message envelope
 * @param {string} userId - User ID (for encrypted key access)
 * @returns {Promise<{valid: boolean, plaintext?: string, error?: string}>}
 */
export async function handleIncomingMessage(envelope, userId = null) {
  try {
    // 1. Validate envelope structure
    const structureCheck = validateEnvelopeStructure(envelope);
    if (!structureCheck.valid) {
      console.error('Invalid envelope structure:', structureCheck.error);
      return { valid: false, error: structureCheck.error };
    }

    // 2. Validate timestamp freshness
    const maxAge = 120000; // 2 minutes
    if (!validateTimestamp(envelope.timestamp, maxAge)) {
      const error = 'Timestamp out of validity window';
      console.warn(`⚠️  Replay attempt: ${error}`);
      await logTimestampFailure(envelope.sessionId, envelope.seq, envelope.timestamp, error, userId);
      await logReplayAttempt(envelope.sessionId, envelope.seq, envelope.timestamp, error, userId);
      triggerReplayDetection(envelope.sessionId, { ...envelope, reason: error });
      return { valid: false, error };
    }

    // 3. Load session early to get lastSeq for validation
    const session = await loadSession(envelope.sessionId, userId);
    if (!session) {
      const error = 'Session not found';
      await logMessageDropped(envelope.sessionId, envelope.seq, error, userId);
      return { valid: false, error };
    }

    // Use userId from session if not provided
    if (!userId) {
      userId = session.userId;
    }

    // 3.5. Validate sequence number (strictly increasing)
    const lastSeq = session.lastSeq || 0;
    const isValidSeq = sequenceManager.validateSequence(envelope.sessionId, envelope.seq);
    if (!isValidSeq) {
      const error = 'Sequence number must be strictly increasing';
      console.warn(`⚠️  Replay attempt: ${error}`);
      await logSeqMismatch(envelope.sessionId, envelope.seq, lastSeq, userId);
      await logReplayAttempt(envelope.sessionId, envelope.seq, envelope.timestamp, error, userId);
      triggerReplayDetection(envelope.sessionId, { ...envelope, reason: error });
      return { valid: false, error };
    }

    // 4. Validate nonce presence, size, and uniqueness (client-side)
    if (!envelope.nonce) {
      const error = 'Missing nonce';
      console.warn(`⚠️  Replay attempt: ${error}`);
      await logReplayAttempt(envelope.sessionId, envelope.seq, envelope.timestamp, error, userId);
      triggerReplayDetection(envelope.sessionId, { ...envelope, reason: error });
      return { valid: false, error };
    }

    // Decode nonce and enforce size constraints (12–32 bytes)
    const nonceBuffer = base64ToArrayBuffer(envelope.nonce);
    const nonceLength = new Uint8Array(nonceBuffer).byteLength;
    if (nonceLength < 12 || nonceLength > 32) {
      const error = `Invalid nonce length: ${nonceLength} (expected 12–32 bytes)`;
      console.warn(`⚠️  Replay attempt: ${error}`);
      await logReplayAttempt(envelope.sessionId, envelope.seq, envelope.timestamp, error, userId);
      triggerReplayDetection(envelope.sessionId, { ...envelope, reason: error });
      return { valid: false, error };
    }

    const nonceHash = await hashNonce(nonceBuffer);
    const nonceAlreadyUsed = await isNonceUsed(envelope.sessionId, nonceHash);
    if (nonceAlreadyUsed) {
      const error = 'Duplicate nonce for this session';
      console.warn(`⚠️  Replay attempt: ${error}`);
      await logReplayAttempt(envelope.sessionId, envelope.seq, envelope.timestamp, error, userId);
      triggerReplayDetection(envelope.sessionId, { ...envelope, reason: error });
      return { valid: false, error };
    }

    // 5. Get receive key (session already loaded and validated)

    const recvKey = await getRecvKey(envelope.sessionId, userId);

    // 6. Convert base64 fields to ArrayBuffer
    const ciphertext = base64ToArrayBuffer(envelope.ciphertext);
    const iv = base64ToArrayBuffer(envelope.iv);
    const authTag = base64ToArrayBuffer(envelope.authTag);

    // 7. Decrypt using recvKey
    let plaintext;
    try {
      if (envelope.type === 'MSG') {
        plaintext = await decryptAESGCMToString(recvKey, iv, ciphertext, authTag);
      } else {
        // For file chunks, return ArrayBuffer
        plaintext = await decryptAESGCM(recvKey, iv, ciphertext, authTag);
      }

      // 8. Update session sequence (with userId for encrypted storage)
      await updateSessionSeq(envelope.sessionId, envelope.seq, userId);

      // 9. Store nonce hash in session metadata (track last 200 nonces)
      await storeUsedNonce(envelope.sessionId, nonceHash);

      console.log(`✓ Message decrypted successfully (seq: ${envelope.seq})`);

      // Note: Plaintext is returned to caller - they should clear it after use
      // Memory clearing is best-effort in JavaScript (strings are immutable)
      // For ArrayBuffer plaintext, we clear it after a short delay
      if (plaintext instanceof ArrayBuffer) {
        // Schedule memory clearing after a short delay
        setTimeout(() => {
          clearPlaintextAfterDecryption(plaintext);
        }, 100);
      }
      
      return {
        valid: true,
        plaintext,
        envelope
      };
    } catch (error) {
      // Log technical error for debugging
      const technicalMessage = error.technicalMessage || error.message;
      console.error('Failed to handle incoming message:', technicalMessage);
      await logDecryptionError(envelope.sessionId, envelope.seq, technicalMessage, userId);
      
      // Trigger invalid signature detection if decryption fails (could be tampered)
      if (technicalMessage.includes('decrypt') || technicalMessage.includes('auth tag') || technicalMessage.includes('Authentication tag')) {
        triggerInvalidSignature(envelope.sessionId, { ...envelope, reason: technicalMessage });
      }
      
      // Return user-friendly error message
      const userMessage = error.userMessage || error.message || 'Failed to process message';
      return { valid: false, error: userMessage, technicalError: technicalMessage };
    }
  } catch (error) {
    // Outer catch for any unexpected errors
    const technicalMessage = error.technicalMessage || error.message;
    console.error('Unexpected error in handleIncomingMessage:', technicalMessage);
    const userMessage = error.userMessage || error.message || 'An unexpected error occurred';
    return { valid: false, error: userMessage, technicalError: technicalMessage };
  }
}



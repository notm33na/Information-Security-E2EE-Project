/**
 * KEP Message Building and Validation Helpers
 */

import {
  generateEphemeralKeyPair,
  exportPublicKeyJWK,
  signEphemeralKey,
  generateNonce,
  arrayBufferToBase64
} from './cryptoHelpers.js';
import { generateTestKeyPair, exportPublicKeyJWK as exportIdentityPublicKeyJWK, importPublicKeyJWK as importIdentityPublicKeyJWK } from '../../identity-keys/helpers/cryptoHelpers.js';

/**
 * Sequence number manager per session
 */
class SequenceManager {
  constructor() {
    this.sequences = new Map();
  }

  getNextSequence(sessionId) {
    const current = this.sequences.get(sessionId) || 0;
    const next = current + 1;
    this.sequences.set(sessionId, next);
    return next;
  }

  validateSequence(sessionId, seq) {
    const lastSeq = this.sequences.get(sessionId) || 0;
    if (seq <= lastSeq) {
      return false;
    }
    this.sequences.set(sessionId, seq);
    return true;
  }

  resetSequence(sessionId) {
    this.sequences.delete(sessionId);
  }
}

export const sequenceManager = new SequenceManager();

/**
 * Builds KEP_INIT message
 * @param {string} fromUserId - Initiator user ID
 * @param {string} toUserId - Recipient user ID
 * @param {CryptoKey} ephPublicKey - Ephemeral public key
 * @param {CryptoKey} identityPrivateKey - Identity private key
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} KEP_INIT message
 */
export async function buildKEPInit(fromUserId, toUserId, ephPublicKey, identityPrivateKey, sessionId) {
  const ephPubJWK = await exportPublicKeyJWK(ephPublicKey);
  const signature = await signEphemeralKey(identityPrivateKey, ephPubJWK);
  const nonce = generateNonce(16);
  const seq = sequenceManager.getNextSequence(sessionId);
  
  return {
    type: 'KEP_INIT',
    from: fromUserId,
    to: toUserId,
    sessionId: sessionId,
    ephPub: ephPubJWK,
    signature: arrayBufferToBase64(signature),
    timestamp: Date.now(),
    nonce: arrayBufferToBase64(nonce),
    seq: seq
  };
}

/**
 * Builds KEP_RESPONSE message
 * @param {string} fromUserId - Responder user ID
 * @param {string} toUserId - Initiator user ID
 * @param {CryptoKey} ephPublicKey - Responder's ephemeral public key
 * @param {CryptoKey} identityPrivateKey - Identity private key
 * @param {ArrayBuffer} rootKey - Root key for confirmation
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} KEP_RESPONSE message
 */
export async function buildKEPResponse(fromUserId, toUserId, ephPublicKey, identityPrivateKey, rootKey, sessionId) {
  const ephPubJWK = await exportPublicKeyJWK(ephPublicKey);
  const signature = await signEphemeralKey(identityPrivateKey, ephPubJWK);
  
  // Generate key confirmation
  const { generateKeyConfirmation } = await import('./cryptoHelpers.js');
  const keyConfirmation = await generateKeyConfirmation(rootKey, toUserId);
  
  const nonce = generateNonce(16);
  const seq = sequenceManager.getNextSequence(sessionId);
  
  return {
    type: 'KEP_RESPONSE',
    from: fromUserId,
    to: toUserId,
    sessionId: sessionId,
    ephPub: ephPubJWK,
    signature: arrayBufferToBase64(signature),
    keyConfirmation: arrayBufferToBase64(keyConfirmation),
    timestamp: Date.now(),
    nonce: arrayBufferToBase64(nonce),
    seq: seq
  };
}

/**
 * Validates KEP_INIT message
 * @param {Object} message - KEP_INIT message
 * @param {CryptoKey} identityPublicKey - Sender's identity public key
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateKEPInit(message, identityPublicKey, maxAge = 120000) {
  try {
    // Check message structure
    if (!message.type || message.type !== 'KEP_INIT') {
      return { valid: false, error: 'Invalid message type' };
    }

    if (!message.from || !message.to || !message.ephPub || !message.signature || !message.sessionId || !message.timestamp || !message.seq || !message.nonce) {
      return { valid: false, error: 'Missing required fields' };
    }

    // Verify timestamp freshness
    const now = Date.now();
    const age = Math.abs(now - message.timestamp);
    if (age > maxAge) {
      return { valid: false, error: 'Timestamp out of validity window' };
    }

    // Verify signature
    const { verifyEphemeralKeySignature, base64ToArrayBuffer } = await import('./cryptoHelpers.js');
    const signature = base64ToArrayBuffer(message.signature);
    const isValid = await verifyEphemeralKeySignature(identityPublicKey, signature, message.ephPub);

    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Validates KEP_RESPONSE message
 * @param {Object} message - KEP_RESPONSE message
 * @param {CryptoKey} identityPublicKey - Responder's identity public key
 * @param {ArrayBuffer} rootKey - Our derived root key
 * @param {string} userId - Our user ID for confirmation
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateKEPResponse(message, identityPublicKey, rootKey, userId, maxAge = 120000) {
  try {
    // Check message structure
    if (!message.type || message.type !== 'KEP_RESPONSE') {
      return { valid: false, error: 'Invalid message type' };
    }

    if (!message.from || !message.ephPub || !message.signature || !message.keyConfirmation || !message.sessionId || !message.timestamp || !message.seq || !message.nonce) {
      return { valid: false, error: 'Missing required fields' };
    }

    // Verify timestamp freshness
    const now = Date.now();
    const age = Math.abs(now - message.timestamp);
    if (age > maxAge) {
      return { valid: false, error: 'Timestamp out of validity window' };
    }

    // Verify signature
    const { verifyEphemeralKeySignature, base64ToArrayBuffer } = await import('./cryptoHelpers.js');
    const signature = base64ToArrayBuffer(message.signature);
    const isValid = await verifyEphemeralKeySignature(identityPublicKey, signature, message.ephPub);

    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    // Verify key confirmation
    const { verifyKeyConfirmation, base64ToArrayBuffer: base64ToAB } = await import('./cryptoHelpers.js');
    const keyConfirmation = base64ToAB(message.keyConfirmation);
    const confirmValid = await verifyKeyConfirmation(keyConfirmation, rootKey, userId);

    if (!confirmValid) {
      return { valid: false, error: 'Key confirmation failed' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}


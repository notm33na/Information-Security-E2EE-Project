/**
 * Session Establishment Module
 * 
 * Handles complete Key Exchange Protocol (KEP) flow for establishing
 * secure encrypted sessions between two users.
 * 
 * Flow:
 * 1. Initiator: Generate ephemeral key → Sign with identity key → Send KEP_INIT
 * 2. Responder: Receive KEP_INIT → Validate → Generate ephemeral key → Sign → Send KEP_RESPONSE
 * 3. Both: Compute shared secret → Derive session keys → Store session
 */

import { generateEphemeralKeyPair, computeSharedSecret, deriveSessionKeys, exportPublicKey, importPublicKey } from './ecdh.js';
import { buildKEPInit, buildKEPResponse, validateKEPInit, validateKEPResponse } from './messages.js';
import { loadPrivateKey } from './identityKeys.js';
import { createSession, initializeSessionEncryption } from './sessionManager.js';
import { generateSecureSessionId } from './sessionIdSecurity.js';
import api from '../services/api.js';

/**
 * Initiates a new session with a peer
 * @param {string} userId - Our user ID
 * @param {string} peerId - Peer user ID
 * @param {string} password - User password for key decryption
 * @param {Object} socket - Socket.IO socket instance
 * @returns {Promise<{sessionId: string, session: Object}>} Established session
 */
export async function initiateSession(userId, peerId, password, socket) {
  try {
    console.log(`Initiating session with ${peerId}...`);

    // 1. Initialize session encryption (cache password-derived key)
    await initializeSessionEncryption(userId, password);

    // 2. Generate session ID
    const sessionId = await generateSecureSessionId(userId, peerId);

    // 3. Check if session already exists
    const { loadSession } = await import('./sessionManager.js');
    const existingSession = await loadSession(sessionId, userId, password);
    if (existingSession) {
      console.log(`Session ${sessionId} already exists`);
      return { sessionId, session: existingSession };
    }

    // 4. Load our identity private key
    const identityPrivateKey = await loadPrivateKey(userId, password);

    // 5. Fetch peer's public identity key
    let peerIdentityPubKeyJWK;
    try {
      const response = await api.get(`/keys/${peerId}`);
      if (!response.data.success || !response.data.data?.publicIdentityKeyJWK) {
        throw new Error('Failed to fetch peer public key');
      }
      peerIdentityPubKeyJWK = response.data.data.publicIdentityKeyJWK;
    } catch (error) {
      throw new Error(`Failed to fetch peer's public identity key: ${error.message}`);
    }

    // 6. Import peer's public identity key
    const peerIdentityPubKey = await importPublicKey(peerIdentityPubKeyJWK);

    // 7. Generate our ephemeral key pair
    const { privateKey: ephPrivateKey, publicKey: ephPublicKey } = await generateEphemeralKeyPair();

    // 8. Build KEP_INIT message
    const kepInitMessage = await buildKEPInit(
      userId,
      peerId,
      ephPublicKey,
      identityPrivateKey,
      sessionId
    );

    // 9. Send KEP_INIT via WebSocket
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off('kep:response', handleResponse);
        reject(new Error('Session establishment timeout: No response from peer'));
      }, 30000); // 30 second timeout

      const handleResponse = async (kepResponseMessage) => {
        // Only handle response for this session
        if (kepResponseMessage.sessionId !== sessionId || kepResponseMessage.from !== peerId) {
          return; // Not for us
        }

        clearTimeout(timeout);
        socket.off('kep:response', handleResponse);

        try {
          // 10. Validate KEP_RESPONSE
          const validation = await validateKEPResponse(
            kepResponseMessage,
            peerIdentityPubKey,
            null, // rootKey not yet computed
            userId
          );

          if (!validation.valid) {
            throw new Error(`Invalid KEP_RESPONSE: ${validation.error}`);
          }

          // 11. Import peer's ephemeral public key
          const peerEphPubKey = await importPublicKey(kepResponseMessage.ephPub);

          // 12. Compute shared secret (ECDH)
          const sharedSecret = await computeSharedSecret(ephPrivateKey, peerEphPubKey);

          // 13. Derive session keys
          const { rootKey, sendKey, recvKey } = await deriveSessionKeys(
            sharedSecret,
            sessionId,
            userId,
            peerId
          );

          // 14. Verify key confirmation HMAC
          const encoder = new TextEncoder();
          const confirmData = encoder.encode(`CONFIRM:${userId}`);
          const hmacKey = await crypto.subtle.importKey(
            'raw',
            rootKey,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
          );
          const { base64ToArrayBuffer } = await import('./signatures.js');
          const keyConfirmation = base64ToArrayBuffer(kepResponseMessage.keyConfirmation);
          const confirmValid = await crypto.subtle.verify('HMAC', hmacKey, keyConfirmation, confirmData);

          if (!confirmValid) {
            throw new Error('Key confirmation failed');
          }

          // 15. Create and store session
          const session = {
            sessionId,
            userId,
            peerId,
            rootKey,
            sendKey,
            recvKey,
            lastSeq: 0,
            lastTimestamp: Date.now(),
            usedNonceHashes: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await createSession(sessionId, userId, peerId, rootKey, sendKey, recvKey, password);

          // 16. Clear ephemeral private key from memory
          // (Note: In JavaScript, we can't explicitly clear CryptoKey, but we can null the reference)
          ephPrivateKey = null;

          console.log(`✓ Session established: ${sessionId}`);
          resolve({ sessionId, session });
        } catch (error) {
          reject(new Error(`Failed to complete session establishment: ${error.message}`));
        }
      };

      socket.on('kep:response', handleResponse);

      // Send KEP_INIT
      socket.emit('kep:init', kepInitMessage);
      console.log(`✓ KEP_INIT sent for session ${sessionId}`);
    });
  } catch (error) {
    throw new Error(`Failed to initiate session: ${error.message}`);
  }
}

/**
 * Handles incoming KEP_INIT message
 * @param {Object} kepInitMessage - KEP_INIT message from peer
 * @param {string} userId - Our user ID
 * @param {string} password - User password for key decryption
 * @param {Object} socket - Socket.IO socket instance
 * @returns {Promise<{sessionId: string, session: Object}>} Established session
 */
export async function handleKEPInit(kepInitMessage, userId, password, socket) {
  try {
    console.log(`Handling KEP_INIT from ${kepInitMessage.from}...`);

    // 1. Initialize session encryption
    await initializeSessionEncryption(userId, password);

    // 2. Extract session info
    const { from: peerId, sessionId } = kepInitMessage;

    // 3. Check if session already exists
    const { loadSession } = await import('./sessionManager.js');
    const existingSession = await loadSession(sessionId, userId, password);
    if (existingSession) {
      console.log(`Session ${sessionId} already exists`);
      return { sessionId, session: existingSession };
    }

    // 4. Fetch peer's public identity key
    let peerIdentityPubKeyJWK;
    try {
      const response = await api.get(`/keys/${peerId}`);
      if (!response.data.success || !response.data.data?.publicIdentityKeyJWK) {
        throw new Error('Failed to fetch peer public key');
      }
      peerIdentityPubKeyJWK = response.data.data.publicIdentityKeyJWK;
    } catch (error) {
      throw new Error(`Failed to fetch peer's public identity key: ${error.message}`);
    }

    // 5. Import peer's public identity key
    const peerIdentityPubKey = await importPublicKey(peerIdentityPubKeyJWK);

    // 6. Validate KEP_INIT
    const validation = await validateKEPInit(kepInitMessage, peerIdentityPubKey, 120000, userId);
    if (!validation.valid) {
      throw new Error(`Invalid KEP_INIT: ${validation.error}`);
    }

    // 7. Load our identity private key
    const identityPrivateKey = await loadPrivateKey(userId, password);

    // 8. Import peer's ephemeral public key
    const peerEphPubKey = await importPublicKey(kepInitMessage.ephPub);

    // 9. Generate our ephemeral key pair
    const { privateKey: ephPrivateKey, publicKey: ephPublicKey } = await generateEphemeralKeyPair();

    // 10. Compute shared secret (ECDH)
    const sharedSecret = await computeSharedSecret(ephPrivateKey, peerEphPubKey);

    // 11. Derive session keys
    const { rootKey, sendKey, recvKey } = await deriveSessionKeys(
      sharedSecret,
      sessionId,
      userId,
      peerId
    );

    // 12. Build KEP_RESPONSE
    const kepResponseMessage = await buildKEPResponse(
      userId,
      peerId,
      ephPublicKey,
      identityPrivateKey,
      rootKey,
      sessionId
    );

    // 13. Send KEP_RESPONSE via WebSocket
    socket.emit('kep:response', kepResponseMessage);
    console.log(`✓ KEP_RESPONSE sent for session ${sessionId}`);

    // 14. Create and store session
    const session = {
      sessionId,
      userId,
      peerId,
      rootKey,
      sendKey,
      recvKey,
      lastSeq: 0,
      lastTimestamp: Date.now(),
      usedNonceHashes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await createSession(sessionId, userId, peerId, rootKey, sendKey, recvKey, password);

    // 15. Clear ephemeral private key from memory
    ephPrivateKey = null;

    console.log(`✓ Session established: ${sessionId}`);
    return { sessionId, session };
  } catch (error) {
    throw new Error(`Failed to handle KEP_INIT: ${error.message}`);
  }
}

/**
 * Handles incoming KEP_RESPONSE message (called by initiator after sending KEP_INIT)
 * This is handled in the initiateSession promise handler, but kept as separate function
 * for clarity and potential reuse.
 * @param {Object} kepResponseMessage - KEP_RESPONSE message from peer
 * @param {string} userId - Our user ID
 * @param {string} password - User password
 * @param {string} sessionId - Session ID
 * @param {CryptoKey} peerIdentityPubKey - Peer's public identity key
 * @param {ArrayBuffer} rootKey - Our computed root key
 * @returns {Promise<boolean>} True if valid
 */
export async function handleKEPResponse(kepResponseMessage, userId, password, sessionId, peerIdentityPubKey, rootKey) {
  try {
    // Validate KEP_RESPONSE
    const validation = await validateKEPResponse(
      kepResponseMessage,
      peerIdentityPubKey,
      rootKey,
      userId
    );

    return validation.valid;
  } catch (error) {
    console.error('KEP_RESPONSE validation error:', error);
    return false;
  }
}


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

import { generateEphemeralKeyPair, computeSharedSecret, deriveSessionKeys, exportPublicKey, importPublicKey as importEphPublicKey } from './ecdh.js';
import { buildKEPInit, buildKEPResponse, validateKEPInit, validateKEPResponse } from './messages.js';
import { loadPrivateKey, importPublicKey as importIdentityPublicKey } from './identityKeys.js';
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
    console.log(`[Session Establishment] Initiating session with ${peerId}...`);

    // 1. Initialize session encryption (cache password-derived key)
    await initializeSessionEncryption(userId, password);

    // 2. Get or create session from backend (ensures only one session per user pair)
    let sessionId;
    try {
      const response = await api.post('/sessions', {
        userId1: userId,
        userId2: peerId
      });
      
      if (response.data.success) {
        sessionId = response.data.data.session.sessionId;
        const isNew = response.data.data.isNew;
        console.log(`[Session Establishment] ${isNew ? 'Created new' : 'Retrieved existing'} session ${sessionId} from backend`);
      } else {
        throw new Error(response.data.error || 'Failed to get or create session');
      }
    } catch (apiError) {
      console.error('[Session Establishment] Failed to get session from backend, falling back to local generation:', apiError);
      // Fallback: Generate session ID locally (should not happen in normal flow)
      sessionId = await generateSecureSessionId(userId, peerId);
      console.warn(`[Session Establishment] Using locally generated session ID ${sessionId} (backend unavailable)`);
    }

    // 3. Check if session already exists locally with keys - prevent unnecessary key exchange
    const { loadSession } = await import('./sessionManager.js');
    try {
      const existingSession = await loadSession(sessionId, userId, password);
      if (existingSession && existingSession.rootKey && existingSession.sendKey && existingSession.recvKey) {
        console.log(`[Session Establishment] ✓ Session ${sessionId} already exists locally with keys - skipping key exchange`);
        console.log(`[Session Establishment] ✓ Prevented unnecessary key regeneration for session ${sessionId}`);
        return { sessionId, session: existingSession };
      } else if (existingSession) {
        console.log(`[Session Establishment] ⚠️ Session ${sessionId} exists but missing keys - will establish keys`);
      }
    } catch (loadError) {
      // Session doesn't exist or can't be loaded - proceed with establishment
      console.log(`[Session Establishment] Session ${sessionId} not found locally, will establish new keys`);
    }

    // 4. Check if identity key exists
    const { hasIdentityKey } = await import('./identityKeys.js');
    const hasKey = await hasIdentityKey(userId);
    if (!hasKey) {
      throw new Error('Identity key not found. Please generate an identity key pair first in the Keys page.');
    }

    // 5. Load our identity private key
    let identityPrivateKey;
    try {
      identityPrivateKey = await loadPrivateKey(userId, password);
    } catch (error) {
      // Provide more context about the error
      if (error.message.includes('decrypt') || error.message.includes('password')) {
        throw new Error('Failed to decrypt identity key. Please verify your password is correct, or regenerate your keys if needed.');
      } else if (error.message.includes('not found')) {
        throw new Error('Identity key not found. Please generate an identity key pair in the Keys page.');
      } else {
        throw new Error(`Failed to load identity key: ${error.message || 'Unknown error'}`);
      }
    }

    // 6. Fetch peer's public identity key
    console.log(`[KEP] Step 6: Fetching peer's public identity key from server...`);
    let peerIdentityPubKeyJWK;
    try {
      const response = await api.get(`/keys/${peerId}`);
      if (!response.data.success || !response.data.data?.publicIdentityKeyJWK) {
        console.error(`[KEP] ✗ Server response invalid:`, response.data);
        throw new Error('Failed to fetch peer public key - invalid server response');
      }
      peerIdentityPubKeyJWK = response.data.data.publicIdentityKeyJWK;
      console.log(`[KEP] ✓ Peer's public identity key fetched from server`);
      console.log(`[KEP] Peer key structure:`, {
        hasKty: !!peerIdentityPubKeyJWK.kty,
        hasCrv: !!peerIdentityPubKeyJWK.crv,
        hasX: !!peerIdentityPubKeyJWK.x,
        hasY: !!peerIdentityPubKeyJWK.y,
        keys: Object.keys(peerIdentityPubKeyJWK)
      });
    } catch (error) {
      console.error(`[KEP] ✗ Failed to fetch peer's public identity key:`, error);
      throw new Error(`Failed to fetch peer's public identity key: ${error.message}`);
    }

    // 7. Import peer's public identity key (ECDSA for signature verification)
    console.log(`[KEP] Step 7: Importing peer's public identity key...`);
    let peerIdentityPubKey;
    try {
      peerIdentityPubKey = await importIdentityPublicKey(peerIdentityPubKeyJWK);
      console.log(`[KEP] ✓ Peer's public identity key imported successfully`);
      console.log(`[KEP] Imported key algorithm:`, {
        name: peerIdentityPubKey?.algorithm?.name,
        namedCurve: peerIdentityPubKey?.algorithm?.namedCurve,
        usages: peerIdentityPubKey?.usages
      });
    } catch (error) {
      console.error(`[KEP] ✗ Failed to import peer's public identity key:`, error);
      console.error(`[KEP] JWK that failed to import:`, peerIdentityPubKeyJWK);
      throw new Error(`Failed to import peer's public identity key: ${error.message}`);
    }

    // 7. Generate our ephemeral key pair
    let { privateKey: ephPrivateKey, publicKey: ephPublicKey } = await generateEphemeralKeyPair();

    // 9. Build KEP_INIT message
    console.log(`[KEP] Step 9: Building KEP_INIT message...`);
    const kepInitMessage = await buildKEPInit(
      userId,
      peerId,
      ephPublicKey,
      identityPrivateKey,
      sessionId
    );
    console.log(`[KEP] ✓ KEP_INIT message built successfully`);
    console.log(`[KEP] KEP_INIT structure:`, {
      type: kepInitMessage.type,
      from: kepInitMessage.from,
      to: kepInitMessage.to,
      sessionId: kepInitMessage.sessionId,
      hasEphPub: !!kepInitMessage.ephPub,
      hasSignature: !!kepInitMessage.signature,
      signatureLength: kepInitMessage.signature ? kepInitMessage.signature.length : 0,
      timestamp: kepInitMessage.timestamp
    });

    // 9. Send KEP_INIT via WebSocket
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.off('kep:response', handleResponse);
        socket.off('kep:sent', handleSent);
        socket.off('error', handleError);
        reject(new Error('Session establishment timeout: No response from peer. The peer may be offline or not connected.'));
      }, 30000); // 30 second timeout

      const handleSent = (data) => {
        if (data.sessionId === sessionId) {
          console.log(`KEP_INIT delivery status: ${data.delivered ? 'delivered' : 'pending'}`);
          if (!data.delivered) {
            console.warn('KEP_INIT not delivered - peer may be offline');
            // If peer is offline, reject immediately with a helpful message
            clearTimeout(timeout);
            socket.off('kep:response', handleResponse);
            socket.off('kep:sent', handleSent);
            socket.off('error', handleError);
            reject(new Error('Peer is not online. The other user must be connected to establish a session.'));
          }
        }
      };

      const handleError = (error) => {
        // Handle both error objects and error strings
        const errorMessage = error?.message || error?.toString() || String(error);
        
        if (errorMessage && (errorMessage.includes('KEP') || errorMessage.includes('rate limit') || errorMessage.includes('Key exchange'))) {
          console.error('KEP error from server:', error);
          clearTimeout(timeout);
          socket.off('kep:response', handleResponse);
          socket.off('kep:sent', handleSent);
          socket.off('error', handleError);
          
          // Check if it's a rate limit error
          if (errorMessage.includes('rate limit') || errorMessage.includes('rate limit exceeded') || errorMessage.includes('Key exchange rate limit')) {
            reject(new Error(`Rate limit exceeded: ${errorMessage}. Please wait a few minutes before trying again.`));
          } else {
            reject(new Error(`Server error: ${errorMessage}`));
          }
        }
      };

      const handleResponse = async (kepResponseMessage) => {
        // Only handle response for this session
        if (kepResponseMessage.sessionId !== sessionId || kepResponseMessage.from !== peerId) {
          console.log('KEP_RESPONSE received but not for this session:', {
            receivedSessionId: kepResponseMessage.sessionId,
            expectedSessionId: sessionId,
            receivedFrom: kepResponseMessage.from,
            expectedPeerId: peerId
          });
          return; // Not for us
        }

        console.log('KEP_RESPONSE received for session:', sessionId);
        clearTimeout(timeout);
        socket.off('kep:response', handleResponse);
        socket.off('kep:sent', handleSent);
        socket.off('error', handleError);

        try {
          // 10. Import peer's ephemeral public key (ECDH for key derivation)
          const peerEphPubKey = await importEphPublicKey(kepResponseMessage.ephPub);

          // 11. Compute shared secret (ECDH)
          const sharedSecret = await computeSharedSecret(ephPrivateKey, peerEphPubKey);

          // 12. Derive session keys (need rootKey for validation)
          const { rootKey, sendKey, recvKey } = await deriveSessionKeys(
            sharedSecret,
            sessionId,
            userId,
            peerId
          );

          // 13. Validate KEP_RESPONSE (now that we have rootKey for key confirmation)
          const validation = await validateKEPResponse(
            kepResponseMessage,
            peerIdentityPubKey,
            rootKey,
            userId
          );

          if (!validation.valid) {
            throw new Error(`Invalid KEP_RESPONSE: ${validation.error}`);
          }

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
          // (Note: In JavaScript, we can't explicitly clear CryptoKey, but we can null the reference)
          ephPrivateKey = null;

          console.log(`✓ Session established: ${sessionId}`);
          resolve({ sessionId, session });
        } catch (error) {
          reject(new Error(`Failed to complete session establishment: ${error.message}`));
        }
      };

      socket.on('kep:response', handleResponse);
      socket.on('kep:sent', handleSent);
      socket.on('error', handleError);

      // Send KEP_INIT
      console.log(`Sending KEP_INIT for session ${sessionId} to peer ${peerId}...`);
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
    console.log(`[KEP] Handling KEP_INIT from ${kepInitMessage.from} for session ${kepInitMessage.sessionId}...`);

    // 1. Initialize session encryption
    console.log(`[KEP] Step 1: Initializing session encryption...`);
    await initializeSessionEncryption(userId, password);

    // 2. Extract session info
    const { from: peerId, sessionId } = kepInitMessage;

    // 3. Ensure session exists in backend (get or create)
    // This ensures the session is registered in MongoDB before proceeding with key exchange
    try {
      const response = await api.post('/sessions', {
        userId1: userId,
        userId2: peerId
      });
      
      if (response.data.success) {
        const backendSessionId = response.data.data.session.sessionId;
        const isNew = response.data.data.isNew;
        
        // Verify session ID matches (should always match due to deterministic generation)
        if (backendSessionId !== sessionId) {
          console.warn(`[KEP] ⚠️ Session ID mismatch: received ${sessionId}, backend has ${backendSessionId} - using backend ID`);
          // Use backend session ID if different (shouldn't happen, but handle gracefully)
        }
        
        if (isNew) {
          console.log(`[KEP] ✓ NEW session registered in backend: ${backendSessionId}`);
        } else {
          console.log(`[KEP] ✓ EXISTING session found in backend: ${backendSessionId}`);
        }
      }
    } catch (apiError) {
      console.warn('[KEP] Failed to register/verify session in backend:', apiError.message);
      // Continue with key exchange even if backend registration fails
      // Session will be created locally, but won't be tracked in MongoDB
    }

    // 4. Check if session already exists locally with keys - prevent unnecessary key exchange
    const { loadSession } = await import('./sessionManager.js');
    try {
      const existingSession = await loadSession(sessionId, userId, password);
      if (existingSession && existingSession.rootKey && existingSession.sendKey && existingSession.recvKey) {
        console.log(`[KEP] ✓ Session ${sessionId} already exists locally with keys - skipping key exchange`);
        console.log(`[KEP] ✓ Prevented unnecessary key regeneration for session ${sessionId}`);
        return { sessionId, session: existingSession };
      } else if (existingSession) {
        console.log(`[KEP] ⚠️ Session ${sessionId} exists but missing keys - will establish keys`);
      }
    } catch (loadError) {
      // Session doesn't exist or can't be loaded - proceed with establishment
      console.log(`[KEP] Session ${sessionId} not found locally, will establish new keys`);
    }

    // 5. Fetch peer's public identity key
    console.log(`[KEP] Step 5: Fetching peer's public identity key from server...`);
    let peerIdentityPubKeyJWK;
    try {
      const response = await api.get(`/keys/${peerId}`);
      if (!response.data.success || !response.data.data?.publicIdentityKeyJWK) {
        console.error(`[KEP] ✗ Server response invalid:`, response.data);
        throw new Error('Failed to fetch peer public key - invalid server response');
      }
      peerIdentityPubKeyJWK = response.data.data.publicIdentityKeyJWK;
      console.log(`[KEP] ✓ Peer's public identity key fetched from server`);
      console.log(`[KEP] Peer key structure:`, {
        hasKty: !!peerIdentityPubKeyJWK.kty,
        hasCrv: !!peerIdentityPubKeyJWK.crv,
        hasX: !!peerIdentityPubKeyJWK.x,
        hasY: !!peerIdentityPubKeyJWK.y,
        keys: Object.keys(peerIdentityPubKeyJWK)
      });
    } catch (error) {
      console.error(`[KEP] ✗ Failed to fetch peer's public identity key:`, error);
      throw new Error(`Failed to fetch peer's public identity key: ${error.message}`);
    }

    // 5. Import peer's public identity key (ECDSA for signature verification)
    console.log(`[KEP] Step 5: Importing peer's public identity key...`);
    let peerIdentityPubKey;
    try {
      peerIdentityPubKey = await importIdentityPublicKey(peerIdentityPubKeyJWK);
      console.log(`[KEP] ✓ Peer's public identity key imported successfully`);
      console.log(`[KEP] Imported key algorithm:`, {
        name: peerIdentityPubKey?.algorithm?.name,
        namedCurve: peerIdentityPubKey?.algorithm?.namedCurve,
        usages: peerIdentityPubKey?.usages
      });
    } catch (error) {
      console.error(`[KEP] ✗ Failed to import peer's public identity key:`, error);
      console.error(`[KEP] JWK that failed to import:`, peerIdentityPubKeyJWK);
      throw new Error(`Failed to import peer's public identity key: ${error.message}`);
    }

    // 6. Validate KEP_INIT
    console.log(`[KEP] Step 6: Validating KEP_INIT message signature...`);
    const validation = await validateKEPInit(kepInitMessage, peerIdentityPubKey, 120000, userId);
    if (!validation.valid) {
      console.error(`[KEP] ✗ KEP_INIT validation failed: ${validation.error}`);
      console.error(`[KEP] KEP_INIT message details:`, {
        from: kepInitMessage.from,
        to: kepInitMessage.to,
        sessionId: kepInitMessage.sessionId,
        hasEphPub: !!kepInitMessage.ephPub,
        hasSignature: !!kepInitMessage.signature,
        timestamp: kepInitMessage.timestamp,
        ephPubKeys: kepInitMessage.ephPub ? Object.keys(kepInitMessage.ephPub) : null
      });
      throw new Error(`Invalid KEP_INIT: ${validation.error}`);
    }
    console.log(`[KEP] ✓ KEP_INIT signature validated successfully`);

    // 7. Load our identity private key
    const identityPrivateKey = await loadPrivateKey(userId, password);

    // 8. Import peer's ephemeral public key (ECDH for key derivation)
    const peerEphPubKey = await importEphPublicKey(kepInitMessage.ephPub);

    // 9. Generate our ephemeral key pair
    let { privateKey: ephPrivateKey, publicKey: ephPublicKey } = await generateEphemeralKeyPair();

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
    console.log(`[KEP] Step 12: Building KEP_RESPONSE message...`);
    const kepResponseMessage = await buildKEPResponse(
      userId,
      peerId,
      ephPublicKey,
      identityPrivateKey,
      rootKey,
      sessionId
    );
    console.log(`[KEP] KEP_RESPONSE message built successfully`);

    // 13. Send KEP_RESPONSE via WebSocket
    console.log(`[KEP] Step 13: Sending KEP_RESPONSE to peer ${peerId} via WebSocket...`);
    socket.emit('kep:response', kepResponseMessage);
    console.log(`[KEP] ✓ KEP_RESPONSE sent for session ${sessionId} to peer ${peerId}`);

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


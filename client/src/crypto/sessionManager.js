/**
 * Session Manager
 * 
 * Manages E2EE sessions including:
 * - Session creation and storage
 * - Key retrieval (send/recv keys)
 * - Sequence number management
 * - Session persistence in IndexedDB
 * - Replay detection and logging (Phase 7)
 * - Invalid signature detection and logging (Phase 7)
 */

/**
 * Logging hooks for attack detection (Phase 7)
 */
let onReplayDetectedCallback = null;
let onInvalidSignatureCallback = null;

/**
 * Sets callback for replay detection
 * @param {Function} callback - Callback function (sessionId, message)
 */
export function setReplayDetectionCallback(callback) {
  onReplayDetectedCallback = callback;
}

/**
 * Sets callback for invalid signature detection
 * @param {Function} callback - Callback function (sessionId, message)
 */
export function setInvalidSignatureCallback(callback) {
  onInvalidSignatureCallback = callback;
}

/**
 * Triggers replay detection callback
 * @param {string} sessionId - Session identifier
 * @param {Object} message - Message that triggered replay detection
 */
export function triggerReplayDetection(sessionId, message) {
  if (onReplayDetectedCallback) {
    onReplayDetectedCallback(sessionId, message);
  }
}

/**
 * Triggers invalid signature callback
 * @param {string} sessionId - Session identifier
 * @param {Object} message - Message with invalid signature
 */
export function triggerInvalidSignature(sessionId, message) {
  if (onInvalidSignatureCallback) {
    onInvalidSignatureCallback(sessionId, message);
  }
}

const DB_NAME = 'InfosecCryptoDB';
const DB_VERSION = 8; // Must match the highest version used by any module
const SESSIONS_STORE = 'sessions';
const SESSION_ENCRYPTION_STORE = 'sessionEncryptionKeys'; // Store encryption metadata

/**
 * Opens IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const transaction = event.target.transaction;
      
      // Create stores if they don't exist (idempotent)
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains(SESSION_ENCRYPTION_STORE)) {
        db.createObjectStore(SESSION_ENCRYPTION_STORE, { keyPath: 'userId' });
      }
      
      // Ensure all other required stores exist
      if (!db.objectStoreNames.contains('identityKeys')) {
        db.createObjectStore('identityKeys', { keyPath: 'userId' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('sessionId', 'sessionId', { unique: false });
        msgStore.createIndex('timestamp', 'timestamp', { unique: false });
        msgStore.createIndex('seq', 'seq', { unique: false });
      }
      if (!db.objectStoreNames.contains('messageQueue')) {
        const queueStore = db.createObjectStore('messageQueue', { keyPath: 'id', autoIncrement: true });
        queueStore.createIndex('sessionId', 'sessionId', { unique: false });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('clientLogs')) {
        const logStore = db.createObjectStore('clientLogs', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        logStore.createIndex('timestamp', 'timestamp', { unique: false });
        logStore.createIndex('userId', 'userId', { unique: false });
        logStore.createIndex('sessionId', 'sessionId', { unique: false });
        logStore.createIndex('event', 'event', { unique: false });
        logStore.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}

/**
 * In-memory cache for session encryption keys (derived from password)
 * Cleared on logout or timeout
 */
const sessionEncryptionKeyCache = new Map(); // userId -> { key: CryptoKey, expiresAt: number }

/**
 * Derives session encryption key from password
 * Uses same PBKDF2 parameters as identity key encryption for consistency.
 * Tests may lower the iteration count via CRYPTO_PBKDF2_ITERATIONS env var
 * for performance while keeping the production default strong.
 * @param {string} password - User password
 * @param {Uint8Array} salt - Salt for key derivation
 * @returns {Promise<CryptoKey>}
 */
async function deriveSessionEncryptionKey(password, salt) {
  const iterations =
    (typeof process !== 'undefined' &&
      process.env &&
      parseInt(process.env.CRYPTO_PBKDF2_ITERATIONS || '', 10)) ||
    100000;
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations,
      hash: 'SHA-256'
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Gets or derives session encryption key for user
 * Caches in memory for active sessions
 * @param {string} userId - User ID
 * @param {string} password - User password
 * @returns {Promise<CryptoKey>}
 */
async function getSessionEncryptionKey(userId, password) {
  // Check cache first
  const cached = sessionEncryptionKeyCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }

  // Load or generate salt
  const db = await openDB();
  let encryptionData;
  
  try {
    encryptionData = await new Promise((resolve, reject) => {
      const transaction = db.transaction([SESSION_ENCRYPTION_STORE], 'readwrite');
      const store = transaction.objectStore(SESSION_ENCRYPTION_STORE);
      
      // Set up transaction handlers first to avoid race conditions
      let resolved = false;
      let requestResult = null;
      
      const completeHandler = () => {
        if (!resolved) {
          resolved = true;
          resolve(requestResult);
        }
      };
      const errorHandler = () => {
        if (!resolved) {
          resolved = true;
          reject(transaction.error || new Error('Transaction error'));
        }
      };
      
      transaction.oncomplete = completeHandler;
      transaction.onerror = errorHandler;
      
      const request = store.get(userId);
      request.onsuccess = () => {
        requestResult = request.result;
        // If transaction is already complete, resolve immediately
        if (transaction.readyState === 'done') {
          if (!resolved) {
            resolved = true;
            resolve(requestResult);
          }
        }
        // Otherwise, wait for transaction.oncomplete
      };
      request.onerror = () => {
        if (!resolved) {
          resolved = true;
          reject(request.error);
        }
      };
    });

    if (!encryptionData) {
      // Generate new salt and store
      const salt = crypto.getRandomValues(new Uint8Array(16));
      encryptionData = {
        userId: userId,
        salt: Array.from(salt),
        createdAt: new Date().toISOString()
      };
      
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([SESSION_ENCRYPTION_STORE], 'readwrite');
        const store = transaction.objectStore(SESSION_ENCRYPTION_STORE);
        
        // Set up transaction handlers first to avoid race conditions
        let resolved = false;
        const completeHandler = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };
        const errorHandler = () => {
          if (!resolved) {
            resolved = true;
            reject(transaction.error || new Error('Transaction error'));
          }
        };
        
        transaction.oncomplete = completeHandler;
        transaction.onerror = errorHandler;
        
        const request = store.put(encryptionData);
        request.onsuccess = () => {
          // If transaction is already complete, resolve immediately
          if (transaction.readyState === 'done') {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          }
          // Otherwise, wait for transaction.oncomplete
        };
        request.onerror = () => {
          if (!resolved) {
            resolved = true;
            reject(request.error);
          }
        };
      });
    }
  } finally {
    // Explicitly close database connection (important for fake-indexeddb)
    // Add a small delay to ensure transaction cleanup completes
    // This helps fake-indexeddb properly clean up before the next operation
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      if (db && typeof db.close === 'function') {
        db.close();
      }
    } catch (error) {
      // Ignore errors when closing - database might already be closed
    }
  }

  // Derive key
  const saltArray = new Uint8Array(encryptionData.salt);
  const key = await deriveSessionEncryptionKey(password, saltArray);

  // Cache for 24 hours (longer than password cache to allow session decryption after page refresh)
  sessionEncryptionKeyCache.set(userId, {
    key: key,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  });

  return key;
}

/**
 * Encrypts session keys for storage
 * @param {ArrayBuffer} keyData - Key data to encrypt (rootKey, sendKey, or recvKey)
 * @param {CryptoKey} encryptionKey - Encryption key
 * @returns {Promise<{encrypted: ArrayBuffer, iv: Uint8Array, authTag: ArrayBuffer}>}
 */
async function encryptSessionKey(keyData, encryptionKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits for GCM
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128
    },
    encryptionKey,
    keyData
  );

  // Extract ciphertext and auth tag
  const tagLength = 16; // 128 bits = 16 bytes
  const ciphertext = encrypted.slice(0, encrypted.byteLength - tagLength);
  const authTag = encrypted.slice(encrypted.byteLength - tagLength);

  return { encrypted: ciphertext, iv, authTag };
}

/**
 * Decrypts session keys from storage
 * @param {ArrayBuffer} encrypted - Encrypted key data
 * @param {Uint8Array} iv - Initialization vector
 * @param {ArrayBuffer} authTag - Authentication tag
 * @param {CryptoKey} encryptionKey - Decryption key
 * @returns {Promise<ArrayBuffer>}
 */
async function decryptSessionKey(encrypted, iv, authTag, encryptionKey) {
  // Combine ciphertext and auth tag
  const combined = new Uint8Array(encrypted.byteLength + authTag.byteLength);
  combined.set(new Uint8Array(encrypted), 0);
  combined.set(new Uint8Array(authTag), encrypted.byteLength);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128
    },
    encryptionKey,
    combined
  );

  return decrypted;
}

/**
 * Clears session encryption key cache for user
 * @param {string} userId - User ID
 */
export function clearSessionEncryptionCache(userId) {
  sessionEncryptionKeyCache.delete(userId);
}

/**
 * Converts ArrayBuffer to base64 string
 * @param {ArrayBuffer} buffer - Buffer to convert
 * @returns {string} Base64 string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts base64 string to ArrayBuffer
 * @param {string} base64 - Base64 string
 * @returns {ArrayBuffer} ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Creates a new session with encrypted key storage
 * Checks if session already exists before creating to prevent duplicate key generation
 * @param {string} sessionId - Unique session identifier
 * @param {string} userId - Our user ID
 * @param {string} peerId - Peer user ID
 * @param {ArrayBuffer} rootKey - Root key
 * @param {ArrayBuffer} sendKey - Key for sending messages
 * @param {ArrayBuffer} recvKey - Key for receiving messages
 * @param {string} password - User password for encryption (optional, uses cached key if available)
 * @returns {Promise<void>}
 */
export async function createSession(sessionId, userId, peerId, rootKey, sendKey, recvKey, password = null) {
  try {
    console.log(`[Session Manager] createSession called for session ${sessionId} (userId: ${userId}, peerId: ${peerId})`);
    
    // Check if session already exists - prevent duplicate key generation
    const existingSession = await loadSession(sessionId, userId, password).catch(() => null);
    if (existingSession) {
      console.log(`[Session Manager] ⚠️ Session ${sessionId} already exists with keys - preventing unnecessary key regeneration`);
      console.log(`[Session Manager] ✓ Reusing existing session keys for session ${sessionId}`);
      return; // Session already exists, don't overwrite
    }

    console.log(`[Session Manager] Generating session keys for new session ${sessionId}`);

    // Get encryption key (from cache or derive from password)
    let encryptionKey = null;
    if (password) {
      encryptionKey = await getSessionEncryptionKey(userId, password);
    } else {
      // Try to use cached key
      const cached = sessionEncryptionKeyCache.get(userId);
      if (cached && cached.expiresAt > Date.now()) {
        encryptionKey = cached.key;
      } else {
        throw new Error('Password required for session encryption or cached key expired');
      }
    }

    // Encrypt session keys
    const rootKeyEnc = await encryptSessionKey(rootKey, encryptionKey);
    const sendKeyEnc = await encryptSessionKey(sendKey, encryptionKey);
    const recvKeyEnc = await encryptSessionKey(recvKey, encryptionKey);

    const session = {
      sessionId,
      userId,
      peerId,
      rootKey: {
        encrypted: Array.from(new Uint8Array(rootKeyEnc.encrypted)),
        iv: Array.from(rootKeyEnc.iv),
        authTag: Array.from(new Uint8Array(rootKeyEnc.authTag))
      },
      sendKey: {
        encrypted: Array.from(new Uint8Array(sendKeyEnc.encrypted)),
        iv: Array.from(sendKeyEnc.iv),
        authTag: Array.from(new Uint8Array(sendKeyEnc.authTag))
      },
      recvKey: {
        encrypted: Array.from(new Uint8Array(recvKeyEnc.encrypted)),
        iv: Array.from(recvKeyEnc.iv),
        authTag: Array.from(new Uint8Array(recvKeyEnc.authTag))
      },
      encrypted: true, // Flag to indicate encrypted storage
      status: 'active', // Key lifecycle status: 'active' or 'inactive'
      statusReason: null, // Reason for status change (e.g., "Superseded by new session <sessionId>")
      statusChangedAt: null, // Timestamp when status was changed
      lastSeq: 0,
      lastTimestamp: Date.now(),
      // Track recently used nonce hashes (client-side replay protection).
      // Stored as an array of hex-encoded SHA-256(nonce) values.
      usedNonceHashes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const db = await openDB();
    const transaction = db.transaction([SESSIONS_STORE], 'readwrite');
    const store = transaction.objectStore(SESSIONS_STORE);

    await new Promise((resolve, reject) => {
      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`[Session Manager] ✓ Session created with encrypted keys: ${sessionId}`);
    console.log(`[Session Manager] ✓ Session keys stored in IndexedDB for session ${sessionId}`);
    console.log(`[Session Manager] ✓ Activated keys for session ${sessionId}`);

    // Mark old session keys as inactive for this peer
    try {
      await cleanupOldSessionsForPeer(userId, peerId, sessionId);
    } catch (cleanupError) {
      // Non-fatal - log but don't fail session creation
      console.warn(`[Session Manager] Failed to mark old sessions as inactive (non-fatal):`, cleanupError);
    }
  } catch (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }
}

/**
 * Validates session access - ensures user has permission to access session
 * @param {Object} session - Session object
 * @param {string} requestingUserId - User ID requesting access
 * @returns {boolean} True if access is allowed
 */
export function validateSessionAccess(session, requestingUserId) {
  if (!session || !requestingUserId) {
    return false;
  }
  
  // User can only access sessions where they are the userId or peerId
  const sessionUserId = session.userId?.toString() || session.userId;
  const sessionPeerId = session.peerId?.toString() || session.peerId;
  const reqUserId = requestingUserId.toString() || requestingUserId;
  
  return sessionUserId === reqUserId || sessionPeerId === reqUserId;
}

/**
 * Loads session from storage and decrypts keys
 * @param {string} sessionId - Session identifier
 * @param {string} userId - User ID (for encryption key lookup and access control)
 * @param {string} password - User password for decryption (optional, uses cached key if available)
 * @returns {Promise<Object|null>} Session object with decrypted keys or null
 */
export async function loadSession(sessionId, userId = null, password = null) {
  try {
    console.log(`[Session Manager] loadSession called for session ${sessionId} (userId: ${userId || 'auto'})`);
    
    const db = await openDB();
    const transaction = db.transaction([SESSIONS_STORE], 'readonly');
    const store = transaction.objectStore(SESSIONS_STORE);

    const session = await new Promise((resolve, reject) => {
      const request = store.get(sessionId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!session) {
      console.log(`[Session Manager] No session found in IndexedDB for session ${sessionId}`);
      return null;
    }

    console.log(`[Session Manager] ✓ Found session ${sessionId} in IndexedDB, loading keys...`);

    // Handle legacy unencrypted sessions (backward compatibility)
    if (!session.encrypted) {
      console.log(`[Session Manager] ✓ Loaded legacy unencrypted session keys from IndexedDB for session ${sessionId}`);
      return {
        ...session,
        status: session.status || 'active', // Default to active for backward compatibility
        rootKey: base64ToArrayBuffer(session.rootKey),
        sendKey: base64ToArrayBuffer(session.sendKey),
        recvKey: base64ToArrayBuffer(session.recvKey)
      };
    }

    // Decrypt encrypted session keys
    if (!userId) {
      userId = session.userId;
    }

    // Get encryption key
    let encryptionKey = null;
    if (password) {
      encryptionKey = await getSessionEncryptionKey(userId, password);
    } else {
      const cached = sessionEncryptionKeyCache.get(userId);
      if (cached && cached.expiresAt > Date.now()) {
        encryptionKey = cached.key;
      } else {
        throw new Error('Password required for session decryption or cached key expired');
      }
    }

    // Validate session access before decrypting keys
    if (userId && !validateSessionAccess(session, userId)) {
      throw new Error('Access denied: User does not have permission to access this session');
    }

    // Decrypt keys
    const rootKeyBuf = new Uint8Array(session.rootKey.encrypted).buffer;
    const rootKeyIV = new Uint8Array(session.rootKey.iv);
    const rootKeyTag = new Uint8Array(session.rootKey.authTag).buffer;
    const rootKey = await decryptSessionKey(rootKeyBuf, rootKeyIV, rootKeyTag, encryptionKey);

    const sendKeyBuf = new Uint8Array(session.sendKey.encrypted).buffer;
    const sendKeyIV = new Uint8Array(session.sendKey.iv);
    const sendKeyTag = new Uint8Array(session.sendKey.authTag).buffer;
    const sendKey = await decryptSessionKey(sendKeyBuf, sendKeyIV, sendKeyTag, encryptionKey);

    const recvKeyBuf = new Uint8Array(session.recvKey.encrypted).buffer;
    const recvKeyIV = new Uint8Array(session.recvKey.iv);
    const recvKeyTag = new Uint8Array(session.recvKey.authTag).buffer;
    const recvKey = await decryptSessionKey(recvKeyBuf, recvKeyIV, recvKeyTag, encryptionKey);

    console.log(`[Session Manager] ✓ Loaded keys from IndexedDB for session ${sessionId}`);
    console.log(`[Session Manager] ✓ Reusing existing session keys for session ${sessionId}`);

    return {
      ...session,
      status: session.status || 'active', // Default to active for backward compatibility
      rootKey,
      sendKey,
      recvKey
    };
  } catch (error) {
    console.error(`[Session Manager] ✗ Failed to load session ${sessionId}:`, error.message);
    throw new Error(`Failed to load session: ${error.message}`);
  }
}

/**
 * Initializes session encryption key cache for user
 * Call this after login to cache the encryption key
 * @param {string} userId - User ID
 * @param {string} password - User password
 * @returns {Promise<void>}
 */
export async function initializeSessionEncryption(userId, password) {
  await getSessionEncryptionKey(userId, password);
}

/**
 * Updates session sequence number
 * @param {string} sessionId - Session identifier
 * @param {number} seq - New sequence number
 * @param {string} userId - User ID (for encryption key lookup)
 * @returns {Promise<void>}
 */
export async function updateSessionSeq(sessionId, seq, userId = null) {
  try {
    const session = await loadSession(sessionId, userId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.lastSeq = seq;
    session.lastTimestamp = Date.now();
    session.updatedAt = new Date().toISOString();

    // Re-encrypt and store
    await storeSession(session, userId);
  } catch (error) {
    throw new Error(`Failed to update session sequence: ${error.message}`);
  }
}

/**
 * Gets send key for session
 * @param {string} sessionId - Session identifier
 * @param {string} userId - User ID (for encryption key lookup)
 * @returns {Promise<ArrayBuffer>} Send key
 */
/**
 * Ensures a self-storage session exists, creating it if necessary
 * For file storage, we create a session with a randomly generated shared secret
 * @param {string} sessionId - Session identifier (e.g., `storage-${userId}`)
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function ensureStorageSession(sessionId, userId) {
  try {
    // Check if session already exists
    const existing = await loadSession(sessionId, userId);
    if (existing) {
      return; // Session already exists
    }

    // Generate a random shared secret for self-storage (256 bits)
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32)).buffer;

    // Derive session keys using HKDF (same as normal sessions)
    const { deriveSessionKeys } = await import('./ecdh.js');
    const { rootKey, sendKey, recvKey } = await deriveSessionKeys(
      sharedSecret,
      sessionId,
      userId,
      userId // For self-storage, peerId = userId
    );

    // Create session (will use cached encryption key if available)
    await createSession(sessionId, userId, userId, rootKey, sendKey, recvKey, null);

    console.log(`✓ Storage session created: ${sessionId}`);
  } catch (error) {
    throw new Error(`Failed to ensure storage session: ${error.message}`);
  }
}

export async function getSendKey(sessionId, userId = null) {
  try {
    const session = await loadSession(sessionId, userId);
    if (!session) {
      // If it's a storage session, try to create it
      if (sessionId && sessionId.startsWith('storage-') && userId) {
        await ensureStorageSession(sessionId, userId);
        const newSession = await loadSession(sessionId, userId);
        if (newSession) {
          return newSession.sendKey;
        }
      }
      throw new Error('Session not found');
    }
    return session.sendKey;
  } catch (error) {
    throw new Error(`Failed to get send key: ${error.message}`);
  }
}

/**
 * Gets receive key for session
 * @param {string} sessionId - Session identifier
 * @param {string} userId - User ID (for encryption key lookup)
 * @returns {Promise<ArrayBuffer>} Receive key
 */
export async function getRecvKey(sessionId, userId = null) {
  try {
    const session = await loadSession(sessionId, userId);
    if (!session) {
      // If it's a storage session, try to create it
      if (sessionId && sessionId.startsWith('storage-') && userId) {
        await ensureStorageSession(sessionId, userId);
        const newSession = await loadSession(sessionId, userId);
        if (newSession) {
          return newSession.recvKey;
        }
      }
      throw new Error('Session not found');
    }
    return session.recvKey;
  } catch (error) {
    throw new Error(`Failed to get recv key: ${error.message}`);
  }
}

/**
 * Gets root key for session
 * @param {string} sessionId - Session identifier
 * @param {string} userId - User ID (for encryption key lookup)
 * @returns {Promise<ArrayBuffer>} Root key
 */
export async function getRootKey(sessionId, userId = null) {
  try {
    const session = await loadSession(sessionId, userId);
    if (!session) {
      throw new Error('Session not found');
    }
    return session.rootKey;
  } catch (error) {
    throw new Error(`Failed to get root key: ${error.message}`);
  }
}

/**
 * Stores session (updates existing or creates new) with encrypted keys
 * @param {Object} session - Session object with decrypted keys
 * @param {string} userId - User ID (for encryption key lookup)
 * @returns {Promise<void>}
 */
export async function storeSession(session, userId = null) {
  try {
    if (!userId) {
      userId = session.userId;
    }

    // Get encryption key from cache
    const cached = sessionEncryptionKeyCache.get(userId);
    if (!cached || cached.expiresAt <= Date.now()) {
      throw new Error('Session encryption key not available. Call initializeSessionEncryption() first.');
    }
    const encryptionKey = cached.key;

    // Encrypt keys
    const rootKeyEnc = await encryptSessionKey(session.rootKey, encryptionKey);
    const sendKeyEnc = await encryptSessionKey(session.sendKey, encryptionKey);
    const recvKeyEnc = await encryptSessionKey(session.recvKey, encryptionKey);

    const sessionToStore = {
      ...session,
      rootKey: {
        encrypted: Array.from(new Uint8Array(rootKeyEnc.encrypted)),
        iv: Array.from(rootKeyEnc.iv),
        authTag: Array.from(new Uint8Array(rootKeyEnc.authTag))
      },
      sendKey: {
        encrypted: Array.from(new Uint8Array(sendKeyEnc.encrypted)),
        iv: Array.from(sendKeyEnc.iv),
        authTag: Array.from(new Uint8Array(sendKeyEnc.authTag))
      },
      recvKey: {
        encrypted: Array.from(new Uint8Array(recvKeyEnc.encrypted)),
        iv: Array.from(recvKeyEnc.iv),
        authTag: Array.from(new Uint8Array(recvKeyEnc.authTag))
      },
      encrypted: true,
      updatedAt: new Date().toISOString()
    };

    const db = await openDB();
    const transaction = db.transaction([SESSIONS_STORE], 'readwrite');
    const store = transaction.objectStore(SESSIONS_STORE);

    await new Promise((resolve, reject) => {
      const request = store.put(sessionToStore);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    throw new Error(`Failed to store session: ${error.message}`);
  }
}

/**
 * Deletes session
 * @param {string} sessionId - Session identifier
 * @returns {Promise<void>}
 */
export async function deleteSession(sessionId) {
  try {
    const db = await openDB();
    const transaction = db.transaction([SESSIONS_STORE], 'readwrite');
    const store = transaction.objectStore(SESSIONS_STORE);

    await new Promise((resolve, reject) => {
      const request = store.delete(sessionId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`[Session Manager] ✓ Session deleted: ${sessionId}`);
  } catch (error) {
    throw new Error(`Failed to delete session: ${error.message}`);
  }
}

/**
 * Marks old session keys as inactive for a peer when a new session is created
 * This prevents accumulation of abandoned session keys while preserving history
 * @param {string} userId - Our user ID
 * @param {string} peerId - Peer user ID
 * @param {string} currentSessionId - The current active session ID
 * @returns {Promise<number>} Number of old sessions marked inactive
 */
export async function cleanupOldSessionsForPeer(userId, peerId, currentSessionId) {
  try {
    console.log(`[Session Manager] Marking old session keys as inactive for peer ${peerId}, activating session ${currentSessionId}`);
    
    const db = await openDB();
    const transaction = db.transaction([SESSIONS_STORE], 'readwrite');
    const store = transaction.objectStore(SESSIONS_STORE);

    const allSessions = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    // Find sessions with the same peer but different session ID
    const oldSessions = allSessions.filter(session => {
      const isSamePeer = (session.userId === userId && session.peerId === peerId) ||
                        (session.userId === peerId && session.peerId === userId);
      const isDifferentSession = session.sessionId !== currentSessionId;
      const isCurrentlyActive = session.status !== 'inactive'; // Only mark active sessions as inactive
      return isSamePeer && isDifferentSession && isCurrentlyActive;
    });

    if (oldSessions.length === 0) {
      console.log(`[Session Manager] No old active sessions to mark inactive for peer ${peerId}`);
      return 0;
    }

    console.log(`[Session Manager] Found ${oldSessions.length} old active session(s) to mark inactive for peer ${peerId}`);

    // Mark old sessions as inactive instead of deleting
    let markedCount = 0;
    for (const oldSession of oldSessions) {
      try {
        // Update session status to inactive
        oldSession.status = 'inactive';
        oldSession.statusReason = `Superseded by new session ${currentSessionId}`;
        oldSession.statusChangedAt = new Date().toISOString();
        oldSession.updatedAt = new Date().toISOString();

        await new Promise((resolve, reject) => {
          const updateRequest = store.put(oldSession);
          updateRequest.onsuccess = () => {
            markedCount++;
            console.log(`[Session Manager] ✓ Marked key for session ${oldSession.sessionId} as Inactive (superseded by ${currentSessionId})`);
            resolve();
          };
          updateRequest.onerror = () => reject(updateRequest.error);
        });
      } catch (error) {
        console.error(`[Session Manager] Failed to mark session ${oldSession.sessionId} as inactive:`, error);
      }
    }

    // Mark current session as active
    try {
      const currentSession = allSessions.find(s => s.sessionId === currentSessionId);
      if (currentSession) {
        currentSession.status = 'active';
        currentSession.statusReason = null;
        currentSession.statusChangedAt = new Date().toISOString();
        currentSession.updatedAt = new Date().toISOString();
        
        await new Promise((resolve, reject) => {
          const updateRequest = store.put(currentSession);
          updateRequest.onsuccess = () => {
            console.log(`[Session Manager] ✓ Activated keys for session ${currentSessionId}`);
            resolve();
          };
          updateRequest.onerror = () => reject(updateRequest.error);
        });
      }
    } catch (error) {
      console.error(`[Session Manager] Failed to activate session ${currentSessionId}:`, error);
    }

    if (markedCount > 0) {
      console.log(`[Session Manager] ✓ Outdated session keys moved to inactive state: ${markedCount} session(s) for peer ${peerId}`);
    }
    
    return markedCount;
  } catch (error) {
    console.error(`[Session Manager] Error marking old sessions as inactive:`, error);
    return 0;
  }
}

/**
 * Retroactively marks old sessions as inactive based on backend active sessions
 * This fixes sessions that were created before cleanup logic was implemented
 * @param {string} userId - User ID
 * @param {Set<string>} activeSessionIds - Set of active session IDs from backend
 * @returns {Promise<number>} Number of sessions marked inactive
 */
export async function cleanupInactiveSessions(userId, activeSessionIds) {
  try {
    console.log(`[Session Manager] Cleaning up inactive sessions for user ${userId}`);
    
    // Use metadata-only function to avoid decryption issues
    const allSessions = await getSessionMetadata(userId);
    
    // Also get all sessions from IndexedDB for updating (including those not belonging to user)
    const db = await openDB();
    const transaction = db.transaction([SESSIONS_STORE], 'readwrite');
    const store = transaction.objectStore(SESSIONS_STORE);

    const allSessionsRaw = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    // Group sessions by peer (using metadata)
    const sessionsByPeer = new Map(); // peerId -> [session metadata]
    for (const session of allSessions) {
      const peerId = session.userId === userId ? session.peerId : session.userId;
      if (!sessionsByPeer.has(peerId)) {
        sessionsByPeer.set(peerId, []);
      }
      sessionsByPeer.get(peerId).push(session);
    }

    let markedCount = 0;

    // For each peer, determine active session and mark others as inactive
    for (const [peerId, peerSessions] of sessionsByPeer.entries()) {
      // Find active session (backend has priority)
      let activeSessionId = null;
      
      // Check backend active sessions first
      const backendActiveSession = peerSessions.find(s => activeSessionIds.has(s.sessionId));
      if (backendActiveSession) {
        activeSessionId = backendActiveSession.sessionId;
      } else {
        // No backend active session - find most recent non-inactive session
        const activeSessions = peerSessions.filter(s => s.status !== 'inactive');
        if (activeSessions.length > 0) {
          activeSessions.sort((a, b) => {
            const timeA = new Date(a.lastActivity || a.updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.lastActivity || b.updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          });
          activeSessionId = activeSessions[0].sessionId;
        }
      }

      if (!activeSessionId) {
        continue; // No active session found for this peer
      }

      // Mark all other sessions for this peer as inactive
      for (const sessionMeta of peerSessions) {
        // Find the raw session object for updating
        const rawSession = allSessionsRaw.find(s => s.sessionId === sessionMeta.sessionId);
        if (!rawSession) continue;

        if (sessionMeta.sessionId !== activeSessionId && rawSession.status !== 'inactive') {
          try {
            rawSession.status = 'inactive';
            rawSession.statusReason = `Superseded by session ${activeSessionId.substring(0, 8)}...`;
            rawSession.statusChangedAt = new Date().toISOString();
            rawSession.updatedAt = new Date().toISOString();

            await new Promise((resolve, reject) => {
              const updateRequest = store.put(rawSession);
              updateRequest.onsuccess = () => {
                markedCount++;
                console.log(`[Session Manager] ✓ Retroactively marked session ${sessionMeta.sessionId} as inactive for peer ${peerId}`);
                resolve();
              };
              updateRequest.onerror = () => reject(updateRequest.error);
            });
          } catch (error) {
            console.error(`[Session Manager] Failed to mark session ${sessionMeta.sessionId} as inactive:`, error);
          }
        } else if (sessionMeta.sessionId === activeSessionId && rawSession.status !== 'active') {
          // Ensure active session is marked as active
          try {
            rawSession.status = 'active';
            rawSession.statusReason = null;
            rawSession.statusChangedAt = new Date().toISOString();
            rawSession.updatedAt = new Date().toISOString();

            await new Promise((resolve, reject) => {
              const updateRequest = store.put(rawSession);
              updateRequest.onsuccess = () => {
                console.log(`[Session Manager] ✓ Marked session ${activeSessionId} as active for peer ${peerId}`);
                resolve();
              };
              updateRequest.onerror = () => reject(updateRequest.error);
            });
          } catch (error) {
            console.error(`[Session Manager] Failed to mark session ${activeSessionId} as active:`, error);
          }
        }
      }
    }

    if (markedCount > 0) {
      console.log(`[Session Manager] ✓ Retroactively marked ${markedCount} session(s) as inactive`);
    }
    
    return markedCount;
  } catch (error) {
    console.error(`[Session Manager] Error cleaning up inactive sessions:`, error);
    return 0;
  }
}

/**
 * Gets session metadata without decrypting keys (for status management)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of session metadata
 */
export async function getSessionMetadata(userId) {
  try {
    const db = await openDB();
    
    // Verify store exists before attempting transaction
    if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
      console.warn('sessions store does not exist, returning empty array');
      return [];
    }
    
    const transaction = db.transaction([SESSIONS_STORE], 'readonly');
    const store = transaction.objectStore(SESSIONS_STORE);

    const sessions = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    // Filter by userId and return metadata only (no decryption)
    const metadataSessions = [];
    for (const s of sessions) {
      if (s.userId === userId || s.peerId === userId) {
        metadataSessions.push({
          sessionId: s.sessionId,
          userId: s.userId,
          peerId: s.peerId,
          status: s.status || 'active', // Default to active for backward compatibility
          statusReason: s.statusReason || null,
          statusChangedAt: s.statusChangedAt || null,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          lastActivity: s.lastActivity,
          lastSeq: s.lastSeq,
          lastTimestamp: s.lastTimestamp,
          encrypted: s.encrypted,
          hasKeys: !!(s.rootKey && s.sendKey && s.recvKey) // Check if keys exist without decrypting
        });
      }
    }
    return metadataSessions;
  } catch (error) {
    console.error('Failed to get session metadata:', error);
    return [];
  }
}

/**
 * Gets all sessions for a user (with decrypted keys)
 * @param {string} userId - User ID
 * @param {string} password - Optional password for decryption
 * @returns {Promise<Array>} Array of sessions with decrypted keys
 */
export async function getUserSessions(userId, password = null) {
  try {
    const db = await openDB();
    
    // Verify store exists before attempting transaction
    if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
      console.warn('sessions store does not exist, returning empty array');
      return [];
    }
    
    const transaction = db.transaction([SESSIONS_STORE], 'readonly');
    const store = transaction.objectStore(SESSIONS_STORE);

    const sessions = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    // Filter by userId and decrypt keys
    const decryptedSessions = [];
    let skippedCount = 0;
    
    for (const s of sessions) {
      if (s.userId === userId || s.peerId === userId) {
        try {
          const decrypted = await loadSession(s.sessionId, userId, password);
          if (decrypted) {
            decryptedSessions.push(decrypted);
          }
        } catch (error) {
          // Skip sessions that can't be decrypted
          // This can happen if:
          // 1. Password cache expired (normal - user needs to log in again)
          // 2. Session was encrypted with different password (user changed password)
          // 3. Session was encrypted with different salt (rare, but possible)
          skippedCount++;
          // Only log first few to avoid spam
          if (skippedCount <= 3) {
            console.warn(`[Session Manager] Skipping session ${s.sessionId.substring(0, 8)}... (decryption failed):`, error.message);
          }
        }
      }
    }
    
    if (skippedCount > 0) {
      console.log(`[Session Manager] Skipped ${skippedCount} session(s) that could not be decrypted (password may have changed or cache expired)`);
    }
    
    return decryptedSessions;
  } catch (error) {
    console.error('Failed to get user sessions:', error);
    // Return empty array instead of throwing to prevent breaking the UI
    return [];
  }
}

/**
 * Checks whether a nonce hash has already been used for a given session.
 * Nonces are tracked as SHA-256(nonceBytes) hex strings in the session record.
 * @param {string} sessionId - Session identifier
 * @param {string} nonceHash - Hex-encoded SHA-256 hash of the nonce
 * @returns {Promise<boolean>} True if nonce hash has been seen before
 */
export async function isNonceUsed(sessionId, nonceHash) {
  const db = await openDB();
  const transaction = db.transaction([SESSIONS_STORE], 'readonly');
  const store = transaction.objectStore(SESSIONS_STORE);

  const session = await new Promise((resolve, reject) => {
    const request = store.get(sessionId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  if (!session || !Array.isArray(session.usedNonceHashes)) {
    return false;
  }

  return session.usedNonceHashes.includes(nonceHash);
}

/**
 * Stores a nonce hash for a session, keeping only the most recent 200 entries.
 * This prevents unbounded growth while still detecting recent replays.
 * @param {string} sessionId - Session identifier
 * @param {string} nonceHash - Hex-encoded SHA-256 hash of the nonce
 * @returns {Promise<void>}
 */
export async function storeUsedNonce(sessionId, nonceHash) {
  const db = await openDB();
  const transaction = db.transaction([SESSIONS_STORE], 'readwrite');
  const store = transaction.objectStore(SESSIONS_STORE);

  const session = await new Promise((resolve, reject) => {
    const request = store.get(sessionId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  if (!session) {
    // If the session does not exist, nothing to track.
    return;
  }

  let used = Array.isArray(session.usedNonceHashes)
    ? session.usedNonceHashes.slice()
    : [];

  if (!used.includes(nonceHash)) {
    used.push(nonceHash);
    // Keep only the last 200 nonces to bound storage.
    if (used.length > 200) {
      used = used.slice(used.length - 200);
    }
    session.usedNonceHashes = used;

    await new Promise((resolve, reject) => {
      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * Rotates ephemeral keys for forward secrecy (Phase 6)
 * 
 * Generates new ephemeral key pair, derives new session keys,
 * and updates the session. Old ephemeral keys are discarded.
 * 
 * FORWARD SECRECY: Old session keys cannot decrypt new messages
 * after rotation, even if old ephemeral keys are compromised.
 * 
 * @param {string} sessionId - Session identifier
 * @param {string} userId - Our user ID
 * @param {string} peerId - Peer user ID
 * @param {CryptoKey} newEphPublicKey - New ephemeral public key from peer
 * @param {CryptoKey} newEphPrivateKey - Our new ephemeral private key
 * @returns {Promise<{rootKey: ArrayBuffer, sendKey: ArrayBuffer, recvKey: ArrayBuffer}>} New session keys
 */
export async function rotateEphemeralKeys(sessionId, userId, peerId, newEphPublicKey, newEphPrivateKey) {
  try {
    // Import ECDH functions
    const ecdhModule = await import('./ecdh.js');
    const { computeSharedSecret, deriveSessionKeys } = ecdhModule;
    
    // Compute new shared secret from new ephemeral keys
    const newSharedSecret = await computeSharedSecret(newEphPrivateKey, newEphPublicKey);
    
    // Derive new session keys using same HKDF procedure
    const newKeys = await deriveSessionKeys(newSharedSecret, sessionId, userId, peerId);
    
    // Update session with new keys
    const session = await loadSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Update session with new keys
    session.rootKey = newKeys.rootKey;
    session.sendKey = newKeys.sendKey;
    session.recvKey = newKeys.recvKey;
    session.updatedAt = new Date().toISOString();
    session.keyRotationCount = (session.keyRotationCount || 0) + 1;
    session.lastKeyRotation = new Date().toISOString();
    
    // Store updated session (with encryption)
    await storeSession(session, userId);
    
    console.log(`✓ Keys rotated for session: ${sessionId} (rotation #${session.keyRotationCount})`);
    
    return newKeys;
  } catch (error) {
    throw new Error(`Failed to rotate keys: ${error.message}`);
  }
}

/**
 * Rotates keys for a session (legacy function name, calls rotateEphemeralKeys)
 * @param {string} sessionId - Session identifier
 * @returns {Promise<void>}
 */
export async function rotateKeys(sessionId) {
  // This is a placeholder - actual rotation requires new ephemeral keys
  // Use rotateEphemeralKeys() with new key pair instead
  console.warn('rotateKeys() is deprecated. Use rotateEphemeralKeys() with new ephemeral keys.');
  throw new Error('Use rotateEphemeralKeys() with new ephemeral key pair');
}


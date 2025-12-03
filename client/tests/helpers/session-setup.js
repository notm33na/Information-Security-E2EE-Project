/**
 * Session Setup Helper for Tests
 * Creates test sessions with unencrypted keys for testing
 */

// Note: fake-indexeddb/auto is already loaded in jest.setup.cjs
// IndexedDB and IDBKeyRange should be available globally

const DB_NAME = 'InfosecCryptoDB';
const SESSIONS_STORE = 'sessions';

/**
 * Creates a test session with unencrypted keys (for testing only)
 * @param {string} sessionId - Session identifier
 * @param {string} userId - User ID
 * @param {string} peerId - Peer user ID
 * @param {ArrayBuffer} sendKey - Send key (32 bytes)
 * @param {ArrayBuffer} recvKey - Receive key (32 bytes)
 * @param {ArrayBuffer} rootKey - Root key (32 bytes, optional)
 * @returns {Promise<void>}
 */
/**
 * Opens IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const store = db.createObjectStore(SESSIONS_STORE, { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains('sessionEncryptionKeys')) {
        db.createObjectStore('sessionEncryptionKeys', { keyPath: 'userId' });
      }
    };
  });
}

/**
 * Converts ArrayBuffer to base64 string
 * @param {ArrayBuffer} buffer - Buffer to convert
 * @returns {string} Base64 string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function createTestSession(sessionId, userId, peerId, sendKey, recvKey, rootKey = null) {
  try {
    const db = await openDB();
    const transaction = db.transaction([SESSIONS_STORE], 'readwrite');
    const store = transaction.objectStore(SESSIONS_STORE);
    
    // Create session with unencrypted keys (for testing)
    // loadSession expects base64 strings for unencrypted sessions
    const session = {
      sessionId,
      userId,
      peerId,
      sendKey: arrayBufferToBase64(sendKey), // Store as base64 string
      recvKey: arrayBufferToBase64(recvKey), // Store as base64 string
      rootKey: arrayBufferToBase64(rootKey || sendKey), // Store as base64 string
      encrypted: false, // Mark as unencrypted for tests
      lastSeq: 0,
      lastTimestamp: Date.now(),
      usedNonceHashes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await new Promise((resolve, reject) => {
      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    // If IndexedDB is not available, use a mock
    console.warn('IndexedDB not available, using in-memory session store:', error.message);
    // Store in global mock if needed
    if (!global.testSessions) {
      global.testSessions = new Map();
    }
    global.testSessions.set(sessionId, {
      sessionId,
      userId,
      peerId,
      sendKey: arrayBufferToBase64(sendKey),
      recvKey: arrayBufferToBase64(recvKey),
      rootKey: arrayBufferToBase64(rootKey || sendKey),
      encrypted: false,
      lastSeq: 0,
      lastTimestamp: Date.now(),
      usedNonceHashes: []
    });
  }
}


/**
 * Global Test Setup
 * Configures test environment, mocks, and utilities
 */

// Setup IndexedDB mock
// Note: fake-indexeddb/auto is already loaded in jest.setup.cjs
// This function just ensures it's available
function setupIndexedDBMock() {
  // fake-indexeddb/auto should have already set up indexedDB and IDBKeyRange
  // Just verify they exist
  if (typeof globalThis.indexedDB === 'undefined') {
    throw new Error('IndexedDB not available. Check jest.setup.cjs');
  }
}

async function clearIndexedDB() {
  try {
    if (globalThis.indexedDB) {
      const deleteRequest = indexedDB.deleteDatabase('InfosecCryptoDB');
      await new Promise((resolve, reject) => {
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      });
    }
  } catch (error) {
    // Ignore errors
  }
}

// Setup global mocks
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Mock Web Crypto API if needed (Node.js environment)
  if (typeof globalThis.crypto === 'undefined') {
    const crypto = await import('crypto');
    globalThis.crypto = crypto.webcrypto;
    if (!globalThis.crypto.getRandomValues) {
      globalThis.crypto.getRandomValues = (arr) => {
        return crypto.randomFillSync(arr);
      };
    }
  }
  
  // Setup IndexedDB mock
  setupIndexedDBMock();
});

beforeEach(async () => {
  // Clear IndexedDB between tests
  await clearIndexedDB();
  
  // Clear console mocks if any
  jest.clearAllMocks();
});

afterAll(async () => {
  // Cleanup
  await clearIndexedDB();
});

// Extend Jest matchers
expect.extend({
  toEqualBytes: async (received, expected) => {
    const { toEqualBytes } = await import('./helpers/assertions.js');
    return toEqualBytes(received, expected);
  }
});

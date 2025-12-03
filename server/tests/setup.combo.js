/**
 * Combo Test Setup
 * Additional setup for combo test suites
 */

import { setupTestDB, cleanTestDB, closeTestDB } from './setup.js';
import { clearTestLogs } from './setup.js';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/infosec_test';

// Setup Web Crypto API for Node.js if needed
if (typeof globalThis.crypto === 'undefined') {
  const crypto = await import('crypto');
  if (crypto.webcrypto) {
    globalThis.crypto = crypto.webcrypto;
  }
}

// Global test setup
beforeAll(async () => {
  await setupTestDB();
  clearTestLogs();
});

// Global test cleanup
afterAll(async () => {
  await closeTestDB();
});

// Clean between tests
beforeEach(async () => {
  await cleanTestDB();
});

export { setupTestDB, cleanTestDB, closeTestDB, clearTestLogs };


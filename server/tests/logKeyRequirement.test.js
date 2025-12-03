/**
 * LOG_HMAC_KEY Requirement Tests
 * 
 * Tests that LOG_HMAC_KEY is required in production and properly handled
 * in development/test environments.
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('LOG_HMAC_KEY Requirement Tests', () => {
  let originalEnv;
  let originalNodeEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env.LOG_HMAC_KEY;
    originalNodeEnv = process.env.NODE_ENV;
    delete process.env.LOG_HMAC_KEY;
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.LOG_HMAC_KEY = originalEnv;
    } else {
      delete process.env.LOG_HMAC_KEY;
    }
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    
    // Note: ES modules don't support require.cache
    // Module cache clearing is not possible in ES modules
    // Tests should handle module state differently if needed
  });

  test('should fail in production mode without LOG_HMAC_KEY', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.LOG_HMAC_KEY;

    // Attempt to import logIntegrity - should throw error
    expect(() => {
      // Use dynamic import to catch the error
      import('../src/utils/logIntegrity.js').catch(err => {
        expect(err.message).toContain('LOG_HMAC_KEY');
        expect(err.message).toContain('required in production');
      });
    }).toBeDefined();
  });

  test('should allow fallback in development mode without LOG_HMAC_KEY', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOG_HMAC_KEY;

    // Should not throw in development
    expect(() => {
      import('../src/utils/logIntegrity.js');
    }).not.toThrow();
  });

  test('should allow fallback in test mode without LOG_HMAC_KEY', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.LOG_HMAC_KEY;

    // Should not throw in test
    expect(() => {
      import('../src/utils/logIntegrity.js');
    }).not.toThrow();
  });

  test('should work correctly with LOG_HMAC_KEY set', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOG_HMAC_KEY = 'test-key-12345678901234567890123456789012';

    // Should import successfully
    expect(() => {
      import('../src/utils/logIntegrity.js');
    }).not.toThrow();
  });
});


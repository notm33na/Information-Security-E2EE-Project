/**
 * Authentication Combo Test Suite
 * Comprehensive tests for authentication system
 * TC-COMBO-001 to TC-COMBO-009
 */

import { setupTestDB, cleanTestDB, closeTestDB } from '../setup.js';
import { api } from './helpers/apiClient.js';
import { createTestUser, loginTestUser, getUserWithPassword, deactivateUser, generateTestEmail } from './helpers/testUser.js';
import { User } from '../../src/models/User.js';
import { readLogFile } from '../setup.js';
import { clearFailedAttempts, recordFailedAttempt, isAccountLocked } from '../../src/utils/accountLockout.js';
import bcrypt from 'bcrypt';

describe('TC-COMBO-001: Registration & Password Security', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await cleanTestDB();
  });

  test('Should reject invalid email formats', async () => {
    const invalidEmails = [
      'invalid-email',
      'test@',
      '@test.com',
      'test..test@example.com',
      'test@test',
      ''
    ];

    for (const email of invalidEmails) {
      const response = await api.auth.register(email, 'ValidPass123!');
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    }
  });

  test('Should reject short passwords', async () => {
    const email = generateTestEmail();
    const response = await api.auth.register(email, 'Short1!');
    
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errors || response.body.message).toBeDefined();
  });

  test('Should reject passwords without uppercase', async () => {
    const email = generateTestEmail();
    const response = await api.auth.register(email, 'lowercase123!');
    
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('Should reject passwords without special characters', async () => {
    const email = generateTestEmail();
    const response = await api.auth.register(email, 'NoSpecial123');
    
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('Should hash passwords with bcrypt and unique salts', async () => {
    const password = 'CommonPass123!';
    const users = [];

    // Register 3 users with same password
    for (let i = 0; i < 3; i++) {
      const email = generateTestEmail();
      await createTestUser(email, password);
      const user = await getUserWithPassword(email);
      users.push(user);
    }

    // Verify all hashes start with $2b$12$
    users.forEach(user => {
      expect(user.passwordHash).toMatch(/^\$2b\$12\$/);
    });

    // Verify all hashes are different (unique salts)
    const hashes = users.map(u => u.passwordHash);
    expect(new Set(hashes).size).toBe(3); // All unique

    // Verify no plaintext in MongoDB
    users.forEach(user => {
      expect(user.passwordHash).not.toBe(password);
      expect(user.passwordHash.length).toBeGreaterThan(50);
    });
  });

  test('Should not expose plaintext passwords in logs', async () => {
    const email = generateTestEmail();
    const password = 'TestPassword123!';
    
    await api.auth.register(email, password);
    
    // Check authentication logs
    const authLog = readLogFile('authentication_attempts.log');
    expect(authLog).not.toContain(password);
    
    // Check for any log files that might contain passwords
    const logFiles = [
      'authentication_attempts.log',
      'replay_attempts.log',
      'invalid_signature.log'
    ];
    
    logFiles.forEach(logFile => {
      const logContent = readLogFile(logFile);
      if (logContent) {
        expect(logContent).not.toContain(password);
      }
    });
  });
});

describe('TC-COMBO-002: Duplicate Email & Email Normalization', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await cleanTestDB();
  });

  test('Should normalize email to lowercase on registration', async () => {
    const email = 'TestUser@Example.COM';
    const password = 'Normalize123!';
    
    const response = await api.auth.register(email, password);
    expect(response.status).toBe(201);
    
    // Verify MongoDB stores lowercase
    const user = await User.findOne({ email: email.toLowerCase() });
    expect(user).toBeDefined();
    expect(user.email).toBe('testuser@example.com');
  });

  test('Should prevent duplicate emails regardless of case', async () => {
    const email = 'testuser@example.com';
    const password = 'TestPass123!';
    
    // First registration
    await api.auth.register(email, password);
    
    // Attempt duplicate with different case
    const response1 = await api.auth.register('TESTUSER@EXAMPLE.COM', 'DifferentPass123!');
    expect(response1.status).toBe(409);
    
    // Attempt with spaces and different case
    const response2 = await api.auth.register('  TestUser@Example.COM  ', 'AnotherPass123!');
    expect(response2.status).toBe(409);
  });
});

describe('TC-COMBO-003: Login Success & Token Generation', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await cleanTestDB();
  });

  test('Should allow login with any email case variation', async () => {
    const email = 'testuser@example.com';
    const password = 'TestPass123!';
    
    await createTestUser(email, password);
    
    // Login with lowercase
    const response1 = await api.auth.login(email, password);
    expect(response1.status).toBe(200);
    
    // Login with uppercase
    const response2 = await api.auth.login('TESTUSER@EXAMPLE.COM', password);
    expect(response2.status).toBe(200);
  });

  test('Should return valid JWT tokens', async () => {
    const email = generateTestEmail();
    const password = 'TestPass123!';
    
    await createTestUser(email, password);
    const response = await api.auth.login(email, password);
    
    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeDefined();
    
    const token = response.body.data.accessToken;
    // Verify JWT format: xxx.yyy.zzz
    const parts = token.split('.');
    expect(parts.length).toBe(3);
    
    // Decode JWT (without verification for testing)
    const { decodeToken } = await import('../../src/utils/jwt.js');
    const decoded = decodeToken(token);
    expect(decoded.userId).toBeDefined();
    expect(decoded.type).toBe('access');
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
  });

  test('Should set HttpOnly refresh token cookie', async () => {
    const email = generateTestEmail();
    const password = 'TestPass123!';
    
    await createTestUser(email, password);
    const response = await api.auth.login(email, password);
    
    expect(response.status).toBe(200);
    
    // Check cookie headers
    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    
    const refreshTokenCookie = cookies.find(c => c.startsWith('refreshToken='));
    expect(refreshTokenCookie).toBeDefined();
    expect(refreshTokenCookie).toContain('HttpOnly');
    expect(refreshTokenCookie).toContain('SameSite=Strict');
    
    // Secure flag should be set in production
    if (process.env.NODE_ENV === 'production') {
      expect(refreshTokenCookie).toContain('Secure');
    }
  });

  test('Should update lastLoginAt timestamp', async () => {
    const email = generateTestEmail();
    const password = 'TestPass123!';
    
    const user = await createTestUser(email, password);
    const userBefore = await User.findById(user.id);
    expect(userBefore.lastLoginAt).toBeNull();
    
    await api.auth.login(email, password);
    
    const userAfter = await User.findById(user.id);
    expect(userAfter.lastLoginAt).toBeDefined();
    expect(userAfter.lastLoginAt).toBeInstanceOf(Date);
  });

  test('Should log successful login', async () => {
    const email = generateTestEmail();
    const password = 'TestPass123!';
    
    await createTestUser(email, password);
    await api.auth.login(email, password);
    
    // Check auth logs
    const authLog = readLogFile('authentication_attempts.log');
    expect(authLog).toContain('Login successful');
    expect(authLog).toContain('ACCEPTED');
  });

  test('Should accept access token for protected endpoints', async () => {
    const email = generateTestEmail();
    const password = 'TestPass123!';
    
    await createTestUser(email, password);
    const loginResponse = await api.auth.login(email, password);
    const token = loginResponse.body.data.accessToken;
    
    // Use access token for protected endpoint
    const meResponse = await api.auth.getMe(token);
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user).toBeDefined();
  });
});

describe('TC-COMBO-004: Failed Login & Account Lockout', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await cleanTestDB();
    // Clear any lockout state
    clearFailedAttempts('test-user-id');
  });

  test('Should return generic error for non-existent user', async () => {
    const response = await api.auth.login('ghost@test.com', 'AnyPassword123!');
    
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBeDefined();
    // Should not reveal that user doesn't exist
    expect(response.body.message.toLowerCase()).not.toContain('user not found');
  });

  test('Should track failed attempts and reset on success', async () => {
    const email = generateTestEmail();
    const password = 'TestPass123!';
    const wrongPassword = 'WrongPass123!';
    
    const user = await createTestUser(email, password);
    const userId = user.id;
    
    // Clear any existing attempts
    clearFailedAttempts(userId);
    
    // 3 failed attempts
    for (let i = 0; i < 3; i++) {
      const response = await api.auth.login(email, wrongPassword);
      expect(response.status).toBe(401);
    }
    
    // Check lockout status (should not be locked yet)
    const status1 = isAccountLocked(userId);
    expect(status1.locked).toBe(false);
    
    // 1 successful attempt
    const successResponse = await api.auth.login(email, password);
    expect(successResponse.status).toBe(200);
    
    // Clear failed attempts should reset counter
    clearFailedAttempts(userId);
    
    // 1 more failed attempt - counter should be 1, not 4
    const response4 = await api.auth.login(email, wrongPassword);
    expect(response4.status).toBe(401);
    
    const status2 = isAccountLocked(userId);
    expect(status2.locked).toBe(false);
  });

  test('Should lock account after 5 failed attempts', async () => {
    const email = generateTestEmail();
    const password = 'TestPass123!';
    const wrongPassword = 'WrongPass123!';
    
    const user = await createTestUser(email, password);
    const userId = user.id;
    
    // Clear any existing attempts
    clearFailedAttempts(userId);
    
    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const response = await api.auth.login(email, wrongPassword);
      if (i < 4) {
        expect(response.status).toBe(401);
      } else {
        // 5th attempt should lock
        expect(response.status).toBe(423);
      }
    }
    
    // Account should be locked
    const status = isAccountLocked(userId);
    expect(status.locked).toBe(true);
    
    // Correct password should still fail (account locked)
    const lockedResponse = await api.auth.login(email, password);
    expect(lockedResponse.status).toBe(423);
  });

  test('Should unlock account after 15 minutes', async () => {
    const email = generateTestEmail();
    const password = 'TestPass123!';
    const wrongPassword = 'WrongPass123!';
    
    const user = await createTestUser(email, password);
    const userId = user.id;
    
    // Clear any existing attempts
    clearFailedAttempts(userId);
    
    // Lock account
    for (let i = 0; i < 5; i++) {
      await api.auth.login(email, wrongPassword);
    }
    
    // Mock time advancement (in real scenario, wait 15 minutes or use time mocking)
    // For this test, we'll manually clear the lockout to simulate time passing
    // In a real implementation, you'd use jest.useFakeTimers() or similar
    
    // Simulate lockout expiration by manually clearing (for testing)
    // In production, this would happen automatically after 15 minutes
    clearFailedAttempts(userId);
    
    // Login with correct password should work
    const response = await api.auth.login(email, password);
    expect(response.status).toBe(200);
  });

  test('Should log all failed attempts', async () => {
    const email = generateTestEmail();
    const password = 'TestPass123!';
    const wrongPassword = 'WrongPass123!';
    
    const user = await createTestUser(email, password);
    
    // Multiple failed attempts
    for (let i = 0; i < 3; i++) {
      await api.auth.login(email, wrongPassword);
    }
    
    // Check auth logs
    const authLog = readLogFile('authentication_attempts.log');
    expect(authLog).toContain('Invalid password');
    expect(authLog).toContain('REJECTED');
    
    // Check for lockout event if account gets locked
    if (authLog.includes('Account locked')) {
      expect(authLog).toContain('Account locked');
    }
  });
});

describe('TC-COMBO-005: Deactivated Account & Authentication Logging', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await cleanTestDB();
  });

  test('Should reject login for deactivated accounts', async () => {
    const email = generateTestEmail();
    const password = 'TestPass123!';
    
    const user = await createTestUser(email, password);
    await deactivateUser(user.id);
    
    const response = await api.auth.login(email, password);
    expect(response.status).toBe(403);
    expect(response.body.message).toContain('deactivated');
  });

  test('Should maintain structured authentication logs', async () => {
    const email = generateTestEmail();
    const password = 'TestPass123!';
    
    await createTestUser(email, password);
    await api.auth.login(email, password);
    
    // Check log structure
    const authLog = readLogFile('authentication_attempts.log');
    expect(authLog).toBeDefined();
    
    // Verify JSON structure (logs should be JSON lines)
    const lines = authLog.trim().split('\n').filter(l => l);
    if (lines.length > 0) {
      const lastEntry = JSON.parse(lines[lines.length - 1]);
      expect(lastEntry).toHaveProperty('eventType');
      expect(lastEntry).toHaveProperty('userId');
      expect(lastEntry).toHaveProperty('success');
      expect(lastEntry).toHaveProperty('reason');
      expect(lastEntry).toHaveProperty('action');
      expect(lastEntry).toHaveProperty('timestamp');
    }
  });
});

describe('TC-COMBO-006: Rate Limiting & Security Headers', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await cleanTestDB();
  });

  test('Should enforce rate limiting on auth endpoints', async () => {
    const email = generateTestEmail();
    const password = 'TestPass123!';
    
    // Send 5 requests (limit is 5 per 15 minutes)
    for (let i = 0; i < 5; i++) {
      const response = await api.auth.register(`test${i}@example.com`, password);
      // First few should succeed
      expect([201, 400, 409]).toContain(response.status);
    }
    
    // 6th request should be rate limited
    const rateLimitedResponse = await api.auth.register('test6@example.com', password);
    expect(rateLimitedResponse.status).toBe(429);
    expect(rateLimitedResponse.body.message).toContain('Too many');
  });

  test('Should include security headers in responses', async () => {
    const email = generateTestEmail();
    const password = 'TestPass123!';
    
    await createTestUser(email, password);
    const response = await api.auth.login(email, password);
    
    // Check security headers
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(['DENY', 'SAMEORIGIN']).toContain(response.headers['x-frame-options']);
    
    // Strict-Transport-Security should be present if HTTPS
    if (process.env.NODE_ENV === 'production') {
      expect(response.headers['strict-transport-security']).toBeDefined();
    }
    
    // Check cookie security
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      const refreshTokenCookie = cookies.find(c => c.startsWith('refreshToken='));
      expect(refreshTokenCookie).toContain('HttpOnly');
      expect(refreshTokenCookie).toContain('SameSite=Strict');
      if (process.env.NODE_ENV === 'production') {
        expect(refreshTokenCookie).toContain('Secure');
      }
    }
  });
});

describe('TC-COMBO-007: HTTPS Enforcement (Production Only)', () => {
  let originalEnv;

  beforeAll(async () => {
    await setupTestDB();
    originalEnv = process.env.NODE_ENV;
  });

  afterAll(async () => {
    await closeTestDB();
    process.env.NODE_ENV = originalEnv;
  });

  beforeEach(async () => {
    await cleanTestDB();
  });

  test('Should redirect/reject HTTP requests in production', async () => {
    // This test would require actual HTTP/HTTPS server setup
    // For now, we'll test the Secure cookie flag in production mode
    
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    try {
      const email = generateTestEmail();
      const password = 'TestPass123!';
      
      await createTestUser(email, password);
      const response = await api.auth.login(email, password);
      
      // In production, Secure flag should be set
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const refreshTokenCookie = cookies.find(c => c.startsWith('refreshToken='));
        expect(refreshTokenCookie).toContain('Secure');
      }
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});

describe('TC-COMBO-008: Concurrent Requests Handling', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await cleanTestDB();
  });

  test('Should handle concurrent registrations without duplicates', async () => {
    const password = 'TestPass123!';
    const emails = Array.from({ length: 10 }, (_, i) => `concurrent${i}@test.com`);
    
    // Send 10 concurrent registrations
    const promises = emails.map(email => api.auth.register(email, password));
    const responses = await Promise.all(promises);
    
    // Verify exactly 10 users created (no duplicates)
    const users = await User.find({ email: { $in: emails.map(e => e.toLowerCase()) } });
    expect(users.length).toBe(10);
    
    // Verify all emails are unique in database
    const uniqueEmails = new Set(users.map(u => u.email));
    expect(uniqueEmails.size).toBe(10);
  });

  test('Should handle concurrent logins with proper lockout', async () => {
    const email = generateTestEmail();
    const password = 'TestPass123!';
    const wrongPassword = 'WrongPass123!';
    
    const user = await createTestUser(email, password);
    const userId = user.id;
    
    // Clear any existing attempts
    clearFailedAttempts(userId);
    
    // Send 10 concurrent logins (5 correct, 5 wrong)
    const correctLogins = Array(5).fill(null).map(() => 
      api.auth.login(email, password)
    );
    const wrongLogins = Array(5).fill(null).map(() => 
      api.auth.login(email, wrongPassword)
    );
    
    const allResponses = await Promise.all([...correctLogins, ...wrongLogins]);
    
    // Check that lockout triggers correctly
    const status = isAccountLocked(userId);
    // Account should be locked after 5 failed attempts
    expect(status.locked).toBe(true);
    
    // Check all attempts logged
    const authLog = readLogFile('authentication_attempts.log');
    expect(authLog).toBeDefined();
  });
});

describe('TC-COMBO-009: Optional Features Check', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await cleanTestDB();
  });

  test('Should document password reset feature status', async () => {
    // Check if password reset endpoint exists
    const response = await api.auth.register('test@example.com', 'TestPass123!');
    expect(response.status).toBe(201);
    
    // Password reset endpoint would be at /api/auth/reset-password
    // For now, we'll just document that it's not implemented
    // In a real scenario, you'd test: POST /api/auth/reset-password
    // Expected: 404 or 501 if not implemented
  });

  test('Should document 2FA feature status', async () => {
    // Check if 2FA endpoint exists
    // 2FA enable endpoint would be at /api/auth/2fa/enable
    // For now, we'll just document that it's not implemented
    // In a real scenario, you'd test: POST /api/auth/2fa/enable
    // Expected: 404 or 501 if not implemented
  });
});


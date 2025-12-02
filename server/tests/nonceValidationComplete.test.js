/**
 * Complete Nonce Validation Tests
 * 
 * Tests the new server-side nonce uniqueness checking functionality
 * that was added to complete replay protection.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { MessageMeta } from '../src/models/MessageMeta.js';
import { hashNonceBase64, isNonceHashUsed } from '../src/utils/replayProtection.js';
import { setupTestDB, cleanTestDB, closeTestDB, generateTestUser } from './setup.js';
import { userService } from '../src/services/user.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const suiteLogsDir = path.join(__dirname, 'logs', `nonce-complete-${process.pid}-${Date.now()}`);

function ensureSuiteLogsDir() {
  if (fs.existsSync(suiteLogsDir)) {
    fs.rmSync(suiteLogsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(suiteLogsDir, { recursive: true });
}

describe('Complete Nonce Validation Tests', () => {
  let testUser1, testUser2;

  beforeAll(async () => {
    process.env.TEST_LOGS_DIR = suiteLogsDir;
    ensureSuiteLogsDir();
    await setupTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
    if (fs.existsSync(suiteLogsDir)) {
      fs.rmSync(suiteLogsDir, { recursive: true, force: true });
    }
    delete process.env.TEST_LOGS_DIR;
  });

  beforeEach(async () => {
    await cleanTestDB();
    ensureSuiteLogsDir();
    const userData1 = generateTestUser();
    const userData2 = generateTestUser();
    testUser1 = await userService.createUser(userData1.email, userData1.password);
    testUser2 = await userService.createUser(userData2.email, userData2.password);
  });

  describe('isNonceHashUsed Function', () => {
    test('should return false for unused nonce hash', async () => {
      const sessionId = 'test-session-1';
      const nonceBytes = crypto.randomBytes(16);
      const nonceBase64 = nonceBytes.toString('base64');
      const nonceHash = hashNonceBase64(nonceBase64);

      const isUsed = await isNonceHashUsed(sessionId, nonceHash, MessageMeta);
      expect(isUsed).toBe(false);
    });

    test('should return true for used nonce hash in same session', async () => {
      const sessionId = 'test-session-2';
      const timestamp = Date.now();
      const nonceBytes = crypto.randomBytes(16);
      const nonceBase64 = nonceBytes.toString('base64');
      const nonceHash = hashNonceBase64(nonceBase64);

      // Create first message with this nonce
      const message1 = new MessageMeta({
        messageId: `${sessionId}:1:${timestamp}`,
        sessionId,
        sender: testUser1.id,
        receiver: testUser2.id,
        type: 'MSG',
        timestamp,
        seq: 1,
        nonceHash
      });
      await message1.save();

      // Check if nonce is used
      const isUsed = await isNonceHashUsed(sessionId, nonceHash, MessageMeta);
      expect(isUsed).toBe(true);
    });

    test('should return false for same nonce hash in different session', async () => {
      const sessionId1 = 'test-session-3';
      const sessionId2 = 'test-session-4';
      const timestamp = Date.now();
      const nonceBytes = crypto.randomBytes(16);
      const nonceBase64 = nonceBytes.toString('base64');
      const nonceHash = hashNonceBase64(nonceBase64);

      // Create message in session 1
      const message1 = new MessageMeta({
        messageId: `${sessionId1}:1:${timestamp}`,
        sessionId: sessionId1,
        sender: testUser1.id,
        receiver: testUser2.id,
        type: 'MSG',
        timestamp,
        seq: 1,
        nonceHash
      });
      await message1.save();

      // Check in session 2 - should return false (nonce is session-scoped)
      const isUsed = await isNonceHashUsed(sessionId2, nonceHash, MessageMeta);
      expect(isUsed).toBe(false);
    });

    test('should throw error if required parameters are missing', async () => {
      await expect(isNonceHashUsed(null, 'hash', MessageMeta)).rejects.toThrow();
      await expect(isNonceHashUsed('session', null, MessageMeta)).rejects.toThrow();
      await expect(isNonceHashUsed('session', 'hash', null)).rejects.toThrow();
    });
  });

  describe('Nonce Uniqueness Enforcement', () => {
    test('should prevent duplicate nonce in same session via database constraint', async () => {
      const sessionId = 'test-session-5';
      const timestamp = Date.now();
      const nonceBytes = crypto.randomBytes(16);
      const nonceBase64 = nonceBytes.toString('base64');
      const nonceHash = hashNonceBase64(nonceBase64);

      // Create first message
      const message1 = new MessageMeta({
        messageId: `${sessionId}:1:${timestamp}`,
        sessionId,
        sender: testUser1.id,
        receiver: testUser2.id,
        type: 'MSG',
        timestamp,
        seq: 1,
        nonceHash
      });
      await message1.save();

      // Try to create second message with same nonce hash in same session
      const message2 = new MessageMeta({
        messageId: `${sessionId}:2:${timestamp + 1000}`,
        sessionId,
        sender: testUser1.id,
        receiver: testUser2.id,
        type: 'MSG',
        timestamp: timestamp + 1000,
        seq: 2,
        nonceHash // Same nonce hash
      });

      // Should be rejected by unique index
      await expect(message2.save()).rejects.toThrow();
    });

    test('should allow same nonce hash in different sessions', async () => {
      const sessionId1 = 'test-session-6';
      const sessionId2 = 'test-session-7';
      const timestamp = Date.now();
      const nonceBytes = crypto.randomBytes(16);
      const nonceBase64 = nonceBytes.toString('base64');
      const nonceHash = hashNonceBase64(nonceBase64);

      // Create message in session 1
      const message1 = new MessageMeta({
        messageId: `${sessionId1}:1:${timestamp}`,
        sessionId: sessionId1,
        sender: testUser1.id,
        receiver: testUser2.id,
        type: 'MSG',
        timestamp,
        seq: 1,
        nonceHash
      });
      await message1.save();

      // Create message in session 2 with same nonce hash - should succeed
      const message2 = new MessageMeta({
        messageId: `${sessionId2}:1:${timestamp + 1000}`,
        sessionId: sessionId2,
        sender: testUser1.id,
        receiver: testUser2.id,
        type: 'MSG',
        timestamp: timestamp + 1000,
        seq: 1,
        nonceHash // Same nonce hash, different session
      });
      await expect(message2.save()).resolves.toBeDefined();
    });
  });

  describe('Integration with Message Processing', () => {
    test('should detect duplicate nonce before saving', async () => {
      const sessionId = 'test-session-8';
      const timestamp = Date.now();
      const nonceBytes = crypto.randomBytes(16);
      const nonceBase64 = nonceBytes.toString('base64');
      const nonceHash = hashNonceBase64(nonceBase64);

      // Simulate first message being processed
      const message1 = new MessageMeta({
        messageId: `${sessionId}:1:${timestamp}`,
        sessionId,
        sender: testUser1.id,
        receiver: testUser2.id,
        type: 'MSG',
        timestamp,
        seq: 1,
        nonceHash
      });
      await message1.save();

      // Simulate checking nonce before processing second message
      const isUsed = await isNonceHashUsed(sessionId, nonceHash, MessageMeta);
      expect(isUsed).toBe(true);

      // This would be rejected in actual message processing flow
      if (isUsed) {
        // Simulate rejection
        await expect(
          new MessageMeta({
            messageId: `${sessionId}:2:${timestamp + 1000}`,
            sessionId,
            sender: testUser1.id,
            receiver: testUser2.id,
            type: 'MSG',
            timestamp: timestamp + 1000,
            seq: 2,
            nonceHash
          }).save()
        ).rejects.toThrow();
      }
    });
  });
});


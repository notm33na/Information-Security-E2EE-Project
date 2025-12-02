/**
 * Nonce Validation Tests
 *
 * Verifies server-side nonce hashing/validation and MongoDB uniqueness
 * constraints for (sessionId, nonceHash).
 */

import { fileURLToPath } from 'url';
import path from 'path';
import crypto from 'crypto';
import { MessageMeta } from '../../src/models/MessageMeta.js';
import { hashNonceBase64 } from '../../src/utils/replayProtection.js';
import { setupTestDB, cleanTestDB, closeTestDB, generateTestUser } from '../setup.js';
import { userService } from '../../src/services/user.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Nonce Validation Tests', () => {
  let sender;
  let receiver;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await cleanTestDB();
    const userData1 = generateTestUser();
    const userData2 = generateTestUser();
    sender = await userService.createUser(userData1.email, userData1.password);
    receiver = await userService.createUser(userData2.email, userData2.password);
  });

  test('missing nonce is rejected by hashNonceBase64', () => {
    expect(() => hashNonceBase64(undefined)).toThrow();
    expect(() => hashNonceBase64(null)).toThrow();
    expect(() => hashNonceBase64('')).toThrow();
  });

  test('malformed nonce (too short) is rejected', () => {
    // "AA==" decodes to a single byte, which is below the 12-byte minimum.
    expect(() => hashNonceBase64('AA==')).toThrow('Invalid nonce length');
  });

  test('legitimate nonce is accepted and can be stored', async () => {
    const sessionId = 'nonce-session-ok';
    const timestamp = Date.now();
    const seq = 1;

    // 16-byte random nonce
    const nonceBytes = crypto.randomBytes(16);
    const nonceBase64 = nonceBytes.toString('base64');
    const nonceHash = hashNonceBase64(nonceBase64);

    const messageId = `${sessionId}:${seq}:${timestamp}`;

    const msg = new MessageMeta({
      messageId,
      sessionId,
      sender: sender.id,
      receiver: receiver.id,
      type: 'MSG',
      timestamp,
      seq,
      nonceHash
    });

    await expect(msg.save()).resolves.toBeDefined();
  });

  test('reused nonce in same session is rejected (duplicate nonceHash)', async () => {
    const sessionId = 'nonce-session-dup';
    const timestamp = Date.now();
    const seq1 = 1;
    const seq2 = 2;

    const nonceBytes = crypto.randomBytes(16);
    const nonceBase64 = nonceBytes.toString('base64');
    const nonceHash = hashNonceBase64(nonceBase64);

    const msg1 = new MessageMeta({
      messageId: `${sessionId}:${seq1}:${timestamp}`,
      sessionId,
      sender: sender.id,
      receiver: receiver.id,
      type: 'MSG',
      timestamp,
      seq: seq1,
      nonceHash
    });
    await msg1.save();

    const msg2 = new MessageMeta({
      messageId: `${sessionId}:${seq2}:${timestamp + 1}`,
      sessionId,
      sender: sender.id,
      receiver: receiver.id,
      type: 'MSG',
      timestamp: timestamp + 1,
      seq: seq2,
      nonceHash
    });

    // The compound unique index { sessionId, nonceHash } should reject this.
    await expect(msg2.save()).rejects.toThrow();
  });
});


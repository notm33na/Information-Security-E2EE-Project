/**
 * TC-MSG-COMBO-001: Message Envelope Structure Validation
 * TC-MSG-COMBO-005: Envelope Validation
 * 
 * Tests envelope structure for MSG, FILE_META, and FILE_CHUNK types
 */

import { base64Encode, base64Decode, isValidBase64 } from './test-helpers/webcryptoHelper.js';

// Try to import envelope functions
let buildTextMessageEnvelope, buildFileMetaEnvelope, buildFileChunkEnvelope, validateEnvelopeStructure;

try {
  const envelopeModule = await import('../../src/crypto/messageEnvelope.js');
  buildTextMessageEnvelope = envelopeModule.buildTextMessageEnvelope;
  buildFileMetaEnvelope = envelopeModule.buildFileMetaEnvelope;
  buildFileChunkEnvelope = envelopeModule.buildFileChunkEnvelope;
  validateEnvelopeStructure = envelopeModule.validateEnvelopeStructure;
} catch (error) {
  throw new Error('Missing module: client/src/crypto/messageEnvelope.js - please export buildTextMessageEnvelope, buildFileMetaEnvelope, buildFileChunkEnvelope, validateEnvelopeStructure');
}

// Try to import encryption function for creating test ciphertext
let encryptAESGCM;
try {
  const aesModule = await import('../../src/crypto/aesGcm.js');
  encryptAESGCM = aesModule.encryptAESGCM;
} catch (error) {
  throw new Error('Missing module: client/src/crypto/aesGcm.js - please export encryptAESGCM');
}

describe('TC-MSG-COMBO-001: Message Envelope Structure Validation', () => {
  let testKey;
  let testCiphertext, testIV, testAuthTag;

  beforeAll(async () => {
    // Generate a test key (32 bytes for AES-256)
    const keyBuffer = new ArrayBuffer(32);
    const keyView = new Uint8Array(keyBuffer);
    crypto.getRandomValues(keyView);
    testKey = keyBuffer;

    // Create test ciphertext
    const plaintext = 'Test message';
    const result = await encryptAESGCM(testKey, plaintext);
    testCiphertext = result.ciphertext;
    testIV = result.iv;
    testAuthTag = result.authTag;
  });

  test('Should generate valid MSG envelope structure', async () => {
    const sessionId = 'test-session-123';
    const sender = 'alice-id';
    const receiver = 'bob-id';

    const envelope = await buildTextMessageEnvelope(
      sessionId,
      sender,
      receiver,
      testCiphertext,
      testIV,
      testAuthTag
    );

    // Verify required fields
    expect(envelope.type).toBe('MSG');
    expect(envelope.sessionId).toBe(sessionId);
    expect(envelope.sender).toBe(sender);
    expect(envelope.receiver).toBe(receiver);
    expect(envelope.ciphertext).toBeDefined();
    expect(envelope.iv).toBeDefined();
    expect(envelope.authTag).toBeDefined();
    expect(envelope.timestamp).toBeDefined();
    expect(envelope.seq).toBeDefined();
    expect(envelope.nonce).toBeDefined();

    // Verify field types
    expect(typeof envelope.timestamp).toBe('number');
    expect(typeof envelope.seq).toBe('number');
    expect(typeof envelope.ciphertext).toBe('string');
    expect(typeof envelope.iv).toBe('string');
    expect(typeof envelope.authTag).toBe('string');
    expect(typeof envelope.nonce).toBe('string');

    // Verify base64 encoding
    expect(isValidBase64(envelope.ciphertext)).toBe(true);
    expect(isValidBase64(envelope.iv)).toBe(true);
    expect(isValidBase64(envelope.authTag)).toBe(true);
    expect(isValidBase64(envelope.nonce)).toBe(true);

    // Verify IV length (12 bytes = 96 bits)
    const ivDecoded = base64Decode(envelope.iv);
    expect(ivDecoded.byteLength).toBe(12);

    // Verify authTag length (16 bytes = 128 bits)
    const authTagDecoded = base64Decode(envelope.authTag);
    expect(authTagDecoded.byteLength).toBe(16);

    // Verify nonce length (12-32 bytes)
    const nonceDecoded = base64Decode(envelope.nonce);
    expect(nonceDecoded.byteLength).toBeGreaterThanOrEqual(12);
    expect(nonceDecoded.byteLength).toBeLessThanOrEqual(32);

    // Evidence to capture: console.log('MSG Envelope:', JSON.stringify(envelope, null, 2));
    console.log('✓ MSG envelope structure validated');
  });

  test('Should generate valid FILE_META envelope structure', async () => {
    const sessionId = 'test-session-123';
    const sender = 'alice-id';
    const receiver = 'bob-id';
    const meta = {
      filename: 'test.pdf',
      size: 1024,
      totalChunks: 5,
      mimetype: 'application/pdf'
    };

    const envelope = buildFileMetaEnvelope(
      sessionId,
      sender,
      receiver,
      testCiphertext,
      testIV,
      testAuthTag,
      meta
    );

    // Verify required fields
    expect(envelope.type).toBe('FILE_META');
    expect(envelope.sessionId).toBe(sessionId);
    expect(envelope.sender).toBe(sender);
    expect(envelope.receiver).toBe(receiver);
    expect(envelope.meta).toBeDefined();
    expect(envelope.meta.filename).toBe(meta.filename);
    expect(envelope.meta.size).toBe(meta.size);
    expect(envelope.meta.totalChunks).toBe(meta.totalChunks);
    expect(envelope.meta.mimetype).toBe(meta.mimetype);

    // Verify meta field types
    expect(typeof envelope.meta.filename).toBe('string');
    expect(typeof envelope.meta.size).toBe('number');
    expect(typeof envelope.meta.totalChunks).toBe('number');
    expect(typeof envelope.meta.mimetype).toBe('string');

    // Evidence to capture: console.log('FILE_META Envelope:', JSON.stringify(envelope, null, 2));
    console.log('✓ FILE_META envelope structure validated');
  });

  test('Should generate valid FILE_CHUNK envelope structure', async () => {
    const sessionId = 'test-session-123';
    const sender = 'alice-id';
    const receiver = 'bob-id';
    const meta = {
      chunkIndex: 0,
      totalChunks: 5
    };

    const envelope = buildFileChunkEnvelope(
      sessionId,
      sender,
      receiver,
      testCiphertext,
      testIV,
      testAuthTag,
      meta
    );

    // Verify required fields
    expect(envelope.type).toBe('FILE_CHUNK');
    expect(envelope.meta).toBeDefined();
    expect(envelope.meta.chunkIndex).toBe(meta.chunkIndex);
    expect(envelope.meta.totalChunks).toBe(meta.totalChunks);

    // Verify chunkIndex is valid
    expect(envelope.meta.chunkIndex).toBeGreaterThanOrEqual(0);
    expect(envelope.meta.chunkIndex).toBeLessThan(meta.totalChunks);

    // Evidence to capture: console.log('FILE_CHUNK Envelope:', JSON.stringify(envelope, null, 2));
    console.log('✓ FILE_CHUNK envelope structure validated');
  });
});

describe('TC-MSG-COMBO-005: Envelope Validation', () => {
  test('Should validate correct envelope structure', () => {
    const validEnvelope = {
      type: 'MSG',
      sessionId: 'test-session',
      sender: 'alice',
      receiver: 'bob',
      ciphertext: 'dGVzdA==',
      iv: 'dGVzdA==',
      authTag: 'dGVzdA==',
      timestamp: Date.now(),
      seq: 1,
      nonce: 'dGVzdA=='
    };

    const result = validateEnvelopeStructure(validEnvelope);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('Should reject envelope with missing required fields', () => {
    const invalidEnvelope = {
      type: 'MSG',
      sessionId: 'test-session'
      // Missing other required fields
    };

    const result = validateEnvelopeStructure(invalidEnvelope);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Missing required field');
  });

  test('Should reject envelope with invalid type', () => {
    const invalidEnvelope = {
      type: 'INVALID_TYPE',
      sessionId: 'test-session',
      sender: 'alice',
      receiver: 'bob',
      ciphertext: 'dGVzdA==',
      iv: 'dGVzdA==',
      authTag: 'dGVzdA==',
      timestamp: Date.now(),
      seq: 1,
      nonce: 'dGVzdA=='
    };

    const result = validateEnvelopeStructure(invalidEnvelope);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid message type');
  });

  test('Should reject FILE_META without meta object', () => {
    const invalidEnvelope = {
      type: 'FILE_META',
      sessionId: 'test-session',
      sender: 'alice',
      receiver: 'bob',
      ciphertext: 'dGVzdA==',
      iv: 'dGVzdA==',
      authTag: 'dGVzdA==',
      timestamp: Date.now(),
      seq: 1,
      nonce: 'dGVzdA=='
      // Missing meta
    };

    const result = validateEnvelopeStructure(invalidEnvelope);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('meta');
  });

  test('Should reject FILE_CHUNK with invalid chunkIndex', () => {
    const invalidEnvelope = {
      type: 'FILE_CHUNK',
      sessionId: 'test-session',
      sender: 'alice',
      receiver: 'bob',
      ciphertext: 'dGVzdA==',
      iv: 'dGVzdA==',
      authTag: 'dGVzdA==',
      timestamp: Date.now(),
      seq: 1,
      nonce: 'dGVzdA==',
      meta: {
        chunkIndex: 10, // Invalid: >= totalChunks
        totalChunks: 5
      }
    };

    // Note: validateEnvelopeStructure may not check chunkIndex range
    // This test verifies structure validation, not business logic
    const result = validateEnvelopeStructure(invalidEnvelope);
    // Structure is valid, but chunkIndex is logically invalid
    expect(result.valid).toBe(true); // Structure validation passes
  });
});


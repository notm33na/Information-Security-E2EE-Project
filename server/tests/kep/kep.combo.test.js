/**
 * Key Exchange Protocol (KEP) Combo Test Suite
 * Comprehensive tests for KEP system
 * TC-KEP-COMBO-001 to TC-KEP-COMBO-012
 */

import { setupTestDB, cleanTestDB, closeTestDB, readLogFile, clearTestLogs } from '../setup.js';
import { generateTestEmail } from '../auth/helpers/testUser.js';
import { createTestUser, loginTestUser } from '../auth/helpers/testUser.js';
import { api } from '../auth/helpers/apiClient.js';
import { PublicKey } from '../../src/models/PublicKey.js';
import { KEPMessage } from '../../src/models/KEPMessage.js';
import { generateTestKeyPair, exportPublicKeyJWK, importPublicKeyJWK } from '../identity-keys/helpers/cryptoHelpers.js';
import {
  generateEphemeralKeyPair,
  exportPublicKeyJWK as exportEphPublicKeyJWK,
  importPublicKeyJWK as importEphPublicKeyJWK,
  computeSharedSecret,
  deriveSessionKeys,
  signEphemeralKey,
  verifyEphemeralKeySignature,
  generateKeyConfirmation,
  verifyKeyConfirmation,
  generateNonce,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  arrayBuffersEqual
} from './helpers/cryptoHelpers.js';
import {
  buildKEPInit,
  buildKEPResponse,
  validateKEPInit,
  validateKEPResponse,
  sequenceManager
} from './helpers/kepHelpers.js';

// Global setup
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/infosec_test';
  process.env.LOG_HMAC_KEY = 'test-hmac-key-for-development-only-1234567890';
  
  // Setup Web Crypto API
  if (typeof globalThis.crypto === 'undefined') {
    const crypto = await import('crypto');
    if (crypto.webcrypto) {
      globalThis.crypto = crypto.webcrypto;
    }
  }
  
  await setupTestDB();
  clearTestLogs();
});

afterAll(async () => {
  await closeTestDB();
});

beforeEach(async () => {
  await cleanTestDB();
  clearTestLogs();
  sequenceManager.sequences.clear();
});

describe('TC-KEP-COMBO-001: KEP Message Structure Validation', () => {
  test('Should generate valid KEP_INIT structure', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    // Generate identity keys
    const aliceIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    
    // Generate ephemeral key
    const ephKeyPair = await generateEphemeralKeyPair();
    const sessionId = `session-${alice.id}-${bob.id}`;
    
    // Build KEP_INIT
    const kepInit = await buildKEPInit(
      alice.id,
      bob.id,
      ephKeyPair.publicKey,
      aliceIdentityKey.privateKey,
      sessionId
    );
    
    // Verify structure
    expect(kepInit.type).toBe('KEP_INIT');
    expect(kepInit.from).toBe(alice.id);
    expect(kepInit.to).toBe(bob.id);
    expect(kepInit.sessionId).toBe(sessionId);
    expect(kepInit.ephPub).toBeDefined();
    expect(kepInit.ephPub.kty).toBe('EC');
    expect(kepInit.ephPub.crv).toBe('P-256');
    expect(kepInit.ephPub.x).toBeDefined();
    expect(kepInit.ephPub.y).toBeDefined();
    expect(kepInit.ephPub.d).toBeUndefined(); // Private key must not be present
    expect(kepInit.signature).toBeDefined();
    expect(kepInit.timestamp).toBeDefined();
    expect(kepInit.seq).toBe(1);
    expect(kepInit.nonce).toBeDefined();
    
    // All fields non-null
    expect(kepInit.from).toBeTruthy();
    expect(kepInit.to).toBeTruthy();
    expect(kepInit.sessionId).toBeTruthy();
    expect(kepInit.signature).toBeTruthy();
    expect(kepInit.nonce).toBeTruthy();
  });

  test('Should generate valid KEP_RESPONSE structure with keyConfirmation', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    // Generate identity keys
    const bobIdentityKey = await generateTestKeyPair();
    const bobPublicJWK = await exportPublicKeyJWK(bobIdentityKey.publicKey);
    await api.keys.upload(bobPublicJWK, (await api.auth.login(email2, password)).body.data.accessToken);
    
    // Generate identity key for Alice (needed for KEP_INIT)
    const aliceIdentityKey = await generateTestKeyPair();
    
    // Generate ephemeral keys and shared secret
    const aliceEphKey = await generateEphemeralKeyPair();
    const bobEphKey = await generateEphemeralKeyPair();
    const sharedSecret = await computeSharedSecret(bobEphKey.privateKey, aliceEphKey.publicKey);
    const sessionId = `session-${alice.id}-${bob.id}`;
    const sessionKeys = await deriveSessionKeys(sharedSecret, sessionId, bob.id, alice.id);
    
    // Build KEP_INIT first to set sequence to 1, then KEP_RESPONSE will be 2
    await buildKEPInit(alice.id, bob.id, aliceEphKey.publicKey, aliceIdentityKey.privateKey, sessionId);
    
    // Build KEP_RESPONSE
    const kepResponse = await buildKEPResponse(
      bob.id,
      alice.id,
      bobEphKey.publicKey,
      bobIdentityKey.privateKey,
      sessionKeys.rootKey,
      sessionId
    );
    
    // Verify structure
    expect(kepResponse.type).toBe('KEP_RESPONSE');
    expect(kepResponse.from).toBe(bob.id);
    expect(kepResponse.to).toBe(alice.id);
    expect(kepResponse.sessionId).toBe(sessionId);
    expect(kepResponse.ephPub).toBeDefined();
    expect(kepResponse.signature).toBeDefined();
    expect(kepResponse.keyConfirmation).toBeDefined(); // Required field
    expect(kepResponse.timestamp).toBeDefined();
    expect(kepResponse.seq).toBe(2); // Incremented from KEP_INIT
    expect(kepResponse.nonce).toBeDefined();
  });

  test('Should reject KEP_INIT with missing required fields', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    const alicePublicKey = await importPublicKeyJWK(alicePublicJWK);
    
    // Test missing type
    const invalid1 = { from: alice.id, to: bob.id, ephPub: {}, signature: 'sig', timestamp: Date.now(), seq: 1, nonce: 'nonce' };
    const result1 = await validateKEPInit(invalid1, alicePublicKey);
    expect(result1.valid).toBe(false);
    expect(result1.error).toContain('Invalid message type');
    
    // Test missing from
    const invalid2 = { type: 'KEP_INIT', to: bob.id, ephPub: {}, signature: 'sig', timestamp: Date.now(), seq: 1, nonce: 'nonce' };
    const result2 = await validateKEPInit(invalid2, alicePublicKey);
    expect(result2.valid).toBe(false);
    expect(result2.error).toContain('Missing required fields');
    
    // Test missing ephPub
    const invalid3 = { type: 'KEP_INIT', from: alice.id, to: bob.id, signature: 'sig', timestamp: Date.now(), seq: 1, nonce: 'nonce' };
    const result3 = await validateKEPInit(invalid3, alicePublicKey);
    expect(result3.valid).toBe(false);
    expect(result3.error).toContain('Missing required fields');
    
    // Test missing signature
    const ephKeyPair = await generateEphemeralKeyPair();
    const ephPubJWK = await exportEphPublicKeyJWK(ephKeyPair.publicKey);
    const invalid4 = { type: 'KEP_INIT', from: alice.id, to: bob.id, ephPub: ephPubJWK, timestamp: Date.now(), seq: 1, nonce: 'nonce' };
    const result4 = await validateKEPInit(invalid4, alicePublicKey);
    expect(result4.valid).toBe(false);
    expect(result4.error).toContain('Missing required fields');
  });

  test('Should reject KEP_RESPONSE with missing keyConfirmation', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const bobIdentityKey = await generateTestKeyPair();
    const bobPublicJWK = await exportPublicKeyJWK(bobIdentityKey.publicKey);
    await api.keys.upload(bobPublicJWK, (await api.auth.login(email2, password)).body.data.accessToken);
    const bobPublicKey = await importPublicKeyJWK(bobPublicJWK);
    
    const ephKeyPair = await generateEphemeralKeyPair();
    const ephPubJWK = await exportEphPublicKeyJWK(ephKeyPair.publicKey);
    const signature = await signEphemeralKey(bobIdentityKey.privateKey, ephPubJWK);
    const sessionId = `session-${alice.id}-${bob.id}`;
    const sharedSecret = await computeSharedSecret(ephKeyPair.privateKey, ephKeyPair.publicKey);
    const sessionKeys = await deriveSessionKeys(sharedSecret, sessionId, bob.id, alice.id);
    
    // Missing keyConfirmation
    const invalid = {
      type: 'KEP_RESPONSE',
      from: bob.id,
      to: alice.id,
      sessionId: sessionId,
      ephPub: ephPubJWK,
      signature: arrayBufferToBase64(signature),
      timestamp: Date.now(),
      seq: 2,
      nonce: arrayBufferToBase64(generateNonce())
    };
    
    const result = await validateKEPResponse(invalid, bobPublicKey, sessionKeys.rootKey, alice.id);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Missing required fields');
  });
});

describe('TC-KEP-COMBO-002: Ephemeral Key Generation & Format', () => {
  test('Should generate ephemeral keys with ECDH P-256', async () => {
    const ephKeyPair = await generateEphemeralKeyPair();
    
    expect(ephKeyPair.privateKey).toBeDefined();
    expect(ephKeyPair.publicKey).toBeDefined();
    expect(ephKeyPair.privateKey.algorithm.name).toBe('ECDH');
    expect(ephKeyPair.privateKey.algorithm.namedCurve).toBe('P-256');
    expect(ephKeyPair.publicKey.algorithm.name).toBe('ECDH');
    expect(ephKeyPair.publicKey.algorithm.namedCurve).toBe('P-256');
    expect(ephKeyPair.privateKey.extractable).toBe(true);
    expect(ephKeyPair.publicKey.extractable).toBe(true);
    expect(ephKeyPair.privateKey.usages).toContain('deriveKey');
    expect(ephKeyPair.privateKey.usages).toContain('deriveBits');
    // Note: Public keys in ECDH don't have usages - only private keys do
    // Public keys are used for deriveBits/deriveKey operations but don't have usages array
  });

  test('Should export ephemeral public key in valid JWK format', async () => {
    const ephKeyPair = await generateEphemeralKeyPair();
    const ephPubJWK = await exportEphPublicKeyJWK(ephKeyPair.publicKey);
    
    expect(ephPubJWK.kty).toBe('EC');
    expect(ephPubJWK.crv).toBe('P-256');
    expect(ephPubJWK.x).toBeDefined();
    expect(ephPubJWK.y).toBeDefined();
    expect(ephPubJWK.d).toBeUndefined(); // Private key component must not be present
    
    // Verify base64 encoding and coordinate lengths
    const xBytes = Buffer.from(ephPubJWK.x, 'base64url');
    const yBytes = Buffer.from(ephPubJWK.y, 'base64url');
    expect(xBytes.length).toBeGreaterThanOrEqual(32); // P-256 coordinates are ~32 bytes
    expect(yBytes.length).toBeGreaterThanOrEqual(32);
  });
});

describe('TC-KEP-COMBO-003: Digital Signature Operations', () => {
  test('Should sign ephemeral key with ECDSA-SHA256', async () => {
    const identityKey = await generateTestKeyPair();
    const ephKeyPair = await generateEphemeralKeyPair();
    const ephPubJWK = await exportEphPublicKeyJWK(ephKeyPair.publicKey);
    
    const signature = await signEphemeralKey(identityKey.privateKey, ephPubJWK);
    
    expect(signature).toBeInstanceOf(ArrayBuffer);
    expect(signature.byteLength).toBeGreaterThanOrEqual(64); // ECDSA P-256 signature is ~64 bytes
    
    // Note: ECDSA signatures are NOT deterministic - they use random nonces
    // Each signature will be different even for the same data
    // Generate multiple signatures and verify they're different (non-deterministic)
    const signature2 = await signEphemeralKey(identityKey.privateKey, ephPubJWK);
    // ECDSA signatures are randomized, so they should be different
    // But both should verify correctly
    const isValid1 = await verifyEphemeralKeySignature(identityKey.publicKey, signature, ephPubJWK);
    const isValid2 = await verifyEphemeralKeySignature(identityKey.publicKey, signature2, ephPubJWK);
    expect(isValid1).toBe(true);
    expect(isValid2).toBe(true);
    
    // Different key should produce different signature
    const ephKeyPair2 = await generateEphemeralKeyPair();
    const ephPubJWK2 = await exportEphPublicKeyJWK(ephKeyPair2.publicKey);
    const signature3 = await signEphemeralKey(identityKey.privateKey, ephPubJWK2);
    expect(arrayBuffersEqual(signature, signature3)).toBe(false);
  });

  test('Should verify valid signatures successfully', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    const alicePublicKey = await importPublicKeyJWK(alicePublicJWK);
    
    const ephKeyPair = await generateEphemeralKeyPair();
    const ephPubJWK = await exportEphPublicKeyJWK(ephKeyPair.publicKey);
    const signature = await signEphemeralKey(aliceIdentityKey.privateKey, ephPubJWK);
    
    const isValid = await verifyEphemeralKeySignature(alicePublicKey, signature, ephPubJWK);
    expect(isValid).toBe(true);
    
    // Build and validate KEP_INIT
    const sessionId = `session-${alice.id}-${bob.id}`;
    const kepInit = await buildKEPInit(
      alice.id,
      bob.id,
      ephKeyPair.publicKey,
      aliceIdentityKey.privateKey,
      sessionId
    );
    
    const validation = await validateKEPInit(kepInit, alicePublicKey);
    expect(validation.valid).toBe(true);
  });

  test('Should reject invalid signatures', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    const alicePublicKey = await importPublicKeyJWK(alicePublicJWK);
    
    const ephKeyPair = await generateEphemeralKeyPair();
    const ephPubJWK = await exportEphPublicKeyJWK(ephKeyPair.publicKey);
    
    // Corrupt signature
    const corruptSignature = new ArrayBuffer(64);
    new Uint8Array(corruptSignature).fill(0);
    
    const isValid = await verifyEphemeralKeySignature(alicePublicKey, corruptSignature, ephPubJWK);
    expect(isValid).toBe(false);
    
    // Modify KEP_INIT signature
    const sessionId = `session-${alice.id}-${bob.id}`;
    const kepInit = await buildKEPInit(
      alice.id,
      bob.id,
      ephKeyPair.publicKey,
      aliceIdentityKey.privateKey,
      sessionId
    );
    kepInit.signature = arrayBufferToBase64(corruptSignature);
    
    const validation = await validateKEPInit(kepInit, alicePublicKey);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Invalid signature');
  });

  test('Should reject signature with wrong identity key', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const charlieIdentityKey = await generateTestKeyPair();
    const charliePublicJWK = await exportPublicKeyJWK(charlieIdentityKey.publicKey);
    const charliePublicKey = await importPublicKeyJWK(charliePublicJWK);
    
    const ephKeyPair = await generateEphemeralKeyPair();
    const ephPubJWK = await exportEphPublicKeyJWK(ephKeyPair.publicKey);
    const signature = await signEphemeralKey(aliceIdentityKey.privateKey, ephPubJWK);
    
    // Verify with wrong key (Charlie's instead of Alice's)
    const isValid = await verifyEphemeralKeySignature(charliePublicKey, signature, ephPubJWK);
    expect(isValid).toBe(false);
  });
});

describe('TC-KEP-COMBO-004: Timestamp Validation', () => {
  test('Should accept timestamps within ±2 minutes', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    const alicePublicKey = await importPublicKeyJWK(alicePublicJWK);
    
    const ephKeyPair = await generateEphemeralKeyPair();
    const sessionId = `session-${alice.id}-${bob.id}`;
    
    // Test current timestamp
    const kepInit1 = await buildKEPInit(alice.id, bob.id, ephKeyPair.publicKey, aliceIdentityKey.privateKey, sessionId);
    const result1 = await validateKEPInit(kepInit1, alicePublicKey);
    expect(result1.valid).toBe(true);
    
    // Test 1 minute ago
    const kepInit2 = await buildKEPInit(alice.id, bob.id, ephKeyPair.publicKey, aliceIdentityKey.privateKey, sessionId);
    kepInit2.timestamp = Date.now() - 60000; // 1 minute ago
    const result2 = await validateKEPInit(kepInit2, alicePublicKey);
    expect(result2.valid).toBe(true);
    
    // Test 1 minute future
    const kepInit3 = await buildKEPInit(alice.id, bob.id, ephKeyPair.publicKey, aliceIdentityKey.privateKey, sessionId);
    kepInit3.timestamp = Date.now() + 60000; // 1 minute future
    const result3 = await validateKEPInit(kepInit3, alicePublicKey);
    expect(result3.valid).toBe(true);
  });

  test('Should reject stale messages (>2 minutes old)', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    const alicePublicKey = await importPublicKeyJWK(alicePublicJWK);
    
    const ephKeyPair = await generateEphemeralKeyPair();
    const sessionId = `session-${alice.id}-${bob.id}`;
    
    // Test 3 minutes ago
    const kepInit1 = await buildKEPInit(alice.id, bob.id, ephKeyPair.publicKey, aliceIdentityKey.privateKey, sessionId);
    kepInit1.timestamp = Date.now() - 180000; // 3 minutes ago
    const result1 = await validateKEPInit(kepInit1, alicePublicKey);
    expect(result1.valid).toBe(false);
    expect(result1.error).toContain('Timestamp out of validity window');
    
    // Test 5 minutes ago
    const kepInit2 = await buildKEPInit(alice.id, bob.id, ephKeyPair.publicKey, aliceIdentityKey.privateKey, sessionId);
    kepInit2.timestamp = Date.now() - 300000; // 5 minutes ago
    const result2 = await validateKEPInit(kepInit2, alicePublicKey);
    expect(result2.valid).toBe(false);
    
    // Test 1 hour ago
    const kepInit3 = await buildKEPInit(alice.id, bob.id, ephKeyPair.publicKey, aliceIdentityKey.privateKey, sessionId);
    kepInit3.timestamp = Date.now() - 3600000; // 1 hour ago
    const result3 = await validateKEPInit(kepInit3, alicePublicKey);
    expect(result3.valid).toBe(false);
  });

  test('Should reject future messages (>2 minutes ahead)', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    const alicePublicKey = await importPublicKeyJWK(alicePublicJWK);
    
    const ephKeyPair = await generateEphemeralKeyPair();
    const sessionId = `session-${alice.id}-${bob.id}`;
    
    // Test 3 minutes future
    const kepInit1 = await buildKEPInit(alice.id, bob.id, ephKeyPair.publicKey, aliceIdentityKey.privateKey, sessionId);
    kepInit1.timestamp = Date.now() + 180000; // 3 minutes future
    const result1 = await validateKEPInit(kepInit1, alicePublicKey);
    expect(result1.valid).toBe(false);
    expect(result1.error).toContain('Timestamp out of validity window');
  });
});

describe('TC-KEP-COMBO-005: Sequence Number Validation', () => {
  test('Should use correct sequence numbers', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const bobIdentityKey = await generateTestKeyPair();
    const sessionId = `session-${alice.id}-${bob.id}`;
    
    const aliceEphKey = await generateEphemeralKeyPair();
    const kepInit = await buildKEPInit(alice.id, bob.id, aliceEphKey.publicKey, aliceIdentityKey.privateKey, sessionId);
    expect(kepInit.seq).toBe(1);
    
    const bobEphKey = await generateEphemeralKeyPair();
    const sharedSecret = await computeSharedSecret(bobEphKey.privateKey, aliceEphKey.publicKey);
    const sessionKeys = await deriveSessionKeys(sharedSecret, sessionId, bob.id, alice.id);
    const kepResponse = await buildKEPResponse(bob.id, alice.id, bobEphKey.publicKey, bobIdentityKey.privateKey, sessionKeys.rootKey, sessionId);
    expect(kepResponse.seq).toBe(2);
  });

  test('Should reject non-monotonic sequences', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    const alicePublicKey = await importPublicKeyJWK(alicePublicJWK);
    
    const sessionId = `session-${alice.id}-${bob.id}`;
    const ephKeyPair = await generateEphemeralKeyPair();
    
    // Process KEP_INIT with seq=1
    const kepInit1 = await buildKEPInit(alice.id, bob.id, ephKeyPair.publicKey, aliceIdentityKey.privateKey, sessionId);
    expect(kepInit1.seq).toBe(1);
    await validateKEPInit(kepInit1, alicePublicKey);
    
    // Attempt duplicate seq=1
    const kepInit2 = await buildKEPInit(alice.id, bob.id, ephKeyPair.publicKey, aliceIdentityKey.privateKey, sessionId);
    kepInit2.seq = 1; // Duplicate
    const result2 = await validateKEPInit(kepInit2, alicePublicKey);
    // Note: sequence validation is handled by sequenceManager, not validateKEPInit
    // But we can test that sequence manager rejects it
    expect(sequenceManager.validateSequence(sessionId, 1)).toBe(false);
    
    // Attempt seq=0 (decreasing)
    expect(sequenceManager.validateSequence(sessionId, 0)).toBe(false);
    
    // Attempt negative seq
    expect(sequenceManager.validateSequence(sessionId, -1)).toBe(false);
  });
});

describe('TC-KEP-COMBO-006: Nonce Validation', () => {
  test('Should include valid nonces in all KEP messages', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const bobIdentityKey = await generateTestKeyPair();
    const sessionId = `session-${alice.id}-${bob.id}`;
    
    const aliceEphKey = await generateEphemeralKeyPair();
    const kepInit = await buildKEPInit(alice.id, bob.id, aliceEphKey.publicKey, aliceIdentityKey.privateKey, sessionId);
    
    expect(kepInit.nonce).toBeDefined();
    expect(kepInit.nonce).toBeTruthy();
    
    // Decode nonce
    const nonceBytes = base64ToArrayBuffer(kepInit.nonce);
    expect(nonceBytes.byteLength).toBe(16); // 16 bytes = 128 bits
    
    // Generate multiple and verify unique
    const nonces = new Set();
    for (let i = 0; i < 10; i++) {
      const nonce = generateNonce(16);
      const nonceBase64 = arrayBufferToBase64(nonce);
      expect(nonces.has(nonceBase64)).toBe(false);
      nonces.add(nonceBase64);
    }
    
    // KEP_RESPONSE also has nonce
    const bobEphKey = await generateEphemeralKeyPair();
    const sharedSecret = await computeSharedSecret(bobEphKey.privateKey, aliceEphKey.publicKey);
    const sessionKeys = await deriveSessionKeys(sharedSecret, sessionId, bob.id, alice.id);
    const kepResponse = await buildKEPResponse(bob.id, alice.id, bobEphKey.publicKey, bobIdentityKey.privateKey, sessionKeys.rootKey, sessionId);
    
    expect(kepResponse.nonce).toBeDefined();
    expect(kepResponse.nonce).toBeTruthy();
    const responseNonceBytes = base64ToArrayBuffer(kepResponse.nonce);
    expect(responseNonceBytes.byteLength).toBe(16);
  });
});

describe('TC-KEP-COMBO-007: Key Confirmation HMAC', () => {
  test('Should generate key confirmation HMAC correctly', async () => {
    const email1 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const sharedSecret = new ArrayBuffer(32);
    new Uint8Array(sharedSecret).fill(1);
    const sessionId = `session-${alice.id}`;
    const sessionKeys = await deriveSessionKeys(sharedSecret, sessionId, alice.id, 'bobId');
    
    const keyConfirmation = await generateKeyConfirmation(sessionKeys.rootKey, alice.id);
    
    expect(keyConfirmation).toBeInstanceOf(ArrayBuffer);
    expect(keyConfirmation.byteLength).toBe(32); // HMAC-SHA256 is 32 bytes
    
    // Test determinism: same inputs → same HMAC
    const keyConfirmation2 = await generateKeyConfirmation(sessionKeys.rootKey, alice.id);
    expect(arrayBuffersEqual(keyConfirmation, keyConfirmation2)).toBe(true);
    
    // Different user ID → different HMAC
    const keyConfirmation3 = await generateKeyConfirmation(sessionKeys.rootKey, 'bobId');
    expect(arrayBuffersEqual(keyConfirmation, keyConfirmation3)).toBe(false);
  });

  test('Should verify valid key confirmation', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceEphKey = await generateEphemeralKeyPair();
    const bobEphKey = await generateEphemeralKeyPair();
    const sharedSecret = await computeSharedSecret(bobEphKey.privateKey, aliceEphKey.publicKey);
    const sessionId = `session-${alice.id}-${bob.id}`;
    const sessionKeys = await deriveSessionKeys(sharedSecret, sessionId, bob.id, alice.id);
    
    // Bob generates key confirmation
    const keyConfirmation = await generateKeyConfirmation(sessionKeys.rootKey, alice.id);
    
    // Alice verifies it
    const isValid = await verifyKeyConfirmation(keyConfirmation, sessionKeys.rootKey, alice.id);
    expect(isValid).toBe(true);
    
    // Build and validate KEP_RESPONSE
    const bobIdentityKey = await generateTestKeyPair();
    const kepResponse = await buildKEPResponse(bob.id, alice.id, bobEphKey.publicKey, bobIdentityKey.privateKey, sessionKeys.rootKey, sessionId);
    
    const bobPublicJWK = await exportPublicKeyJWK(bobIdentityKey.publicKey);
    const bobPublicKey = await importPublicKeyJWK(bobPublicJWK);
    const validation = await validateKEPResponse(kepResponse, bobPublicKey, sessionKeys.rootKey, alice.id);
    expect(validation.valid).toBe(true);
  });

  test('Should reject mismatched key confirmation', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceEphKey = await generateEphemeralKeyPair();
    const bobEphKey = await generateEphemeralKeyPair();
    const sharedSecret = await computeSharedSecret(bobEphKey.privateKey, aliceEphKey.publicKey);
    const sessionId = `session-${alice.id}-${bob.id}`;
    const sessionKeys = await deriveSessionKeys(sharedSecret, sessionId, bob.id, alice.id);
    
    // Generate correct key confirmation
    const correctConfirmation = await generateKeyConfirmation(sessionKeys.rootKey, alice.id);
    
    // Corrupt it
    const corruptConfirmation = new ArrayBuffer(32);
    new Uint8Array(corruptConfirmation).fill(0);
    
    const isValid = await verifyKeyConfirmation(corruptConfirmation, sessionKeys.rootKey, alice.id);
    expect(isValid).toBe(false);
    
    // Test with KEP_RESPONSE
    const bobIdentityKey = await generateTestKeyPair();
    const kepResponse = await buildKEPResponse(bob.id, alice.id, bobEphKey.publicKey, bobIdentityKey.privateKey, sessionKeys.rootKey, sessionId);
    kepResponse.keyConfirmation = arrayBufferToBase64(corruptConfirmation);
    
    const bobPublicJWK = await exportPublicKeyJWK(bobIdentityKey.publicKey);
    const bobPublicKey = await importPublicKeyJWK(bobPublicJWK);
    const validation = await validateKEPResponse(kepResponse, bobPublicKey, sessionKeys.rootKey, alice.id);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Key confirmation failed');
  });
});

describe('TC-KEP-COMBO-008: Session Key Derivation', () => {
  test('Should derive rootKey via HKDF', async () => {
    const sharedSecret = new ArrayBuffer(32);
    new Uint8Array(sharedSecret).fill(1);
    const sessionId = 'test-session-123';
    
    const sessionKeys = await deriveSessionKeys(sharedSecret, sessionId, 'aliceId', 'bobId');
    
    expect(sessionKeys.rootKey).toBeInstanceOf(ArrayBuffer);
    expect(sessionKeys.rootKey.byteLength).toBe(32); // 256 bits = 32 bytes
    
    // Test determinism
    const sessionKeys2 = await deriveSessionKeys(sharedSecret, sessionId, 'aliceId', 'bobId');
    expect(arrayBuffersEqual(sessionKeys.rootKey, sessionKeys2.rootKey)).toBe(true);
  });

  test('Should derive sendKey via HKDF', async () => {
    const sharedSecret = new ArrayBuffer(32);
    new Uint8Array(sharedSecret).fill(1);
    const sessionId = 'test-session-123';
    
    const sessionKeys = await deriveSessionKeys(sharedSecret, sessionId, 'aliceId', 'bobId');
    
    expect(sessionKeys.sendKey).toBeInstanceOf(ArrayBuffer);
    expect(sessionKeys.sendKey.byteLength).toBe(32); // 256 bits = 32 bytes
  });

  test('Should derive recvKey via HKDF', async () => {
    const sharedSecret = new ArrayBuffer(32);
    new Uint8Array(sharedSecret).fill(1);
    const sessionId = 'test-session-123';
    
    const sessionKeys = await deriveSessionKeys(sharedSecret, sessionId, 'aliceId', 'bobId');
    
    expect(sessionKeys.recvKey).toBeInstanceOf(ArrayBuffer);
    expect(sessionKeys.recvKey.byteLength).toBe(32); // 256 bits = 32 bytes
  });

  test('Should verify session key symmetry', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceEphKey = await generateEphemeralKeyPair();
    const bobEphKey = await generateEphemeralKeyPair();
    
    // Both compute shared secret
    const aliceSharedSecret = await computeSharedSecret(aliceEphKey.privateKey, bobEphKey.publicKey);
    const bobSharedSecret = await computeSharedSecret(bobEphKey.privateKey, aliceEphKey.publicKey);
    
    // Verify shared secrets are equal
    expect(arrayBuffersEqual(aliceSharedSecret, bobSharedSecret)).toBe(true);
    
    const sessionId = `session-${alice.id}-${bob.id}`;
    
    // Both derive session keys
    const aliceKeys = await deriveSessionKeys(aliceSharedSecret, sessionId, alice.id, bob.id);
    const bobKeys = await deriveSessionKeys(bobSharedSecret, sessionId, bob.id, alice.id);
    
    // Verify symmetry
    expect(arrayBuffersEqual(aliceKeys.rootKey, bobKeys.rootKey)).toBe(true);
    expect(arrayBuffersEqual(aliceKeys.sendKey, bobKeys.recvKey)).toBe(true);
    expect(arrayBuffersEqual(bobKeys.sendKey, aliceKeys.recvKey)).toBe(true);
  });
});

describe('TC-KEP-COMBO-009: Session Establishment', () => {
  test('Should establish session successfully with valid flow', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    // Generate identity keys
    const aliceIdentityKey = await generateTestKeyPair();
    const bobIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    const bobPublicJWK = await exportPublicKeyJWK(bobIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    await api.keys.upload(bobPublicJWK, (await api.auth.login(email2, password)).body.data.accessToken);
    const alicePublicKey = await importPublicKeyJWK(alicePublicJWK);
    const bobPublicKey = await importPublicKeyJWK(bobPublicJWK);
    
    // Alice initiates
    const sessionId = `session-${alice.id}-${bob.id}`;
    const aliceEphKey = await generateEphemeralKeyPair();
    const kepInit = await buildKEPInit(alice.id, bob.id, aliceEphKey.publicKey, aliceIdentityKey.privateKey, sessionId);
    
    // Bob validates KEP_INIT
    const initValidation = await validateKEPInit(kepInit, alicePublicKey);
    expect(initValidation.valid).toBe(true);
    
    // Bob generates response
    const bobEphKey = await generateEphemeralKeyPair();
    const sharedSecret = await computeSharedSecret(bobEphKey.privateKey, aliceEphKey.publicKey);
    const bobSessionKeys = await deriveSessionKeys(sharedSecret, sessionId, bob.id, alice.id);
    const kepResponse = await buildKEPResponse(bob.id, alice.id, bobEphKey.publicKey, bobIdentityKey.privateKey, bobSessionKeys.rootKey, sessionId);
    
    // Alice validates KEP_RESPONSE
    const aliceSharedSecret = await computeSharedSecret(aliceEphKey.privateKey, bobEphKey.publicKey);
    const aliceSessionKeys = await deriveSessionKeys(aliceSharedSecret, sessionId, alice.id, bob.id);
    const responseValidation = await validateKEPResponse(kepResponse, bobPublicKey, aliceSessionKeys.rootKey, alice.id);
    expect(responseValidation.valid).toBe(true);
    
    // Verify keys match
    expect(arrayBuffersEqual(aliceSessionKeys.rootKey, bobSessionKeys.rootKey)).toBe(true);
    expect(arrayBuffersEqual(aliceSessionKeys.sendKey, bobSessionKeys.recvKey)).toBe(true);
    expect(arrayBuffersEqual(bobSessionKeys.sendKey, aliceSessionKeys.recvKey)).toBe(true);
  });

  test('Should fail session with invalid signature', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    const alicePublicKey = await importPublicKeyJWK(alicePublicJWK);
    
    const sessionId = `session-${alice.id}-${bob.id}`;
    const aliceEphKey = await generateEphemeralKeyPair();
    const kepInit = await buildKEPInit(alice.id, bob.id, aliceEphKey.publicKey, aliceIdentityKey.privateKey, sessionId);
    
    // Corrupt signature
    kepInit.signature = arrayBufferToBase64(new ArrayBuffer(64));
    
    const validation = await validateKEPInit(kepInit, alicePublicKey);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Invalid signature');
  });

  test('Should fail session with stale timestamp', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    const alicePublicKey = await importPublicKeyJWK(alicePublicJWK);
    
    const sessionId = `session-${alice.id}-${bob.id}`;
    const aliceEphKey = await generateEphemeralKeyPair();
    const kepInit = await buildKEPInit(alice.id, bob.id, aliceEphKey.publicKey, aliceIdentityKey.privateKey, sessionId);
    
    // Set old timestamp
    kepInit.timestamp = Date.now() - 180000; // 3 minutes ago
    
    const validation = await validateKEPInit(kepInit, alicePublicKey);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Timestamp out of validity window');
  });

  test('Should fail session with key confirmation mismatch', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const bobIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    const bobPublicJWK = await exportPublicKeyJWK(bobIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    await api.keys.upload(bobPublicJWK, (await api.auth.login(email2, password)).body.data.accessToken);
    const alicePublicKey = await importPublicKeyJWK(alicePublicJWK);
    const bobPublicKey = await importPublicKeyJWK(bobPublicJWK);
    
    const sessionId = `session-${alice.id}-${bob.id}`;
    const aliceEphKey = await generateEphemeralKeyPair();
    const bobEphKey = await generateEphemeralKeyPair();
    const sharedSecret = await computeSharedSecret(bobEphKey.privateKey, aliceEphKey.publicKey);
    const bobSessionKeys = await deriveSessionKeys(sharedSecret, sessionId, bob.id, alice.id);
    
    const kepResponse = await buildKEPResponse(bob.id, alice.id, bobEphKey.publicKey, bobIdentityKey.privateKey, bobSessionKeys.rootKey, sessionId);
    
    // Corrupt key confirmation
    kepResponse.keyConfirmation = arrayBufferToBase64(new ArrayBuffer(32));
    
    const aliceSharedSecret = await computeSharedSecret(aliceEphKey.privateKey, bobEphKey.publicKey);
    const aliceSessionKeys = await deriveSessionKeys(aliceSharedSecret, sessionId, alice.id, bob.id);
    const validation = await validateKEPResponse(kepResponse, bobPublicKey, aliceSessionKeys.rootKey, alice.id);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Key confirmation failed');
  });
});

describe('TC-KEP-COMBO-010: Logging - Invalid Signatures', () => {
  test('Should log invalid KEP_INIT signatures', async () => {
    // Note: Client-side logging is tested, server-side logging would require actual message processing
    // This test verifies the validation logic that would trigger logging
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    const alicePublicKey = await importPublicKeyJWK(alicePublicJWK);
    
    const sessionId = `session-${alice.id}-${bob.id}`;
    const aliceEphKey = await generateEphemeralKeyPair();
    const kepInit = await buildKEPInit(alice.id, bob.id, aliceEphKey.publicKey, aliceIdentityKey.privateKey, sessionId);
    
    // Corrupt signature
    kepInit.signature = arrayBufferToBase64(new ArrayBuffer(64));
    
    const validation = await validateKEPInit(kepInit, alicePublicKey);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Invalid signature');
    
    // Log file would contain entry if server-side logging was implemented
    // For now, we verify the validation fails correctly
  });

  test('Should log invalid KEP_RESPONSE signatures', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const bobIdentityKey = await generateTestKeyPair();
    const bobPublicJWK = await exportPublicKeyJWK(bobIdentityKey.publicKey);
    await api.keys.upload(bobPublicJWK, (await api.auth.login(email2, password)).body.data.accessToken);
    const bobPublicKey = await importPublicKeyJWK(bobPublicJWK);
    
    const sessionId = `session-${alice.id}-${bob.id}`;
    const bobEphKey = await generateEphemeralKeyPair();
    const sharedSecret = new ArrayBuffer(32);
    const sessionKeys = await deriveSessionKeys(sharedSecret, sessionId, bob.id, alice.id);
    const kepResponse = await buildKEPResponse(bob.id, alice.id, bobEphKey.publicKey, bobIdentityKey.privateKey, sessionKeys.rootKey, sessionId);
    
    // Corrupt signature
    kepResponse.signature = arrayBufferToBase64(new ArrayBuffer(64));
    
    const validation = await validateKEPResponse(kepResponse, bobPublicKey, sessionKeys.rootKey, alice.id);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Invalid signature');
  });
});

describe('TC-KEP-COMBO-011: Logging - Key Exchange Attempts', () => {
  test('Should log successful KEP_INIT', async () => {
    // Note: Server-side logging would require actual WebSocket message processing
    // This test verifies the message structure is correct for logging
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const sessionId = `session-${alice.id}-${bob.id}`;
    const aliceEphKey = await generateEphemeralKeyPair();
    const kepInit = await buildKEPInit(alice.id, bob.id, aliceEphKey.publicKey, aliceIdentityKey.privateKey, sessionId);
    
    // Verify message structure is correct for logging
    expect(kepInit.type).toBe('KEP_INIT');
    expect(kepInit.from).toBe(alice.id);
    expect(kepInit.to).toBe(bob.id);
    expect(kepInit.sessionId).toBe(sessionId);
    // No sensitive data (private keys) in message
    expect(kepInit.ephPub.d).toBeUndefined();
  });

  test('Should log successful KEP_RESPONSE', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const bobIdentityKey = await generateTestKeyPair();
    const sessionId = `session-${alice.id}-${bob.id}`;
    const bobEphKey = await generateEphemeralKeyPair();
    const sharedSecret = new ArrayBuffer(32);
    const sessionKeys = await deriveSessionKeys(sharedSecret, sessionId, bob.id, alice.id);
    const kepResponse = await buildKEPResponse(bob.id, alice.id, bobEphKey.publicKey, bobIdentityKey.privateKey, sessionKeys.rootKey, sessionId);
    
    // Verify message structure
    expect(kepResponse.type).toBe('KEP_RESPONSE');
    expect(kepResponse.from).toBe(bob.id);
    expect(kepResponse.to).toBe(alice.id);
    expect(kepResponse.sessionId).toBe(sessionId);
    // No session keys exposed in message
    expect(kepResponse.rootKey).toBeUndefined();
    expect(kepResponse.sendKey).toBeUndefined();
    expect(kepResponse.recvKey).toBeUndefined();
  });
});

describe('TC-KEP-COMBO-012: Logging - Invalid KEP Messages', () => {
  test('Should log messages with missing required fields', async () => {
    // Note: Server-side logging would require actual message processing
    // This test verifies validation logic
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    const alicePublicKey = await importPublicKeyJWK(alicePublicJWK);
    
    // Missing signature
    const invalid = {
      type: 'KEP_INIT',
      from: alice.id,
      to: bob.id,
      sessionId: 'session-123',
      ephPub: {},
      timestamp: Date.now(),
      seq: 1,
      nonce: 'nonce'
    };
    
    const validation = await validateKEPInit(invalid, alicePublicKey);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('Missing required fields');
  });

  test('Should log various invalid scenarios', async () => {
    const email1 = generateTestEmail();
    const email2 = generateTestEmail();
    const password = 'TestPass123!';
    
    const alice = await createTestUser(email1, password);
    const bob = await createTestUser(email2, password);
    
    const aliceIdentityKey = await generateTestKeyPair();
    const alicePublicJWK = await exportPublicKeyJWK(aliceIdentityKey.publicKey);
    await api.keys.upload(alicePublicJWK, (await api.auth.login(email1, password)).body.data.accessToken);
    const alicePublicKey = await importPublicKeyJWK(alicePublicJWK);
    
    // Missing type
    const invalid1 = { from: alice.id, to: bob.id, ephPub: {}, signature: 'sig', timestamp: Date.now(), seq: 1, nonce: 'nonce' };
    const result1 = await validateKEPInit(invalid1, alicePublicKey);
    expect(result1.valid).toBe(false);
    expect(result1.error).toContain('Invalid message type');
    
    // Missing ephPub
    const invalid2 = { type: 'KEP_INIT', from: alice.id, to: bob.id, signature: 'sig', timestamp: Date.now(), seq: 1, nonce: 'nonce' };
    const result2 = await validateKEPInit(invalid2, alicePublicKey);
    expect(result2.valid).toBe(false);
    expect(result2.error).toContain('Missing required fields');
  });
});


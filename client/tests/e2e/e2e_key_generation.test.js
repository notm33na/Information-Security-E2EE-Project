/**
 * E2EE Key Generation Tests
 *
 * Focused, fast coverage of:
 * - Identity key creation (ECDSA P-256)
 * - Ephemeral key creation (ECDH P-256)
 * - Password-derived encryption for private key storage
 * - Basic IndexedDB retrieval
 *
 * Heavy/duplicate scenarios are covered in the other E2E suites.
 */

jest.setTimeout(60000);

import {
  generateIdentityKeyPair,
  storePrivateKeyEncrypted,
  loadPrivateKey,
  exportPublicKey,
  hasIdentityKey,
} from '../../src/crypto/identityKeys.js';
import {
  generateEphemeralKeyPair,
  exportPublicKey as exportEphPublicKey,
} from '../../src/crypto/ecdh.js';
import {
  clearIndexedDB,
  generateTestUser,
  cryptoKeysEqual,
} from './testHelpers.js';

describe('E2EE Key Generation Tests (fast subset)', () => {
  const testUser = generateTestUser('testuser');

  beforeAll(async () => {
    await clearIndexedDB();
  });

  afterAll(async () => {
    await clearIndexedDB();
  });

  describe('Identity Key Generation (ECDSA P-256)', () => {
    test('should generate identity key pair with correct algorithm', async () => {
      const { privateKey, publicKey } = await generateIdentityKeyPair();

      expect(privateKey).toBeDefined();
      expect(publicKey).toBeDefined();
      expect(privateKey.algorithm.name).toBe('ECDSA');
      expect(privateKey.algorithm.namedCurve).toBe('P-256');
      expect(publicKey.algorithm.name).toBe('ECDSA');
      expect(publicKey.algorithm.namedCurve).toBe('P-256');
    });

    test('should export public key in JWK format', async () => {
      const { publicKey } = await generateIdentityKeyPair();
      const jwk = await exportPublicKey(publicKey);

      expect(jwk).toBeDefined();
      expect(jwk.kty).toBe('EC');
      expect(jwk.crv).toBe('P-256');
      expect(jwk.x).toBeDefined();
      expect(jwk.y).toBeDefined();
      expect(jwk.d).toBeUndefined();
    });
  });

  describe('Ephemeral Key Generation (ECDH P-256)', () => {
    test('should generate ephemeral key pair with correct algorithm', async () => {
      const { privateKey, publicKey } = await generateEphemeralKeyPair();

      expect(privateKey).toBeDefined();
      expect(publicKey).toBeDefined();
      expect(privateKey.algorithm.name).toBe('ECDH');
      expect(privateKey.algorithm.namedCurve).toBe('P-256');
      expect(publicKey.algorithm.name).toBe('ECDH');
      expect(publicKey.algorithm.namedCurve).toBe('P-256');
    });

    test('should export ephemeral public key in JWK format', async () => {
      const { publicKey } = await generateEphemeralKeyPair();
      const jwk = await exportEphPublicKey(publicKey);

      expect(jwk).toBeDefined();
      expect(jwk.kty).toBe('EC');
      expect(jwk.crv).toBe('P-256');
      expect(jwk.x).toBeDefined();
      expect(jwk.y).toBeDefined();
      expect(jwk.d).toBeUndefined();
    });
  });

  describe('Password-Derived Encryption for Private Key Storage', () => {
    test('should store and retrieve private key encrypted with password', async () => {
      const { privateKey: originalKey } = await generateIdentityKeyPair();

      await storePrivateKeyEncrypted(
        testUser.userId,
        originalKey,
        testUser.password,
      );

      const hasKey = await hasIdentityKey(testUser.userId);
      expect(hasKey).toBe(true);

      const loadedKey = await loadPrivateKey(
        testUser.userId,
        testUser.password,
      );

      const keysEqual = await cryptoKeysEqual(originalKey, loadedKey);
      expect(keysEqual).toBe(true);
    });
  });

  describe('IndexedDB Retrieval (basic)', () => {
    test('should load private key from IndexedDB after storage', async () => {
      const { privateKey: originalKey } = await generateIdentityKeyPair();

      await storePrivateKeyEncrypted(
        testUser.userId,
        originalKey,
        testUser.password,
      );

      const loadedKey = await loadPrivateKey(
        testUser.userId,
        testUser.password,
      );

      expect(loadedKey).toBeDefined();
      expect(loadedKey.algorithm.name).toBe('ECDSA');
      expect(loadedKey.algorithm.namedCurve).toBe('P-256');
    });
  });
}
);



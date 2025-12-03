/**
 * TC-MSG-COMBO-002: AES-256-GCM Encryption - Key Import & IV Generation
 * TC-MSG-COMBO-003: AES-256-GCM Decryption - AuthTag Validation
 * 
 * Tests encryption/decryption operations, key import, IV uniqueness, and authTag validation
 */

import { base64Encode, base64Decode, generateIV } from './test-helpers/webcryptoHelper.js';

// Try to import crypto functions
let encryptAESGCM, decryptAESGCM, decryptAESGCMToString, generateIVFromModule;

try {
  const aesModule = await import('../../src/crypto/aesGcm.js');
  encryptAESGCM = aesModule.encryptAESGCM;
  decryptAESGCM = aesModule.decryptAESGCM;
  decryptAESGCMToString = aesModule.decryptAESGCMToString;
  generateIVFromModule = aesModule.generateIV;
} catch (error) {
  throw new Error('Missing module: client/src/crypto/aesGcm.js - please export encryptAESGCM, decryptAESGCM, decryptAESGCMToString, generateIV');
}

const webcrypto = (globalThis.crypto?.subtle) || (require('crypto').webcrypto?.subtle);

describe('TC-MSG-COMBO-002: AES-256-GCM Encryption', () => {
  test('Should import key correctly as AES-GCM CryptoKey', async () => {
    // Generate 256-bit key (32 bytes)
    const keyBuffer = new ArrayBuffer(32);
    const keyView = new Uint8Array(keyBuffer);
    crypto.getRandomValues(keyView);

    // Import key
    const cryptoKey = await webcrypto.importKey(
      'raw',
      keyBuffer,
      {
        name: 'AES-GCM',
        length: 256
      },
      false, // not extractable
      ['encrypt']
    );

    // Verify key properties
    expect(cryptoKey.algorithm.name).toBe('AES-GCM');
    expect(cryptoKey.algorithm.length).toBe(256);
    expect(cryptoKey.usages).toContain('encrypt');
    expect(cryptoKey.extractable).toBe(false);

    console.log('✓ Key imported correctly as AES-256-GCM');
  });

  test('Should generate unique IVs for each message', async () => {
    const ivs = new Set();
    const ivStrings = [];

    // Generate 10 IVs
    for (let i = 0; i < 10; i++) {
      const iv = generateIVFromModule();
      expect(iv.byteLength).toBe(12); // 96 bits
      
      const ivString = base64Encode(iv);
      ivStrings.push(ivString);
      ivs.add(ivString);
    }

    // All IVs should be unique
    expect(ivs.size).toBe(10);
    expect(ivStrings.length).toBe(10);

    // Evidence to capture: console.log('IVs:', ivStrings);
    console.log('✓ All IVs are unique (12 bytes each)');
  });

  test('Should encrypt plaintext correctly', async () => {
    const keyBuffer = new ArrayBuffer(32);
    const keyView = new Uint8Array(keyBuffer);
    crypto.getRandomValues(keyView);

    const plaintext = 'Test message for encryption';
    const result = await encryptAESGCM(keyBuffer, plaintext);

    // Verify result structure
    expect(result.ciphertext).toBeInstanceOf(ArrayBuffer);
    expect(result.iv).toBeInstanceOf(Uint8Array);
    expect(result.authTag).toBeInstanceOf(ArrayBuffer);

    // Verify IV length
    expect(result.iv.byteLength).toBe(12);

    // Verify authTag length
    expect(result.authTag.byteLength).toBe(16);

    // Verify ciphertext is different from plaintext
    const plaintextBuffer = new TextEncoder().encode(plaintext);
    expect(result.ciphertext.byteLength).toBeGreaterThan(0);
    // Ciphertext should not equal plaintext (very unlikely)
    const ciphertextView = new Uint8Array(result.ciphertext);
    const plaintextView = new Uint8Array(plaintextBuffer);
    expect(ciphertextView).not.toEqual(plaintextView);

    // Evidence to capture: console.log('Encryption result:', {
    //   ciphertext: base64Encode(result.ciphertext),
    //   iv: base64Encode(result.iv),
    //   authTag: base64Encode(result.authTag)
    // });
    console.log('✓ Plaintext encrypted successfully');
  });

  test('Should produce different ciphertexts for identical plaintexts (due to unique IVs)', async () => {
    const keyBuffer = new ArrayBuffer(32);
    const keyView = new Uint8Array(keyBuffer);
    crypto.getRandomValues(keyView);

    const plaintext = 'Same message';
    const result1 = await encryptAESGCM(keyBuffer, plaintext);
    const result2 = await encryptAESGCM(keyBuffer, plaintext);
    const result3 = await encryptAESGCM(keyBuffer, plaintext);

    // IVs should be different
    expect(base64Encode(result1.iv)).not.toBe(base64Encode(result2.iv));
    expect(base64Encode(result2.iv)).not.toBe(base64Encode(result3.iv));

    // Ciphertexts should be different (due to different IVs)
    const ciphertext1 = base64Encode(result1.ciphertext);
    const ciphertext2 = base64Encode(result2.ciphertext);
    const ciphertext3 = base64Encode(result3.ciphertext);
    expect(ciphertext1).not.toBe(ciphertext2);
    expect(ciphertext2).not.toBe(ciphertext3);

    console.log('✓ Identical plaintexts produce different ciphertexts');
  });
});

describe('TC-MSG-COMBO-003: AES-256-GCM Decryption', () => {
  test('Should decrypt with valid authTag', async () => {
    const keyBuffer = new ArrayBuffer(32);
    const keyView = new Uint8Array(keyBuffer);
    crypto.getRandomValues(keyView);

    const plaintext = 'Test decryption message';
    const { ciphertext, iv, authTag } = await encryptAESGCM(keyBuffer, plaintext);

    // Decrypt
    const decrypted = await decryptAESGCMToString(keyBuffer, iv, ciphertext, authTag);

    // Verify plaintext recovered
    expect(decrypted).toBe(plaintext);

    console.log('✓ Decryption with valid authTag succeeded');
  });

  test('Should reject decryption with invalid authTag', async () => {
    const keyBuffer = new ArrayBuffer(32);
    const keyView = new Uint8Array(keyBuffer);
    crypto.getRandomValues(keyView);

    const plaintext = 'Test message';
    const { ciphertext, iv, authTag } = await encryptAESGCM(keyBuffer, plaintext);

    // Corrupt authTag
    const corruptedAuthTag = new ArrayBuffer(16);
    const corruptedView = new Uint8Array(corruptedAuthTag);
    crypto.getRandomValues(corruptedView);

    // Attempt decryption - should throw OperationError
    await expect(
      decryptAESGCMToString(keyBuffer, iv, ciphertext, corruptedAuthTag)
    ).rejects.toThrow();

    // Verify error is OperationError or contains authentication failure
    try {
      await decryptAESGCMToString(keyBuffer, iv, ciphertext, corruptedAuthTag);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error.name === 'OperationError' || error.message.includes('authentication') || error.message.includes('verification')).toBe(true);
    }

    console.log('✓ Invalid authTag correctly rejected');
  });

  test('Should reject decryption with tampered ciphertext', async () => {
    const keyBuffer = new ArrayBuffer(32);
    const keyView = new Uint8Array(keyBuffer);
    crypto.getRandomValues(keyView);

    const plaintext = 'Test message';
    const { ciphertext, iv, authTag } = await encryptAESGCM(keyBuffer, plaintext);

    // Tamper with ciphertext (change one byte)
    const tamperedCiphertext = new Uint8Array(ciphertext);
    tamperedCiphertext[0] = (tamperedCiphertext[0] + 1) % 256;

    // Attempt decryption - should throw OperationError
    await expect(
      decryptAESGCMToString(keyBuffer, iv, tamperedCiphertext.buffer, authTag)
    ).rejects.toThrow();

    console.log('✓ Tampered ciphertext correctly rejected');
  });

  test('Should reject decryption with wrong key', async () => {
    const key1 = new ArrayBuffer(32);
    const key1View = new Uint8Array(key1);
    crypto.getRandomValues(key1View);

    const key2 = new ArrayBuffer(32);
    const key2View = new Uint8Array(key2);
    crypto.getRandomValues(key2View);

    const plaintext = 'Test message';
    const { ciphertext, iv, authTag } = await encryptAESGCM(key1, plaintext);

    // Attempt decryption with wrong key - should throw OperationError
    await expect(
      decryptAESGCMToString(key2, iv, ciphertext, authTag)
    ).rejects.toThrow();

    console.log('✓ Wrong key correctly rejected');
  });
});


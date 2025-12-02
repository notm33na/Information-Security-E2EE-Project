/**
 * Crypto Helper Functions
 * Utilities for cryptographic operations in tests
 */

import crypto from 'crypto';

// Use webcrypto if available (Node.js 15+)
const webcrypto = (globalThis.crypto?.subtle) || (crypto.webcrypto?.subtle) || crypto.subtle;
const getRandomValues = (globalThis.crypto?.getRandomValues) || (crypto.webcrypto?.getRandomValues) || crypto.getRandomValues;

/**
 * Generates a test identity key pair
 * @returns {Promise<{privateKey: CryptoKey, publicKey: CryptoKey}>}
 */
export async function generateTestKeyPair() {
  const keyPair = await webcrypto.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    true, // extractable
    ['sign', 'verify']
  );

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey
  };
}

/**
 * Exports a public key to JWK format
 * @param {CryptoKey} publicKey - Public key
 * @returns {Promise<Object>} JWK object
 */
export async function exportPublicKeyJWK(publicKey) {
  return await webcrypto.exportKey('jwk', publicKey);
}

/**
 * Exports a private key to JWK format
 * @param {CryptoKey} privateKey - Private key
 * @returns {Promise<Object>} JWK object
 */
export async function exportPrivateKeyJWK(privateKey) {
  return await webcrypto.exportKey('jwk', privateKey);
}

/**
 * Imports a public key from JWK format
 * @param {Object} jwk - JWK object
 * @returns {Promise<CryptoKey>} Public key
 */
export async function importPublicKeyJWK(jwk) {
  return await webcrypto.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    true,
    ['verify']
  );
}

/**
 * Imports a private key from JWK format
 * @param {Object} jwk - JWK object
 * @returns {Promise<CryptoKey>} Private key
 */
export async function importPrivateKeyJWK(jwk) {
  return await webcrypto.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    true,
    ['sign']
  );
}

/**
 * Encrypts private key with password (simplified for testing)
 * @param {CryptoKey} privateKey - Private key to encrypt
 * @param {string} password - Password for encryption
 * @returns {Promise<{encryptedData: Uint8Array, salt: Uint8Array, iv: Uint8Array}>}
 */
export async function encryptPrivateKey(privateKey, password) {
  // Export private key to JWK
  const jwk = await exportPrivateKeyJWK(privateKey);
  
  // Convert to ArrayBuffer
  const encoder = new TextEncoder();
  const keyData = encoder.encode(JSON.stringify(jwk));
  
    // Generate salt and IV
    const salt = getRandomValues(new Uint8Array(16));
    const iv = getRandomValues(new Uint8Array(12));
    
    // Derive encryption key
    const passwordKey = await webcrypto.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
    const encryptionKey = await webcrypto.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: parseInt(process.env.CRYPTO_PBKDF2_ITERATIONS || '100000', 10),
      hash: 'SHA-256'
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
  
    // Encrypt
    const encryptedData = await webcrypto.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    encryptionKey,
    keyData
  );
  
  return {
    encryptedData: new Uint8Array(encryptedData),
    salt: salt,
    iv: iv
  };
}

/**
 * Decrypts private key with password
 * @param {Uint8Array} encryptedData - Encrypted data
 * @param {string} password - Password for decryption
 * @param {Uint8Array} salt - Salt used for encryption
 * @param {Uint8Array} iv - IV used for encryption
 * @returns {Promise<CryptoKey>} Decrypted private key
 */
export async function decryptPrivateKey(encryptedData, password, salt, iv) {
    // Derive decryption key
    const encoder = new TextEncoder();
    const passwordKey = await webcrypto.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
    const decryptionKey = await webcrypto.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: parseInt(process.env.CRYPTO_PBKDF2_ITERATIONS || '100000', 10),
      hash: 'SHA-256'
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
  
    // Decrypt
    const decryptedData = await webcrypto.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    decryptionKey,
    encryptedData
  );
  
  // Parse JWK and import key
  const decoder = new TextDecoder();
  const jwk = JSON.parse(decoder.decode(decryptedData));
  
  return await importPrivateKeyJWK(jwk);
}

/**
 * Generates an ephemeral ECDH key pair
 * @returns {Promise<{privateKey: CryptoKey, publicKey: CryptoKey}>}
 */
export async function generateEphemeralKeyPair() {
  const keyPair = await webcrypto.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey
  };
}

/**
 * Signs data with a private key
 * @param {CryptoKey} privateKey - Private key
 * @param {ArrayBuffer} data - Data to sign
 * @returns {Promise<ArrayBuffer>} Signature
 */
export async function signData(privateKey, data) {
  return await webcrypto.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256'
    },
    privateKey,
    data
  );
}

/**
 * Verifies a signature
 * @param {CryptoKey} publicKey - Public key
 * @param {ArrayBuffer} signature - Signature to verify
 * @param {ArrayBuffer} data - Original data
 * @returns {Promise<boolean>} True if signature is valid
 */
export async function verifySignature(publicKey, signature, data) {
  return await webcrypto.verify(
    {
      name: 'ECDSA',
      hash: 'SHA-256'
    },
    publicKey,
    signature,
    data
  );
}


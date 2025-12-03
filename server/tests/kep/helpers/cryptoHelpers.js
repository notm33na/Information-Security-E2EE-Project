/**
 * Cryptographic Helper Functions for KEP Tests
 * Adapted for Node.js webcrypto environment
 */

import crypto from 'crypto';

const webcrypto = (globalThis.crypto?.subtle) || (crypto.webcrypto?.subtle);
const getRandomValues = (globalThis.crypto?.getRandomValues) || (crypto.webcrypto?.getRandomValues) || ((arr) => {
  return crypto.randomFillSync(arr);
});

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
  return { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey };
}

/**
 * Exports public key to JWK format
 * @param {CryptoKey} publicKey - Public key
 * @returns {Promise<Object>} JWK object
 */
export async function exportPublicKeyJWK(publicKey) {
  return await webcrypto.exportKey('jwk', publicKey);
}

/**
 * Imports public key from JWK format
 * @param {Object} jwk - JWK object
 * @returns {Promise<CryptoKey>} Public key
 */
export async function importPublicKeyJWK(jwk) {
  return await webcrypto.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Computes shared secret using ECDH
 * @param {CryptoKey} privateKey - Private key
 * @param {CryptoKey} publicKey - Public key
 * @returns {Promise<ArrayBuffer>} Shared secret
 */
export async function computeSharedSecret(privateKey, publicKey) {
  return await webcrypto.deriveBits(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
      public: publicKey
    },
    privateKey,
    256 // 256 bits = 32 bytes
  );
}

/**
 * HKDF key derivation
 * @param {ArrayBuffer} inputKeyMaterial - Input key material
 * @param {ArrayBuffer} salt - Salt
 * @param {ArrayBuffer} info - Info
 * @param {number} length - Length in bits
 * @returns {Promise<ArrayBuffer>} Derived key
 */
export async function hkdf(inputKeyMaterial, salt, info, length) {
  const baseKey = await webcrypto.importKey(
    'raw',
    inputKeyMaterial,
    'HKDF',
    false,
    ['deriveBits']
  );
  return await webcrypto.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt || new ArrayBuffer(0),
      info: info
    },
    baseKey,
    length
  );
}

/**
 * Derives session keys from shared secret
 * @param {ArrayBuffer} sharedSecret - Shared secret
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {string} peerId - Peer ID
 * @returns {Promise<{rootKey: ArrayBuffer, sendKey: ArrayBuffer, recvKey: ArrayBuffer}>}
 */
export async function deriveSessionKeys(sharedSecret, sessionId, userId, peerId) {
  const encoder = new TextEncoder();
  
  // Derive root key
  const rootKeySalt = encoder.encode('ROOT');
  const rootKeyInfo = encoder.encode(sessionId);
  const rootKey = await hkdf(sharedSecret, rootKeySalt, rootKeyInfo, 256);
  
  // Derive send key
  const sendKeySalt = encoder.encode('SEND');
  const sendKeyInfo = encoder.encode(userId);
  const sendKey = await hkdf(rootKey, sendKeySalt, sendKeyInfo, 256);
  
  // Derive receive key (using SEND salt for symmetry)
  const recvKeySalt = encoder.encode('SEND');
  const recvKeyInfo = encoder.encode(peerId);
  const recvKey = await hkdf(rootKey, recvKeySalt, recvKeyInfo, 256);
  
  return { rootKey, sendKey, recvKey };
}

/**
 * Signs ephemeral key with identity private key
 * @param {CryptoKey} identityPrivateKey - Identity private key
 * @param {Object} ephPubJWK - Ephemeral public key JWK
 * @returns {Promise<ArrayBuffer>} Signature
 */
export async function signEphemeralKey(identityPrivateKey, ephPubJWK) {
  const encoder = new TextEncoder();
  const jwkString = JSON.stringify(ephPubJWK);
  const data = encoder.encode(jwkString);
  return await webcrypto.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    identityPrivateKey,
    data
  );
}

/**
 * Verifies signature on ephemeral key
 * @param {CryptoKey} identityPublicKey - Identity public key
 * @param {ArrayBuffer} signature - Signature
 * @param {Object} ephPubJWK - Ephemeral public key JWK
 * @returns {Promise<boolean>} True if valid
 */
export async function verifyEphemeralKeySignature(identityPublicKey, signature, ephPubJWK) {
  try {
    const encoder = new TextEncoder();
    const jwkString = JSON.stringify(ephPubJWK);
    const data = encoder.encode(jwkString);
    return await webcrypto.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      identityPublicKey,
      signature,
      data
    );
  } catch (error) {
    return false;
  }
}

/**
 * Generates key confirmation HMAC
 * @param {ArrayBuffer} rootKey - Root key
 * @param {string} userId - User ID to confirm
 * @returns {Promise<ArrayBuffer>} HMAC
 */
export async function generateKeyConfirmation(rootKey, userId) {
  const encoder = new TextEncoder();
  const confirmData = encoder.encode(`CONFIRM:${userId}`);
  const hmacKey = await webcrypto.importKey(
    'raw',
    rootKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return await webcrypto.sign('HMAC', hmacKey, confirmData);
}

/**
 * Verifies key confirmation HMAC
 * @param {ArrayBuffer} receivedHMAC - Received HMAC
 * @param {ArrayBuffer} rootKey - Root key
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if valid
 */
export async function verifyKeyConfirmation(receivedHMAC, rootKey, userId) {
  try {
    const encoder = new TextEncoder();
    const confirmData = encoder.encode(`CONFIRM:${userId}`);
    const hmacKey = await webcrypto.importKey(
      'raw',
      rootKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    // Generate expected HMAC and compare
    const expectedHMAC = await webcrypto.sign('HMAC', hmacKey, confirmData);
    return arrayBuffersEqual(receivedHMAC, expectedHMAC);
  } catch (error) {
    return false;
  }
}

/**
 * Generates a nonce
 * @param {number} length - Length in bytes (default: 16)
 * @returns {Uint8Array} Nonce
 */
export function generateNonce(length = 16) {
  const arr = new Uint8Array(length);
  // Use crypto.getRandomValues or crypto.randomFillSync
  if (globalThis.crypto && globalThis.crypto.getRandomValues) {
    return globalThis.crypto.getRandomValues(arr);
  } else if (crypto.webcrypto && crypto.webcrypto.getRandomValues) {
    return crypto.webcrypto.getRandomValues(arr);
  }
  // Fallback using crypto.randomFillSync
  return crypto.randomFillSync(arr);
}

/**
 * Converts ArrayBuffer to base64
 * @param {ArrayBuffer} buffer - Buffer
 * @returns {string} Base64 string
 */
export function arrayBufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

/**
 * Converts base64 to ArrayBuffer
 * @param {string} base64 - Base64 string
 * @returns {ArrayBuffer} ArrayBuffer
 */
export function base64ToArrayBuffer(base64) {
  const buffer = Buffer.from(base64, 'base64');
  const arrayBuffer = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; i++) {
    view[i] = buffer[i];
  }
  return arrayBuffer;
}

/**
 * Compares two ArrayBuffers
 * @param {ArrayBuffer} a - First buffer
 * @param {ArrayBuffer} b - Second buffer
 * @returns {boolean} True if equal
 */
export function arrayBuffersEqual(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  const viewA = new Uint8Array(a);
  const viewB = new Uint8Array(b);
  for (let i = 0; i < viewA.length; i++) {
    if (viewA[i] !== viewB[i]) return false;
  }
  return true;
}


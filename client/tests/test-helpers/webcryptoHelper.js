/**
 * Web Crypto Helper Functions for Tests
 * Provides base64 encoding/decoding, IV generation, and SHA-256 hashing
 */

import crypto from 'crypto';

const webcrypto = (globalThis.crypto?.subtle) || (crypto.webcrypto?.subtle);
const getRandomValues = (globalThis.crypto?.getRandomValues) || (crypto.webcrypto?.getRandomValues) || ((arr) => {
  return crypto.randomFillSync(arr);
});

/**
 * Base64 encodes an ArrayBuffer or Uint8Array
 * @param {ArrayBuffer|Uint8Array} buffer - Buffer to encode
 * @returns {string} Base64 string
 */
export function base64Encode(buffer) {
  if (buffer instanceof Uint8Array) {
    return Buffer.from(buffer).toString('base64');
  }
  return Buffer.from(buffer).toString('base64');
}

/**
 * Base64 decodes a string to ArrayBuffer
 * @param {string} base64 - Base64 string
 * @returns {ArrayBuffer} Decoded buffer
 */
export function base64Decode(base64) {
  const buffer = Buffer.from(base64, 'base64');
  const arrayBuffer = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; i++) {
    view[i] = buffer[i];
  }
  return arrayBuffer;
}

/**
 * Generates a random IV (12 bytes for AES-GCM)
 * @returns {Uint8Array} 12-byte IV
 */
export function generateIV() {
  const arr = new Uint8Array(12);
  if (globalThis.crypto && globalThis.crypto.getRandomValues) {
    return globalThis.crypto.getRandomValues(arr);
  } else if (crypto.webcrypto && crypto.webcrypto.getRandomValues) {
    return crypto.webcrypto.getRandomValues(arr);
  }
  return crypto.randomFillSync(arr);
}

/**
 * Computes SHA-256 hash of data
 * @param {ArrayBuffer|Uint8Array|string} data - Data to hash
 * @returns {Promise<ArrayBuffer>} Hash as ArrayBuffer
 */
export async function sha256(data) {
  let buffer;
  if (typeof data === 'string') {
    const encoder = new TextEncoder();
    buffer = encoder.encode(data);
  } else if (data instanceof Uint8Array) {
    buffer = data;
  } else {
    buffer = new Uint8Array(data);
  }
  
  return await webcrypto.digest('SHA-256', buffer);
}

/**
 * Computes SHA-256 hash and returns hex string
 * @param {ArrayBuffer|Uint8Array|string} data - Data to hash
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function sha256Hex(data) {
  const hash = await sha256(data);
  const hashBytes = new Uint8Array(hash);
  let hex = '';
  for (const b of hashBytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Validates base64 string format
 * @param {string} str - String to validate
 * @returns {boolean} True if valid base64
 */
export function isValidBase64(str) {
  if (typeof str !== 'string' || str.length === 0) {
    return false;
  }
  try {
    const decoded = Buffer.from(str, 'base64');
    const reencoded = decoded.toString('base64');
    return reencoded === str;
  } catch (e) {
    return false;
  }
}


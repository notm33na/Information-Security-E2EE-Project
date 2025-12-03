/**
 * Mock Crypto Utilities
 * Provides mock cryptographic keys and operations for testing
 */

/**
 * Generates mock session keys (32 bytes each for AES-256)
 * @returns {{sendKey: ArrayBuffer, recvKey: ArrayBuffer}} Mock keys
 */
export function generateMockKeys() {
  const sendKey = new ArrayBuffer(32);
  const recvKey = new ArrayBuffer(32);
  
  const sendView = new Uint8Array(sendKey);
  const recvView = new Uint8Array(recvKey);
  
  // Generate random keys
  crypto.getRandomValues(sendView);
  crypto.getRandomValues(recvView);
  
  return { sendKey, recvKey };
}

/**
 * Generates a mock IV (12 bytes)
 * @returns {Uint8Array} 12-byte IV
 */
export function generateMockIV() {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  return iv;
}

/**
 * Extracts IV from envelope (base64 to Uint8Array)
 * @param {Object} envelope - Message envelope
 * @returns {Uint8Array} IV
 */
export function extractIV(envelope) {
  const base64 = envelope.iv;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Extracts authTag from envelope (base64 to ArrayBuffer)
 * @param {Object} envelope - Message envelope
 * @returns {ArrayBuffer} AuthTag
 */
export function extractAuthTag(envelope) {
  const base64 = envelope.authTag;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Corrupts an authTag by flipping random bits
 * @param {Object} envelope - Message envelope
 * @returns {Object} Envelope with corrupted authTag
 */
export function corruptAuthTag(envelope) {
  const corrupted = { ...envelope };
  const authTagBuffer = extractAuthTag(envelope);
  const view = new Uint8Array(authTagBuffer);
  
  // Flip random bits
  for (let i = 0; i < view.length; i++) {
    view[i] = view[i] ^ (1 << (i % 8));
  }
  
  // Convert back to base64
  let binary = '';
  for (let i = 0; i < view.length; i++) {
    binary += String.fromCharCode(view[i]);
  }
  corrupted.authTag = btoa(binary);
  
  return corrupted;
}

/**
 * Corrupts ciphertext by modifying bytes
 * @param {Object} envelope - Message envelope
 * @returns {Object} Envelope with corrupted ciphertext
 */
export function corruptCiphertext(envelope) {
  const corrupted = { ...envelope };
  const base64 = envelope.ciphertext;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  // Modify first byte
  bytes[0] = (bytes[0] + 1) % 256;
  
  // Convert back to base64
  let newBinary = '';
  for (let i = 0; i < bytes.length; i++) {
    newBinary += String.fromCharCode(bytes[i]);
  }
  corrupted.ciphertext = btoa(newBinary);
  
  return corrupted;
}

/**
 * Verifies IV is 12 bytes
 * @param {Uint8Array} iv - IV to verify
 * @returns {boolean} True if valid
 */
export function verifyIVLength(iv) {
  return iv.byteLength === 12;
}

/**
 * Verifies authTag is 16 bytes
 * @param {ArrayBuffer} authTag - AuthTag to verify
 * @returns {boolean} True if valid
 */
export function verifyAuthTagLength(authTag) {
  return authTag.byteLength === 16;
}


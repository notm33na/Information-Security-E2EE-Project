/**
 * ECDH (Elliptic Curve Diffie-Hellman) Operations
 * 
 * Handles ephemeral key generation, shared secret computation,
 * and HKDF-based key derivation for session keys.
 * 
 * Uses Web Crypto API with P-256 curve.
 */

/**
 * Generates an ephemeral ECDH key pair for key exchange
 * @returns {Promise<{privateKey: CryptoKey, publicKey: CryptoKey}>}
 */
export async function generateEphemeralKeyPair() {
  try {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true, // extractable
      ['deriveKey', 'deriveBits']
    );

    console.log('[KEP] ✓ Generated ephemeral key pair (ECDH P-256)');
    
    return {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey
    };
  } catch (error) {
    throw new Error(`Failed to generate ephemeral key pair: ${error.message}`);
  }
}

/**
 * Computes shared secret using ECDH
 * @param {CryptoKey} privateKey - Our private key
 * @param {CryptoKey} publicKey - Their public key
 * @returns {Promise<ArrayBuffer>} Shared secret as ArrayBuffer
 */
export async function computeSharedSecret(privateKey, publicKey) {
  try {
    const sharedSecret = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        namedCurve: 'P-256',
        public: publicKey
      },
      privateKey,
      256 // 256 bits = 32 bytes
    );

    return sharedSecret;
  } catch (error) {
    throw new Error(`Failed to compute shared secret: ${error.message}`);
  }
}

/**
 * HKDF (HMAC-based Key Derivation Function) using Web Crypto API
 * @param {ArrayBuffer} inputKeyMaterial - Input key material (shared secret)
 * @param {ArrayBuffer} salt - Salt (optional, can be empty)
 * @param {ArrayBuffer} info - Context/application-specific info
 * @param {number} length - Output length in bits
 * @returns {Promise<ArrayBuffer>} Derived key material
 */
export async function hkdf(inputKeyMaterial, salt, info, length) {
  try {
    // Import input key material
    const baseKey = await crypto.subtle.importKey(
      'raw',
      inputKeyMaterial,
      'HKDF',
      false,
      ['deriveBits']
    );

    // Derive key using HKDF
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: salt || new ArrayBuffer(0),
        info: info
      },
      baseKey,
      length
    );

    return derivedBits;
  } catch (error) {
    throw new Error(`HKDF derivation failed: ${error.message}`);
  }
}

/**
 * Derives session keys from shared secret using HKDF
 * 
 * Key derivation chain:
 * 1. rootKey = HKDF(sharedSecret, salt="ROOT", info=sessionId, 256 bits)
 * 2. sendKey = HKDF(rootKey, salt="SEND", info=userId, 256 bits)
 * 3. recvKey = HKDF(rootKey, salt="SEND", info=peerId, 256 bits)
 * 
 * Note: Both sendKey and recvKey use "SEND" salt to ensure symmetry:
 * - Alice's sendKey = HKDF(rootKey, "SEND", aliceId) = Bob's recvKey = HKDF(rootKey, "SEND", aliceId)
 * - Bob's sendKey = HKDF(rootKey, "SEND", bobId) = Alice's recvKey = HKDF(rootKey, "SEND", bobId)
 * 
 * @param {ArrayBuffer} sharedSecret - ECDH shared secret
 * @param {string} sessionId - Unique session identifier
 * @param {string} userId - Our user ID
 * @param {string} peerId - Peer user ID
 * @returns {Promise<{rootKey: ArrayBuffer, sendKey: ArrayBuffer, recvKey: ArrayBuffer}>}
 */
export async function deriveSessionKeys(sharedSecret, sessionId, userId, peerId) {
  try {
    const encoder = new TextEncoder();

    // Derive root key
    const rootKeySalt = encoder.encode('ROOT');
    const rootKeyInfo = encoder.encode(sessionId);
    const rootKey = await hkdf(sharedSecret, rootKeySalt, rootKeyInfo, 256);
    console.log('[KEP] ✓ Session key derived (HKDF-SHA256): rootKey, sendKey, recvKey');

    // Derive send key (for messages we send)
    // This will match the peer's recvKey when they derive with same salt and our userId as info
    const sendKeySalt = encoder.encode('SEND');
    const sendKeyInfo = encoder.encode(userId);
    const sendKey = await hkdf(rootKey, sendKeySalt, sendKeyInfo, 256);

    // Derive receive key (for messages we receive)
    // This matches the peer's sendKey (they derive with same salt and their userId, which is our peerId)
    // Use "SEND" salt to ensure symmetry: peer's sendKey = HKDF(rootKey, "SEND", peerId) = our recvKey
    const recvKeySalt = encoder.encode('SEND');
    const recvKeyInfo = encoder.encode(peerId);
    const recvKey = await hkdf(rootKey, recvKeySalt, recvKeyInfo, 256);

    return {
      rootKey,
      sendKey,
      recvKey
    };
  } catch (error) {
    throw new Error(`Failed to derive session keys: ${error.message}`);
  }
}

/**
 * Exports public key to JWK format
 * @param {CryptoKey} publicKey - Public key to export
 * @returns {Promise<Object>} JWK object (cleaned of optional fields)
 */
export async function exportPublicKey(publicKey) {
  try {
    const jwk = await crypto.subtle.exportKey('jwk', publicKey);
    
    // Clean the JWK to remove optional fields that might cause import issues
    // Keep only essential fields: kty, crv, x, y
    // Remove key_ops, use, alg, kid, ext to ensure compatibility across different implementations
    const cleanedJWK = {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y
    };
    
    return cleanedJWK;
  } catch (error) {
    throw new Error(`Failed to export public key: ${error.message}`);
  }
}

/**
 * Imports public key from JWK format
 * @param {Object} jwk - JWK object
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKey(jwk) {
  try {
    // Check if Web Crypto API is available
    if (!crypto || !crypto.subtle) {
      throw new Error('Web Crypto API is not available. This page must be served over HTTPS (or localhost).');
    }

    // Deep clone to avoid mutating the original
    const cleanedJWK = JSON.parse(JSON.stringify(jwk));
    
    // Always remove key_ops and other optional fields that might cause conflicts
    // Web Crypto API is strict: if key_ops is present, it must be a superset of requested usages
    // By removing it, we let Web Crypto use the usages we specify in the import call
    delete cleanedJWK.key_ops;
    delete cleanedJWK.use;
    delete cleanedJWK.alg;
    delete cleanedJWK.kid;
    delete cleanedJWK.ext;
    
    // Keep only the essential fields required for ECDH P-256 public keys
    // These are the minimum required fields according to RFC 7517
    const essentialFields = ['kty', 'crv', 'x', 'y'];
    const finalJWK = {};
    for (const field of essentialFields) {
      if (cleanedJWK[field] !== undefined) {
        finalJWK[field] = cleanedJWK[field];
      } else {
        throw new Error(`Missing required JWK field: ${field}`);
      }
    }
    
    // Validate that we have all required fields
    if (!finalJWK.kty || finalJWK.kty !== 'EC') {
      throw new Error('Invalid JWK: kty must be "EC"');
    }
    if (!finalJWK.crv || finalJWK.crv !== 'P-256') {
      throw new Error('Invalid JWK: crv must be "P-256"');
    }
    if (!finalJWK.x || !finalJWK.y) {
      throw new Error('Invalid JWK: missing x or y coordinate');
    }
    
    // For ECDH public keys, keyUsages must be an empty array []
    // Public keys don't have usages - only private keys do
    // The public key is used in deriveBits/deriveKey operations, but you don't specify usages when importing it
    return await crypto.subtle.importKey(
      'jwk',
      finalJWK,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true, // extractable
      [] // Empty array for public keys - usages are only for private keys
    );
  } catch (error) {
    // Provide more context in error message
    if (error.message.includes('key_ops') || error.message.includes('key usages')) {
      throw new Error(`Failed to import public key: ${error.message}. JWK had key_ops: ${jwk.key_ops ? JSON.stringify(jwk.key_ops) : 'none'}, other fields: ${JSON.stringify(Object.keys(jwk))}`);
    }
    throw new Error(`Failed to import public key: ${error.message}`);
  }
}


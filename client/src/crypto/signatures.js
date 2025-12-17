/**
 * Digital Signature Operations
 * 
 * Handles signing and verification of data using ECC P-256 keys.
 * Used for:
 * - Signing ephemeral public keys in KEP
 * - Verifying signatures from peers
 */

/**
 * Signs data using private key
 * @param {CryptoKey} privateKey - Private key for signing
 * @param {ArrayBuffer|string} data - Data to sign
 * @returns {Promise<ArrayBuffer>} Signature as ArrayBuffer
 */
export async function signData(privateKey, data) {
  try {
    // Convert string to ArrayBuffer if needed
    let dataBuffer;
    if (typeof data === 'string') {
      const encoder = new TextEncoder();
      dataBuffer = encoder.encode(data);
    } else {
      dataBuffer = data;
    }

    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      privateKey,
      dataBuffer
    );

    return signature;
  } catch (error) {
    throw new Error(`Failed to sign data: ${error.message}`);
  }
}

/**
 * Verifies signature using public key
 * @param {CryptoKey} publicKey - Public key for verification
 * @param {ArrayBuffer} signature - Signature to verify
 * @param {ArrayBuffer|string} data - Original data
 * @returns {Promise<boolean>} True if signature is valid
 */
export async function verifySignature(publicKey, signature, data) {
  try {
    // Convert string to ArrayBuffer if needed
    let dataBuffer;
    if (typeof data === 'string') {
      const encoder = new TextEncoder();
      dataBuffer = encoder.encode(data);
    } else {
      dataBuffer = data;
    }

    const isValid = await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      publicKey,
      signature,
      dataBuffer
    );

    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Normalizes JWK to ensure consistent stringification
 * Removes any extra fields and ensures keys are in a consistent order
 * @param {Object} jwk - JWK object
 * @returns {Object} Normalized JWK with keys in sorted order
 */
function normalizeJWK(jwk) {
  // Build normalized object with keys in a specific, consistent order
  // This ensures JSON.stringify produces the same output every time
  const normalized = {};
  
  // Always include these required fields in this exact order
  normalized.kty = jwk.kty;
  normalized.crv = jwk.crv;
  normalized.x = jwk.x;
  normalized.y = jwk.y;
  
  // Add optional fields if present and non-empty (in alphabetical order for consistency)
  // Note: We skip empty arrays/strings to ensure consistency
  if (jwk.alg !== undefined && jwk.alg !== null && jwk.alg !== '') {
    normalized.alg = jwk.alg;
  }
  // Only include key_ops if it's a non-empty array
  if (jwk.key_ops !== undefined && Array.isArray(jwk.key_ops) && jwk.key_ops.length > 0) {
    normalized.key_ops = jwk.key_ops;
  }
  if (jwk.use !== undefined && jwk.use !== null && jwk.use !== '') {
    normalized.use = jwk.use;
  }
  
  return normalized;
}

/**
 * Signs ephemeral public key for KEP
 * @param {CryptoKey} identityPrivateKey - Identity private key
 * @param {Object} ephPubJWK - Ephemeral public key in JWK format
 * @returns {Promise<ArrayBuffer>} Signature
 */
export async function signEphemeralKey(identityPrivateKey, ephPubJWK) {
  try {
    // Normalize JWK to ensure consistent stringification
    const normalizedJWK = normalizeJWK(ephPubJWK);
    // Serialize JWK to string for signing
    // The normalized object already has keys in consistent order, so JSON.stringify will produce consistent output
    const jwkString = JSON.stringify(normalizedJWK);
    
    console.log('[Signature Creation] Signing ephemeral key...', {
      normalizedJWKKeys: Object.keys(normalizedJWK),
      jwkStringLength: jwkString.length,
      jwkString: jwkString
    });
    
    const signature = await signData(identityPrivateKey, jwkString);
    
    console.log('[Signature Creation] ✓ Signature created successfully', {
      signatureLength: signature.byteLength,
      jwkStringPreview: jwkString.substring(0, 100) + '...'
    });
    
    return signature;
  } catch (error) {
    console.error('[Signature Creation] ✗ Failed to sign ephemeral key:', error);
    throw new Error(`Failed to sign ephemeral key: ${error.message}`);
  }
}

/**
 * Verifies signature on ephemeral public key
 * @param {CryptoKey} identityPublicKey - Identity public key
 * @param {ArrayBuffer} signature - Signature to verify
 * @param {Object} ephPubJWK - Ephemeral public key in JWK format
 * @returns {Promise<boolean>} True if signature is valid
 */
export async function verifyEphemeralKeySignature(identityPublicKey, signature, ephPubJWK) {
  try {
    // Normalize JWK to ensure consistent stringification (same as signing)
    const normalizedJWK = normalizeJWK(ephPubJWK);
    // Serialize JWK to string for verification (same method as signing)
    const jwkString = JSON.stringify(normalizedJWK);
    
    console.log('[Signature Verification] Attempting to verify signature...', {
      normalizedJWKKeys: Object.keys(normalizedJWK),
      jwkStringLength: jwkString.length,
      signatureLength: signature.byteLength,
      jwkString: jwkString
    });
    
    const isValid = await verifySignature(identityPublicKey, signature, jwkString);
    
    if (!isValid) {
      console.error('═══════════════════════════════════════════════════════════');
      console.error('🚨 SIGNATURE VERIFICATION FAILED - DETAILED DEBUG INFO 🚨');
      console.error('═══════════════════════════════════════════════════════════');
      console.error('[Signature Verification] Signature verification returned false');
      console.error('[Signature Verification] Original JWK keys:', Object.keys(ephPubJWK));
      console.error('[Signature Verification] Normalized JWK keys:', Object.keys(normalizedJWK));
      console.error('[Signature Verification] JWK string used for verification:', jwkString);
      console.error('[Signature Verification] Signature length:', signature.byteLength, 'bytes');
      console.error('[Signature Verification] Identity public key type:', identityPublicKey?.algorithm?.name);
      console.error('[Signature Verification] Identity public key curve:', identityPublicKey?.algorithm?.namedCurve);
      console.error('═══════════════════════════════════════════════════════════');
    } else {
      console.log('[Signature Verification] ✓ Signature verified successfully');
    }
    
    return isValid;
  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('🚨 SIGNATURE VERIFICATION EXCEPTION 🚨');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('Ephemeral key signature verification error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('JWK that failed verification:', ephPubJWK);
    console.error('═══════════════════════════════════════════════════════════');
    return false;
  }
}

/**
 * Converts ArrayBuffer to base64 string
 * @param {ArrayBuffer} buffer - Buffer to convert
 * @returns {string} Base64 string
 */
export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts base64 string to ArrayBuffer
 * @param {string} base64 - Base64 string
 * @returns {ArrayBuffer} ArrayBuffer
 */
export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}


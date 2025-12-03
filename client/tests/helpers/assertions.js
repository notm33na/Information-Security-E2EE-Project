/**
 * Custom Assertions for File Encryption Tests
 * Extends Jest matchers with file-specific assertions
 */

/**
 * Custom matcher: toHaveProperty
 * Checks if object has property (Jest built-in, but documented here for clarity)
 */
export const toHaveProperty = (received, property) => {
  const pass = property in received;
  return {
    message: () => `expected ${received} ${pass ? 'not ' : ''}to have property ${property}`,
    pass
  };
};

/**
 * Custom matcher: toEqualBytes
 * Compares two ArrayBuffers or Blobs byte-by-byte
 */
export const toEqualBytes = (received, expected) => {
  let receivedBuffer, expectedBuffer;
  
  if (received instanceof Blob) {
    receivedBuffer = received.arrayBuffer();
  } else if (received instanceof ArrayBuffer) {
    receivedBuffer = Promise.resolve(received);
  } else {
    return {
      message: () => `expected ${received} to be ArrayBuffer or Blob`,
      pass: false
    };
  }
  
  if (expected instanceof Blob) {
    expectedBuffer = expected.arrayBuffer();
  } else if (expected instanceof ArrayBuffer) {
    expectedBuffer = Promise.resolve(expected);
  } else {
    return {
      message: () => `expected ${expected} to be ArrayBuffer or Blob`,
      pass: false
    };
  }
  
  return Promise.all([receivedBuffer, expectedBuffer]).then(([recv, exp]) => {
    if (recv.byteLength !== exp.byteLength) {
      return {
        message: () => `expected buffers to have same length (${recv.byteLength} vs ${exp.byteLength})`,
        pass: false
      };
    }
    
    const recvView = new Uint8Array(recv);
    const expView = new Uint8Array(exp);
    
    for (let i = 0; i < recvView.length; i++) {
      if (recvView[i] !== expView[i]) {
        return {
          message: () => `buffers differ at byte ${i} (${recvView[i]} vs ${expView[i]})`,
          pass: false
        };
      }
    }
    
    return {
      message: () => 'buffers are equal',
      pass: true
    };
  });
};

/**
 * Helper to check envelope structure
 * @param {Object} envelope - Envelope to check
 * @param {string} expectedType - Expected type (MSG, FILE_META, FILE_CHUNK)
 */
export function expectValidEnvelope(envelope, expectedType) {
  expect(envelope).toBeDefined();
  expect(envelope.type).toBe(expectedType);
  expect(envelope.sessionId).toBeDefined();
  expect(envelope.sender).toBeDefined();
  expect(envelope.receiver).toBeDefined();
  expect(envelope.ciphertext).toBeDefined();
  expect(typeof envelope.ciphertext).toBe('string'); // base64
  expect(envelope.iv).toBeDefined();
  expect(typeof envelope.iv).toBe('string'); // base64
  expect(envelope.authTag).toBeDefined();
  expect(typeof envelope.authTag).toBe('string'); // base64
  expect(envelope.timestamp).toBeDefined();
  expect(typeof envelope.timestamp).toBe('number');
  expect(envelope.seq).toBeDefined();
  expect(typeof envelope.seq).toBe('number');
  expect(envelope.nonce).toBeDefined();
  expect(typeof envelope.nonce).toBe('string'); // base64
}

/**
 * Helper to check FILE_META envelope
 * @param {Object} envelope - Envelope to check
 */
export function expectFileMetaEnvelope(envelope) {
  expectValidEnvelope(envelope, 'FILE_META');
  expect(envelope.meta).toBeDefined();
  expect(envelope.meta.filename).toBeDefined();
  expect(envelope.meta.size).toBeDefined();
  expect(typeof envelope.meta.size).toBe('number');
  expect(envelope.meta.totalChunks).toBeDefined();
  expect(typeof envelope.meta.totalChunks).toBe('number');
  expect(envelope.meta.mimetype).toBeDefined();
}

/**
 * Helper to check FILE_CHUNK envelope
 * @param {Object} envelope - Envelope to check
 */
export function expectFileChunkEnvelope(envelope) {
  expectValidEnvelope(envelope, 'FILE_CHUNK');
  expect(envelope.meta).toBeDefined();
  expect(envelope.meta.chunkIndex).toBeDefined();
  expect(typeof envelope.meta.chunkIndex).toBe('number');
  expect(envelope.meta.totalChunks).toBeDefined();
  expect(typeof envelope.meta.totalChunks).toBe('number');
}

/**
 * Helper to verify IV length (12 bytes = 16 base64 chars)
 * @param {string} base64IV - Base64-encoded IV
 */
export function expectIVLength(base64IV) {
  const decoded = atob(base64IV);
  expect(decoded.length).toBe(12);
}

/**
 * Helper to verify authTag length (16 bytes = 24 base64 chars)
 * @param {string} base64AuthTag - Base64-encoded authTag
 */
export function expectAuthTagLength(base64AuthTag) {
  const decoded = atob(base64AuthTag);
  expect(decoded.length).toBe(16);
}

/**
 * Helper to verify all IVs are unique
 * @param {Array<string>} base64IVs - Array of base64-encoded IVs
 */
export function expectUniqueIVs(base64IVs) {
  const uniqueIVs = new Set(base64IVs);
  expect(uniqueIVs.size).toBe(base64IVs.length);
}


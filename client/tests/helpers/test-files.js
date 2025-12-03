/**
 * Test File Generation Utilities
 * Creates test files of various sizes and types for testing
 */

/**
 * Creates a test file with specified size and type
 * @param {number} sizeBytes - Size in bytes
 * @param {string} filename - Filename
 * @param {string} mimetype - MIME type
 * @returns {File} File object
 */
export function createTestFile(sizeBytes, filename = 'test.txt', mimetype = 'text/plain') {
  // Generate random data
  const data = new Uint8Array(sizeBytes);
  crypto.getRandomValues(data);
  
  // Create Blob
  const blob = new Blob([data], { type: mimetype });
  
  // Create File from Blob
  return new File([blob], filename, { type: mimetype });
}

/**
 * Creates a small test file (50KB)
 * @returns {File} 50KB text file
 */
export function createSmallFile() {
  return createTestFile(50 * 1024, 'small-file.txt', 'text/plain');
}

/**
 * Creates a large test file (500KB)
 * @returns {File} 500KB image file
 */
export function createLargeFile() {
  return createTestFile(500 * 1024, 'large-image.jpg', 'image/jpeg');
}

/**
 * Creates a very large test file (150MB) for size limit testing
 * @returns {File} 150MB file
 */
export function createVeryLargeFile() {
  return createTestFile(150 * 1024 * 1024, 'very-large.bin', 'application/octet-stream');
}

/**
 * Creates a medium test file (50MB) for valid size testing
 * @returns {File} 50MB file
 */
export function createMediumFile() {
  return createTestFile(50 * 1024 * 1024, 'medium-file.bin', 'application/octet-stream');
}

/**
 * Reads file as ArrayBuffer
 * @param {File} file - File to read
 * @returns {Promise<ArrayBuffer>} File contents as ArrayBuffer
 */
export async function readFileAsArrayBuffer(file) {
  return await file.arrayBuffer();
}

/**
 * Compares two ArrayBuffers byte-by-byte
 * @param {ArrayBuffer} buffer1 - First buffer
 * @param {ArrayBuffer} buffer2 - Second buffer
 * @returns {boolean} True if buffers are identical
 */
export function compareArrayBuffers(buffer1, buffer2) {
  if (buffer1.byteLength !== buffer2.byteLength) {
    return false;
  }
  
  const view1 = new Uint8Array(buffer1);
  const view2 = new Uint8Array(buffer2);
  
  for (let i = 0; i < view1.length; i++) {
    if (view1[i] !== view2[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Compares a Blob with an ArrayBuffer
 * @param {Blob} blob - Blob to compare
 * @param {ArrayBuffer} buffer - ArrayBuffer to compare
 * @returns {Promise<boolean>} True if contents match
 */
export async function compareBlobToBuffer(blob, buffer) {
  const blobBuffer = await blob.arrayBuffer();
  return compareArrayBuffers(blobBuffer, buffer);
}


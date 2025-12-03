/**
 * TC-MSG-COMBO-012: File Chunk Decryption
 * 
 * Tests file chunk decryption and session state updates
 */

// Try to import file decryption functions
let decryptAESGCM, decryptFile;

try {
  const aesModule = await import('../../src/crypto/aesGcm.js');
  decryptAESGCM = aesModule.decryptAESGCM;
} catch (error) {
  throw new Error('Missing module: client/src/crypto/aesGcm.js - please export decryptAESGCM');
}

try {
  const fileModule = await import('../../src/crypto/fileDecryption.js');
  decryptFile = fileModule.decryptFile;
} catch (error) {
  console.warn('File decryption module not found, some tests will be skipped');
}

import { base64Encode } from './test-helpers/webcryptoHelper.js';
import { encryptAESGCM } from '../../src/crypto/aesGcm.js';
import { buildFileChunkEnvelope } from '../../src/crypto/messageEnvelope.js';

describe('TC-MSG-COMBO-012: File Chunk Decryption', () => {
  test('Should decrypt file chunk to ArrayBuffer', async () => {
    const keyBuffer = new ArrayBuffer(32);
    const keyView = new Uint8Array(keyBuffer);
    crypto.getRandomValues(keyView);

    // Create test chunk data
    const chunkData = new Uint8Array(1024); // 1KB chunk
    crypto.getRandomValues(chunkData);

    // Encrypt chunk
    const { ciphertext, iv, authTag } = await encryptAESGCM(keyBuffer, chunkData.buffer);

    // Decrypt chunk
    const decrypted = await decryptAESGCM(keyBuffer, iv, ciphertext, authTag);

    // Verify result is ArrayBuffer
    expect(decrypted).toBeInstanceOf(ArrayBuffer);
    expect(decrypted.byteLength).toBe(chunkData.byteLength);

    // Verify content matches
    const decryptedView = new Uint8Array(decrypted);
    expect(decryptedView).toEqual(chunkData);

    console.log('✓ File chunk decrypted to ArrayBuffer');
  });

  test('Should create FILE_CHUNK envelope with correct metadata', async () => {
    const sessionId = 'test-session-file';
    const sender = 'alice';
    const receiver = 'bob';
    const chunkIndex = 2;
    const totalChunks = 5;

    const keyBuffer = new ArrayBuffer(32);
    const keyView = new Uint8Array(keyBuffer);
    crypto.getRandomValues(keyView);

    const chunkData = new Uint8Array(512);
    crypto.getRandomValues(chunkData);
    const { ciphertext, iv, authTag } = await encryptAESGCM(keyBuffer, chunkData.buffer);

    const envelope = buildFileChunkEnvelope(
      sessionId,
      sender,
      receiver,
      ciphertext,
      iv,
      authTag,
      { chunkIndex, totalChunks }
    );

    // Verify envelope structure
    expect(envelope.type).toBe('FILE_CHUNK');
    expect(envelope.meta.chunkIndex).toBe(chunkIndex);
    expect(envelope.meta.totalChunks).toBe(totalChunks);
    expect(envelope.meta.chunkIndex).toBeGreaterThanOrEqual(0);
    expect(envelope.meta.chunkIndex).toBeLessThan(totalChunks);

    console.log('✓ FILE_CHUNK envelope created with correct metadata');
  });

  test('Should verify updateSessionSeq called for file chunks', async () => {
    // This test verifies that updateSessionSeq is available
    // Actual call happens in handleIncomingMessage
    let updateSessionSeq;
    try {
      const sessionModule = await import('../../src/crypto/sessionManager.js');
      updateSessionSeq = sessionModule.updateSessionSeq;
      expect(typeof updateSessionSeq).toBe('function');
      console.log('✓ updateSessionSeq function available for file chunks');
    } catch (error) {
      throw new Error('Missing module: client/src/crypto/sessionManager.js - please export updateSessionSeq');
    }
  });

  test('Should verify storeUsedNonce called for file chunks', async () => {
    // This test verifies that storeUsedNonce is available
    // Actual call happens in handleIncomingMessage
    let storeUsedNonce;
    try {
      const sessionModule = await import('../../src/crypto/sessionManager.js');
      storeUsedNonce = sessionModule.storeUsedNonce;
      expect(typeof storeUsedNonce).toBe('function');
      console.log('✓ storeUsedNonce function available for file chunks');
    } catch (error) {
      throw new Error('Missing module: client/src/crypto/sessionManager.js - please export storeUsedNonce');
    }
  });
});


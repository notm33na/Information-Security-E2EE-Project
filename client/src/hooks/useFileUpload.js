import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { encryptFile } from '../crypto/fileEncryption.js';
import { ensureStorageSession } from '../crypto/sessionManager.js';
import api from '../services/api';

/**
 * Generate a random hex string using Web Crypto API
 * @param {number} length - Number of bytes to generate
 * @returns {string} Hex string
 */
function generateRandomHex(length) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hook for uploading encrypted files to cloud storage
 */
export function useFileUpload() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  /**
   * Upload a file - encrypts locally and uploads to cloud
   * @param {File} file - File to upload
   * @param {string} sessionId - Optional session ID (for shared files)
   * @returns {Promise<{fileId: string, messageId: string}>}
   */
  const uploadFile = useCallback(async (file, sessionId = null) => {
    if (!user?.id) {
      throw new Error('User must be logged in to upload files');
    }

    if (!file) {
      throw new Error('No file provided');
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Generate unique file ID using Web Crypto API
      const fileId = generateRandomHex(16);

      // Encrypt file locally using a default session or self-storage session
      // For self-storage, we'll use a special session ID
      const storageSessionId = sessionId || `storage-${user.id}`;
      
      // Ensure storage session exists (creates it if it doesn't)
      try {
        await ensureStorageSession(storageSessionId, user.id);
      } catch (err) {
        // If session encryption key is not available, provide helpful error
        if (err.message.includes('cached key expired') || err.message.includes('Password required')) {
          throw new Error('Session encryption key expired. Please log out and log back in to refresh your encryption keys.');
        }
        throw err;
      }
      
      // Encrypt file with progress tracking
      const { fileMetaEnvelope, chunkEnvelopes } = await encryptFile(
        file,
        storageSessionId,
        user.id,
        user.id, // Self-storage
        user.id,
        (chunkIndex, totalChunks, encryptionProgress, speed, timeRemaining) => {
          // Encryption progress is 0-50% of total
          setProgress(encryptionProgress * 0.5);
        }
      );

      // SECURITY: Validate that file is encrypted before sharing/uploading
      const { validateFileEncryption } = await import('../crypto/messageEnvelope.js');
      const metaValidation = validateFileEncryption(fileMetaEnvelope);
      if (!metaValidation.valid) {
        throw new Error(metaValidation.error || 'File encryption validation failed');
      }

      // Validate all chunks are encrypted
      for (const chunkEnvelope of chunkEnvelopes) {
        const chunkValidation = validateFileEncryption(chunkEnvelope);
        if (!chunkValidation.valid) {
          throw new Error(chunkValidation.error || 'File chunk encryption validation failed');
        }
      }

      // Upload metadata with first chunk
      setProgress(50);
      
      // Upload chunks sequentially (metadata included with first chunk)
      const totalChunks = chunkEnvelopes.length;
      for (let i = 0; i < chunkEnvelopes.length; i++) {
        const chunk = chunkEnvelopes[i];
        
        // Upload progress: 50% (encryption) + 50% (upload)
        const uploadProgress = 50 + ((i + 1) / totalChunks) * 50;
        setProgress(uploadProgress);

        // Include metadata with first chunk
        const uploadData = {
          fileId,
          chunkIndex: i,
          totalChunks: totalChunks,
          encryptedData: chunk.ciphertext,
          iv: chunk.iv,
          authTag: chunk.authTag,
          sessionId: storageSessionId,
          timestamp: chunk.timestamp,
          seq: chunk.seq,
          nonce: chunk.nonce
        };

        // Add file metadata to first chunk
        if (i === 0) {
          uploadData.filename = file.name;
          uploadData.size = file.size;
          uploadData.mimetype = file.type || 'application/octet-stream';
        }

        await api.post('/files/upload', uploadData);

        // Small delay to avoid overwhelming the server
        if (i < chunkEnvelopes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      setProgress(100);

      // Wait a moment for the server to process the final chunk
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the final file metadata
      try {
        const finalResponse = await api.get(`/files/${fileId}`);
        return {
          fileId,
          messageId: finalResponse.data.data.messageId || `file-${fileId}`,
          filename: file.name,
          size: file.size
        };
      } catch (err) {
        // If metadata not found yet, return with fileId
        return {
          fileId,
          messageId: `file-${fileId}`,
          filename: file.name,
          size: file.size
        };
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to upload file';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setUploading(false);
      // Reset progress after a delay
      setTimeout(() => setProgress(0), 2000);
    }
  }, [user?.id]);

  /**
   * Download and decrypt a file
   * @param {string} fileId - File ID to download
   * @returns {Promise<{blob: Blob, filename: string, mimetype: string}>}
   */
  const downloadFile = useCallback(async (fileId) => {
    if (!user?.id) {
      throw new Error('User must be logged in to download files');
    }

    try {
      // Get file metadata
      const metadataResponse = await api.get(`/files/${fileId}`);
      
      if (!metadataResponse.data.success || !metadataResponse.data.data) {
        throw new Error('File metadata not found');
      }
      
      const metadata = metadataResponse.data.data;

      // Validate metadata has required fields
      if (!metadata.totalChunks || !metadata.filename) {
        throw new Error('Invalid file metadata: missing required fields');
      }

      // Download all chunks
      const chunks = [];
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkResponse = await api.get(`/files/${fileId}/chunk/${i}`);
        if (!chunkResponse.data.success || !chunkResponse.data.data) {
          throw new Error(`Failed to download chunk ${i}`);
        }
        chunks.push(chunkResponse.data.data);
      }

      // Get decryption key
      // Files are encrypted with sendKey (from encryptFile)
      // For self-storage (userId = peerId), sendKey and recvKey are the same
      // But let's try recvKey first, then sendKey as fallback if that fails
      const storageSessionId = metadata.sessionId || `storage-${user.id}`;
      const { getRecvKey, getSendKey, ensureStorageSession } = await import('../crypto/sessionManager.js');
      
      // Ensure storage session exists (it should, but ensure it does)
      try {
        await ensureStorageSession(storageSessionId, user.id);
      } catch (err) {
        console.warn('Storage session might not exist, but continuing:', err);
      }
      
      // Get receive key for decryption (for self-storage, sendKey = recvKey)
      // Try recvKey first, but if decryption fails, we'll try sendKey
      let decryptionKey = await getRecvKey(storageSessionId, user.id);
      
      console.log(`Using storage session: ${storageSessionId} for decryption`);

      // Decrypt chunks directly (server stores encrypted chunks, not full envelopes)
      const { decryptAESGCM } = await import('../crypto/aesGcm.js');
      const { base64ToArrayBuffer } = await import('../crypto/signatures.js');
      
      const decryptedChunks = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Validate chunk has required encryption fields
        if (!chunk.encryptedData || !chunk.iv || !chunk.authTag) {
          throw new Error(`Chunk ${i} is missing encryption fields (encryptedData, iv, or authTag)`);
        }
        
        // Convert base64 to ArrayBuffer
        const ciphertext = base64ToArrayBuffer(chunk.encryptedData);
        const iv = base64ToArrayBuffer(chunk.iv);
        const authTag = base64ToArrayBuffer(chunk.authTag);
        
        // Decrypt chunk
        try {
          const decrypted = await decryptAESGCM(decryptionKey, iv, ciphertext, authTag);
          decryptedChunks.push(decrypted);
        } catch (error) {
          // If decryption fails with recvKey and this is self-storage, try sendKey
          if (i === 0 && error.message.includes('integrity check failed')) {
            console.warn(`Decryption with recvKey failed for chunk ${i}, trying sendKey for self-storage...`);
            try {
              const sendKey = await getSendKey(storageSessionId, user.id);
              const decrypted = await decryptAESGCM(sendKey, iv, ciphertext, authTag);
              decryptedChunks.push(decrypted);
              decryptionKey = sendKey; // Use sendKey for remaining chunks
              console.log(`✓ Using sendKey for decryption (self-storage)`);
            } catch (sendKeyError) {
              console.error(`Failed to decrypt chunk ${i} with sendKey:`, sendKeyError);
              throw new Error(`Failed to decrypt chunk ${i}: ${error.message}`);
            }
          } else {
            console.error(`Failed to decrypt chunk ${i}:`, error);
            throw new Error(`Failed to decrypt chunk ${i}: ${error.message}`);
          }
        }
      }

      // Combine chunks into Blob
      const blob = new Blob(decryptedChunks, { type: metadata.mimetype });

      return {
        blob,
        filename: metadata.filename,
        mimetype: metadata.mimetype,
        size: metadata.size
      };
    } catch (err) {
      console.error('File download error:', err);
      
      // Provide specific error messages
      if (err.response?.status === 404) {
        throw new Error('File not found. The file may have been deleted or does not exist.');
      } else if (err.response?.status === 403) {
        throw new Error('Access denied. You do not have permission to download this file.');
      } else if (err.message?.includes('totalChunks')) {
        throw new Error('Invalid file metadata. The file may be corrupted.');
      }
      
      const errorMessage = err.response?.data?.error || err.message || 'Failed to download file';
      throw new Error(errorMessage);
    }
  }, [user?.id]);

  /**
   * Delete a file
   * @param {string} fileId - File ID to delete
   * @returns {Promise<void>}
   */
  const deleteFile = useCallback(async (fileId) => {
    if (!user?.id) {
      throw new Error('User must be logged in to delete files');
    }

    try {
      const response = await api.delete(`/files/${fileId}`);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to delete file');
      }
    } catch (err) {
      console.error('File delete error:', err);
      
      // Provide specific error messages
      if (err.response?.status === 404) {
        throw new Error('File not found. The file may have already been deleted.');
      } else if (err.response?.status === 403) {
        throw new Error('Access denied. You do not have permission to delete this file.');
      }
      
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete file';
      throw new Error(errorMessage);
    }
  }, [user?.id]);

  return {
    uploadFile,
    downloadFile,
    deleteFile,
    uploading,
    progress,
    error
  };
}


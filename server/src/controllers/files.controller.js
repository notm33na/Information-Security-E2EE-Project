import { MessageMeta } from '../models/MessageMeta.js';
import { logMessageMetadataAccess } from '../utils/messageLogging.js';
import { validateTimestamp, hashNonceBase64, isNonceHashUsed } from '../utils/replayProtection.js';
import { logReplayAttempt } from '../utils/replayProtection.js';
import { requireSenderAuthorization } from '../middlewares/authorization.middleware.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
await fs.mkdir(UPLOADS_DIR, { recursive: true });

/**
 * Upload encrypted file
 * POST /api/files/upload
 * 
 * Accepts encrypted file chunks and stores them
 */
export async function uploadFile(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { 
      fileId, 
      chunkIndex, 
      totalChunks, 
      encryptedData, 
      iv, 
      authTag, 
      filename, 
      size, 
      mimetype,
      sessionId,
      timestamp,
      seq,
      nonce
    } = req.body;

    // Validate required fields
    if (!fileId || chunkIndex === undefined || !totalChunks || !encryptedData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // SECURITY: Ensure file is encrypted before sharing
    // Only encrypted files can be shared - validate encryption fields are present
    if (!encryptedData || !iv || !authTag) {
      return res.status(400).json({
        success: false,
        error: 'Only encrypted files can be shared. Files must include encryptedData, iv, and authTag.'
      });
    }

    // Validate encryption fields are non-empty strings (base64 encoded)
    if (typeof encryptedData !== 'string' || encryptedData.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid encryption: encryptedData must be a non-empty base64 string'
      });
    }

    if (typeof iv !== 'string' || iv.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid encryption: iv must be a non-empty base64 string'
      });
    }

    if (typeof authTag !== 'string' || authTag.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid encryption: authTag must be a non-empty base64 string'
      });
    }

    // Validate timestamp
    if (timestamp && !validateTimestamp(timestamp)) {
      logReplayAttempt(sessionId || 'unknown', seq || 0, timestamp, 'Timestamp out of validity window');
      return res.status(400).json({
        success: false,
        error: 'Timestamp out of validity window'
      });
    }

    // Validate nonce if provided
    if (nonce && sessionId) {
      try {
        const nonceHash = hashNonceBase64(nonce);
        const nonceAlreadyUsed = await isNonceHashUsed(sessionId, nonceHash, MessageMeta);
        if (nonceAlreadyUsed) {
          logReplayAttempt(sessionId, seq || 0, timestamp || Date.now(), 'Duplicate nonce detected');
          return res.status(400).json({
            success: false,
            error: 'Duplicate nonce detected (replay attempt)'
          });
        }
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: 'Invalid nonce format'
        });
      }
    }

    // Create file directory
    const fileDir = path.join(UPLOADS_DIR, fileId);
    await fs.mkdir(fileDir, { recursive: true });

    // Store chunk (skip if chunkIndex is -1, which is metadata-only)
    if (chunkIndex >= 0) {
      const chunkPath = path.join(fileDir, `chunk-${chunkIndex}.enc`);
      const chunkData = {
        encryptedData,
        iv,
        authTag,
        chunkIndex,
        timestamp: timestamp || Date.now()
      };

      await fs.writeFile(chunkPath, JSON.stringify(chunkData), 'utf8');
    }

    // Store metadata on first chunk or if this is a metadata-only upload
    if (chunkIndex === 0 || chunkIndex === -1) {
      const metadataPath = path.join(fileDir, 'metadata.json');
      const metadata = {
        fileId,
        filename: filename || 'encrypted-file',
        size: size || 0,
        mimetype: mimetype || 'application/octet-stream',
        totalChunks,
        userId: req.user.id.toString(),
        uploadedAt: new Date().toISOString(),
        sessionId: sessionId || null
      };
      await fs.writeFile(metadataPath, JSON.stringify(metadata), 'utf8');
    }

    // Check if all chunks are uploaded (skip check if this was metadata-only)
    if (chunkIndex >= 0 && chunkIndex === totalChunks - 1) {
      // Verify all chunks exist
      const chunks = await fs.readdir(fileDir);
      const chunkFiles = chunks.filter(f => f.startsWith('chunk-') && f.endsWith('.enc'));
      
        if (chunkFiles.length === totalChunks) {
        // All chunks uploaded - create file record in database
        const metadataPath = path.join(fileDir, 'metadata.json');
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        const metadata = JSON.parse(metadataContent);

        // Check if messageMeta already exists for this fileId
        let messageMeta = await MessageMeta.findOne({ 'meta.fileId': fileId });
        
        if (!messageMeta) {
          // Store file metadata in MessageMeta for consistency with messaging system
          const messageId = `file-${fileId}-${Date.now()}`;
          messageMeta = new MessageMeta({
            messageId,
            sessionId: sessionId || `file-${fileId}`,
            sender: req.user.id,
            receiver: req.user.id, // Self-storage
            type: 'FILE_META',
            timestamp: timestamp || Date.now(),
            seq: seq || 0,
            nonceHash: nonce ? hashNonceBase64(nonce) : crypto.randomBytes(16).toString('hex'),
            meta: {
              filename: metadata.filename,
              size: metadata.size,
              totalChunks: metadata.totalChunks,
              mimetype: metadata.mimetype,
              fileId: fileId
            },
            delivered: true
          });

          await messageMeta.save();
        }
        
        // Get messageId from messageMeta (either newly created or existing)
        const messageId = messageMeta.messageId;
        
        // Update metadata file with messageId
        metadata.messageId = messageId;
        await fs.writeFile(metadataPath, JSON.stringify(metadata), 'utf8');

        // Log file upload
        logMessageMetadataAccess(req.user.id, sessionId || `file-${fileId}`, 'file_upload', {
          messageId,
          filename: metadata.filename,
          size: metadata.size
        });

        return res.json({
          success: true,
          message: 'File uploaded successfully',
          data: {
            fileId,
            messageId,
            filename: metadata.filename,
            size: metadata.size,
            totalChunks
          }
        });
      }
    }

    res.json({
      success: true,
      message: 'Chunk uploaded successfully',
      data: {
        fileId,
        chunkIndex,
        totalChunks,
        uploaded: chunkIndex + 1,
        remaining: totalChunks - chunkIndex - 1
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    next(error);
  }
}

/**
 * Get file metadata
 * GET /api/files/:fileId
 */
export async function getFileMetadata(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { fileId } = req.params;
    const fileDir = path.join(UPLOADS_DIR, fileId);
    const metadataPath = path.join(fileDir, 'metadata.json');

    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);

      // Verify user owns this file
      if (metadata.userId !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: metadata
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Download file chunk
 * GET /api/files/:fileId/chunk/:chunkIndex
 */
export async function downloadFileChunk(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { fileId, chunkIndex } = req.params;
    const fileDir = path.join(UPLOADS_DIR, fileId);
    const metadataPath = path.join(fileDir, 'metadata.json');

    // Verify file exists and user has access
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);

      if (metadata.userId !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Read chunk
      const chunkPath = path.join(fileDir, `chunk-${chunkIndex}.enc`);
      const chunkContent = await fs.readFile(chunkPath, 'utf8');
      const chunkData = JSON.parse(chunkContent);

      res.json({
        success: true,
        data: chunkData
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: 'File or chunk not found'
        });
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Delete file
 * DELETE /api/files/:fileId
 */
export async function deleteFile(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { fileId } = req.params;
    const fileDir = path.join(UPLOADS_DIR, fileId);
    const metadataPath = path.join(fileDir, 'metadata.json');

    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);

      // Verify user owns this file
      if (metadata.userId !== req.user.id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      // Delete file directory and all chunks
      await fs.rm(fileDir, { recursive: true, force: true });

      // Delete from MessageMeta
      await MessageMeta.deleteMany({ 'meta.fileId': fileId });

      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
}

/**
 * List user's files
 * GET /api/files
 */
export async function listFiles(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get files from MessageMeta where user is sender and type is FILE_META
    // Include both files with fileId (uploaded files) and without (message files)
    const files = await MessageMeta.find({
      sender: req.user.id,
      type: 'FILE_META'
    })
      .sort({ createdAt: -1 })
      .select('messageId sessionId meta timestamp createdAt')
      .lean();

    const fileList = files.map(file => ({
      id: file.messageId,
      fileId: file.meta?.fileId,
      name: file.meta?.filename || 'Unknown file',
      size: file.meta?.size || 0,
      type: file.meta?.mimetype || 'application/octet-stream',
      uploadedAt: file.createdAt || new Date(file.timestamp),
      sessionId: file.sessionId
    }));

    res.json({
      success: true,
      data: {
        files: fileList,
        total: fileList.length
      }
    });
  } catch (error) {
    next(error);
  }
}


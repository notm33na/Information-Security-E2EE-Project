import express from 'express';
import rateLimit from 'express-rate-limit';
import { 
  uploadFile, 
  getFileMetadata, 
  downloadFileChunk, 
  deleteFile, 
  listFiles 
} from '../controllers/files.controller.js';
import { verifyTokenMiddleware, requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Rate limiting for file operations
const fileLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // 50 requests per minute per IP
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many file operations. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// All file routes require authentication
router.use(verifyTokenMiddleware);
router.use(requireAuth);
router.use(fileLimiter);

// Upload file chunk
router.post('/upload', uploadFile);

// List user's files
router.get('/', listFiles);

// Get file metadata
router.get('/:fileId', getFileMetadata);

// Download file chunk
router.get('/:fileId/chunk/:chunkIndex', downloadFileChunk);

// Delete file
router.delete('/:fileId', deleteFile);

export default router;


import express from 'express';
import rateLimit from 'express-rate-limit';
import { uploadPublicKey, getPublicKey, getMyPublicKey } from '../controllers/keys.controller.js';
import { verifyTokenMiddleware, requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Rate limiting for public key endpoints - increased for session establishment retries
const keyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP (increased for retries during session establishment)
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many public key requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Upload public key (requires auth)
router.post(
  '/upload',
  verifyTokenMiddleware,
  requireAuth,
  uploadPublicKey
);

// Get current user's public key (requires auth)
router.get(
  '/me',
  verifyTokenMiddleware,
  requireAuth,
  getMyPublicKey
);

// Get public key by user ID (public endpoint with rate limiting)
router.get('/:userId', keyLimiter, getPublicKey);

export default router;


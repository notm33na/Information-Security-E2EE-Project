/**
 * Test Keys Routes
 * Keys routes with rate limiting disabled for testing
 */

import express from 'express';
import { uploadPublicKey, getPublicKey, getMyPublicKey } from '../../src/controllers/keys.controller.js';
import { verifyTokenMiddleware, requireAuth } from '../../src/middlewares/auth.middleware.js';

const router = express.Router();

// No rate limiting in test environment

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

// Get public key by user ID (requires auth in tests to match test expectations)
router.get('/:userId', verifyTokenMiddleware, requireAuth, getPublicKey);

export default router;


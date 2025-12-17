import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  getAttackStatus,
  toggleAttackMode,
  getCaptured,
  clearCaptured,
  simulateExact,
  simulateStaleTimestamp,
  simulateOutOfOrder,
  simulateDuplicateNonce,
  getAttackTypes
} from '../controllers/replayAttack.controller.js';
import { verifyTokenMiddleware, requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Rate limiting for replay attack endpoints
const attackLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many replay attack simulation requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Get attack mode status
router.get(
  '/status',
  attackLimiter,
  getAttackStatus
);

// Toggle attack mode (requires auth for security)
router.post(
  '/toggle',
  attackLimiter,
  verifyTokenMiddleware,
  requireAuth,
  toggleAttackMode
);

// Get captured messages for a session
router.get(
  '/captured/:sessionId',
  attackLimiter,
  verifyTokenMiddleware,
  requireAuth,
  getCaptured
);

// Clear captured messages
router.delete(
  '/captured/:sessionId?',
  attackLimiter,
  verifyTokenMiddleware,
  requireAuth,
  clearCaptured
);

// Get available attack types
router.get(
  '/types',
  attackLimiter,
  getAttackTypes
);

// Simulate exact replay attack
router.post(
  '/simulate/exact',
  attackLimiter,
  verifyTokenMiddleware,
  requireAuth,
  simulateExact
);

// Simulate stale timestamp replay attack
router.post(
  '/simulate/stale-timestamp',
  attackLimiter,
  verifyTokenMiddleware,
  requireAuth,
  simulateStaleTimestamp
);

// Simulate out-of-order sequence replay attack
router.post(
  '/simulate/out-of-order-seq',
  attackLimiter,
  verifyTokenMiddleware,
  requireAuth,
  simulateOutOfOrder
);

// Simulate duplicate nonce replay attack
router.post(
  '/simulate/duplicate-nonce',
  attackLimiter,
  verifyTokenMiddleware,
  requireAuth,
  simulateDuplicateNonce
);

export default router;

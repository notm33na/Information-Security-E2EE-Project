import express from 'express';
import { getOrCreateSession, getUserSessions, getSessionById } from '../controllers/sessions.controller.js';
import { verifyTokenMiddleware, requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Get or create session between two users
router.post(
  '/',
  verifyTokenMiddleware,
  requireAuth,
  getOrCreateSession
);

// Get all sessions for current user
router.get(
  '/',
  verifyTokenMiddleware,
  requireAuth,
  getUserSessions
);

// Get specific session by ID
router.get(
  '/:sessionId',
  verifyTokenMiddleware,
  requireAuth,
  getSessionById
);

export default router;


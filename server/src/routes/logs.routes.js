import express from 'express';
import { getSecurityLogs } from '../controllers/logs.controller.js';
import { verifyTokenMiddleware, requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Get security logs (requires authentication)
router.get(
  '/',
  verifyTokenMiddleware,
  requireAuth,
  getSecurityLogs
);

export default router;


/**
 * MITM Attack Routes
 * API endpoints for MITM attack simulation
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { verifyTokenMiddleware } from '../middlewares/auth.middleware.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import {
  getMITMStatus,
  toggleMITMMode,
  getIntercepted,
  clearIntercepted,
  simulateUnsigned,
  simulateSigned,
  simulateKeyConfirmation,
  getMITMAttackTypes
} from '../controllers/mitmAttack.controller.js';

const router = express.Router();

// Rate limiting for MITM attack endpoints
const attackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many MITM attack requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// All routes require authentication
router.use(verifyTokenMiddleware);
router.use(requireAuth);

// Get MITM attack mode status
router.get('/status', attackLimiter, getMITMStatus);

// Toggle MITM attack mode
router.post('/toggle', attackLimiter, toggleMITMMode);

// Get intercepted KEP messages
router.get('/intercepted/:sessionId?', attackLimiter, getIntercepted);

// Clear intercepted KEP messages
router.delete('/intercepted', attackLimiter, clearIntercepted);

// Get available attack types
router.get('/types', attackLimiter, getMITMAttackTypes);

// Simulate MITM attacks
router.post('/simulate/unsigned', attackLimiter, simulateUnsigned);
router.post('/simulate/signed', attackLimiter, simulateSigned);
router.post('/simulate/key-confirmation', attackLimiter, simulateKeyConfirmation);

export default router;

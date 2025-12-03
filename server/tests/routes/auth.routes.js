/**
 * Test Auth Routes
 * Auth routes with rate limiting disabled for testing
 */

import express from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  logout,
  refresh,
  getMe,
  deactivate,
  reactivate
} from '../../src/controllers/auth.controller.js';
import { verifyTokenMiddleware, requireAuth } from '../../src/middlewares/auth.middleware.js';

const router = express.Router();

// No rate limiting in test environment
// Rate limiting is disabled for tests to allow multiple requests

// Password validation rules
const passwordRules = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character')
];

// Email validation
const emailValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase()
];

// Register route (no rate limiting)
router.post(
  '/register',
  emailValidation,
  passwordRules,
  register
);

// Login route (no rate limiting)
router.post(
  '/login',
  emailValidation,
  body('password').notEmpty().withMessage('Password is required'),
  login
);

// Logout route (requires auth)
router.post(
  '/logout',
  verifyTokenMiddleware,
  requireAuth,
  logout
);

// Refresh token route
router.post('/refresh', refresh);

// Get current user route (requires auth)
router.get(
  '/me',
  verifyTokenMiddleware,
  requireAuth,
  getMe
);

// Deactivate account route (requires auth)
router.post(
  '/deactivate',
  verifyTokenMiddleware,
  requireAuth,
  deactivate
);

// Reactivate account route (placeholder)
router.post('/reactivate', reactivate);

export default router;


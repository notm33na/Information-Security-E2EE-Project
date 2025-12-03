/**
 * Test App Setup
 * Creates Express app instance for testing
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import { setupSecurityMiddleware } from '../src/middleware/security.js';
import { authErrorHandler } from '../src/middlewares/auth.middleware.js';
import authRouter from './routes/auth.routes.js'; // Use test routes without rate limiting
import keysRouter from './routes/keys.routes.js'; // Use test routes without rate limiting

const app = express();

// Trust proxy (disabled in test to avoid rate limiter warnings)
if (process.env.NODE_ENV !== 'test') {
  app.set('trust proxy', true);
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security middleware
setupSecurityMiddleware(app);

// Routes (test routes have rate limiting disabled)
app.use('/api/auth', authRouter);
app.use('/api/keys', keysRouter);

// Error handling middleware
app.use(authErrorHandler);

// Global error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  let userMessage = 'An unexpected error occurred. Please try again.';
  let statusCode = error.status || 500;
  
  if (error.name === 'PasswordValidationError') {
    userMessage = error.errors?.join(', ') || 'Password does not meet requirements';
    statusCode = 400;
  } else if (error.name === 'DuplicateUserError') {
    userMessage = 'An account with this email already exists. Please use a different email or try logging in.';
    statusCode = 409;
  } else if (error.name === 'ValidationError') {
    userMessage = error.message || 'Invalid input data';
    statusCode = 400;
  } else if (error.message) {
    userMessage = error.message;
  }
  
  res.status(statusCode).json({
    success: false,
    error: error.name || 'Error',
    message: userMessage
  });
});

export default app;


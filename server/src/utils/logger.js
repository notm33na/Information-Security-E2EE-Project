/**
 * Centralized Logging with Winston
 * 
 * Provides structured logging with daily rotation and log categories.
 * Integrates with existing HMAC-protected logging for security events.
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists
const logsDir = process.env.TEST_LOGS_DIR || path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured JSON logs
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Custom format for console output (development)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    // Handle both string messages and object messages
    let msg = message;
    if (typeof message === 'object') {
      msg = JSON.stringify(message, null, 2);
    }
    const output = `${timestamp} [${level}]: ${msg}`;
    // Add metadata if present (excluding category which is in defaultMeta)
    const meta = { ...metadata };
    delete meta.category;
    if (Object.keys(meta).length > 0) {
      return `${output}\n${JSON.stringify(meta, null, 2)}`;
    }
    return output;
  })
);

// Daily rotate file transport configuration
const createDailyRotateTransport = (filename, level = 'info') => {
  return new DailyRotateFile({
    filename: path.join(logsDir, `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    maxSize: '100m',
    maxFiles: '30d', // Keep logs for 30 days
    level,
    format: jsonFormat,
    zippedArchive: true, // Compress rotated logs
    auditFile: path.join(logsDir, `.${filename}-audit.json`)
  });
};

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  defaultMeta: { service: 'infosec-server' },
  transports: [
    // Console output (development)
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: consoleFormat,
        level: 'debug'
      })
    ] : []),
    
    // General application logs
    createDailyRotateTransport('app', 'info'),
    
    // Error logs
    createDailyRotateTransport('error', 'error')
  ],
  exceptionHandlers: [
    createDailyRotateTransport('exceptions', 'error')
  ],
  rejectionHandlers: [
    createDailyRotateTransport('rejections', 'error')
  ]
});

// Category-specific loggers
export const securityLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: { category: 'security' },
  transports: [
    createDailyRotateTransport('security', 'info'),
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: consoleFormat
      })
    ] : [])
  ]
});

export const authLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: { category: 'auth' },
  transports: [
    createDailyRotateTransport('auth', 'info'),
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: consoleFormat
      })
    ] : [])
  ]
});

export const replayLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: { category: 'replay' },
  transports: [
    createDailyRotateTransport('replay_attempts', 'info'),
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: consoleFormat
      })
    ] : [])
  ]
});

export const signatureLogger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: { category: 'signature' },
  transports: [
    createDailyRotateTransport('invalid_signature', 'info'),
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: consoleFormat
      })
    ] : [])
  ]
});

export const alertsLogger = winston.createLogger({
  level: 'warn',
  format: jsonFormat,
  defaultMeta: { category: 'alerts' },
  transports: [
    createDailyRotateTransport('alerts', 'warn'),
    ...(process.env.NODE_ENV !== 'production' ? [
      new winston.transports.Console({
        format: consoleFormat
      })
    ] : [])
  ]
});

// Export default logger
export default logger;


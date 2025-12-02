/**
 * Alert Threshold Detector
 * 
 * Monitors security events and triggers alerts when thresholds are exceeded.
 * 
 * Alert Rules:
 * 1. 5 failed auth attempts in 5 minutes → alert
 * 2. 3 replay attempts from same IP in 10 minutes → alert
 * 3. 2 signature validation failures in 10 minutes → alert
 */

import { alertsLogger } from './logger.js';
import { writeProtectedLog } from './logIntegrity.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory tracking (in production, use Redis or similar for distributed systems)
const authFailureTracker = new Map(); // userId -> [{timestamp, ip}]
const replayAttemptTracker = new Map(); // ip -> [{timestamp, sessionId}]
const signatureFailureTracker = new Map(); // userId -> [{timestamp, sessionId}]

// Cleanup old entries periodically (every 15 minutes)
setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  const tenMinutesAgo = now - 10 * 60 * 1000;

  // Clean auth failures older than 5 minutes
  for (const [userId, attempts] of authFailureTracker.entries()) {
    const recent = attempts.filter(a => a.timestamp > fiveMinutesAgo);
    if (recent.length === 0) {
      authFailureTracker.delete(userId);
    } else {
      authFailureTracker.set(userId, recent);
    }
  }

  // Clean replay attempts older than 10 minutes
  for (const [ip, attempts] of replayAttemptTracker.entries()) {
    const recent = attempts.filter(a => a.timestamp > tenMinutesAgo);
    if (recent.length === 0) {
      replayAttemptTracker.delete(ip);
    } else {
      replayAttemptTracker.set(ip, recent);
    }
  }

  // Clean signature failures older than 10 minutes
  for (const [userId, failures] of signatureFailureTracker.entries()) {
    const recent = failures.filter(f => f.timestamp > tenMinutesAgo);
    if (recent.length === 0) {
      signatureFailureTracker.delete(userId);
    } else {
      signatureFailureTracker.set(userId, recent);
    }
  }
}, 15 * 60 * 1000); // Run every 15 minutes

/**
 * Records a failed authentication attempt and checks threshold
 * @param {string} userId - User ID (null if user not found)
 * @param {string} ip - Client IP address
 * @param {string} reason - Failure reason
 */
export function recordAuthFailure(userId, ip, reason) {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  // Track by userId (or 'unknown' if userId is null)
  const key = userId || `unknown:${ip}`;
  const attempts = authFailureTracker.get(key) || [];
  
  // Add new attempt
  attempts.push({ timestamp: now, ip, reason });
  
  // Filter to last 5 minutes
  const recentAttempts = attempts.filter(a => a.timestamp > fiveMinutesAgo);
  authFailureTracker.set(key, recentAttempts);

  // Check threshold: 5 failed attempts in 5 minutes
  if (recentAttempts.length >= 5) {
    const alert = {
      eventType: 'AUTH_FAILURE_THRESHOLD',
      userId: userId || null,
      ip,
      attemptCount: recentAttempts.length,
      timeWindow: '5 minutes',
      threshold: 5,
      reason: `Multiple failed authentication attempts detected`,
      recentAttempts: recentAttempts.map(a => ({
        timestamp: new Date(a.timestamp).toISOString(),
        reason: a.reason
      })),
      timestamp: new Date().toISOString()
    };

    // Log alert
    writeProtectedLog('alerts.log', alert);
    alertsLogger.warn(alert);

    // Clear tracked attempts after alert (to avoid spam)
    authFailureTracker.delete(key);
  }
}

/**
 * Records a replay attempt and checks threshold
 * @param {string} sessionId - Session identifier
 * @param {string} ip - Client IP address
 * @param {string} reason - Replay rejection reason
 */
export function recordReplayAttempt(sessionId, ip, reason) {
  const now = Date.now();
  const tenMinutesAgo = now - 10 * 60 * 1000;

  // Track by IP
  const attempts = replayAttemptTracker.get(ip) || [];
  
  // Add new attempt
  attempts.push({ timestamp: now, sessionId, reason });
  
  // Filter to last 10 minutes
  const recentAttempts = attempts.filter(a => a.timestamp > tenMinutesAgo);
  replayAttemptTracker.set(ip, recentAttempts);

  // Check threshold: 3 replay attempts from same IP in 10 minutes
  if (recentAttempts.length >= 3) {
    const alert = {
      eventType: 'REPLAY_ATTEMPT_THRESHOLD',
      ip,
      attemptCount: recentAttempts.length,
      timeWindow: '10 minutes',
      threshold: 3,
      reason: `Multiple replay attempts detected from IP`,
      recentAttempts: recentAttempts.map(a => ({
        timestamp: new Date(a.timestamp).toISOString(),
        sessionId: a.sessionId,
        reason: a.reason
      })),
      timestamp: new Date().toISOString()
    };

    // Log alert
    writeProtectedLog('alerts.log', alert);
    alertsLogger.warn(alert);

    // Clear tracked attempts after alert (to avoid spam)
    replayAttemptTracker.delete(ip);
  }
}

/**
 * Records a signature validation failure and checks threshold
 * @param {string} userId - User ID
 * @param {string} sessionId - Session identifier
 * @param {string} messageType - Message type (KEP_INIT, KEP_RESPONSE, KEY_UPDATE)
 * @param {string} reason - Failure reason
 */
export function recordSignatureFailure(userId, sessionId, messageType, reason) {
  const now = Date.now();
  const tenMinutesAgo = now - 10 * 60 * 1000;

  // Track by userId
  const failures = signatureFailureTracker.get(userId) || [];
  
  // Add new failure
  failures.push({ timestamp: now, sessionId, messageType, reason });
  
  // Filter to last 10 minutes
  const recentFailures = failures.filter(f => f.timestamp > tenMinutesAgo);
  signatureFailureTracker.set(userId, recentFailures);

  // Check threshold: 2 signature failures in 10 minutes
  if (recentFailures.length >= 2) {
    const alert = {
      eventType: 'SIGNATURE_FAILURE_THRESHOLD',
      userId,
      failureCount: recentFailures.length,
      timeWindow: '10 minutes',
      threshold: 2,
      reason: `Multiple signature validation failures detected`,
      recentFailures: recentFailures.map(f => ({
        timestamp: new Date(f.timestamp).toISOString(),
        sessionId: f.sessionId,
        messageType: f.messageType,
        reason: f.reason
      })),
      timestamp: new Date().toISOString()
    };

    // Log alert
    writeProtectedLog('alerts.log', alert);
    alertsLogger.warn(alert);

    // Clear tracked failures after alert (to avoid spam)
    signatureFailureTracker.delete(userId);
  }
}

/**
 * Gets current alert statistics (for monitoring/API)
 * @returns {Object} Current tracking statistics
 */
export function getAlertStatistics() {
  return {
    authFailures: {
      trackedUsers: authFailureTracker.size,
      totalAttempts: Array.from(authFailureTracker.values()).reduce((sum, attempts) => sum + attempts.length, 0)
    },
    replayAttempts: {
      trackedIPs: replayAttemptTracker.size,
      totalAttempts: Array.from(replayAttemptTracker.values()).reduce((sum, attempts) => sum + attempts.length, 0)
    },
    signatureFailures: {
      trackedUsers: signatureFailureTracker.size,
      totalFailures: Array.from(signatureFailureTracker.values()).reduce((sum, failures) => sum + failures.length, 0)
    }
  };
}


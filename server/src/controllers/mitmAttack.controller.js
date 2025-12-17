/**
 * MITM Attack Controller
 * Handles API requests for MITM attack simulation
 */

import {
  isMITMModeEnabled,
  setMITMMode,
  getMITMStats,
  getInterceptedKEP,
  clearInterceptedKEP,
  simulateUnsignedMITM,
  simulateSignedMITM,
  simulateKeyConfirmationMismatch,
  MITM_ATTACK_TYPES
} from '../services/mitmAttackSimulator.js';

/**
 * Get MITM attack mode status
 */
export async function getMITMStatus(req, res, next) {
  try {
    const stats = getMITMStats();
    res.json({
      success: true,
      data: {
        enabled: stats.enabled,
        activeAttacks: stats.activeAttacks,
        interceptedSessions: stats.interceptedSessions,
        totalAttacks: stats.totalAttacks
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Toggle MITM attack mode
 */
export async function toggleMITMMode(req, res, next) {
  try {
    const { enabled } = req.body;
    const newState = setMITMMode(enabled);
    
    res.json({
      success: true,
      data: {
        enabled: newState,
        message: `MITM attack mode ${newState ? 'enabled' : 'disabled'}`
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get intercepted KEP messages
 */
export async function getIntercepted(req, res, next) {
  try {
    const { sessionId } = req.params;
    const isAll = !sessionId || sessionId === 'all';
    const intercepted = getInterceptedKEP(isAll ? null : sessionId);

    if (isAll) {
      // Return all intercepted sessions
      // getInterceptedKEP(null) returns an object with sessionId as keys
      const interceptedObj = intercepted || {};
      res.json({
        success: true,
        data: {
          intercepted: interceptedObj,
          count: Object.keys(interceptedObj).length
        }
      });
    } else {
      // Return specific session
      // getInterceptedKEP(sessionId) returns { sessionId, intercepted } or null
      if (!intercepted) {
        return res.status(404).json({
          success: false,
          error: 'No intercepted KEP messages found for this session'
        });
      }

      res.json({
        success: true,
        data: {
          sessionId: intercepted.sessionId,
          intercepted: intercepted.intercepted
        }
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Clear intercepted KEP messages
 */
export async function clearIntercepted(req, res, next) {
  try {
    const { sessionId } = req.query;
    clearInterceptedKEP(sessionId || null);
    
    res.json({
      success: true,
      data: {
        message: sessionId ? `Cleared intercepted KEP for session ${sessionId}` : 'Cleared all intercepted KEP messages'
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Simulate unsigned MITM attack
 */
export async function simulateUnsigned(req, res, next) {
  try {
    const { sessionId } = req.body;
    const userId = req.user?.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required'
      });
    }

    const result = await simulateUnsignedMITM(sessionId, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Simulate signed MITM attack
 */
export async function simulateSigned(req, res, next) {
  try {
    const { sessionId } = req.body;
    const userId = req.user?.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required'
      });
    }

    const result = await simulateSignedMITM(sessionId, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Simulate key confirmation mismatch
 */
export async function simulateKeyConfirmation(req, res, next) {
  try {
    const { sessionId } = req.body;
    const userId = req.user?.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId is required'
      });
    }

    const result = await simulateKeyConfirmationMismatch(sessionId, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get available MITM attack types
 */
export async function getMITMAttackTypes(req, res, next) {
  try {
    res.json({
      success: true,
      data: {
        attackTypes: Object.values(MITM_ATTACK_TYPES),
        descriptions: {
          [MITM_ATTACK_TYPES.UNSIGNED_INTERCEPT]: 'Intercept unsigned key exchange (demonstrates vulnerability)',
          [MITM_ATTACK_TYPES.SIGNED_INTERCEPT]: 'Intercept signed key exchange (demonstrates protection)',
          [MITM_ATTACK_TYPES.KEY_CONFIRMATION_MISMATCH]: 'Key confirmation mismatch (demonstrates additional protection)'
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

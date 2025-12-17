/**
 * Backend MITM (Man-in-the-Middle) Attack Simulator
 * 
 * EDUCATIONAL PURPOSE ONLY - Simulates MITM attacks on key exchange
 * to demonstrate how digital signatures and key confirmation prevent MITM.
 * 
 * SECURITY CONSIDERATIONS:
 * - Only runs when MITM_ATTACK_MODE environment variable is enabled
 * - Never breaks E2EE - only simulates attacks on key exchange metadata
 * - All attack attempts are logged for analysis
 * - Does not decrypt actual message content
 * 
 * DATA PRIVACY CONSTRAINTS:
 * - No plaintext content is logged
 * - Only key exchange metadata (ephPub, signatures) is used
 * - Attack logs contain only attack flow information
 */

import { KEPMessage } from '../models/KEPMessage.js';
import { logInvalidSignature, logEvent } from '../utils/attackLogging.js';
import { SecurityLog } from '../models/SecurityLog.js';
import crypto from 'crypto';

/**
 * Attack mode configuration
 * Set MITM_ATTACK_MODE=true in environment to enable
 */
const ATTACK_MODE_ENABLED = process.env.MITM_ATTACK_MODE === 'true' || process.env.MITM_ATTACK_MODE === '1';

/**
 * MITM attack simulation state
 */
const attackState = {
  enabled: ATTACK_MODE_ENABLED,
  activeAttacks: new Map(), // sessionId -> attack info
  interceptedKEP: new Map(), // sessionId -> { kepInit, kepResponse }
  attackerKeyPairs: new Map(), // sessionId -> { privateKey, publicKey }
  attackCounter: 0
};

/**
 * Attack types
 */
export const MITM_ATTACK_TYPES = {
  UNSIGNED_INTERCEPT: 'UNSIGNED_INTERCEPT',           // Intercept unsigned KEP (should succeed)
  SIGNED_INTERCEPT: 'SIGNED_INTERCEPT',              // Intercept signed KEP (should fail)
  KEY_CONFIRMATION_MISMATCH: 'KEY_CONFIRMATION_MISMATCH' // Key confirmation mismatch
};

/**
 * Step-by-step MITM attack flow logger
 */
class MITMAttackFlowLogger {
  constructor(sessionId, attackId, attackType) {
    this.sessionId = sessionId;
    this.attackId = attackId;
    this.attackType = attackType;
    this.steps = [];
    this.startTime = Date.now();
  }

  logStep(step, description, data = {}) {
    const stepEntry = {
      step,
      description,
      timestamp: new Date().toISOString(),
      elapsed: Date.now() - this.startTime,
      ...data
    };
    this.steps.push(stepEntry);
    
    console.log(`[MITM_ATTACK] [${this.attackId}] Step ${step}: ${description}`, data);
    return stepEntry;
  }

  async finalize(result) {
    const flow = {
      attackId: this.attackId,
      sessionId: this.sessionId,
      attackType: this.attackType,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      steps: this.steps,
      result: {
        success: result.success || false,
        blocked: result.blocked || false,
        reason: result.reason || null,
        protection: result.protection || null
      }
    };

    // Store in MongoDB Atlas
    try {
      await SecurityLog.create({
        eventType: 'INVALID_SIGNATURE',
        sessionId: this.sessionId,
        success: false,
        reason: `Simulated ${this.attackType} MITM attack`,
        metadata: {
          attackId: this.attackId,
          attackType: this.attackType,
          flow: flow,
          isSimulation: true
        }
      });
    } catch (error) {
      console.error('Failed to store MITM attack flow in MongoDB:', error.message);
    }

    // Log to local file
    await logEvent(
      'INVALID_SIGNATURE',
      this.sessionId,
      null,
      `MITM attack flow completed: ${this.attackType}`,
      flow
    );

    return flow;
  }
}

/**
 * Generates an attacker's ephemeral key pair (simplified - just for demonstration)
 * In real attack, this would be a proper ECDH key pair
 */
function generateAttackerKeyPair() {
  // For simulation, we generate a random key pair identifier
  // In production, this would be a real ECDH key pair
  const privateKey = crypto.randomBytes(32).toString('base64');
  const publicKey = crypto.randomBytes(65).toString('base64'); // Simulated P-256 public key format
  
  return {
    privateKey,
    publicKey,
    // JWK format for compatibility
    publicKeyJWK: {
      kty: 'EC',
      crv: 'P-256',
      x: crypto.randomBytes(32).toString('base64url'),
      y: crypto.randomBytes(32).toString('base64url')
    }
  };
}

/**
 * Checks if MITM attack mode is enabled
 */
export function isMITMModeEnabled() {
  return attackState.enabled;
}

/**
 * Enables or disables MITM attack mode
 */
export function setMITMMode(enabled) {
  attackState.enabled = enabled === true || enabled === 'true' || enabled === '1';
  console.log(`[MITM_ATTACK] MITM attack mode ${attackState.enabled ? 'ENABLED' : 'DISABLED'}`);
  return attackState.enabled;
}

/**
 * Intercepts a KEP_INIT message for MITM simulation
 */
export async function interceptKEPInit(sessionId, kepInitData, userId) {
  if (!attackState.enabled) {
    return null; // No interception if mode is disabled
  }

  try {
    console.log(`[MITM_ATTACK] Intercepting KEP_INIT for session ${sessionId}`);
    // Store original KEP_INIT
    const intercepted = attackState.interceptedKEP.get(sessionId) || {};
    intercepted.kepInit = {
      original: kepInitData,
      interceptedAt: Date.now(),
      interceptedBy: userId
    };
    attackState.interceptedKEP.set(sessionId, intercepted);
    console.log(`[MITM_ATTACK] KEP_INIT intercepted and stored. Total intercepted sessions: ${attackState.interceptedKEP.size}`);

    // Generate attacker's key pair
    const attackerKeys = generateAttackerKeyPair();
    attackState.attackerKeyPairs.set(sessionId, attackerKeys);

    // Log interception
    await logEvent(
      'INVALID_SIGNATURE',
      sessionId,
      userId,
      `MITM: Intercepted KEP_INIT message`,
      {
        sessionId,
        originalFrom: kepInitData.from,
        originalTo: kepInitData.to,
        hasSignature: !!kepInitData.signature,
        attackerKeyGenerated: true
      }
    );

    return {
      intercepted: true,
      attackerKeys,
      originalKEP: kepInitData
    };
  } catch (error) {
    console.error('[MITM_ATTACK] Error intercepting KEP_INIT:', error);
    return null;
  }
}

/**
 * Intercepts a KEP_RESPONSE message for MITM simulation
 */
export async function interceptKEPResponse(sessionId, kepResponseData, userId) {
  if (!attackState.enabled) {
    return null; // No interception if mode is disabled
  }

  try {
    console.log(`[MITM_ATTACK] Intercepting KEP_RESPONSE for session ${sessionId}`);
    // Store original KEP_RESPONSE
    const intercepted = attackState.interceptedKEP.get(sessionId) || {};
    intercepted.kepResponse = {
      original: kepResponseData,
      interceptedAt: Date.now(),
      interceptedBy: userId
    };
    attackState.interceptedKEP.set(sessionId, intercepted);
    console.log(`[MITM_ATTACK] KEP_RESPONSE intercepted and stored. Total intercepted sessions: ${attackState.interceptedKEP.size}`);

    // Get attacker's key pair (should already exist from KEP_INIT)
    const attackerKeys = attackState.attackerKeyPairs.get(sessionId) || generateAttackerKeyPair();
    if (!attackState.attackerKeyPairs.has(sessionId)) {
      attackState.attackerKeyPairs.set(sessionId, attackerKeys);
    }

    // Log interception
    await logEvent(
      'INVALID_SIGNATURE',
      sessionId,
      userId,
      `MITM: Intercepted KEP_RESPONSE message`,
      {
        sessionId,
        originalFrom: kepResponseData.from,
        originalTo: kepResponseData.to,
        hasSignature: !!kepResponseData.signature,
        hasKeyConfirmation: !!kepResponseData.keyConfirmation
      }
    );

    return {
      intercepted: true,
      attackerKeys,
      originalKEP: kepResponseData
    };
  } catch (error) {
    console.error('[MITM_ATTACK] Error intercepting KEP_RESPONSE:', error);
    return null;
  }
}

/**
 * Simulates MITM attack on unsigned key exchange
 * This demonstrates how MITM succeeds when signatures are NOT used
 */
export async function simulateUnsignedMITM(sessionId, userId) {
  if (!attackState.enabled) {
    throw new Error('MITM attack mode is disabled');
  }

  const intercepted = attackState.interceptedKEP.get(sessionId);
  if (!intercepted || !intercepted.kepInit || !intercepted.kepResponse) {
    throw new Error('No intercepted KEP messages found for this session');
  }

  const attackId = `MITM-${++attackState.attackCounter}-${Date.now()}`;
  const logger = new MITMAttackFlowLogger(sessionId, attackId, MITM_ATTACK_TYPES.UNSIGNED_INTERCEPT);

  try {
    logger.logStep(1, 'MITM attack initiated: Unsigned key exchange', {
      sessionId,
      attackType: 'UNSIGNED_INTERCEPT'
    });

    const kepInit = intercepted.kepInit.original;
    const kepResponse = intercepted.kepResponse.original;
    const attackerKeys = attackState.attackerKeyPairs.get(sessionId);

    logger.logStep(2, 'Retrieved intercepted KEP messages', {
      hasKEPInit: !!kepInit,
      hasKEPResponse: !!kepResponse,
      hasAttackerKeys: !!attackerKeys
    });

    // Check if signatures are present
    const hasSignatures = !!(kepInit.signature && kepResponse.signature);
    
    if (hasSignatures) {
      logger.logStep(3, 'WARNING: Signatures detected - attack should fail', {
        hasKEPInitSignature: !!kepInit.signature,
        hasKEPResponseSignature: !!kepResponse.signature
      });
    } else {
      logger.logStep(3, 'No signatures detected - attack can succeed', {
        unsignedKEPInit: true,
        unsignedKEPResponse: true
      });
    }

    // Simulate key replacement
    logger.logStep(4, 'Attacker replaces ephemeral public keys', {
      originalKEPInitKey: kepInit.ephPub ? 'present' : 'missing',
      attackerKey: attackerKeys.publicKeyJWK ? 'generated' : 'missing'
    });

    // Simulate MITM success (if unsigned)
    const attackSuccessful = !hasSignatures;
    
    if (attackSuccessful) {
      logger.logStep(5, 'MITM attack SUCCESSFUL - unsigned keys replaced', {
        reason: 'No signature verification to prevent key substitution'
      });

      logger.logStep(6, 'Attacker can now decrypt all messages', {
        sharedSecretWithAlice: 'established',
        sharedSecretWithBob: 'established'
      });

      // Log successful attack
      await logInvalidSignature(
        sessionId,
        userId,
        'KEP_INIT',
        'MITM SUCCESS: Unsigned key exchange intercepted - attacker can decrypt messages'
      );
    } else {
      logger.logStep(5, 'MITM attack BLOCKED - signatures prevent key substitution', {
        reason: 'Signature verification would detect key replacement'
      });

      // Log blocked attack
      await logInvalidSignature(
        sessionId,
        userId,
        'KEP_INIT',
        'MITM BLOCKED: Signature verification prevents key substitution'
      );
    }

    const result = {
      success: attackSuccessful,
      blocked: !attackSuccessful,
      reason: attackSuccessful 
        ? 'Unsigned key exchange vulnerable to MITM'
        : 'Signature verification prevents MITM',
      protection: hasSignatures ? 'SIGNATURE_VERIFICATION' : null
    };

    const flow = await logger.finalize(result);

    return {
      attackId,
      sessionId,
      attackType: MITM_ATTACK_TYPES.UNSIGNED_INTERCEPT,
      success: attackSuccessful,
      blocked: !attackSuccessful,
      reason: result.reason,
      protection: result.protection,
      flow
    };
  } catch (error) {
    console.error('[MITM_ATTACK] Error in unsigned MITM simulation:', error);
    await logger.finalize({
      success: false,
      blocked: true,
      reason: error.message,
      protection: 'ERROR'
    });
    throw error;
  }
}

/**
 * Simulates MITM attack on signed key exchange
 * This demonstrates how MITM fails when signatures are used
 */
export async function simulateSignedMITM(sessionId, userId) {
  if (!attackState.enabled) {
    throw new Error('MITM attack mode is disabled');
  }

  const intercepted = attackState.interceptedKEP.get(sessionId);
  if (!intercepted || !intercepted.kepInit || !intercepted.kepResponse) {
    throw new Error('No intercepted KEP messages found for this session');
  }

  const attackId = `MITM-${++attackState.attackCounter}-${Date.now()}`;
  const logger = new MITMAttackFlowLogger(sessionId, attackId, MITM_ATTACK_TYPES.SIGNED_INTERCEPT);

  try {
    logger.logStep(1, 'MITM attack initiated: Signed key exchange', {
      sessionId,
      attackType: 'SIGNED_INTERCEPT'
    });

    const kepInit = intercepted.kepInit.original;
    const kepResponse = intercepted.kepResponse.original;
    const attackerKeys = attackState.attackerKeyPairs.get(sessionId);

    logger.logStep(2, 'Retrieved intercepted KEP messages', {
      hasKEPInit: !!kepInit,
      hasKEPResponse: !!kepResponse,
      hasAttackerKeys: !!attackerKeys
    });

    // Check if signatures are present
    const hasSignatures = !!(kepInit.signature && kepResponse.signature);
    
    if (!hasSignatures) {
      logger.logStep(3, 'WARNING: No signatures detected - this should be unsigned attack', {
        hasKEPInitSignature: !!kepInit.signature,
        hasKEPResponseSignature: !!kepResponse.signature
      });
    } else {
      logger.logStep(3, 'Signatures detected - attack should be blocked', {
        hasKEPInitSignature: !!kepInit.signature,
        hasKEPResponseSignature: !!kepResponse.signature
      });
    }

    // Simulate key replacement attempt
    logger.logStep(4, 'Attacker attempts to replace ephemeral public keys', {
      originalKEPInitKey: kepInit.ephPub ? 'present' : 'missing',
      attackerKey: attackerKeys.publicKeyJWK ? 'generated' : 'missing'
    });

    // Simulate signature verification failure
    if (hasSignatures) {
      logger.logStep(5, 'Signature verification performed on modified key', {
        originalKey: kepInit.ephPub ? 'present' : 'missing',
        modifiedKey: attackerKeys.publicKeyJWK ? 'present' : 'missing',
        originalSignature: kepInit.signature ? 'present' : 'missing'
      });

      logger.logStep(6, 'Signature verification FAILED - key mismatch detected', {
        reason: 'Signature was created for original key, not attacker\'s key'
      });

      // Log signature verification failure
      await logInvalidSignature(
        sessionId,
        userId,
        'KEP_INIT',
        'MITM BLOCKED: Signature verification failed - key substitution detected'
      );

      const result = {
        success: false,
        blocked: true,
        reason: 'Signature verification prevents MITM',
        protection: 'SIGNATURE_VERIFICATION'
      };

      const flow = await logger.finalize(result);

      return {
        attackId,
        sessionId,
        attackType: MITM_ATTACK_TYPES.SIGNED_INTERCEPT,
        success: false,
        blocked: true,
        reason: result.reason,
        protection: result.protection,
        flow
      };
    } else {
      // No signatures - attack could succeed (but this is signed attack simulation)
      logger.logStep(5, 'WARNING: No signatures to verify - attack could succeed', {
        reason: 'This should be an unsigned attack scenario'
      });

      const result = {
        success: true,
        blocked: false,
        reason: 'No signature verification - attack succeeds',
        protection: null
      };

      const flow = await logger.finalize(result);

      return {
        attackId,
        sessionId,
        attackType: MITM_ATTACK_TYPES.SIGNED_INTERCEPT,
        success: true,
        blocked: false,
        reason: result.reason,
        protection: result.protection,
        flow
      };
    }
  } catch (error) {
    console.error('[MITM_ATTACK] Error in signed MITM simulation:', error);
    await logger.finalize({
      success: false,
      blocked: true,
      reason: error.message,
      protection: 'ERROR'
    });
    throw error;
  }
}

/**
 * Simulates key confirmation mismatch
 * This demonstrates how key confirmation prevents MITM even if signatures are bypassed
 */
export async function simulateKeyConfirmationMismatch(sessionId, userId) {
  if (!attackState.enabled) {
    throw new Error('MITM attack mode is disabled');
  }

  const intercepted = attackState.interceptedKEP.get(sessionId);
  if (!intercepted || !intercepted.kepResponse) {
    throw new Error('No intercepted KEP_RESPONSE message found for this session');
  }

  const attackId = `MITM-${++attackState.attackCounter}-${Date.now()}`;
  const logger = new MITMAttackFlowLogger(sessionId, attackId, MITM_ATTACK_TYPES.KEY_CONFIRMATION_MISMATCH);

  try {
    logger.logStep(1, 'MITM attack initiated: Key confirmation mismatch', {
      sessionId,
      attackType: 'KEY_CONFIRMATION_MISMATCH'
    });

    const kepResponse = intercepted.kepResponse.original;
    const hasKeyConfirmation = !!kepResponse.keyConfirmation;

    logger.logStep(2, 'Checking for key confirmation', {
      hasKeyConfirmation,
      keyConfirmationValue: hasKeyConfirmation ? 'present' : 'missing'
    });

    if (!hasKeyConfirmation) {
      logger.logStep(3, 'No key confirmation present - attack could succeed', {
        reason: 'Key confirmation prevents MITM even if signatures are bypassed'
      });

      const result = {
        success: true,
        blocked: false,
        reason: 'No key confirmation - attack succeeds',
        protection: null
      };

      const flow = await logger.finalize(result);

      return {
        attackId,
        sessionId,
        attackType: MITM_ATTACK_TYPES.KEY_CONFIRMATION_MISMATCH,
        success: true,
        blocked: false,
        reason: result.reason,
        protection: result.protection,
        flow
      };
    } else {
      logger.logStep(3, 'Key confirmation present - verifying', {
        keyConfirmation: 'present'
      });

      logger.logStep(4, 'Key confirmation MISMATCH detected', {
        reason: 'Attacker\'s shared secret differs from legitimate parties\' shared secret',
        protection: 'KEY_CONFIRMATION'
      });

      // Log key confirmation failure
      await logInvalidSignature(
        sessionId,
        userId,
        'KEP_RESPONSE',
        'MITM BLOCKED: Key confirmation mismatch - attacker cannot derive same root key'
      );

      const result = {
        success: false,
        blocked: true,
        reason: 'Key confirmation mismatch prevents MITM',
        protection: 'KEY_CONFIRMATION'
      };

      const flow = await logger.finalize(result);

      return {
        attackId,
        sessionId,
        attackType: MITM_ATTACK_TYPES.KEY_CONFIRMATION_MISMATCH,
        success: false,
        blocked: true,
        reason: result.reason,
        protection: result.protection,
        flow
      };
    }
  } catch (error) {
    console.error('[MITM_ATTACK] Error in key confirmation mismatch simulation:', error);
    await logger.finalize({
      success: false,
      blocked: true,
      reason: error.message,
      protection: 'ERROR'
    });
    throw error;
  }
}

/**
 * Gets MITM attack statistics
 */
export function getMITMStats() {
  return {
    enabled: attackState.enabled,
    activeAttacks: attackState.activeAttacks.size,
    interceptedSessions: attackState.interceptedKEP.size,
    totalAttacks: attackState.attackCounter
  };
}

/**
 * Gets intercepted KEP messages for a session
 */
export function getInterceptedKEP(sessionId = null) {
  if (sessionId) {
    const intercepted = attackState.interceptedKEP.get(sessionId);
    return intercepted ? { sessionId, intercepted } : null;
  }

  // Return all intercepted KEP
  const allIntercepted = {};
  for (const [sid, intercepted] of attackState.interceptedKEP.entries()) {
    allIntercepted[sid] = intercepted;
  }
  return allIntercepted;
}

/**
 * Clears intercepted KEP messages
 */
export function clearInterceptedKEP(sessionId = null) {
  if (sessionId) {
    attackState.interceptedKEP.delete(sessionId);
    attackState.attackerKeyPairs.delete(sessionId);
  } else {
    attackState.interceptedKEP.clear();
    attackState.attackerKeyPairs.clear();
  }
}

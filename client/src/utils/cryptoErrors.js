/**
 * User-Friendly Crypto Error Messages
 * 
 * Converts technical crypto errors into user-friendly messages
 * while preserving technical details for debugging.
 */

/**
 * Maps crypto error types to user-friendly messages
 * @param {Error} error - Original error object
 * @param {string} operation - Operation that failed (e.g., 'encryption', 'decryption')
 * @returns {Object} { userMessage: string, technicalMessage: string }
 */
export function getCryptoErrorMessage(error, operation = 'operation') {
  const technicalMessage = error.message || 'Unknown error';
  
  // Authentication tag verification failures
  if (error.message && (
    error.message.includes('Authentication tag') ||
    error.message.includes('auth tag') ||
    error.message.includes('OperationError')
  )) {
    return {
      userMessage: 'Message integrity check failed. The message may have been tampered with or corrupted.',
      technicalMessage: `Decryption failed: ${technicalMessage}`,
      errorType: 'INTEGRITY_FAILURE'
    };
  }
  
  // Key-related errors
  if (error.message && (
    error.message.includes('key') ||
    error.message.includes('Key')
  )) {
    if (error.message.includes('not found') || error.message.includes('missing')) {
      return {
        userMessage: 'Encryption key not available. Please try logging in again.',
        technicalMessage: technicalMessage,
        errorType: 'KEY_NOT_FOUND'
      };
    }
    if (error.message.includes('invalid') || error.message.includes('Invalid')) {
      return {
        userMessage: 'Invalid encryption key. Please establish a new secure session.',
        technicalMessage: technicalMessage,
        errorType: 'INVALID_KEY'
      };
    }
  }
  
  // Session-related errors
  if (error.message && (
    error.message.includes('Session') ||
    error.message.includes('session')
  )) {
    if (error.message.includes('not found')) {
      return {
        userMessage: 'Secure session not found. Please start a new conversation.',
        technicalMessage: technicalMessage,
        errorType: 'SESSION_NOT_FOUND'
      };
    }
    if (error.message.includes('expired') || error.message.includes('Expired')) {
      return {
        userMessage: 'Secure session has expired. Please start a new conversation.',
        technicalMessage: technicalMessage,
        errorType: 'SESSION_EXPIRED'
      };
    }
  }
  
  // Network/connection errors
  if (error.message && (
    error.message.includes('network') ||
    error.message.includes('Network') ||
    error.message.includes('fetch') ||
    error.message.includes('connection')
  )) {
    return {
      userMessage: 'Network error. Please check your connection and try again.',
      technicalMessage: technicalMessage,
      errorType: 'NETWORK_ERROR'
    };
  }
  
  // Replay protection errors
  if (error.message && (
    error.message.includes('replay') ||
    error.message.includes('Replay') ||
    error.message.includes('duplicate') ||
    error.message.includes('Duplicate')
  )) {
    return {
      userMessage: 'Message rejected: This message appears to be a duplicate.',
      technicalMessage: technicalMessage,
      errorType: 'REPLAY_DETECTED'
    };
  }
  
  // Timestamp validation errors
  if (error.message && (
    error.message.includes('timestamp') ||
    error.message.includes('Timestamp') ||
    error.message.includes('stale')
  )) {
    return {
      userMessage: 'Message rejected: Message is too old or from the future.',
      technicalMessage: technicalMessage,
      errorType: 'TIMESTAMP_INVALID'
    };
  }
  
  // Generic encryption/decryption errors
  if (operation === 'encryption') {
    return {
      userMessage: 'Failed to encrypt message. Please try again.',
      technicalMessage: `Encryption failed: ${technicalMessage}`,
      errorType: 'ENCRYPTION_FAILED'
    };
  }
  
  if (operation === 'decryption') {
    return {
      userMessage: 'Failed to decrypt message. The message may be corrupted.',
      technicalMessage: `Decryption failed: ${technicalMessage}`,
      errorType: 'DECRYPTION_FAILED'
    };
  }
  
  // Default fallback
  return {
    userMessage: 'An error occurred. Please try again.',
    technicalMessage: technicalMessage,
    errorType: 'UNKNOWN_ERROR'
  };
}

/**
 * Creates a user-friendly error object
 * @param {Error} error - Original error
 * @param {string} operation - Operation name
 * @returns {Error} Enhanced error with userMessage property
 */
export function createUserFriendlyError(error, operation = 'operation') {
  const { userMessage, technicalMessage, errorType } = getCryptoErrorMessage(error, operation);
  
  const friendlyError = new Error(userMessage);
  friendlyError.technicalMessage = technicalMessage;
  friendlyError.errorType = errorType;
  friendlyError.originalError = error;
  
  // Preserve stack trace for debugging
  if (error.stack) {
    friendlyError.stack = error.stack;
  }
  
  return friendlyError;
}


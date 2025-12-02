/**
 * Crypto Error Handling Tests
 * 
 * Tests the user-friendly error message utility
 */

import { getCryptoErrorMessage, createUserFriendlyError } from '../../src/utils/cryptoErrors.js';

describe('Crypto Error Handling Tests', () => {
  describe('getCryptoErrorMessage', () => {
    test('should handle authentication tag failures', () => {
      const error = new Error('Authentication tag verification failed');
      const result = getCryptoErrorMessage(error, 'decryption');
      
      expect(result.userMessage).toContain('integrity check failed');
      expect(result.technicalMessage).toContain('Decryption failed');
      expect(result.errorType).toBe('INTEGRITY_FAILURE');
    });

    test('should handle key not found errors', () => {
      const error = new Error('Key not found');
      const result = getCryptoErrorMessage(error, 'decryption');
      
      expect(result.userMessage).toContain('Encryption key not available');
      expect(result.userMessage).toContain('try logging in again');
      expect(result.errorType).toBe('KEY_NOT_FOUND');
    });

    test('should handle session not found errors', () => {
      const error = new Error('Session not found');
      const result = getCryptoErrorMessage(error, 'decryption');
      
      expect(result.userMessage).toContain('Secure session not found');
      expect(result.userMessage).toContain('start a new conversation');
      expect(result.errorType).toBe('SESSION_NOT_FOUND');
    });

    test('should handle network errors', () => {
      const error = new Error('Network request failed');
      const result = getCryptoErrorMessage(error, 'operation');
      
      expect(result.userMessage).toContain('Network error');
      expect(result.userMessage).toContain('check your connection');
      expect(result.errorType).toBe('NETWORK_ERROR');
    });

    test('should handle replay detection errors', () => {
      const error = new Error('Duplicate nonce detected');
      const result = getCryptoErrorMessage(error, 'operation');
      
      expect(result.userMessage).toContain('duplicate');
      expect(result.errorType).toBe('REPLAY_DETECTED');
    });

    test('should handle timestamp validation errors', () => {
      const error = new Error('Timestamp out of validity window');
      const result = getCryptoErrorMessage(error, 'operation');
      
      expect(result.userMessage).toContain('too old or from the future');
      expect(result.errorType).toBe('TIMESTAMP_INVALID');
    });

    test('should handle generic encryption errors', () => {
      const error = new Error('Some encryption error');
      const result = getCryptoErrorMessage(error, 'encryption');
      
      expect(result.userMessage).toContain('Failed to encrypt');
      expect(result.errorType).toBe('ENCRYPTION_FAILED');
    });

    test('should handle generic decryption errors', () => {
      const error = new Error('Some decryption error');
      const result = getCryptoErrorMessage(error, 'decryption');
      
      expect(result.userMessage).toContain('Failed to decrypt');
      expect(result.errorType).toBe('DECRYPTION_FAILED');
    });

    test('should handle unknown errors', () => {
      const error = new Error('Some unknown error');
      const result = getCryptoErrorMessage(error, 'operation');
      
      expect(result.userMessage).toContain('An error occurred');
      expect(result.errorType).toBe('UNKNOWN_ERROR');
    });
  });

  describe('createUserFriendlyError', () => {
    test('should create error with userMessage and technicalMessage', () => {
      const originalError = new Error('Authentication tag verification failed');
      const friendlyError = createUserFriendlyError(originalError, 'decryption');
      
      // The error message should be the user-friendly message
      expect(friendlyError.message).toContain('integrity check failed');
      expect(friendlyError.technicalMessage).toBeDefined();
      expect(friendlyError.technicalMessage).toContain('Decryption failed');
      expect(friendlyError.errorType).toBe('INTEGRITY_FAILURE');
      expect(friendlyError.originalError).toBe(originalError);
    });

    test('should preserve stack trace', () => {
      const originalError = new Error('Test error');
      const friendlyError = createUserFriendlyError(originalError, 'operation');
      
      expect(friendlyError.stack).toBeDefined();
      expect(friendlyError.stack).toBe(originalError.stack);
    });

    test('should handle errors without stack trace', () => {
      const originalError = { message: 'Test error' };
      const friendlyError = createUserFriendlyError(originalError, 'operation');
      
      expect(friendlyError.message).toBeDefined();
      expect(friendlyError.technicalMessage).toBeDefined();
    });
  });
});


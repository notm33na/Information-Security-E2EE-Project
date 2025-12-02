/**
 * Test User Helper Functions
 * Utilities for creating, managing, and cleaning up test users
 */

import { userService } from '../../../src/services/user.service.js';
import { User } from '../../../src/models/User.js';

/**
 * Creates a test user with the given email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Created user object
 */
export async function createTestUser(email, password) {
  return await userService.createUser(email, password);
}

/**
 * Logs in a test user and returns tokens
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{user: Object, accessToken: string, refreshToken: string}>}
 */
export async function loginTestUser(email, password) {
  const user = await userService.getUserByEmail(email, true);
  if (!user) {
    throw new Error('User not found');
  }

  const isValid = await userService.verifyPassword(email, password);
  if (!isValid) {
    throw new Error('Invalid password');
  }

  // Generate tokens (simplified - in real scenario, use auth controller)
  const { generateAccessToken, generateRefreshToken } = await import('../../../src/utils/jwt.js');
  const accessToken = generateAccessToken(user._id.toString(), user.email);
  const refreshToken = generateRefreshToken(user._id.toString(), user.email);

  await userService.updateLastLogin(user._id.toString());

  return {
    user: userService.safeUser(user),
    accessToken,
    refreshToken
  };
}

/**
 * Cleans up a test user by ID
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function cleanupTestUser(userId) {
  await User.findByIdAndDelete(userId);
}

/**
 * Gets a user from database with password hash
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User object with password hash
 */
export async function getUserWithPassword(email) {
  return await userService.getUserByEmail(email, true);
}

/**
 * Deactivates a user account
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function deactivateUser(userId) {
  await userService.deactivateUser(userId);
}

/**
 * Generates a unique test email
 * @returns {string} Unique email address
 */
export function generateTestEmail() {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  return `test${uniqueId}@example.com`;
}


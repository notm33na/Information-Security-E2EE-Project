/**
 * API Client Helper
 * Provides functions to make authenticated API requests for testing
 */

import request from 'supertest';
import app from '../../app.js';

/**
 * API client for making requests
 */
export const api = {
  /**
   * Authentication endpoints
   */
  auth: {
    /**
     * Register a new user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} Response object
     */
    register: async (email, password) => {
      return await request(app)
        .post('/api/auth/register')
        .send({ email, password });
    },

    /**
     * Login a user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} Response object with cookies
     */
    login: async (email, password) => {
      return await request(app)
        .post('/api/auth/login')
        .send({ email, password });
    },

    /**
     * Get current user (requires authentication)
     * @param {string} token - Access token
     * @returns {Promise<Object>} Response object
     */
    getMe: async (token) => {
      return await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
    }
  },

  /**
   * Keys endpoints
   */
  keys: {
    /**
     * Upload public key
     * @param {Object} publicKeyJWK - Public key in JWK format
     * @param {string} token - Access token
     * @returns {Promise<Object>} Response object
     */
    upload: async (publicKeyJWK, token) => {
      return await request(app)
        .post('/api/keys/upload')
        .set('Authorization', `Bearer ${token}`)
        .send({ publicIdentityKeyJWK: publicKeyJWK });
    },

    /**
     * Retrieve public key by user ID
     * @param {string} userId - User ID
     * @param {string} token - Access token
     * @returns {Promise<Object>} Response object
     */
    retrieve: async (userId, token) => {
      return await request(app)
        .get(`/api/keys/${userId}`)
        .set('Authorization', `Bearer ${token}`);
    }
  }
};


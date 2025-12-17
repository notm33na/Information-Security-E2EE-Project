import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { setAccessToken as setTokenStore, clearAccessToken, setTokenUpdateCallback } from '../utils/tokenStore';
import { generateIdentityKeyPair, storePrivateKeyEncrypted, exportPublicKey } from '../crypto/identityKeys.js';
import { initializeSessionEncryption, clearSessionEncryptionCache } from '../crypto/sessionManager.js';
import { getBackendWebSocketURL } from '../config/backend.js';

const AuthContext = createContext(null);

/**
 * AuthProvider component
 * Manages authentication state and provides auth methods
 */
// Password cache for session establishment (encrypted in memory, cleared on logout)
const passwordCache = new Map(); // userId -> { password: string, expiresAt: number }

// Global WebSocket connection for KEP_INIT handling
let globalSocket = null;
let globalSocketListeners = new Set();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Attempts to refresh the access token using refresh token cookie
   */
  const refreshAccessToken = useCallback(async () => {
    try {
      const response = await api.post('/auth/refresh');
      if (response.data.success) {
        const newToken = response.data.data.accessToken;
        setAccessToken(newToken);
        setTokenStore(newToken); // Also update token store
        return newToken;
      }
      return null;
    } catch (error) {
      // 401 is expected if there's no valid refresh token (e.g., first visit, expired token)
      // Network errors are expected if backend is not running
      if (error.response?.status !== 401 && !error.code === 'ECONNREFUSED') {
        // Only log non-network, non-401 errors
        if (error.response) {
          console.error('Token refresh failed:', error.response.data);
        } else if (!error.message?.includes('Network Error')) {
          console.error('Token refresh failed:', error.message);
        }
      }
      setAccessToken(null);
      setUser(null);
      return null;
    }
  }, []);

  /**
   * Fetches current user information
   */
  const fetchUser = useCallback(async (token) => {
    try {
      const response = await api.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.data.success) {
        setUser(response.data.data.user);
        return response.data.data.user;
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch user:', error);
      return null;
    }
  }, []);

  /**
   * Initializes auth state on mount
   */
  useEffect(() => {
    // Set up token update callback
    setTokenUpdateCallback((token) => {
      setAccessToken(token);
    });

    const initializeAuth = async () => {
      try {
        // Try to refresh token first
        const token = await refreshAccessToken();
        if (token) {
          setTokenStore(token); // Update token store
          // Fetch user info
          const user = await fetchUser(token);
          
          // Verify identity key persists after page refresh (if user is logged in)
          if (user) {
            try {
              const { hasIdentityKey } = await import('../crypto/identityKeys.js');
              const keyExists = await hasIdentityKey(user.id);
              if (keyExists) {
                console.log(`[Auth] ✓ Identity key verified in IndexedDB after page refresh for user ${user.id}`);
              } else {
                console.log(`[Auth] ⚠️ No identity key found in IndexedDB after page refresh for user ${user.id}`);
              }
            } catch (keyCheckError) {
              console.warn('[Auth] Failed to check identity key after page refresh:', keyCheckError);
              // Non-fatal
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [refreshAccessToken, fetchUser]);

  /**
   * Global WebSocket handler for KEP_INIT messages
   * This ensures KEP_INIT messages are handled even when user isn't on Chat page
   */
  useEffect(() => {
    if (!user?.id || !accessToken) {
      // Clean up global socket if user logs out
      if (globalSocket) {
        globalSocket.off('kep:init');
        globalSocket.close();
        globalSocket = null;
      }
      return;
    }

    // Set up global WebSocket connection for KEP_INIT handling
    const setupGlobalSocket = async () => {
      try {
        const { default: io } = await import('socket.io-client');
        
        // Reuse existing socket if available and connected
        if (globalSocket && globalSocket.connected) {
          console.log('[Global WS] Reusing existing connection');
          return;
        }

        // Properly close existing socket if disconnected or in bad state
        if (globalSocket) {
          console.log('[Global WS] Closing existing socket before creating new one');
          globalSocket.removeAllListeners(); // Remove all listeners to prevent leaks
          globalSocket.disconnect(); // Disconnect first
          globalSocket.close(); // Then close
          globalSocket = null; // Clear reference
        }

        const wsURL = import.meta.env.DEV 
          ? window.location.origin
          : getBackendWebSocketURL();

        globalSocket = io(wsURL, {
          transports: ['polling', 'websocket'],
          rejectUnauthorized: false,
          auth: {
            token: accessToken
          },
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: Infinity,
          reconnectionDelayMax: 10000,
          timeout: 20000,
          forceNew: false
        });

        globalSocket.on('connect', () => {
          console.log('[Global WS] Connected for KEP_INIT handling');
        });

        // Handle KEP_INIT messages globally
        const handleKEPInit = async (kepInitMessage) => {
          if (!user?.id) {
            console.warn('[Global KEP] Cannot handle KEP_INIT: user not available');
            return;
          }
          
          console.log(`[Global KEP] Received KEP_INIT from ${kepInitMessage?.from} for session ${kepInitMessage?.sessionId}`);
          console.log(`[Global KEP] Message details:`, {
            from: kepInitMessage?.from,
            to: kepInitMessage?.to,
            sessionId: kepInitMessage?.sessionId,
            ourUserId: user.id,
            messageType: kepInitMessage?.type
          });
          
          // Verify this message is for us
          if (kepInitMessage.to !== user.id) {
            console.log(`[Global KEP] KEP_INIT not for us (to: ${kepInitMessage.to}, us: ${user.id})`);
            return;
          }

          try {
            // Get cached password directly from cache
            const cached = passwordCache.get(user.id);
            const password = cached && cached.expiresAt > Date.now() ? cached.password : null;
            
            if (!password) {
              console.warn('[Global KEP] Password not cached - cannot respond to KEP_INIT');
              return;
            }

            console.log(`[Global KEP] Processing KEP_INIT and preparing KEP_RESPONSE...`);
            const { handleKEPInit } = await import('../crypto/sessionEstablishment.js');
            await handleKEPInit(kepInitMessage, user.id, password, globalSocket);
            console.log(`[Global KEP] ✓ Successfully handled KEP_INIT and sent KEP_RESPONSE`);
          } catch (error) {
            console.error('[Global KEP] ✗ Failed to handle KEP_INIT:', error);
            console.error('[Global KEP] Error details:', {
              message: error.message,
              stack: error.stack,
              name: error.name
            });
          }
        };

        globalSocket.on('kep:init', handleKEPInit);

        globalSocket.on('disconnect', () => {
          console.log('[Global WS] Disconnected');
        });

        globalSocket.on('error', (error) => {
          console.warn('[Global WS] Error:', error);
        });
      } catch (error) {
        console.error('[Global WS] Failed to set up global socket:', error);
      }
    };

    setupGlobalSocket();

    return () => {
      // Don't close global socket on unmount - keep it alive for KEP_INIT handling
      // It will be cleaned up when user logs out
    };
  }, [user?.id, accessToken]);

  /**
   * Login function
   */
  const login = async (email, password) => {
    try {
      setError(null);
      const response = await api.post('/auth/login', { email, password });
      
      if (response.data.success) {
        const { user, accessToken: token } = response.data.data;
        setUser(user);
        setAccessToken(token);
        setTokenStore(token); // Store token in token store for API interceptor
        
        // Verify identity key exists in IndexedDB (do NOT regenerate)
        try {
          const { hasIdentityKey } = await import('../crypto/identityKeys.js');
          const keyExists = await hasIdentityKey(user.id);
          if (keyExists) {
            console.log(`[Auth] ✓ Identity key verified in IndexedDB after login for user ${user.id}`);
          } else {
            console.log(`[Auth] ⚠️ No identity key found in IndexedDB for user ${user.id} - user should generate one`);
          }
        } catch (keyCheckError) {
          console.warn('[Auth] Failed to check identity key existence:', keyCheckError);
          // Non-fatal - user can generate key later
        }
        
        // Initialize session encryption key cache
        try {
          await initializeSessionEncryption(user.id, password);
          console.log('✓ Session encryption initialized');
          // Cache password for session establishment
          cachePassword(user.id, password);
        } catch (encError) {
          console.warn('Failed to initialize session encryption:', encError);
          // Non-fatal - sessions will require password on first access
        }
        
        return { success: true, user };
      }
      
      throw new Error(response.data.message || 'Login failed');
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  /**
   * Register function
   * Also generates and stores identity key pair
   */
  const register = async (email, password) => {
    try {
      setError(null);
      
      // Generate identity key pair
      console.log('Generating identity key pair...');
      let privateKey, publicKey, publicKeyJWK;
      try {
        const keyPair = await generateIdentityKeyPair();
        privateKey = keyPair.privateKey;
        publicKey = keyPair.publicKey;
        publicKeyJWK = await exportPublicKey(publicKey);
      } catch (keyGenError) {
        console.error('Failed to generate identity keys:', keyGenError);
        throw new Error('Failed to generate encryption keys. Please try again.');
      }
      
      // Register user
      let response;
      try {
        response = await api.post('/auth/register', { email, password });
      } catch (regError) {
        // Handle registration errors with user-friendly messages
        if (regError.response?.status === 409) {
          throw new Error('An account with this email already exists. Please use a different email or try logging in.');
        }
        if (regError.response?.status === 400) {
          const validationErrors = regError.response?.data?.errors || [];
          if (validationErrors.length > 0) {
            const firstError = validationErrors[0]?.msg || validationErrors[0];
            throw new Error(firstError);
          }
          throw new Error(regError.response?.data?.message || 'Invalid registration data. Please check your email and password requirements.');
        }
        if (regError.response?.data?.message) {
          throw new Error(regError.response.data.message);
        }
        throw new Error('Registration failed. Please check your connection and try again.');
      }
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Registration failed. Please try again.');
      }
      
      const { user, accessToken: token } = response.data.data;
      setUser(user);
      setAccessToken(token);
      setTokenStore(token);
      
      // Store private key encrypted with password
      try {
        await storePrivateKeyEncrypted(user.id, privateKey, password);
        console.log('✓ Identity private key stored securely');
      } catch (storeError) {
        console.error('Failed to store private key:', storeError);
        // This is critical - if we can't store the key, user can't decrypt messages
        // User is already registered, so we need to inform them
        // Don't throw - allow login but show warning
        const storeErrorMessage = storeError.message || 'Failed to store encryption keys';
        if (storeErrorMessage.includes('password') || storeErrorMessage.includes('encryption')) {
          // Password-related error - this is critical
          throw new Error('Account created but encryption key storage failed. Your password may be incorrect. Please try logging in or contact support.');
        }
        // Other storage errors - allow registration but warn user
        console.warn('Key storage failed but registration succeeded. User can retry key generation later.');
        // Continue - user can regenerate keys if needed
      }
      
      // Initialize session encryption key cache
      try {
        await initializeSessionEncryption(user.id, password);
        console.log('✓ Session encryption initialized');
        // Cache password for session establishment
        cachePassword(user.id, password);
      } catch (encError) {
        console.warn('Failed to initialize session encryption:', encError);
        // Non-fatal - sessions will require password on first access
      }
      
      // Upload public key to server (non-critical, can be done later)
      try {
        await api.post('/keys/upload', { publicIdentityKeyJWK: publicKeyJWK });
        console.log('✓ Identity public key uploaded to server');
      } catch (keyError) {
        console.warn('Failed to upload public key (non-critical):', keyError);
        // Non-fatal - user can upload later, but we should inform them
        // Don't throw - registration was successful
      }
      
      return { success: true, user };
    } catch (error) {
      // Extract user-friendly error message
      let errorMessage = 'Registration failed. Please try again.';
      
      // Prioritize user-friendly messages from server
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        // Check if it's a technical error that needs translation
        const techError = error.message;
        if (techError.includes('Network Error') || techError.includes('ECONNREFUSED')) {
          errorMessage = 'Unable to connect to server. Please check your internet connection and try again.';
        } else if (techError.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.';
        } else if (techError.includes('Failed to generate')) {
          errorMessage = 'Failed to generate encryption keys. Please refresh the page and try again.';
        } else {
          // Use the error message if it's already user-friendly
          errorMessage = techError;
        }
      }
      
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  /**
   * Caches password for session establishment (1 hour)
   */
  const cachePassword = useCallback((userId, password) => {
    passwordCache.set(userId, {
      password,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours (matches session encryption key cache)
    });
  }, []);

  /**
   * Gets cached password if available and not expired
   */
  const getCachedPassword = useCallback((userId) => {
    const cached = passwordCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.password;
    }
    return null;
  }, []);

  /**
   * Logout function
   */
  const logout = async () => {
    try {
      if (accessToken) {
        try {
          await api.post('/auth/logout', {}, {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });
        } catch (error) {
          // Ignore 401 errors on logout (token might be expired)
          if (error.response?.status !== 401) {
            console.error('Logout error:', error);
          }
        }
      }
    } catch (error) {
      // Ignore errors during logout
      console.error('Logout error:', error);
    } finally {
      // Clear session encryption cache on logout (but NOT identity keys)
      if (user) {
        const userId = user.id;
        clearSessionEncryptionCache(userId);
        passwordCache.delete(userId); // Clear password cache
        
        // Verify identity key is NOT cleared (it should persist)
        try {
          const { hasIdentityKey } = await import('../crypto/identityKeys.js');
          const keyExists = await hasIdentityKey(userId);
          if (keyExists) {
            console.log(`[Auth] ✓ Identity key preserved in IndexedDB after logout for user ${userId}`);
          } else {
            console.log(`[Auth] ⚠️ Identity key not found in IndexedDB after logout for user ${userId} (this is expected if user never generated one)`);
          }
        } catch (keyCheckError) {
          console.warn('[Auth] Failed to verify identity key after logout:', keyCheckError);
          // Non-fatal
        }
        
        // Clear persisted messages
        try {
          const { clearAllUserMessages } = await import('../utils/messageStorage.js');
          await clearAllUserMessages(userId);
        } catch (error) {
          console.warn('Failed to clear user messages:', error);
        }
      }
      
      // Close global WebSocket on logout
      if (globalSocket) {
        globalSocket.off('kep:init');
        globalSocket.close();
        globalSocket = null;
      }
      
      setUser(null);
      setAccessToken(null);
      clearAccessToken(); // Clear token store
      setError(null);
    }
  };

  /**
   * Updates access token (used by interceptors)
   */
  const updateAccessToken = useCallback((token) => {
    setAccessToken(token);
    setTokenStore(token); // Also update token store
  }, []);

  const value = {
    user,
    accessToken,
    loading,
    error,
    isAuthenticated: !!user && !!accessToken,
    login,
    register,
    logout,
    refreshAccessToken,
    updateAccessToken,
    cachePassword,
    getCachedPassword,
    clearError: () => setError(null)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth hook
 * Provides access to auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}


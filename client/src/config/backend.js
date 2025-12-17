/**
 * Backend Configuration
 * 
 * Centralized configuration for backend server URL.
 * Can be configured via environment variable or defaults to localhost.
 */

/**
 * Get the backend server URL
 * Priority:
 * 1. VITE_BACKEND_URL environment variable
 * 2. Auto-detect from window.location (for shared backend on same network)
 * 3. Default to localhost
 */
export function getBackendURL() {
  // In development, check for environment variable first
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }

  // In development, try to auto-detect if we're on a network IP
  if (import.meta.env.DEV) {
    const hostname = window.location.hostname;
    
    // If accessing via network IP (not localhost), use same IP for backend
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '[::1]') {
      // Use same hostname but backend port
      return `https://${hostname}:8443`;
    }
  }

  // Default to localhost
  return 'https://localhost:8443';
}

/**
 * Get the backend WebSocket URL
 * Same logic as getBackendURL but for WebSocket connections
 */
export function getBackendWebSocketURL() {
  return getBackendURL();
}


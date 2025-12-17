import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasIdentityKey } from '../crypto/identityKeys';
import { getUserSessions } from '../crypto/sessionManager';
import api from '../services/api';
import { getAccessToken } from '../utils/tokenStore';

/**
 * Generate a fingerprint from key data (ArrayBuffer or string)
 */
function generateKeyFingerprint(keyData) {
  try {
    let dataString;
    if (keyData instanceof ArrayBuffer) {
      // Convert ArrayBuffer to hex string
      const bytes = new Uint8Array(keyData);
      dataString = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (typeof keyData === 'string') {
      dataString = keyData;
    } else {
      return 'Unknown';
    }
    
    // Simple hash for display
    const hash = dataString.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
    }, 0).toString(16).substring(0, 20);
    
    return hash.match(/.{1,4}/g)?.join(' ') || hash;
  } catch (err) {
    console.warn('Failed to generate fingerprint:', err);
    return 'Unknown';
  }
}

/**
 * Hook to fetch and manage encryption keys
 */
export function useKeys() {
  const { user, getCachedPassword } = useAuth();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAllKeys = async () => {
    if (!user?.id) {
      setKeys([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const keysList = [];

      // 1. Fetch Identity Keys (from local IndexedDB - doesn't require server)
      try {
        const hasKey = await hasIdentityKey(user.id);
        console.log('[useKeys] Identity key exists:', hasKey);
        
        if (hasKey) {
          // Try to fetch public key from server (optional - for additional metadata)
          let publicKeyInfo = null;
          const token = getAccessToken();
          if (token) {
            try {
              const response = await api.get('/keys/me');
              if (response.data.success && response.data.data) {
                publicKeyInfo = response.data.data;
              }
            } catch (keyErr) {
              // Server fetch failed, but we can still show the key from IndexedDB
              console.warn('[useKeys] Failed to fetch public key from server (will show local key):', keyErr.message);
            }
          }

          // Generate fingerprint - use a default if we don't have public key info
          let fingerprint = 'Local key (fingerprint unavailable)';
          if (publicKeyInfo?.publicIdentityKeyJWK) {
            try {
              // Create a simple fingerprint from JWK
              const jwk = publicKeyInfo.publicIdentityKeyJWK;
              const keyData = `${jwk.kty}-${jwk.crv}-${jwk.x?.substring(0, 8)}-${jwk.y?.substring(0, 8)}`;
              // Simple hash for display
              fingerprint = keyData.split('').reduce((acc, char) => {
                return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
              }, 0).toString(16).substring(0, 20).match(/.{1,4}/g)?.join(' ') || 'Unknown';
            } catch (err) {
              console.warn('[useKeys] Failed to generate fingerprint:', err);
            }
          }

          keysList.push({
            id: 'identity-key',
            name: 'Identity Key (ECC P-256)',
            type: 'Identity Key',
            keyType: 'ECC P-256',
            category: 'identity',
            status: 'active',
            fingerprint: fingerprint,
            createdAt: publicKeyInfo?.createdAt || publicKeyInfo?.updatedAt || new Date().toISOString(),
            expiresAt: 'Never',
            publicKeyJWK: publicKeyInfo?.publicIdentityKeyJWK
          });
        }
      } catch (identityErr) {
        console.error('[useKeys] Failed to check identity key:', identityErr);
        // Don't fail completely - continue to check session keys
      }

      // 2. Fetch Session Keys (from local IndexedDB) and determine active status
      try {
        console.log('[useKeys] Fetching session keys for user:', user.id);
        
        // Get active sessions from backend to determine which session keys are currently active
        let activeSessionIds = new Set();
        try {
          const sessionsResponse = await api.get('/sessions');
          if (sessionsResponse.data.success && sessionsResponse.data.data.sessions) {
            activeSessionIds = new Set(sessionsResponse.data.data.sessions.map(s => s.sessionId));
            console.log(`[useKeys] Found ${activeSessionIds.size} active session(s) from backend`);
          }
        } catch (apiErr) {
          console.warn('[useKeys] Failed to fetch active sessions from backend (will use IndexedDB status):', apiErr.message);
        }
        
        // Retroactively clean up old sessions based on backend active sessions
        // Use metadata-only cleanup to avoid password cache issues
        try {
          const { cleanupInactiveSessions } = await import('../crypto/sessionManager');
          await cleanupInactiveSessions(user.id, activeSessionIds);
        } catch (cleanupErr) {
          console.warn('[useKeys] Failed to cleanup inactive sessions (non-fatal):', cleanupErr.message);
        }
        
        // Try to get sessions with decrypted keys
        // Use cached password if available to decrypt sessions
        let sessions = [];
        const cachedPassword = getCachedPassword ? getCachedPassword(user.id) : null;
        
        if (cachedPassword) {
          console.log('[useKeys] Cached password available, refreshing session encryption cache...');
          // First, try to initialize session encryption if we have password but cache expired
          try {
            const { initializeSessionEncryption } = await import('../crypto/sessionManager');
            await initializeSessionEncryption(user.id, cachedPassword);
            console.log('[useKeys] ✓ Session encryption cache refreshed with password');
          } catch (initErr) {
            console.warn('[useKeys] Failed to initialize session encryption:', initErr.message);
          }
        } else {
          console.warn('[useKeys] No cached password available - sessions may not decrypt');
        }
        
        try {
          // Try with cached password first
          sessions = await getUserSessions(user.id, cachedPassword);
          console.log(`[useKeys] ✓ Decrypted ${sessions.length} session(s) with keys`);
          
          // If we got fewer sessions than expected, some may have failed to decrypt
          // This is normal if sessions were encrypted with a different password/salt
        } catch (decryptErr) {
          console.warn('[useKeys] Failed to decrypt sessions, using metadata only:', decryptErr.message);
          // Fall back to metadata-only for status display
          const { getSessionMetadata } = await import('../crypto/sessionManager');
          const metadataSessions = await getSessionMetadata(user.id);
          // Convert metadata to session-like objects for display
          sessions = metadataSessions.map(meta => ({
            ...meta,
            rootKey: null, // Keys not available without password
            sendKey: null,
            recvKey: null
          }));
          console.log(`[useKeys] Using metadata for ${sessions.length} session(s) (keys not available)`);
        }
        
        // Note: We keep all sessions for status determination, even if keys aren't decrypted
        // Keys will only be displayed if they were successfully decrypted
        console.log('[useKeys] Found sessions in IndexedDB:', sessions.length);
        
        // First pass: Determine active session per peer
        // Priority: 1) Backend active sessions (most authoritative), 2) IndexedDB status field
        const activeSessionPerPeer = new Map(); // peerId -> activeSessionId
        
        // Group sessions by peer
        const sessionsByPeer = new Map(); // peerId -> [sessions]
        for (const session of sessions) {
          const peerId = session.userId === user.id ? session.peerId : session.userId;
          if (!sessionsByPeer.has(peerId)) {
            sessionsByPeer.set(peerId, []);
          }
          sessionsByPeer.get(peerId).push(session);
        }
        
        // For each peer, determine which session is active
        for (const [peerId, peerSessions] of sessionsByPeer.entries()) {
          // Find session that is active in backend (highest priority)
          const backendActiveSession = peerSessions.find(s => activeSessionIds.has(s.sessionId));
          
          if (backendActiveSession) {
            // Backend says this session is active
            activeSessionPerPeer.set(peerId, backendActiveSession.sessionId);
            console.log(`[useKeys] Peer ${peerId}: Backend active session is ${backendActiveSession.sessionId}`);
          } else {
            // No backend active session - check IndexedDB status
            // Find the most recent session that is not explicitly inactive
            const activeSessions = peerSessions.filter(s => s.status !== 'inactive');
            if (activeSessions.length > 0) {
              // Sort by lastActivity or createdAt (most recent first)
              activeSessions.sort((a, b) => {
                const timeA = new Date(a.lastActivity || a.updatedAt || a.createdAt || 0).getTime();
                const timeB = new Date(b.lastActivity || b.updatedAt || b.createdAt || 0).getTime();
                return timeB - timeA;
              });
              // Most recent active session is the active one
              activeSessionPerPeer.set(peerId, activeSessions[0].sessionId);
              console.log(`[useKeys] Peer ${peerId}: Most recent active session is ${activeSessions[0].sessionId}`);
            }
          }
        }
        
        // Second pass: Build key list with correct status
        for (const session of sessions) {
          const sessionId = session.sessionId;
          const peerId = session.userId === user.id ? session.peerId : session.userId;
          
          // Determine final status
          const activeSessionId = activeSessionPerPeer.get(peerId);
          const finalStatus = (activeSessionId === sessionId) ? 'active' : 'inactive';
          const statusReason = session.statusReason || (finalStatus === 'inactive' && activeSessionId ? `Superseded by session ${activeSessionId.substring(0, 8)}...` : null);
          
          // Only add keys if they exist (session was successfully decrypted)
          // If keys are null, the session metadata is still used for status display
          
          // Root Key
          if (session.rootKey) {
            keysList.push({
              id: `session-${sessionId}-root`,
              name: `Root Key (Session: ${sessionId.substring(0, 8)}...)`,
              type: 'Session Key',
              keyType: 'HKDF-SHA256 (256 bits)',
              category: 'session',
              status: finalStatus,
              statusReason: statusReason,
              fingerprint: generateKeyFingerprint(session.rootKey),
              createdAt: session.createdAt || new Date().toISOString(),
              statusChangedAt: session.statusChangedAt || null,
              expiresAt: 'Session lifetime',
              sessionId: sessionId,
              peerId: peerId,
              keyPurpose: 'Base key for deriving send/recv keys'
            });
          }

          // Send Key
          if (session.sendKey) {
            keysList.push({
              id: `session-${sessionId}-send`,
              name: `Send Key (Session: ${sessionId.substring(0, 8)}...)`,
              type: 'Session Key',
              keyType: 'HKDF-SHA256 (256 bits)',
              category: 'session',
              status: finalStatus,
              statusReason: statusReason,
              fingerprint: generateKeyFingerprint(session.sendKey),
              createdAt: session.createdAt || new Date().toISOString(),
              statusChangedAt: session.statusChangedAt || null,
              expiresAt: 'Session lifetime',
              sessionId: sessionId,
              peerId: peerId,
              keyPurpose: 'Encrypts outgoing messages (AES-256-GCM)'
            });
          }

          // Receive Key
          if (session.recvKey) {
            keysList.push({
              id: `session-${sessionId}-recv`,
              name: `Receive Key (Session: ${sessionId.substring(0, 8)}...)`,
              type: 'Session Key',
              keyType: 'HKDF-SHA256 (256 bits)',
              category: 'session',
              status: finalStatus,
              statusReason: statusReason,
              fingerprint: generateKeyFingerprint(session.recvKey),
              createdAt: session.createdAt || new Date().toISOString(),
              statusChangedAt: session.statusChangedAt || null,
              expiresAt: 'Session lifetime',
              sessionId: sessionId,
              peerId: peerId,
              keyPurpose: 'Decrypts incoming messages (AES-256-GCM)'
            });
          }
        }
        
        console.log(`[useKeys] Processed ${keysList.filter(k => k.category === 'session').length} session keys (active: ${keysList.filter(k => k.category === 'session' && k.status === 'active').length}, inactive: ${keysList.filter(k => k.category === 'session' && k.status === 'inactive').length})`);
      } catch (sessionErr) {
        console.warn('[useKeys] Failed to fetch session keys:', sessionErr);
        // Don't fail completely if session keys can't be loaded
      }

      console.log('[useKeys] Total keys found:', keysList.length);
      setKeys(keysList);
    } catch (err) {
      console.error('[useKeys] Failed to fetch keys:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllKeys();
  }, [user?.id]);

  return { 
    keys, 
    loading, 
    error,
    refetch: fetchAllKeys
  };
}


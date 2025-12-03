import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { hasIdentityKey } from '../crypto/identityKeys';
import api from '../services/api';
import { getAccessToken } from '../utils/tokenStore';

/**
 * Hook to fetch and manage encryption keys
 */
export function useKeys() {
  const { user } = useAuth();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) {
      setKeys([]);
      setLoading(false);
      return;
    }

    // Don't fetch if not authenticated
    const token = getAccessToken();
    if (!token) {
      setKeys([]);
      setLoading(false);
      return;
    }

    const fetchKeys = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const keysList = [];

        // Check if identity key exists in IndexedDB
        const hasKey = await hasIdentityKey(user.id);
        
        if (hasKey) {
          // Try to fetch public key from server
          let publicKeyInfo = null;
          try {
            const response = await api.get('/keys/me');
            if (response.data.success && response.data.data) {
              publicKeyInfo = response.data.data;
            }
          } catch (keyErr) {
            console.warn('Failed to fetch public key from server:', keyErr);
          }

          // Generate fingerprint from public key if available
          let fingerprint = 'Not available';
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
              console.warn('Failed to generate fingerprint:', err);
            }
          }

          keysList.push({
            id: 'identity-key',
            name: 'Identity Key (ECC P-256)',
            type: 'ECC P-256',
            status: 'active',
            fingerprint: fingerprint,
            createdAt: publicKeyInfo?.createdAt || publicKeyInfo?.updatedAt || new Date().toISOString(),
            expiresAt: 'Never',
            publicKeyJWK: publicKeyInfo?.publicIdentityKeyJWK
          });
        }

        setKeys(keysList);
      } catch (err) {
        console.error('Failed to fetch keys:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchKeys();
  }, [user?.id]);

  return { 
    keys, 
    loading, 
    error,
    refetch: async () => {
      if (user?.id) {
        try {
          const hasKey = await hasIdentityKey(user.id);
          const keysList = [];
          
          if (hasKey) {
            let publicKeyInfo = null;
            try {
              const response = await api.get('/keys/me');
              if (response.data.success && response.data.data) {
                publicKeyInfo = response.data.data;
              }
            } catch (keyErr) {
              console.warn('Failed to fetch public key:', keyErr);
            }

            let fingerprint = 'Not available';
            if (publicKeyInfo?.publicIdentityKeyJWK) {
              try {
                const jwk = publicKeyInfo.publicIdentityKeyJWK;
                const keyData = `${jwk.kty}-${jwk.crv}-${jwk.x?.substring(0, 8)}-${jwk.y?.substring(0, 8)}`;
                fingerprint = keyData.split('').reduce((acc, char) => {
                  return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
                }, 0).toString(16).substring(0, 20).match(/.{1,4}/g)?.join(' ') || 'Unknown';
              } catch (err) {
                console.warn('Failed to generate fingerprint:', err);
              }
            }

            keysList.push({
              id: 'identity-key',
              name: 'Identity Key (ECC P-256)',
              type: 'ECC P-256',
              status: 'active',
              fingerprint: fingerprint,
              createdAt: publicKeyInfo?.createdAt || new Date().toISOString(),
              expiresAt: 'Never',
              publicKeyJWK: publicKeyInfo?.publicIdentityKeyJWK
            });
          }
          setKeys(keysList);
        } catch (err) {
          console.error('Failed to refetch keys:', err);
        }
      }
    }
  };
}


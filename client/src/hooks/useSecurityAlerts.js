import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserSessions } from '../crypto/sessionManager';

/**
 * Hook to aggregate security alerts from all sessions
 * Note: Security events are typically tracked in real-time during chat sessions
 * This hook provides a way to view historical alerts
 */
export function useSecurityAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    const fetchAlerts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get all sessions to check for security events
        const sessions = await getUserSessions(user.id);
        
        // For now, we'll create alerts based on session metadata
        // In a real implementation, you'd track security events in IndexedDB or via API
        const alertsList = [];

        // Check for sessions with potential security issues
        // (This is a placeholder - real security events should be tracked separately)
        sessions.forEach(session => {
          // Example: Check if session has been inactive for too long (potential security concern)
          const lastUpdate = new Date(session.updatedAt || session.createdAt).getTime();
          const daysSinceUpdate = (Date.now() - lastUpdate) / (1000 * 60 * 60 * 24);
          
          if (daysSinceUpdate > 90) {
            alertsList.push({
              id: `session-stale-${session.sessionId}`,
              title: 'Stale Session Detected',
              message: `Session ${session.sessionId.substring(0, 8)}... has been inactive for ${Math.floor(daysSinceUpdate)} days`,
              severity: 'low',
              timestamp: session.updatedAt || session.createdAt,
              sessionId: session.sessionId
            });
          }
        });

        // Sort by timestamp (most recent first)
        alertsList.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeB - timeA;
        });

        setAlerts(alertsList);
      } catch (err) {
        console.error('Failed to fetch security alerts:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();

    // Refresh alerts periodically
    const interval = setInterval(fetchAlerts, 60000); // Every minute
    return () => clearInterval(interval);
  }, [user?.id]);

  return { 
    alerts, 
    loading, 
    error,
    refetch: async () => {
      if (user?.id) {
        try {
          const sessions = await getUserSessions(user.id);
          const alertsList = [];

          sessions.forEach(session => {
            const lastUpdate = new Date(session.updatedAt || session.createdAt).getTime();
            const daysSinceUpdate = (Date.now() - lastUpdate) / (1000 * 60 * 60 * 24);
            
            if (daysSinceUpdate > 90) {
              alertsList.push({
                id: `session-stale-${session.sessionId}`,
                title: 'Stale Session Detected',
                message: `Session ${session.sessionId.substring(0, 8)}... has been inactive for ${Math.floor(daysSinceUpdate)} days`,
                severity: 'low',
                timestamp: session.updatedAt || session.createdAt,
                sessionId: session.sessionId
              });
            }
          });

          alertsList.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA;
          });

          setAlerts(alertsList);
        } catch (err) {
          console.error('Failed to refetch alerts:', err);
        }
      }
    }
  };
}


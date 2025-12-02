import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserSessions } from '../crypto/sessionManager';
import api from '../services/api';
import { getAccessToken } from '../utils/tokenStore';

/**
 * Hook to fetch audit logs from API
 */
export function useLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) {
      setLogs([]);
      setLoading(false);
      return;
    }

    // Don't fetch if not authenticated
    const token = getAccessToken();
    if (!token) {
      setLogs([]);
      setLoading(false);
      return;
    }

    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get all sessions to fetch audit trails
        const sessions = await getUserSessions(user.id);
        
        // Fetch audit trails for each session
        const allLogs = [];
        
        for (const session of sessions.slice(0, 10)) { // Limit to first 10 sessions
          try {
            const response = await api.get(`/audit/session/${session.sessionId}`);
            if (response.data.success && response.data.data.auditTrail) {
              const auditTrail = response.data.data.auditTrail;
              
              // Transform audit trail entries to log format
              auditTrail.forEach(entry => {
                allLogs.push({
                  id: `${entry.messageId}-${entry.timestamp}`,
                  title: entry.action,
                  message: `Action: ${entry.action} on message ${entry.messageId.substring(0, 8)}...`,
                  level: entry.action.includes('error') || entry.action.includes('failed') ? 'error' :
                         entry.action.includes('warning') ? 'warning' :
                         entry.action.includes('success') ? 'success' : 'info',
                  timestamp: entry.timestamp,
                  source: entry.changedBy || 'System',
                  sessionId: session.sessionId,
                  messageId: entry.messageId
                });
              });
            }
          } catch (sessionErr) {
            // Skip sessions that fail (might not have audit trail)
            console.warn(`Failed to fetch audit trail for session ${session.sessionId}:`, sessionErr);
          }
        }

        // Sort by timestamp (most recent first)
        allLogs.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeB - timeA;
        });

        // Limit to most recent 100 logs
        setLogs(allLogs.slice(0, 100));
      } catch (err) {
        console.error('Failed to fetch logs:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();

    // Refresh logs periodically
    const interval = setInterval(fetchLogs, 120000); // Every 2 minutes
    return () => clearInterval(interval);
  }, [user?.id]);

  return { 
    logs, 
    loading, 
    error,
    refetch: async () => {
      if (user?.id) {
        try {
          const sessions = await getUserSessions(user.id);
          const allLogs = [];
          
          for (const session of sessions.slice(0, 10)) {
            try {
              const response = await api.get(`/audit/session/${session.sessionId}`);
              if (response.data.success && response.data.data.auditTrail) {
                const auditTrail = response.data.data.auditTrail;
                auditTrail.forEach(entry => {
                  allLogs.push({
                    id: `${entry.messageId}-${entry.timestamp}`,
                    title: entry.action,
                    message: `Action: ${entry.action} on message ${entry.messageId.substring(0, 8)}...`,
                    level: entry.action.includes('error') || entry.action.includes('failed') ? 'error' :
                           entry.action.includes('warning') ? 'warning' :
                           entry.action.includes('success') ? 'success' : 'info',
                    timestamp: entry.timestamp,
                    source: entry.changedBy || 'System',
                    sessionId: session.sessionId,
                    messageId: entry.messageId
                  });
                });
              }
            } catch (sessionErr) {
              console.warn(`Failed to fetch audit trail for session ${session.sessionId}:`, sessionErr);
            }
          }

          allLogs.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA;
          });

          setLogs(allLogs.slice(0, 100));
        } catch (err) {
          console.error('Failed to refetch logs:', err);
        }
      }
    }
  };
}


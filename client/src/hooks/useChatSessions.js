import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatChatTimestamp } from '../utils/formatTime';

/**
 * Hook to fetch and manage chat sessions
 * Fetches sessions from backend API (MongoDB) instead of only IndexedDB
 */
export function useChatSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessions = async () => {
    if (!user?.id) {
      console.log('[useChatSessions] No user ID, clearing sessions');
      setSessions([]);
      setLoading(false);
      return;
    }

    try {
      console.log(`[useChatSessions] Fetching sessions for user ${user.id} from backend API...`);
      setLoading(true);
      setError(null);
      
      // Call backend API to get sessions from MongoDB
      const response = await api.get('/sessions');
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch sessions');
      }

      const backendSessions = response.data.data.sessions || [];
      console.log(`[useChatSessions] ✓ Received ${backendSessions.length} sessions from backend`);

      // Transform sessions into chat list format
      const formattedSessions = backendSessions.map(session => {
        const formatted = {
          id: session.sessionId,
          sessionId: session.sessionId,
          name: session.peerEmail || session.peerId || 'Unknown User',
          lastMessage: 'No messages yet',
          timestamp: formatChatTimestamp(session.lastActivity || session.updatedAt || session.createdAt),
          unreadCount: 0, // Could be calculated from message metadata
          avatar: null, // Could be fetched from user profile
          peerId: session.peerId,
          peerEmail: session.peerEmail,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          lastActivity: session.lastActivity
        };
        console.log(`[useChatSessions] Formatted session ${session.sessionId}: peerId=${formatted.peerId}, peerEmail=${formatted.peerEmail}`);
        return formatted;
      });

      // Sort by most recent activity
      formattedSessions.sort((a, b) => {
        const timeA = new Date(a.lastActivity || a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.lastActivity || b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      console.log(`[useChatSessions] ✓ Setting ${formattedSessions.length} sessions in state`);
      setSessions(formattedSessions);
    } catch (err) {
      console.error('[useChatSessions] ✗ Failed to fetch sessions:', err);
      setError(err.message || 'Failed to load sessions');
      setSessions([]); // Clear sessions on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();

    // Refresh sessions periodically
    const interval = setInterval(fetchSessions, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [user?.id]);

  return { 
    sessions, 
    loading, 
    error, 
    refetch: fetchSessions
  };
}


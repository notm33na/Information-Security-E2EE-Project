import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserSessions } from '../crypto/sessionManager';
import { formatChatTimestamp } from '../utils/formatTime';

/**
 * Hook to fetch and manage chat sessions
 */
export function useChatSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const fetchSessions = async () => {
      try {
        setLoading(true);
        setError(null);
        const userSessions = await getUserSessions(user.id);
        
        // Transform sessions into chat list format
        const formattedSessions = userSessions.map(session => ({
          id: session.sessionId,
          sessionId: session.sessionId,
          name: session.peerId || 'Unknown User', // You might want to fetch peer name from API
          lastMessage: 'No messages yet',
          timestamp: formatChatTimestamp(session.updatedAt || session.createdAt),
          unreadCount: 0, // Could be calculated from message metadata
          avatar: null, // Could be fetched from user profile
          peerId: session.peerId,
          userId: session.userId,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
        }));

        // Sort by most recent update
        formattedSessions.sort((a, b) => {
          const timeA = new Date(a.timestamp || 0).getTime();
          const timeB = new Date(b.timestamp || 0).getTime();
          return timeB - timeA;
        });

        setSessions(formattedSessions);
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();

    // Refresh sessions periodically
    const interval = setInterval(fetchSessions, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [user?.id]);

  return { sessions, loading, error, refetch: () => {
    if (user?.id) {
      getUserSessions(user.id).then(userSessions => {
        const formattedSessions = userSessions.map(session => ({
          id: session.sessionId,
          sessionId: session.sessionId,
          name: session.peerId || 'Unknown User',
          lastMessage: 'No messages yet',
          timestamp: formatChatTimestamp(session.updatedAt || session.createdAt),
          unreadCount: 0,
          avatar: null,
          peerId: session.peerId,
          userId: session.userId,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
        }));
        formattedSessions.sort((a, b) => {
          const timeA = new Date(a.timestamp || 0).getTime();
          const timeB = new Date(b.timestamp || 0).getTime();
          return timeB - timeA;
        });
        setSessions(formattedSessions);
      }).catch(err => {
        console.error('Failed to refetch sessions:', err);
        setError(err.message);
      });
    }
  }};
}


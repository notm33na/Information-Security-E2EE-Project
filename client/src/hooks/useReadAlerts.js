import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const READ_ALERTS_KEY = 'read_alerts';

/**
 * Hook to manage read status of security alerts
 * Stores read alert IDs in localStorage per user
 */
export function useReadAlerts() {
  const { user } = useAuth();
  const [readAlerts, setReadAlerts] = useState(new Set());

  // Load read alerts from localStorage on mount and when user changes
  useEffect(() => {
    if (!user?.id) {
      setReadAlerts(new Set());
      return;
    }

    try {
      const key = `${READ_ALERTS_KEY}_${user.id}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const readIds = JSON.parse(stored);
        setReadAlerts(new Set(readIds));
      } else {
        setReadAlerts(new Set());
      }
    } catch (error) {
      console.error('[useReadAlerts] Failed to load read alerts:', error);
      setReadAlerts(new Set());
    }
  }, [user?.id]);

  // Save read alerts to localStorage
  const saveReadAlerts = useCallback((readIds) => {
    if (!user?.id) return;
    
    try {
      const key = `${READ_ALERTS_KEY}_${user.id}`;
      localStorage.setItem(key, JSON.stringify(Array.from(readIds)));
    } catch (error) {
      console.error('[useReadAlerts] Failed to save read alerts:', error);
    }
  }, [user?.id]);

  // Mark an alert as read
  const markAsRead = useCallback((alertId) => {
    if (!alertId) return;
    
    setReadAlerts(prev => {
      const updated = new Set(prev);
      updated.add(alertId);
      saveReadAlerts(updated);
      return updated;
    });
  }, [saveReadAlerts]);

  // Mark multiple alerts as read
  const markAllAsRead = useCallback((alertIds) => {
    if (!alertIds || alertIds.length === 0) return;
    
    setReadAlerts(prev => {
      const updated = new Set(prev);
      alertIds.forEach(id => {
        if (id) updated.add(id);
      });
      saveReadAlerts(updated);
      return updated;
    });
  }, [saveReadAlerts]);

  // Check if an alert is read
  const isRead = useCallback((alertId) => {
    if (!alertId) return false;
    return readAlerts.has(alertId);
  }, [readAlerts]);

  // Clear all read alerts (for testing/debugging)
  const clearReadAlerts = useCallback(() => {
    if (!user?.id) return;
    
    try {
      const key = `${READ_ALERTS_KEY}_${user.id}`;
      localStorage.removeItem(key);
      setReadAlerts(new Set());
    } catch (error) {
      console.error('[useReadAlerts] Failed to clear read alerts:', error);
    }
  }, [user?.id]);

  return {
    isRead,
    markAsRead,
    markAllAsRead,
    clearReadAlerts,
    readCount: readAlerts.size
  };
}

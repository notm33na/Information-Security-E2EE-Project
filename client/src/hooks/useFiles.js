import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatFileTimestamp } from '../utils/formatTime';
import { getAccessToken } from '../utils/tokenStore';

/**
 * Hook to fetch file metadata from messages
 */
export function useFiles() {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) {
      setFiles([]);
      setLoading(false);
      return;
    }

    // Don't fetch if not authenticated
    const token = getAccessToken();
    if (!token) {
      setFiles([]);
      setLoading(false);
      return;
    }

    const fetchFiles = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Try to fetch from files endpoint first (for uploaded files)
        let response;
        try {
          response = await api.get('/files');
        } catch (err) {
          // If files endpoint doesn't exist or fails, fall back to messages
          if (err.response?.status === 404 || err.response?.status === 403) {
            // Fall back to fetching from messages
            try {
              response = await api.get(`/messages/pending/${user.id}`);
            } catch (msgErr) {
              if (msgErr.response?.status === 403) {
                console.warn('Access denied. User may need to re-authenticate.');
                setError('Access denied. Please refresh the page.');
                setFiles([]);
                setLoading(false);
                return;
              }
              throw msgErr;
            }
            
            if (response.data.success) {
              const messages = response.data.data.messages || [];
              const fileMessages = messages.filter(msg => msg.type === 'FILE_META');
              
              const formattedFiles = fileMessages.map(msg => ({
                id: msg.messageId,
                name: msg.meta?.filename || 'Unknown file',
                size: msg.meta?.size || 0,
                type: msg.meta?.mimetype || 'application/octet-stream',
                encrypted: true,
                uploadedAt: formatFileTimestamp(msg.createdAt || msg.timestamp),
                uploadedAtRaw: msg.createdAt || msg.timestamp,
                sessionId: msg.sessionId,
                messageId: msg.messageId
              }));

              formattedFiles.sort((a, b) => {
                const timeA = new Date(a.uploadedAtRaw).getTime();
                const timeB = new Date(b.uploadedAtRaw).getTime();
                return timeB - timeA;
              });

              setFiles(formattedFiles);
            }
            return;
          }
          throw err;
        }
        
        if (response.data.success) {
          // Files endpoint response
          const fileList = response.data.data.files || [];
          
          // Transform to file format
          // Only include files that have a fileId (uploaded to storage)
          const formattedFiles = fileList
            .filter(file => file.fileId) // Only files with fileId can be downloaded/deleted
            .map(file => ({
              id: file.id,
              fileId: file.fileId,
              name: file.name,
              size: file.size,
              type: file.type,
              encrypted: true,
              uploadedAt: formatFileTimestamp(file.uploadedAt),
              uploadedAtRaw: file.uploadedAt,
              sessionId: file.sessionId,
              messageId: file.id
            }));

          // Sort by most recent
          formattedFiles.sort((a, b) => {
            const timeA = new Date(a.uploadedAtRaw).getTime();
            const timeB = new Date(b.uploadedAtRaw).getTime();
            return timeB - timeA;
          });

          setFiles(formattedFiles);
        }
      } catch (err) {
        console.error('Failed to fetch files:', err);
        setError(err.message);
        // Don't set error state if it's just no files found
        if (err.response?.status !== 404) {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();

    // Refresh files periodically
    const interval = setInterval(fetchFiles, 60000); // Every minute
    return () => clearInterval(interval);
  }, [user?.id]);

  // Calculate total storage used
  const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
  const totalSizeGB = totalSize / (1024 * 1024 * 1024); // Convert to GB
  const maxStorageGB = 10; // 10 GB limit

  return { 
    files, 
    loading, 
    error, 
    totalSize,
    totalSizeGB,
    maxStorageGB,
    storageUsed: (totalSizeGB / maxStorageGB) * 100,
    refetch: async () => {
      if (user?.id) {
        try {
          setLoading(true);
          setError(null);
          
          // Try files endpoint first
          let response;
          try {
            response = await api.get('/files');
          } catch (err) {
            // Fall back to messages endpoint
            if (err.response?.status === 404 || err.response?.status === 403) {
              response = await api.get(`/messages/pending/${user.id}`);
            } else {
              throw err;
            }
          }
          
          if (response.data.success) {
            // Check if it's files endpoint response
            if (response.data.data.files) {
              const fileList = response.data.data.files || [];
              // Only include files that have a fileId (uploaded to storage)
              const formattedFiles = fileList
                .filter(file => file.fileId) // Only files with fileId can be downloaded/deleted
                .map(file => ({
                  id: file.id,
                  fileId: file.fileId,
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  encrypted: true,
                  uploadedAt: formatFileTimestamp(file.uploadedAt),
                  uploadedAtRaw: file.uploadedAt,
                  sessionId: file.sessionId,
                  messageId: file.id
                }));
              
              formattedFiles.sort((a, b) => {
                const timeA = new Date(a.uploadedAtRaw).getTime();
                const timeB = new Date(b.uploadedAtRaw).getTime();
                return timeB - timeA;
              });
              
              setFiles(formattedFiles);
            } else {
              // Messages endpoint response
              const messages = response.data.data.messages || [];
              const fileMessages = messages.filter(msg => msg.type === 'FILE_META');
              const formattedFiles = fileMessages.map(msg => ({
                id: msg.messageId,
                name: msg.meta?.filename || 'Unknown file',
                size: msg.meta?.size || 0,
                type: msg.meta?.mimetype || 'application/octet-stream',
                encrypted: true,
                uploadedAt: formatFileTimestamp(msg.createdAt || msg.timestamp),
                uploadedAtRaw: msg.createdAt || msg.timestamp,
                sessionId: msg.sessionId,
                messageId: msg.messageId
              }));
              
              formattedFiles.sort((a, b) => {
                const timeA = new Date(a.uploadedAtRaw).getTime();
                const timeB = new Date(b.uploadedAtRaw).getTime();
                return timeB - timeA;
              });
              
              setFiles(formattedFiles);
            }
          }
        } catch (err) {
          console.error('Failed to refetch files:', err);
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }
    }
  };
}


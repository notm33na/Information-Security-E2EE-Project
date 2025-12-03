import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { sendEncryptedMessage } from '../crypto/messageFlow.js';
import { handleIncomingMessage } from '../crypto/messageFlow.js';
import { encryptFile } from '../crypto/fileEncryption.js';
import { decryptFile } from '../crypto/fileDecryption.js';
import {
  loadSession,
  setReplayDetectionCallback,
  setInvalidSignatureCallback,
} from '../crypto/sessionManager.js';
import { storeMessage, loadMessages } from '../utils/messageStorage.js';
import { initiateSession, handleKEPInit } from '../crypto/sessionEstablishment.js';

/**
 * Custom hook for chat functionality
 * @param {string} sessionId - Session identifier
 * @param {Object} socket - Socket.IO socket instance
 * @returns {Object} Chat functions and state
 */
export function useChat(sessionId, socket, peerId = null) {
  const { user, getCachedPassword } = useAuth();
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]); // Pending file reconstructions
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [isEstablishingSession, setIsEstablishingSession] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  const [fileProgress, setFileProgress] = useState(null); // {filename, progress, speed, timeRemaining, type}
  const [errors, setErrors] = useState([]); // Array of error objects
  const fileChunksRef = useRef(new Map()); // sessionId -> {meta, chunks}
  
  // Load persisted messages on mount
  useEffect(() => {
    if (!sessionId) return;

    const loadPersistedMessages = async () => {
      try {
        const persistedMessages = await loadMessages(sessionId);
        if (persistedMessages.length > 0) {
          // Sort by sequence number
          const sorted = persistedMessages.sort((a, b) => (a.seq || 0) - (b.seq || 0));
          setMessages(sorted);
        }
      } catch (error) {
        console.error('Failed to load persisted messages:', error);
      }
    };

    loadPersistedMessages();
  }, [sessionId]);

  // Handle incoming messages
  useEffect(() => {
    if (!socket || !sessionId) return;

    const handleMessage = async (envelope) => {
      try {
        setIsDecrypting(true);

        const result = await handleIncomingMessage(envelope);

        if (result.valid) {
          if (envelope.type === 'MSG') {
            // Text message
            const newMessage = {
              id: `${envelope.sessionId}-${envelope.seq}`,
              type: 'text',
              content: result.plaintext,
              sender: envelope.sender,
              timestamp: envelope.timestamp,
              seq: envelope.seq
            };
            
            // Add to state (sorted by sequence)
            setMessages(prev => {
              const updated = [...prev, newMessage].sort((a, b) => (a.seq || 0) - (b.seq || 0));
              return updated;
            });
            
            // Persist to IndexedDB
            storeMessage(envelope.sessionId, newMessage);
          } else if (envelope.type === 'FILE_META') {
            // File metadata - start file reconstruction
            const fileId = `${envelope.sessionId}-${envelope.seq}`;
            fileChunksRef.current.set(fileId, {
              meta: envelope,
              chunks: []
            });
          } else if (envelope.type === 'FILE_CHUNK') {
            // File chunk - find matching file metadata by sessionId
            // We need to find the most recent FILE_META for this session
            let fileData = null;
            let fileId = null;
            
            // Find the file metadata entry
            for (const [id, data] of fileChunksRef.current.entries()) {
              if (data.meta.sessionId === envelope.sessionId && 
                  data.meta.meta.totalChunks === envelope.meta.totalChunks) {
                fileData = data;
                fileId = id;
                break;
              }
            }
            
            if (fileData) {
              // Sort chunks by index and add
              fileData.chunks.push(envelope);
              fileData.chunks.sort((a, b) => a.meta.chunkIndex - b.meta.chunkIndex);
              
              // Check if all chunks received
              if (fileData.chunks.length === fileData.meta.meta.totalChunks) {
                try {
                  // Show reassembly progress
                  setFileProgress({
                    filename: 'Reassembling file...',
                    progress: 0,
                    type: 'reassemble'
                  });

                  // Decrypt and reconstruct file with progress tracking
                  let reassemblyFilename = 'Reassembling file...';
                  const decrypted = await decryptFile(
                    fileData.meta, 
                    fileData.chunks, 
                    sessionId,
                    null,
                    (chunkIndex, totalChunks, progress, speed, timeRemaining) => {
                      setFileProgress({
                        filename: reassemblyFilename,
                        progress,
                        speed,
                        timeRemaining,
                        type: 'reassemble'
                      });
                    }
                  );
                  
                  // Update filename once we have it
                  reassemblyFilename = decrypted.filename;
                  
                  setFiles(prev => [...prev, {
                    id: fileId,
                    filename: decrypted.filename,
                    blob: decrypted.blob,
                    mimetype: decrypted.mimetype,
                    size: decrypted.size,
                    timestamp: envelope.timestamp
                  }]);

                  // Clear progress
                  setFileProgress(null);

                  // Clean up
                  fileChunksRef.current.delete(fileId);
                } catch (error) {
                  console.error('Failed to decrypt file:', error);
                  setFileProgress(null);
                  setErrors(prev => [...prev, {
                    id: `file-error-${Date.now()}`,
                    title: 'File Decryption Failed',
                    message: error.message || 'Failed to decrypt and reassemble file',
                    variant: 'destructive',
                    timestamp: Date.now()
                  }]);
                }
              }
            } else {
              console.warn('Received FILE_CHUNK without matching FILE_META');
            }
          }
        } else {
          // Log technical error but show user-friendly message
          const technicalError = result.technicalError || result.error;
          const userError = result.error || 'Failed to process message';
          console.error('Invalid message:', technicalError);
          
          // Show error to user (except replay/duplicate which are handled silently)
          if (result.error && !result.error.includes('replay') && !result.error.includes('duplicate')) {
            setErrors(prev => [...prev, {
              id: `msg-error-${Date.now()}`,
              title: 'Message Processing Failed',
              message: userError,
              variant: 'destructive',
              timestamp: Date.now()
            }]);
          }
        }
      } catch (error) {
        // Log technical error for debugging
        const technicalMessage = error.technicalMessage || error.message;
        console.error('Error handling message:', technicalMessage);
        
        // Show user-friendly error
        const userMessage = error.userMessage || 'Failed to process message';
        setErrors(prev => [...prev, {
          id: `error-${Date.now()}`,
          title: 'Error',
          message: userMessage,
          variant: 'destructive',
          timestamp: Date.now()
        }]);
      } finally {
        setIsDecrypting(false);
      }
    };

    socket.on('msg:receive', handleMessage);

    // Handle KEP_INIT messages
    const handleKEPInitMessage = async (kepInitMessage) => {
      if (!user?.id || !socket) return;
      
      try {
        const password = getCachedPassword(user.id);
        if (!password) {
          console.error('Password not cached for session establishment');
          setSessionError('Password required for session establishment');
          return;
        }

        await handleKEPInit(kepInitMessage, user.id, password, socket);
        setSessionError(null);
      } catch (error) {
        console.error('Failed to handle KEP_INIT:', error);
        setSessionError(error.message || 'Failed to establish session');
      }
    };

    socket.on('kep:init', handleKEPInitMessage);

    return () => {
      socket.off('msg:receive', handleMessage);
      socket.off('kep:init', handleKEPInitMessage);
    };
  }, [socket, sessionId, user, getCachedPassword]);

  // Wire replay/invalid-signature detection into UI-level security events
  useEffect(() => {
    // Replay detection: sequence/timestamp violations
    setReplayDetectionCallback((sid, message) => {
      if (!sid || sid !== sessionId) return;

      setSecurityEvents((prev) => [
        ...prev,
        {
          id: `replay-${sid}-${message.seq || Date.now()}`,
          type: 'replay',
          sessionId: sid,
          reason: message.reason || 'Replay attempt detected',
          timestamp: Date.now(),
        },
      ]);
    });

    // Invalid signature / integrity failures
    setInvalidSignatureCallback((sid, message) => {
      if (!sid || sid !== sessionId) return;

      setSecurityEvents((prev) => [
        ...prev,
        {
          id: `invalid-${sid}-${message.seq || Date.now()}`,
          type: 'integrity',
          sessionId: sid,
          reason: message.reason || 'Message integrity check failed',
          timestamp: Date.now(),
        },
      ]);
    });

    // No explicit teardown needed – callbacks are overwritten when sessionId changes
  }, [sessionId]);

  /**
   * Sends an encrypted text message
   */
  const sendMessage = useCallback(async (plaintext) => {
    if (!socket || !sessionId || !plaintext.trim()) {
      return;
    }

    try {
      const envelope = await sendEncryptedMessage(sessionId, plaintext, (event, data) => {
        socket.emit(event, data);
      });

      // Add to local messages immediately (optimistic update, sorted by sequence)
      const newMessage = {
        id: `${sessionId}-${envelope.seq}`,
        type: 'text',
        content: plaintext,
        sender: user.id,
        timestamp: envelope.timestamp,
        seq: envelope.seq,
        sent: true
      };
      
      setMessages(prev => {
        const updated = [...prev, newMessage].sort((a, b) => (a.seq || 0) - (b.seq || 0));
        return updated;
      });
      
      // Persist to IndexedDB
      storeMessage(sessionId, newMessage);
    } catch (error) {
      // Log technical error for debugging
      const technicalMessage = error.technicalMessage || error.message;
      console.error('Failed to send message:', technicalMessage);
      
      // Re-throw with user-friendly message if available
      if (error.userMessage) {
        const userError = new Error(error.userMessage);
        userError.technicalMessage = technicalMessage;
        userError.originalError = error;
        throw userError;
      }
      throw error;
    }
  }, [socket, sessionId, user]);

  /**
   * Sends an encrypted file
   */
  const sendFile = useCallback(async (file, receiverId) => {
    if (!socket || !sessionId || !file) {
      return;
    }

    try {
      const session = await loadSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Show upload progress
      setFileProgress({
        filename: file.name,
        progress: 0,
        type: 'upload'
      });

      // Encrypt file with progress tracking
      const { fileMetaEnvelope, chunkEnvelopes } = await encryptFile(
        file,
        sessionId,
        session.userId,
        receiverId || session.peerId,
        null,
        (chunkIndex, totalChunks, progress, speed, timeRemaining) => {
          setFileProgress({
            filename: file.name,
            progress,
            speed,
            timeRemaining,
            type: 'upload'
          });
        }
      );

      // Send metadata first
      socket.emit('msg:send', fileMetaEnvelope);

      // Send chunks with progress
      const totalChunks = chunkEnvelopes.length;
      for (let i = 0; i < chunkEnvelopes.length; i++) {
        socket.emit('msg:send', chunkEnvelopes[i]);
        
        // Update progress (50% encryption, 50% upload)
        const uploadProgress = 50 + ((i + 1) / totalChunks) * 50;
        setFileProgress(prev => prev ? {
          ...prev,
          progress: uploadProgress
        } : null);
      }

      // Clear progress
      setFileProgress(null);
      console.log(`✓ File sent: ${file.name}`);
    } catch (error) {
      // Clear progress on error
      setFileProgress(null);
      
      // Log technical error for debugging
      const technicalMessage = error.technicalMessage || error.message;
      console.error('Failed to send file:', technicalMessage);
      
      // Show error to user
      const userMessage = error.userMessage || error.message || 'Failed to send file';
      setErrors(prev => [...prev, {
        id: `file-send-error-${Date.now()}`,
        title: 'File Send Failed',
        message: userMessage,
        variant: 'destructive',
        timestamp: Date.now()
      }]);
      
      // Re-throw with user-friendly message if available
      if (error.userMessage) {
        const userError = new Error(error.userMessage);
        userError.technicalMessage = technicalMessage;
        userError.originalError = error;
        throw userError;
      }
      throw error;
    }
  }, [socket, sessionId]);

  // Check if session exists and establish if needed
  useEffect(() => {
    if (!sessionId || !user?.id || !socket || !peerId || isEstablishingSession) return;

    const checkAndEstablishSession = async () => {
      try {
        const password = getCachedPassword(user.id);
        if (!password) {
          console.warn('Password not cached - session establishment may fail');
          return;
        }

        // Check if session exists
        const session = await loadSession(sessionId, user.id, password);
        if (session) {
          setSessionError(null);
          return; // Session exists
        }

        // Session doesn't exist - establish it
        setIsEstablishingSession(true);
        setSessionError(null);

        try {
          await initiateSession(user.id, peerId, password, socket);
          setSessionError(null);
        } catch (error) {
          console.error('Failed to establish session:', error);
          setSessionError(error.message || 'Failed to establish secure session');
        } finally {
          setIsEstablishingSession(false);
        }
      } catch (error) {
        console.error('Session check error:', error);
        setSessionError(error.message || 'Failed to check session');
        setIsEstablishingSession(false);
      }
    };

    checkAndEstablishSession();
  }, [sessionId, user?.id, peerId, socket, getCachedPassword, isEstablishingSession]);

  // Remove old errors (older than 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setErrors(prev => prev.filter(err => Date.now() - err.timestamp < 10000));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    messages,
    files,
    isDecrypting,
    sendMessage,
    sendFile,
    securityEvents,
    isEstablishingSession,
    sessionError,
    fileProgress,
    errors,
    clearError: (errorId) => {
      setErrors(prev => prev.filter(err => err.id !== errorId));
    }
  };
}


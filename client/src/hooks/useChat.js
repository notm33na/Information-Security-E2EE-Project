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
import { useConnectionState } from './useConnectionState.js';
import { queueMessage, getQueuedMessages, removeQueuedMessage, incrementQueueAttempt } from '../utils/messageQueue.js';

/**
 * Custom hook for chat functionality
 * @param {string} sessionId - Session identifier
 * @param {Object} socket - Socket.IO socket instance
 * @returns {Object} Chat functions and state
 */
export function useChat(sessionId, socket, peerId = null) {
  const { user, getCachedPassword, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]); // Pending file reconstructions
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [isEstablishingSession, setIsEstablishingSession] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  const [fileProgress, setFileProgress] = useState(null); // {filename, progress, speed, timeRemaining, type}
  const [errors, setErrors] = useState([]); // Array of error objects
  const fileChunksRef = useRef(new Map()); // sessionId -> {meta, chunks}
  const sessionRetryRef = useRef(0); // Track retry attempts
  const sessionRetryTimeoutRef = useRef(null); // Track retry timeout
  const sessionEstablishmentInProgressRef = useRef(false); // Prevent duplicate establishment calls
  
  // Connection state management
  const { isConnected, connectionError, reconnect } = useConnectionState(socket);
  
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
        console.log(`[useChat] Received message: type=${envelope.type}, sessionId=${envelope.sessionId}, seq=${envelope.seq}, sender=${envelope.sender}, receiver=${envelope.receiver}`);
        setIsDecrypting(true);

        const result = await handleIncomingMessage(envelope);

        if (result.valid) {
          if (envelope.type === 'MSG') {
            // Text message - use unique ID format matching server: sessionId:seq:timestamp
            const messageId = `${envelope.sessionId}:${envelope.seq}:${envelope.timestamp}`;
            const newMessage = {
              id: messageId,
              type: 'text',
              content: result.plaintext,
              sender: envelope.sender,
              timestamp: envelope.timestamp,
              seq: envelope.seq
            };
            
            // Add to state (check for duplicates first, sorted by sequence)
            setMessages(prev => {
              // Check if message already exists
              const exists = prev.some(msg => msg.id === messageId);
              if (exists) {
                console.warn('Duplicate message detected, skipping:', messageId);
                return prev;
              }
              const updated = [...prev, newMessage].sort((a, b) => (a.seq || 0) - (b.seq || 0));
              return updated;
            });
            
            // Persist to IndexedDB
            storeMessage(envelope.sessionId, newMessage);
          } else if (envelope.type === 'FILE_META') {
            // File metadata - start file reconstruction
            // Use a unique file ID based on sessionId and timestamp to handle multiple files
            const fileId = `${envelope.sessionId}-file-${envelope.timestamp}-${envelope.seq}`;
            fileChunksRef.current.set(fileId, {
              meta: envelope,
              chunks: [],
              receivedAt: Date.now()
            });
            console.log(`✓ File metadata received: ${fileId}, expecting ${envelope.meta?.totalChunks || 'unknown'} chunks`);
            console.log('FILE_META envelope details:', {
              sessionId: envelope.sessionId,
              sender: envelope.sender,
              receiver: envelope.receiver,
              timestamp: envelope.timestamp,
              seq: envelope.seq,
              hasCiphertext: !!envelope.ciphertext,
              hasIV: !!envelope.iv,
              hasAuthTag: !!envelope.authTag,
              meta: envelope.meta
            });
          } else if (envelope.type === 'FILE_CHUNK') {
            // File chunk - NOTE: This envelope has already been validated by handleIncomingMessage()
            // above, which applies replay protection (timestamp ±2min, sequence validation, nonce uniqueness)
            // per spec requirement #8. The chunk is decrypted in handleIncomingMessage() but we store
            // the envelope here and decrypt again in decryptFile() for reassembly.
            // Find matching file metadata by sessionId and timestamp proximity
            console.log(`✓ FILE_CHUNK received: chunkIndex=${envelope.meta?.chunkIndex}, totalChunks=${envelope.meta?.totalChunks}, sessionId=${envelope.sessionId}, timestamp=${envelope.timestamp}`);
            
            let fileData = null;
            let fileId = null;
            
            // Find the file metadata entry - match by sessionId and similar timestamp (within 5 seconds)
            const chunkTimestamp = envelope.timestamp;
            console.log(`Looking for matching FILE_META. Current fileChunksRef entries:`, Array.from(fileChunksRef.current.keys()));
            
            for (const [id, data] of fileChunksRef.current.entries()) {
              if (!data.meta) {
                console.warn(`File data ${id} has no meta, skipping`);
                continue;
              }
              const timeDiff = Math.abs(data.meta.timestamp - chunkTimestamp);
              const totalChunksMatch = data.meta.meta?.totalChunks === envelope.meta?.totalChunks;
              console.log(`Checking file ${id}: timeDiff=${timeDiff}ms, totalChunksMatch=${totalChunksMatch}, sessionIdMatch=${data.meta.sessionId === envelope.sessionId}`);
              
              if (data.meta.sessionId === envelope.sessionId && 
                  timeDiff < 5000 && // Within 5 seconds
                  totalChunksMatch) {
                fileData = data;
                fileId = id;
                console.log(`✓ Found matching FILE_META: ${fileId}`);
                break;
              }
            }
            
            // If no match found, try to find by sessionId only (fallback)
            if (!fileData) {
              for (const [id, data] of fileChunksRef.current.entries()) {
                if (data.meta.sessionId === envelope.sessionId) {
                  // Use the most recent file metadata
                  if (!fileData || data.receivedAt > fileData.receivedAt) {
                    fileData = data;
                    fileId = id;
                  }
                }
              }
            }
            
            if (fileData) {
              // Check if this chunk is already received (avoid duplicates)
              const isDuplicate = fileData.chunks.some(
                chunk => chunk.meta?.chunkIndex === envelope.meta?.chunkIndex
              );
              
              if (!isDuplicate) {
                // Add chunk
                fileData.chunks.push(envelope);
                fileData.chunks.sort((a, b) => (a.meta?.chunkIndex || 0) - (b.meta?.chunkIndex || 0));
                
                console.log(`File chunk ${envelope.meta?.chunkIndex} received for ${fileId} (${fileData.chunks.length}/${fileData.meta.meta?.totalChunks || '?'})`);
                
                // Check if all chunks received
                const totalChunks = fileData.meta.meta?.totalChunks || 0;
                console.log(`File chunk progress: ${fileData.chunks.length}/${totalChunks} chunks received for ${fileId}`);
                
                if (fileData.chunks.length === totalChunks && totalChunks > 0) {
                  try {
                    console.log(`✓ All chunks received for ${fileId}, starting decryption...`);
                    
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
                      user?.id || null,
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
                    
                    // Add file to state (check for duplicates)
                    setFiles(prev => {
                      const exists = prev.some(f => f.id === fileId);
                      if (exists) {
                        console.warn(`File ${fileId} already exists in state, skipping duplicate`);
                        return prev;
                      }
                      console.log(`✓ Adding file to state: ${decrypted.filename} (${fileId})`);
                      return [...prev, {
                        id: fileId,
                        filename: decrypted.filename,
                        blob: decrypted.blob,
                        mimetype: decrypted.mimetype,
                        size: decrypted.size,
                        timestamp: fileData.meta.timestamp || Date.now(),
                        sender: envelope.sender
                      }];
                    });

                    // Clear progress
                    setFileProgress(null);

                    // Clean up
                    fileChunksRef.current.delete(fileId);
                    console.log(`✓ File decrypted and added to chat: ${decrypted.filename}`);
                  } catch (error) {
                    console.error('Failed to decrypt file:', error);
                    console.error('Error details:', {
                      message: error.message,
                      stack: error.stack,
                      fileId,
                      totalChunks,
                      chunksReceived: fileData.chunks.length
                    });
                    setFileProgress(null);
                    setErrors(prev => [...prev, {
                      id: `file-error-${Date.now()}`,
                      title: 'File Decryption Failed',
                      message: error.message || 'Failed to decrypt and reassemble file',
                      variant: 'destructive',
                      timestamp: Date.now()
                    }]);
                    // Don't delete fileData on error - might retry
                  }
                }
              } else {
                console.log(`Duplicate chunk ${envelope.meta?.chunkIndex} ignored for ${fileId}`);
              }
            } else {
              console.warn('Received FILE_CHUNK without matching FILE_META, storing for later', {
                sessionId: envelope.sessionId,
                chunkIndex: envelope.meta?.chunkIndex,
                totalChunks: envelope.meta?.totalChunks
              });
              // Store chunk temporarily - might receive metadata later
              const tempFileId = `${envelope.sessionId}-temp-${envelope.timestamp}`;
              if (!fileChunksRef.current.has(tempFileId)) {
                fileChunksRef.current.set(tempFileId, {
                  meta: null,
                  chunks: [envelope],
                  receivedAt: Date.now()
                });
                // Clean up temp entries after 30 seconds
                setTimeout(() => {
                  if (fileChunksRef.current.has(tempFileId)) {
                    fileChunksRef.current.delete(tempFileId);
                  }
                }, 30000);
              }
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
      if (!user?.id || !socket) {
        console.warn('[Chat KEP] Cannot handle KEP_INIT: missing user or socket', { hasUser: !!user?.id, hasSocket: !!socket });
        return;
      }
      
      console.log(`[Chat KEP] Received KEP_INIT from ${kepInitMessage?.from} for session ${kepInitMessage?.sessionId}`);
      console.log(`[Chat KEP] Message details:`, {
        from: kepInitMessage?.from,
        to: kepInitMessage?.to,
        sessionId: kepInitMessage?.sessionId,
        ourUserId: user.id,
        messageType: kepInitMessage?.type
      });
      
      try {
        const password = getCachedPassword(user.id);
        if (!password) {
          console.error('[Chat KEP] Password not cached for session establishment - cannot respond to KEP_INIT');
          setSessionError('Password required for session establishment. Please log out and log back in.');
          // Don't return silently - log that we're not responding
          console.warn('[Chat KEP] Not sending KEP_RESPONSE due to missing password cache');
          return;
        }

        console.log(`[Chat KEP] Processing KEP_INIT and preparing KEP_RESPONSE...`);
        await handleKEPInit(kepInitMessage, user.id, password, socket);
        console.log(`[Chat KEP] ✓ Successfully handled KEP_INIT and sent KEP_RESPONSE`);
        setSessionError(null);
      } catch (error) {
        console.error('[Chat KEP] ✗ Failed to handle KEP_INIT:', error);
        console.error('[Chat KEP] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
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
    if (!sessionId || !plaintext.trim()) {
      return;
    }

    try {
      // Ensure session exists before sending
      const password = getCachedPassword(user.id);
      if (!password) {
        // Provide more helpful error message based on authentication state
        if (isAuthenticated) {
          throw new Error('Password cache expired. Please log out and log back in to re-establish your session encryption keys.');
        } else {
          throw new Error('Password not available. Please log in to continue.');
        }
      }

      const session = await loadSession(sessionId, user.id, password);
      if (!session) {
        // Check if session is being established
        if (isEstablishingSession) {
          throw new Error('Session is being established. Please wait a moment and try again.');
        }
        throw new Error('Session not found. Please wait for session establishment to complete.');
      }

      // Build envelope
      const envelope = await sendEncryptedMessage(sessionId, plaintext, (event, data) => {
        // This callback is for internal use during encryption
        // Actual sending happens below
      });
      
      // Send message if connected, otherwise queue it
      if (socket && socket.connected) {
        socket.emit('msg:send', envelope);
      } else {
        // Queue message for later sending
        console.warn('Socket not connected, queueing message');
        await queueMessage(sessionId, envelope, 'text');
        setErrors(prev => [...prev, {
          id: `offline-${Date.now()}`,
          title: 'Message Queued',
          message: 'Message will be sent when connection is restored.',
          variant: 'default',
          timestamp: Date.now()
        }]);
      }

      // Add to local messages immediately (optimistic update, sorted by sequence)
      // Use unique ID format matching server: sessionId:seq:timestamp
      const messageId = `${sessionId}:${envelope.seq}:${envelope.timestamp}`;
      const newMessage = {
        id: messageId,
        type: 'text',
        content: plaintext,
        sender: user.id,
        timestamp: envelope.timestamp,
        seq: envelope.seq,
        sent: true
      };
      
      setMessages(prev => {
        // Check if message already exists (shouldn't happen for sent messages, but be safe)
        const exists = prev.some(msg => msg.id === messageId);
        if (exists) {
          console.warn('Duplicate message detected when sending, skipping:', messageId);
          return prev;
        }
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
        user?.id || session.userId,
        (chunkIndex, totalChunks, progress, speed, timeRemaining) => {
          // Encryption progress (0-50%)
          setFileProgress({
            filename: file.name,
            progress: progress * 0.5, // Encryption is 50% of total
            speed,
            timeRemaining,
            type: 'upload'
          });
        }
      );

      // SECURITY: Validate that file is encrypted before sharing
      const { validateFileEncryption } = await import('../crypto/messageEnvelope.js');
      const metaValidation = validateFileEncryption(fileMetaEnvelope);
      if (!metaValidation.valid) {
        throw new Error(metaValidation.error || 'File encryption validation failed');
      }

      // Validate all chunks are encrypted
      for (const chunkEnvelope of chunkEnvelopes) {
        const chunkValidation = validateFileEncryption(chunkEnvelope);
        if (!chunkValidation.valid) {
          throw new Error(chunkValidation.error || 'File chunk encryption validation failed');
        }
      }

      // Check if socket is connected before sending
      if (!socket.connected) {
        throw new Error('Socket not connected. Please wait for connection to be established.');
      }

      // Send metadata first
      socket.emit('msg:send', fileMetaEnvelope);
      console.log(`✓ File metadata sent: ${file.name} (${chunkEnvelopes.length} chunks)`);

      // Send chunks sequentially with small delay to avoid overwhelming the connection
      const totalChunks = chunkEnvelopes.length;
      for (let i = 0; i < chunkEnvelopes.length; i++) {
        // Check connection before each chunk
        if (!socket.connected) {
          throw new Error('Connection lost while sending file chunks. Please try again.');
        }
        
        socket.emit('msg:send', chunkEnvelopes[i]);
        
        // Update progress (50% encryption done, now 50-100% upload)
        const uploadProgress = 50 + ((i + 1) / totalChunks) * 50;
        setFileProgress(prev => prev ? {
          ...prev,
          progress: uploadProgress,
          type: 'upload'
        } : null);
        
        // Small delay between chunks to avoid overwhelming the connection
        if (i < chunkEnvelopes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Clear progress
      setFileProgress(null);
      console.log(`✓ File sent: ${file.name} (${totalChunks} chunks)`);
      
      // Add file to sender's own state so they can see it in chat
      // Decrypt the file for display (sender can see their own sent files)
      try {
        const { decryptFile } = await import('../crypto/fileDecryption.js');
        const decrypted = await decryptFile(
          fileMetaEnvelope,
          chunkEnvelopes,
          sessionId,
          user?.id || session.userId
        );
        
        // Add to files state for display
        const fileId = `${sessionId}-file-${fileMetaEnvelope.timestamp}-${fileMetaEnvelope.seq}`;
        setFiles(prev => {
          // Check if file already exists (avoid duplicates)
          const exists = prev.some(f => f.id === fileId);
          if (exists) {
            return prev;
          }
          return [...prev, {
            id: fileId,
            filename: decrypted.filename,
            blob: decrypted.blob,
            mimetype: decrypted.mimetype,
            size: decrypted.size,
            timestamp: fileMetaEnvelope.timestamp || Date.now(),
            sender: user?.id || session.userId
          }];
        });
        
        console.log(`✓ File added to sender's view: ${decrypted.filename}`);
      } catch (decryptError) {
        // If decryption fails, still show file was sent but log the error
        console.warn('Failed to decrypt sent file for display:', decryptError);
        // Add file metadata without blob for display
        const fileId = `${sessionId}-file-${fileMetaEnvelope.timestamp}-${fileMetaEnvelope.seq}`;
        setFiles(prev => {
          const exists = prev.some(f => f.id === fileId);
          if (exists) {
            return prev;
          }
          return [...prev, {
            id: fileId,
            filename: file.name,
            mimetype: file.type || 'application/octet-stream',
            size: file.size,
            timestamp: fileMetaEnvelope.timestamp || Date.now(),
            sender: user?.id || session.userId,
            blob: null // Will need to be decrypted when downloaded
          }];
        });
      }
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
    if (!sessionId || !user?.id || !socket || isEstablishingSession) return;
    
    // Prevent duplicate calls - if establishment is already in progress, skip
    if (sessionEstablishmentInProgressRef.current) {
      console.log(`[useChat] Session establishment already in progress for ${sessionId}, skipping duplicate call`);
      return;
    }

    // If peerId is not set, we can't establish a new session
    // But we can still check if an existing session exists
    if (!peerId) {
      // Try to load existing session without peerId
      const checkExistingSession = async () => {
        try {
          const password = getCachedPassword(user.id);
          if (password) {
            const session = await loadSession(sessionId, user.id, password);
            if (session && session.peerId) {
              // Session exists, no error
              setSessionError(null);
            }
          }
        } catch (error) {
          // Session doesn't exist or can't be loaded - that's OK, we'll wait for peerId
          console.log('No existing session found, waiting for peerId to establish new session');
        }
      };
      checkExistingSession();
      return;
    }

    const checkAndEstablishSession = async () => {
      // Check if we're rate limited (sessionRetryRef.current >= 999 indicates rate limit)
      if (sessionRetryRef.current >= 999) {
        console.warn('Session establishment is rate limited. Please wait before trying again.');
        setSessionError('Too many session establishment attempts. Please wait a few minutes before trying again.');
        return;
      }
      
      try {
        const password = getCachedPassword(user.id);
        if (!password) {
          // Clear any existing retry timeout
          if (sessionRetryTimeoutRef.current) {
            clearTimeout(sessionRetryTimeoutRef.current);
          }
          
          // If user is authenticated but password cache is missing, it's likely a page refresh
          // Try to refresh the session encryption cache from IndexedDB first
          if (isAuthenticated) {
            try {
              const { initializeSessionEncryption } = await import('../crypto/sessionManager');
              // Try to use the session encryption key cache if it's still valid
              // This allows sessions to work even if password cache expired but encryption key cache is still valid
              console.warn('[useChat] Password cache expired, but checking if session encryption cache is still valid...');
              // We can't initialize without password, but loadSession will try to use cached encryption key
              // So we'll just proceed and let loadSession handle it
            } catch (initErr) {
              console.error('Password cache missing for authenticated user. User needs to log out and log back in.');
              setSessionError('Password cache expired. Please log out and log back in to re-establish your session encryption keys.');
              sessionRetryRef.current = 0; // Reset for next attempt
              return;
            }
          }
          
          // If not authenticated, retry a few times in case authentication is in progress
          if (sessionRetryRef.current < 3) {
            sessionRetryRef.current += 1;
            console.warn(`Password not cached - retrying session establishment (attempt ${sessionRetryRef.current}/3)...`);
            
            sessionRetryTimeoutRef.current = setTimeout(() => {
              const retryPassword = getCachedPassword(user.id);
              if (retryPassword && !isEstablishingSession) {
                sessionRetryRef.current = 0; // Reset on success
                checkAndEstablishSession();
              } else if (!isAuthenticated) {
                // Still not authenticated, try again
                checkAndEstablishSession();
              } else {
                // Authenticated but password still missing - stop retrying
                setSessionError('Password cache expired. Please log out and log back in to re-establish your session encryption keys.');
                sessionRetryRef.current = 0;
              }
            }, 2000 * sessionRetryRef.current); // Exponential backoff
          } else {
            console.error('Password not available after retries. Session establishment failed.');
            setSessionError('Password not available. Please log in to continue.');
            sessionRetryRef.current = 0; // Reset for next attempt
          }
          return;
        }
        
        // Reset retry counter on success
        sessionRetryRef.current = 0;

        // Check if session exists locally FIRST - prevent unnecessary key exchange
        try {
          const session = await loadSession(sessionId, user.id, password);
          if (session && session.rootKey && session.sendKey && session.recvKey) {
            console.log(`[useChat] ✓ Session ${sessionId} exists locally with keys - preventing unnecessary key regeneration`);
            console.log(`[useChat] ✓ Reusing existing session keys for session ${sessionId}`);
            setSessionError(null);
            return; // Session exists locally with keys - no need to establish
          } else if (session) {
            console.log(`[useChat] ⚠️ Session ${sessionId} exists but missing keys - will establish keys`);
          }
        } catch (loadError) {
          // Session doesn't exist locally - check backend to confirm it should exist
          console.log(`[useChat] Session ${sessionId} not found locally, checking backend...`);
          
          try {
            const api = (await import('../services/api')).default;
            const response = await api.get(`/sessions/${sessionId}`);
            
            if (response.data.success && response.data.data.session) {
              // Session exists in backend but not locally - keys need to be established
              console.log(`[useChat] Session ${sessionId} exists in backend but keys not in IndexedDB - will establish keys`);
              setSessionError(null);
              // Continue to establish session keys
            } else {
              console.log(`[useChat] Session ${sessionId} not found in backend, establishing new session...`);
            }
          } catch (apiError) {
            // Backend check failed - proceed with establishment
            console.log(`[useChat] Could not verify session in backend, proceeding with establishment:`, apiError.message);
          }
        }

        // Session doesn't exist or keys are missing - establish it
        // Set guard to prevent duplicate calls
        if (sessionEstablishmentInProgressRef.current) {
          console.log(`[useChat] ⚠️ Session establishment already in progress for ${sessionId} - preventing duplicate call`);
          return;
        }
        
        sessionEstablishmentInProgressRef.current = true;
        setIsEstablishingSession(true);
        setSessionError(null);

        try {
          console.log(`[useChat] Generating session keys for new session ${sessionId} with peer ${peerId}...`);
          console.log(`[useChat] Initiating ECDH key exchange and HKDF derivation...`);
          await initiateSession(user.id, peerId, password, socket);
          setSessionError(null);
          console.log(`[useChat] ✓ Session ${sessionId} established successfully with new keys`);
        } catch (error) {
          // Capture full error details for debugging
          const errorDetails = {
            message: error.message,
            name: error.name,
            stack: error.stack,
            toString: error.toString()
          };
          console.error('Failed to establish session:', errorDetails);
          
          // Extract error message from various possible sources
          let errorMessage = error.message || error.toString() || error.name || 'Failed to establish secure session';
          
          // If message is empty, try to get more details
          if (!errorMessage || errorMessage.trim() === '' || errorMessage === 'Error') {
            if (error.originalError) {
              errorMessage = error.originalError.message || error.originalError.toString() || 'Unknown error';
            } else {
              errorMessage = 'Failed to establish secure session. Please check your identity key and password.';
            }
          }
          
          setSessionError(errorMessage);
          
          // Provide helpful error message based on error type
          let userMessage = errorMessage;
          if (errorMessage.includes('Identity key not found') || errorMessage.includes('not found')) {
            userMessage = 'Identity key not found. Please generate an identity key pair in the Keys page before starting a conversation.';
          } else if (errorMessage.includes('decrypt') || errorMessage.includes('password') || errorMessage.includes('incorrect')) {
            userMessage = 'Failed to decrypt identity key. The password may be incorrect. Please try logging out and logging back in, or regenerate your keys.';
          } else if (errorMessage.includes('Failed to load private key')) {
            userMessage = 'Failed to load identity key. Please check your password or regenerate your keys in the Keys page.';
          } else if (errorMessage.includes('corrupted')) {
            userMessage = 'Identity key data is corrupted. Please regenerate your identity key pair in the Keys page.';
          } else if (errorMessage.includes('Failed to initiate session')) {
            // Extract the inner error message
            const innerError = errorMessage.replace('Failed to initiate session: ', '');
            if (innerError && innerError !== errorMessage) {
              userMessage = innerError;
            }
          } else if (errorMessage.includes('not online') || errorMessage.includes('offline')) {
            userMessage = 'The other user is not currently online. They must be connected to establish a secure session.';
          } else if (errorMessage.includes('timeout') || errorMessage.includes('No response from peer')) {
            userMessage = 'Session establishment timed out. The other user may be offline or not responding. Please try again when they are online.';
          } else if (errorMessage.includes('rate limit') || errorMessage.includes('Rate limit exceeded')) {
            userMessage = 'Too many session establishment attempts. Please wait a few minutes before trying again.';
            // Don't retry on rate limit - wait for user to manually retry
            sessionRetryRef.current = 999; // Set high to prevent auto-retry
          }
          
          setErrors(prev => [...prev, {
            id: `session-error-${Date.now()}`,
            title: 'Session Establishment Failed',
            message: userMessage,
            variant: 'destructive',
            timestamp: Date.now()
          }]);
        } finally {
          setIsEstablishingSession(false);
          sessionEstablishmentInProgressRef.current = false; // Clear guard
        }
      } catch (error) {
        console.error('[useChat] Session check error:', error);
        setSessionError(error.message || 'Failed to check session');
        setIsEstablishingSession(false);
        sessionEstablishmentInProgressRef.current = false; // Clear guard on error
      }
    };

    checkAndEstablishSession();
    
    // Cleanup retry timeout on unmount or dependency change
    return () => {
      if (sessionRetryTimeoutRef.current) {
        clearTimeout(sessionRetryTimeoutRef.current);
        sessionRetryTimeoutRef.current = null;
      }
      sessionRetryRef.current = 0;
      sessionEstablishmentInProgressRef.current = false; // Clear guard on cleanup
    };
    // Dependencies: Only re-run if these change
    // Note: getCachedPassword is stable (from useAuth), isEstablishingSession prevents loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, user?.id, peerId, socket?.id, isEstablishingSession]);

  // Remove old errors (older than 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setErrors(prev => prev.filter(err => Date.now() - err.timestamp < 10000));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Process queued messages when connection is restored
  useEffect(() => {
    if (!isConnected || !socket || !sessionId || !user?.id) return;

    const processQueue = async () => {
      try {
        const queuedMessages = await getQueuedMessages(sessionId);
        if (queuedMessages.length === 0) return;

        console.log(`Processing ${queuedMessages.length} queued messages...`);

        for (const queuedMsg of queuedMessages) {
          try {
            // Check if message is too old (older than 1 hour, skip it)
            const age = Date.now() - queuedMsg.timestamp;
            if (age > 60 * 60 * 1000) {
              console.warn('Skipping old queued message:', queuedMsg.id);
              await removeQueuedMessage(queuedMsg.id);
              continue;
            }

            // Check max attempts (5 attempts max)
            if (queuedMsg.attempts >= 5) {
              console.warn('Max attempts reached for queued message:', queuedMsg.id);
              await removeQueuedMessage(queuedMsg.id);
              continue;
            }

            // Send the message
            socket.emit('msg:send', queuedMsg.envelope);
            
            // Remove from queue on success
            await removeQueuedMessage(queuedMsg.id);
          } catch (error) {
            console.error('Failed to send queued message:', error);
            await incrementQueueAttempt(queuedMsg.id);
          }
        }
      } catch (error) {
        console.error('Failed to process message queue:', error);
      }
    };

    // Process queue after a short delay to ensure connection is stable
    const timeoutId = setTimeout(processQueue, 1000);
    return () => clearTimeout(timeoutId);
  }, [isConnected, socket, sessionId, user?.id]);

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
    },
    isConnected,
    connectionError,
    reconnect
  };
}


import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
// Alert component - using inline Alert for now
import { Shield, XCircle, CheckCircle, Clock, Hash, ArrowUp, AlertTriangle, Play, Download, RefreshCw } from 'lucide-react';
import { handleIncomingMessage, sendEncryptedMessage } from '../crypto/messageFlow';
import { buildTextMessageEnvelope } from '../crypto/messageEnvelope';
import { generateTimestamp } from '../crypto/messages';
import { getSendKey, getRecvKey, loadSession, initializeSessionEncryption } from '../crypto/sessionManager';
import { encryptAESGCM } from '../crypto/aesGcm';
import api from '../services/api';
import { toast } from '../hooks/use-toast';
import { cn } from '../lib/utils';

/**
 * Replay Attack Demonstration Page
 * 
 * Demonstrates all replay protection mechanisms:
 * 1. Nonces - Uniqueness validation
 * 2. Timestamps - Freshness validation (±2 minute window)
 * 3. Sequence Numbers - Monotonicity validation
 */
export default function ReplayAttackDemo() {
  const { user, getCachedPassword } = useAuth();
  const [selectedSession, setSelectedSession] = useState(null);
  const [demoResults, setDemoResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [capturedMessages, setCapturedMessages] = useState([]);
  const [currentTest, setCurrentTest] = useState(null);

  /**
   * Helper function to extract userId and peerId from session data
   */
  const extractSessionParticipants = (sessionData, currentUserId) => {
    const userId = currentUserId.toString();
    let peerId = null;
    
    // Backend returns peerId directly
    if (sessionData.peerId) {
      peerId = sessionData.peerId.toString();
    } else if (sessionData.participants && Array.isArray(sessionData.participants) && sessionData.participants.length > 0) {
      // Fallback: extract from participants array
      const peer = sessionData.participants.find(p => {
        const pId = (p._id || p).toString();
        return pId !== userId;
      });
      peerId = (peer?._id || peer || sessionData.participants[0]?._id || sessionData.participants[0])?.toString();
    }
    
    if (!peerId) {
      throw new Error('Could not determine peer ID from session data. Session structure: ' + JSON.stringify(sessionData));
    }
    
    return { userId, peerId };
  };

  /**
   * Helper function to get send key for a session
   * Uses the exact same approach as chat - loads session with password if available
   */
  const getSessionSendKey = async (sessionId, userId) => {
    // Get cached password (same as chat does)
    const cachedPassword = getCachedPassword ? getCachedPassword(userId) : null;
    
    // Refresh encryption cache if password is available (same as chat does)
    if (cachedPassword) {
      try {
        await initializeSessionEncryption(userId, cachedPassword);
        console.log('[ReplayAttackDemo] ✓ Session encryption cache refreshed');
      } catch (initErr) {
        console.warn('[ReplayAttackDemo] Failed to refresh cache:', initErr.message);
        // Continue anyway - might still work
      }
    }
    
    // Load session exactly like chat does: loadSession(sessionId, user.id, password)
    // This is the same call that chat makes, so it should work if chat is working
    try {
      console.log('[ReplayAttackDemo] Loading session (same way as chat)...');
      const session = await loadSession(sessionId, userId, cachedPassword);
      
      if (!session || !session.sendKey) {
        throw new Error('Session loaded but send key not found');
      }
      
      console.log('[ReplayAttackDemo] ✓ Session loaded successfully');
      return session.sendKey;
    } catch (error) {
      // If password cache expired, provide helpful message
      if (error.message.includes('Password required') || error.message.includes('cached key expired')) {
        throw new Error('Encryption key cache expired. Please open the chat for this session first to refresh the cache, or refresh the page. If the problem persists, log out and log back in.');
      }
      throw new Error(`Failed to load session: ${error.message}`);
    }
  };

  // Load available sessions
  useEffect(() => {
    const loadSessions = async () => {
      if (!user?.id) return;
      
      try {
        // Get sessions from backend
        const response = await api.get('/sessions');
        
        if (response.data.success && response.data.data.sessions.length > 0) {
          setSelectedSession(response.data.data.sessions[0].sessionId);
        }
      } catch (error) {
        console.error('Failed to load sessions:', error);
      }
    };
    
    loadSessions();
  }, [user]);

  /**
   * Test 1: Nonce Uniqueness Protection
   */
  const testNonceUniqueness = async () => {
    if (!selectedSession || !user?.id) {
      toast({
        title: 'Error',
        description: 'Please select a session first',
        variant: 'destructive'
      });
      return;
    }

    setIsRunning(true);
    setCurrentTest('nonce');
    const results = [];

    try {
      // Get session info from backend (for userId and peerId)
      const response = await api.get(`/sessions/${selectedSession}`);
      
      if (!response.data || !response.data.success) {
        throw new Error('Failed to fetch session from backend');
      }
      
      const sessionData = response.data.data?.session || response.data.data;
      
      if (!sessionData) {
        throw new Error('Session not found in backend');
      }
      
      // The backend returns peerId directly, not participants array
      // userId is the current user, peerId is the other participant
      // Extract userId and peerId safely
      const { userId: finalUserId, peerId: finalPeerId } = extractSessionParticipants(sessionData, user.id);
      
      // Get send key using the same function that chat uses
      // This will work if chat is working, since it uses the same cache
      const sendKey = await getSessionSendKey(selectedSession, user.id);

      // Create a legitimate message
      const { timestamp, nonce } = generateTimestamp();
      const plaintext = 'Test message for nonce uniqueness';
      const { ciphertext, iv, authTag } = await encryptAESGCM(sendKey, plaintext);
      
      const envelope = buildTextMessageEnvelope(
        selectedSession,
        finalUserId,
        finalPeerId,
        ciphertext,
        iv,
        authTag
      );

      // Step 1: Send legitimate message
      results.push({
        step: 1,
        title: 'Legitimate Message Sent',
        description: 'Sending a message with a unique nonce',
        details: {
          seq: envelope.seq,
          timestamp: new Date(envelope.timestamp).toISOString(),
          nonceLength: atob(envelope.nonce).length,
          nonceHash: await hashNonce(atob(envelope.nonce))
        },
        status: 'success'
      });

      // Process the message (this stores the nonce)
      const result1 = await handleIncomingMessage(envelope, user.id);
      
      if (result1.valid) {
        results.push({
          step: 2,
          title: 'Message Accepted',
          description: 'Message processed successfully, nonce stored',
          details: {
            seq: envelope.seq,
            nonceStored: true
          },
          status: 'success'
        });
      }

      // Step 2: Attempt replay with same nonce
      results.push({
        step: 3,
        title: 'Replay Attempt',
        description: 'Attempting to replay the same message with identical nonce',
        details: {
          seq: envelope.seq,
          timestamp: new Date(envelope.timestamp).toISOString(),
          nonceHash: await hashNonce(atob(envelope.nonce)),
          warning: 'Using the same nonce as the original message'
        },
        status: 'warning'
      });

      const result2 = await handleIncomingMessage(envelope, user.id);
      
      if (!result2.valid && result2.error.includes('nonce')) {
        results.push({
          step: 4,
          title: 'Replay Blocked by Nonce Check',
          description: result2.error,
          details: {
            protection: 'NONCE_UNIQUENESS',
            reason: 'Duplicate nonce detected',
            blocked: true
          },
          status: 'blocked'
        });
      } else {
        results.push({
          step: 4,
          title: 'ERROR: Replay Not Blocked',
          description: 'Nonce uniqueness check failed to block replay',
          details: {
            protection: 'NONCE_UNIQUENESS',
            blocked: false,
            error: 'Protection mechanism failed'
          },
          status: 'error'
        });
      }

    } catch (error) {
      results.push({
        step: -1,
        title: 'Test Error',
        description: error.message,
        status: 'error'
      });
    }

    setDemoResults(results);
    setIsRunning(false);
    setCurrentTest(null);
  };

  /**
   * Test 2: Timestamp Freshness Protection
   */
  const testTimestampFreshness = async () => {
    if (!selectedSession || !user?.id) {
      toast({
        title: 'Error',
        description: 'Please select a session first',
        variant: 'destructive'
      });
      return;
    }

    setIsRunning(true);
    setCurrentTest('timestamp');
    const results = [];

    try {
      // Get session info from backend
      const response = await api.get(`/sessions/${selectedSession}`);
      const sessionData = response.data.success ? response.data.data.session : null;
      
      if (!sessionData) {
        throw new Error('Session not found in backend');
      }
      
      // Extract userId and peerId safely
      const { userId: finalUserId, peerId: finalPeerId } = extractSessionParticipants(sessionData, user.id);
      
      // Get send key using the same function that chat uses
      const sendKey = await getSessionSendKey(selectedSession, user.id);

      // Create a message with old timestamp (3 minutes ago)
      const oldTimestamp = Date.now() - (3 * 60 * 1000); // 3 minutes ago
      const { nonce } = generateTimestamp();
      const plaintext = 'Test message with old timestamp';
      const { ciphertext, iv, authTag } = await encryptAESGCM(sendKey, plaintext);
      
      const envelope = buildTextMessageEnvelope(
        selectedSession,
        finalUserId,
        finalPeerId,
        ciphertext,
        iv,
        authTag
      );

      // Override timestamp to be old
      envelope.timestamp = oldTimestamp;

      results.push({
        step: 1,
        title: 'Replay Attempt with Stale Timestamp',
        description: 'Attempting to replay a message with timestamp 3 minutes old',
        details: {
          timestamp: new Date(oldTimestamp).toISOString(),
          age: Math.abs(Date.now() - oldTimestamp),
          window: '±2 minutes (120,000 ms)',
          status: 'Outside validity window'
        },
        status: 'warning'
      });

      const result = await handleIncomingMessage(envelope, user.id);
      
      if (!result.valid && result.error.includes('timestamp')) {
        results.push({
          step: 2,
          title: 'Replay Blocked by Timestamp Check',
          description: result.error,
          details: {
            protection: 'TIMESTAMP_FRESHNESS',
            reason: 'Timestamp outside ±2 minute window',
            blocked: true,
            messageAge: Math.abs(Date.now() - oldTimestamp)
          },
          status: 'blocked'
        });
      } else {
        results.push({
          step: 2,
          title: 'ERROR: Replay Not Blocked',
          description: 'Timestamp freshness check failed to block replay',
          details: {
            protection: 'TIMESTAMP_FRESHNESS',
            blocked: false,
            error: 'Protection mechanism failed'
          },
          status: 'error'
        });
      }

    } catch (error) {
      results.push({
        step: -1,
        title: 'Test Error',
        description: error.message,
        status: 'error'
      });
    }

    setDemoResults(results);
    setIsRunning(false);
    setCurrentTest(null);
  };

  /**
   * Test 3: Sequence Number Monotonicity Protection
   */
  const testSequenceMonotonicity = async () => {
    if (!selectedSession || !user?.id) {
      toast({
        title: 'Error',
        description: 'Please select a session first',
        variant: 'destructive'
      });
      return;
    }

    setIsRunning(true);
    setCurrentTest('sequence');
    const results = [];

    try {
      // Get session info from backend
      const response = await api.get(`/sessions/${selectedSession}`);
      const sessionData = response.data.success ? response.data.data.session : null;
      
      if (!sessionData) {
        throw new Error('Session not found in backend');
      }
      
      // Extract userId and peerId safely
      const { userId: finalUserId, peerId: finalPeerId } = extractSessionParticipants(sessionData, user.id);
      
      // Get send key using the same function that chat uses
      const sendKey = await getSessionSendKey(selectedSession, user.id);

      // Get last sequence number - we'll let the sequence manager handle it automatically
      // The sequence manager will track the last sequence for this session
      const lastSeq = 0; // Will be determined by sequence manager

      // Step 1: Send a legitimate message
      const { timestamp, nonce } = generateTimestamp();
      const plaintext = 'Test message for sequence validation';
      const { ciphertext, iv, authTag } = await encryptAESGCM(sendKey, plaintext);
      
      const envelope1 = buildTextMessageEnvelope(
        selectedSession,
        finalUserId,
        finalPeerId,
        ciphertext,
        iv,
        authTag
      );

      results.push({
        step: 1,
        title: 'Legitimate Message Sent',
        description: `Sending message with sequence number ${envelope1.seq}`,
        details: {
          seq: envelope1.seq,
          lastSeq: lastSeq,
          status: 'Valid (seq > lastSeq)'
        },
        status: 'success'
      });

      const result1 = await handleIncomingMessage(envelope1, user.id);
      
      if (result1.valid) {
        results.push({
          step: 2,
          title: 'Message Accepted',
          description: 'Message processed, sequence number updated',
          details: {
            oldLastSeq: lastSeq,
            newLastSeq: envelope1.seq
          },
          status: 'success'
        });
      }

      // Step 2: Attempt to replay with same sequence number
      results.push({
        step: 3,
        title: 'Replay Attempt',
        description: `Attempting to replay message with sequence ${envelope1.seq} (already used)`,
        details: {
          seq: envelope1.seq,
          currentLastSeq: envelope1.seq,
          status: 'Invalid (seq <= lastSeq)'
        },
        status: 'warning'
      });

      const result2 = await handleIncomingMessage(envelope1, user.id);
      
      if (!result2.valid && result2.error.includes('sequence')) {
        results.push({
          step: 4,
          title: 'Replay Blocked by Sequence Check',
          description: result2.error,
          details: {
            protection: 'SEQUENCE_MONOTONICITY',
            reason: 'Sequence number must be strictly increasing',
            blocked: true,
            receivedSeq: envelope1.seq,
            lastSeq: envelope1.seq
          },
          status: 'blocked'
        });
      } else {
        results.push({
          step: 4,
          title: 'ERROR: Replay Not Blocked',
          description: 'Sequence monotonicity check failed to block replay',
          details: {
            protection: 'SEQUENCE_MONOTONICITY',
            blocked: false,
            error: 'Protection mechanism failed'
          },
          status: 'error'
        });
      }

    } catch (error) {
      results.push({
        step: -1,
        title: 'Test Error',
        description: error.message,
        status: 'error'
      });
    }

    setDemoResults(results);
    setIsRunning(false);
    setCurrentTest(null);
  };

  /**
   * Test 4: Combined Protection (All Mechanisms)
   */
  const testCombinedProtection = async () => {
    if (!selectedSession || !user?.id) {
      toast({
        title: 'Error',
        description: 'Please select a session first',
        variant: 'destructive'
      });
      return;
    }

    setIsRunning(true);
    setCurrentTest('combined');
    const results = [];

    try {
      // Get session info from backend
      const response = await api.get(`/sessions/${selectedSession}`);
      const sessionData = response.data.success ? response.data.data.session : null;
      
      if (!sessionData) {
        throw new Error('Session not found in backend');
      }
      
      // Extract userId and peerId safely
      const { userId: finalUserId, peerId: finalPeerId } = extractSessionParticipants(sessionData, user.id);
      
      // Get send key using the same function that chat uses
      const sendKey = await getSessionSendKey(selectedSession, user.id);

      // Create a legitimate message
      const { timestamp, nonce } = generateTimestamp();
      const plaintext = 'Test message for combined protection';
      const { ciphertext, iv, authTag } = await encryptAESGCM(sendKey, plaintext);
      
      const envelope = buildTextMessageEnvelope(
        selectedSession,
        finalUserId,
        finalPeerId,
        ciphertext,
        iv,
        authTag
      );

      results.push({
        step: 1,
        title: 'Legitimate Message',
        description: 'Sending message with valid nonce, timestamp, and sequence',
        details: {
          seq: envelope.seq,
          timestamp: new Date(envelope.timestamp).toISOString(),
          noncePresent: !!envelope.nonce
        },
        status: 'success'
      });

      const result1 = await handleIncomingMessage(envelope, user.id);
      
      if (result1.valid) {
        results.push({
          step: 2,
          title: 'Message Accepted',
          description: 'All protection mechanisms passed',
          status: 'success'
        });
      }

      // Attempt replay with all violations
      results.push({
        step: 3,
        title: 'Replay Attempt',
        description: 'Replaying message with: duplicate nonce, old timestamp, and used sequence',
        details: {
          nonceViolation: 'Duplicate nonce',
          timestampViolation: 'Same timestamp (may be stale)',
          sequenceViolation: 'Sequence already used'
        },
        status: 'warning'
      });

      const result2 = await handleIncomingMessage(envelope, user.id);
      
      if (!result2.valid) {
        // Determine which protection caught it
        let protection = 'UNKNOWN';
        if (result2.error.includes('nonce')) protection = 'NONCE_UNIQUENESS';
        else if (result2.error.includes('timestamp')) protection = 'TIMESTAMP_FRESHNESS';
        else if (result2.error.includes('sequence')) protection = 'SEQUENCE_MONOTONICITY';

        results.push({
          step: 4,
          title: 'Replay Blocked',
          description: result2.error,
          details: {
            protection: protection,
            blocked: true,
            reason: 'Multiple protection mechanisms detected replay'
          },
          status: 'blocked'
        });
      } else {
        results.push({
          step: 4,
          title: 'ERROR: Replay Not Blocked',
          description: 'All protection mechanisms failed',
          status: 'error'
        });
      }

    } catch (error) {
      results.push({
        step: -1,
        title: 'Test Error',
        description: error.message,
        status: 'error'
      });
    }

    setDemoResults(results);
    setIsRunning(false);
    setCurrentTest(null);
  };

  // Helper function to hash nonce
  const hashNonce = async (nonceBase64) => {
    const nonceBytes = Uint8Array.from(atob(nonceBase64), c => c.charCodeAt(0));
    const digest = await crypto.subtle.digest('SHA-256', nonceBytes);
    const hashBytes = new Uint8Array(digest);
    return Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'blocked':
        return <Shield className="w-5 h-5 text-success" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-success/10 text-success border-success/20">Success</Badge>;
      case 'blocked':
        return <Badge className="bg-success/10 text-success border-success/20">Blocked</Badge>;
      case 'warning':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Warning</Badge>;
      case 'error':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Error</Badge>;
      default:
        return null;
    }
  };

  const exportResults = () => {
    const report = {
      timestamp: new Date().toISOString(),
      sessionId: selectedSession,
      tests: demoResults,
      summary: {
        totalTests: demoResults.length,
        blocked: demoResults.filter(r => r.status === 'blocked').length,
        successful: demoResults.filter(r => r.status === 'success').length,
        errors: demoResults.filter(r => r.status === 'error').length
      }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replay-attack-demo-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Replay Attack Demonstration</h1>
            <p className="text-muted-foreground">
              Comprehensive demonstration of replay protection mechanisms: Nonces, Timestamps, and Sequence Numbers
            </p>
            <div className="mt-4 p-4 bg-warning/10 border border-warning/20 rounded-lg">
              <p className="text-sm text-foreground">
                <strong>How to Perform Replay Attacks:</strong> Select a session below, then click any test button to demonstrate how replay attacks are detected and blocked. 
                Each test shows step-by-step how the protection mechanisms work. See <code className="bg-muted px-1 rounded">docs/HOW_TO_PERFORM_REPLAY_ATTACKS.md</code> for detailed instructions.
              </p>
            </div>
          </div>

          {/* Protection Mechanisms Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="w-5 h-5 text-primary" />
                  Nonces
                </CardTitle>
                <CardDescription>Uniqueness validation</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Each message includes a cryptographically random nonce (16 bytes). 
                  Nonce hashes are stored and checked to prevent duplicate message replays.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Timestamps
                </CardTitle>
                <CardDescription>Freshness validation</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Messages must have timestamps within ±2 minutes of the current time. 
                  Stale messages are rejected as potential replays.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUp className="w-5 h-5 text-primary" />
                  Sequence Numbers
                </CardTitle>
                <CardDescription>Monotonicity validation</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Sequence numbers must be strictly increasing per session. 
                  Messages with sequence numbers ≤ last received are rejected.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Test Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Run Attack Demonstrations</CardTitle>
              <CardDescription>
                Select a test to demonstrate how replay protection mechanisms work
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={testNonceUniqueness}
                  disabled={isRunning || !selectedSession}
                  variant="outline"
                >
                  <Hash className="w-4 h-4 mr-2" />
                  Test Nonce Uniqueness
                </Button>
                <Button
                  onClick={testTimestampFreshness}
                  disabled={isRunning || !selectedSession}
                  variant="outline"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Test Timestamp Freshness
                </Button>
                <Button
                  onClick={testSequenceMonotonicity}
                  disabled={isRunning || !selectedSession}
                  variant="outline"
                >
                  <ArrowUp className="w-4 h-4 mr-2" />
                  Test Sequence Monotonicity
                </Button>
                <Button
                  onClick={testCombinedProtection}
                  disabled={isRunning || !selectedSession}
                  variant="default"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Test Combined Protection
                </Button>
                {demoResults.length > 0 && (
                  <Button
                    onClick={exportResults}
                    variant="outline"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Results
                  </Button>
                )}
              </div>

              {isRunning && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    <div>
                      <div className="font-semibold text-foreground">Running Test</div>
                      <div className="text-sm text-muted-foreground">
                        Executing {currentTest} protection test...
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {demoResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Test Results</CardTitle>
                <CardDescription>
                  Detailed results of replay attack demonstrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {demoResults.map((result, index) => (
                    <div
                      key={index}
                      className={cn(
                        "p-4 rounded-lg border",
                        result.status === 'success' && "bg-success/5 border-success/20",
                        result.status === 'blocked' && "bg-success/5 border-success/20",
                        result.status === 'warning' && "bg-warning/5 border-warning/20",
                        result.status === 'error' && "bg-destructive/5 border-destructive/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusIcon(result.status)}
                            <h4 className="font-semibold">{result.title}</h4>
                            {getStatusBadge(result.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {result.description}
                          </p>
                          {result.details && (
                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono">
                              <pre>{JSON.stringify(result.details, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {demoResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Protection Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">
                      {demoResults.filter(r => r.status === 'blocked').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Attacks Blocked</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-success">
                      {demoResults.filter(r => r.status === 'success').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Valid Messages</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-destructive">
                      {demoResults.filter(r => r.status === 'error').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}


import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';
import { getBackendWebSocketURL } from '../config/backend.js';

/**
 * WebSocket test component
 * Connects to the secure WebSocket server with JWT authentication
 */
function WebSocketTest() {
  const { accessToken, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }

    const setupSocket = () => {
      // Initialize Socket.IO connection with JWT token
      // In development, use Vite proxy to avoid mixed content issues
      // In production, connect directly to HTTPS
      const wsURL = import.meta.env.DEV 
        ? window.location.origin // Use same origin (Vite proxy will handle it)
        : getBackendWebSocketURL();
      
      const newSocket = io(wsURL, {
      transports: ['polling', 'websocket'], // Try polling first in dev (works through proxy)
      rejectUnauthorized: false, // Allow self-signed certificates in development
      auth: {
        token: accessToken
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 3, // Reduced attempts to avoid spam
      reconnectionDelayMax: 5000
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('hello', (data) => {
      setMessages(prev => [...prev, { type: 'server', data }]);
      if (data.authenticated) {
        setAuthenticated(true);
      }
    });

    newSocket.on('auth:hello', (data) => {
      setMessages(prev => [...prev, { type: 'auth', data }]);
      if (data.success) {
        setAuthenticated(true);
      }
    });

    newSocket.on('message', (data) => {
      setMessages(prev => [...prev, { type: 'echo', data }]);
    });

      newSocket.on('error', (data) => {
        setMessages(prev => [...prev, { type: 'error', data }]);
      });

      newSocket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        setConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        // Only log once to avoid console spam
        if (!newSocket._errorLogged) {
          console.warn('WebSocket connection error (this is expected in development due to mixed content):', error.message);
          newSocket._errorLogged = true;
        }
        setConnected(false);
      });

      setSocket(newSocket);
    };

    setupSocket();

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [isAuthenticated, accessToken]);

  const sendMessage = () => {
    if (socket && messageInput.trim()) {
      socket.emit('message', messageInput);
      setMessages(prev => [...prev, { type: 'client', data: messageInput }]);
      setMessageInput('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-destructive" />
          <span className="text-sm text-muted-foreground">Authentication required</span>
        </div>
        <p className="text-sm text-muted-foreground">Please log in to use WebSocket features.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {connected ? (
            <CheckCircle className="w-5 h-5 text-success" />
          ) : (
            <XCircle className="w-5 h-5 text-destructive" />
          )}
          <Badge variant={connected ? 'default' : 'destructive'}>
            {connected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
        {connected && (
          <div className="flex items-center gap-2">
            {authenticated ? (
              <CheckCircle className="w-5 h-5 text-success" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive" />
            )}
            <Badge variant={authenticated ? 'default' : 'destructive'}>
              {authenticated ? 'Authenticated' : 'Not Authenticated'}
            </Badge>
          </div>
        )}
      </div>
      
      {messages.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Messages:</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
            {messages.map((msg, idx) => (
              <div key={idx} className="p-2 rounded-lg bg-secondary text-sm">
                <span className="font-medium text-primary">{msg.type}:</span>
                <pre className="mt-1 text-xs text-muted-foreground overflow-x-auto">
                  {JSON.stringify(msg.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          disabled={!connected || !authenticated}
          className="flex-1"
        />
        <Button 
          onClick={sendMessage} 
          disabled={!connected || !authenticated || !messageInput.trim()}
          size="sm"
        >
          Send
        </Button>
        <Button 
          onClick={() => socket?.emit('auth:hello')}
          disabled={!connected}
          variant="outline"
          size="sm"
        >
          Test Auth
        </Button>
      </div>
    </div>
  );
}

export default WebSocketTest;

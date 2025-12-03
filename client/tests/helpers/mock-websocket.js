/**
 * Mock WebSocket Utilities
 * Provides mock WebSocket connections for testing
 */

/**
 * Creates a mock WebSocket connection
 * @param {string} userId - User ID
 * @returns {Object} Mock WebSocket object
 */
export function createMockWebSocket(userId) {
  const listeners = new Map();
  const sentMessages = [];
  
  const mockSocket = {
    id: userId,
    connected: true,
    
    // Event listeners
    on(event, callback) {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event).push(callback);
    },
    
    // Emit event
    emit(event, data) {
      sentMessages.push({ event, data, timestamp: Date.now() });
      
      // Trigger listeners if any
      if (listeners.has(event)) {
        listeners.get(event).forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in ${event} listener:`, error);
          }
        });
      }
    },
    
    // Simulate receiving a message
    simulateReceive(event, data) {
      if (listeners.has(event)) {
        listeners.get(event).forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in ${event} listener:`, error);
          }
        });
      }
    },
    
    // Get sent messages
    getSentMessages() {
      return sentMessages;
    },
    
    // Clear sent messages
    clearSentMessages() {
      sentMessages.length = 0;
    },
    
    // Disconnect
    disconnect() {
      this.connected = false;
      listeners.clear();
    }
  };
  
  return mockSocket;
}

/**
 * Creates mock WebSocket connections for Alice and Bob
 * @returns {{alice: Object, bob: Object}} Mock WebSocket connections
 */
export function createMockWebSocketPair() {
  const alice = createMockWebSocket('alice-id');
  const bob = createMockWebSocket('bob-id');
  
  // Set up forwarding: when Alice sends, Bob receives
  alice.on('msg:send', (envelope) => {
    // Simulate server forwarding
    setTimeout(() => {
      bob.simulateReceive('msg:receive', envelope);
    }, 10);
  });
  
  bob.on('msg:send', (envelope) => {
    // Simulate server forwarding
    setTimeout(() => {
      alice.simulateReceive('msg:receive', envelope);
    }, 10);
  });
  
  return { alice, bob };
}

/**
 * Mock socket.emit function for use in sendEncryptedMessage
 * @param {Object} socket - Mock socket
 * @returns {Function} emit function
 */
export function createSocketEmit(socket) {
  return (event, data) => {
    socket.emit(event, data);
  };
}


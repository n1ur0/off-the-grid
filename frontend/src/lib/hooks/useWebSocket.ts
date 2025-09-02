import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketMessage {
  type: string;
  topic?: string;
  timestamp?: string;
  [key: string]: any;
}

export interface WebSocketHookOptions {
  url: string;
  protocols?: string[];
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface WebSocketHookReturn {
  socket: WebSocket | null;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastMessage: WebSocketMessage | null;
  subscribe: (topic: string) => void;
  unsubscribe: (topic: string) => void;
  sendMessage: (message: any) => boolean;
  reconnect: () => void;
  disconnect: () => void;
  subscriptions: Set<string>;
}

export function useWebSocket(options: WebSocketHookOptions): WebSocketHookReturn {
  const {
    url,
    protocols,
    onOpen,
    onClose,
    onError,
    onMessage,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    heartbeatInterval = 30000,
  } = options;

  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [subscriptions, setSubscriptions] = useState<Set<string>>(new Set());
  
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeout = useRef<NodeJS.Timeout | null>(null);
  const isManuallyDisconnected = useRef(false);

  const clearTimeouts = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    if (heartbeatTimeout.current) {
      clearTimeout(heartbeatTimeout.current);
      heartbeatTimeout.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeout.current) {
      clearTimeout(heartbeatTimeout.current);
    }

    heartbeatTimeout.current = setTimeout(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }));
        startHeartbeat(); // Schedule next heartbeat
      }
    }, heartbeatInterval);
  }, [socket, heartbeatInterval]);

  const connect = useCallback(() => {
    if (socket?.readyState === WebSocket.OPEN || isManuallyDisconnected.current) {
      return;
    }

    setConnectionState('connecting');
    
    try {
      const ws = new WebSocket(url, protocols);
      
      ws.onopen = (event) => {
        setConnectionState('connected');
        setSocket(ws);
        reconnectAttempts.current = 0;
        
        // Resubscribe to all topics
        subscriptions.forEach(topic => {
          ws.send(JSON.stringify({ type: 'subscribe', topic }));
        });
        
        startHeartbeat();
        onOpen?.(event);
      };

      ws.onclose = (event) => {
        setConnectionState('disconnected');
        setSocket(null);
        clearTimeouts();
        
        onClose?.(event);
        
        // Auto-reconnect if not manually disconnected
        if (!isManuallyDisconnected.current && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (event) => {
        setConnectionState('error');
        onError?.(event);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          
          // Handle pong responses
          if (message.type === 'pong') {
            // Connection is alive, continue heartbeat
            return;
          }
          
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

    } catch (error) {
      setConnectionState('error');
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [url, protocols, onOpen, onClose, onError, onMessage, reconnectInterval, maxReconnectAttempts, subscriptions, startHeartbeat, clearTimeouts]);

  const disconnect = useCallback(() => {
    isManuallyDisconnected.current = true;
    clearTimeouts();
    
    if (socket) {
      socket.close();
      setSocket(null);
    }
    
    setConnectionState('disconnected');
  }, [socket, clearTimeouts]);

  const reconnect = useCallback(() => {
    isManuallyDisconnected.current = false;
    reconnectAttempts.current = 0;
    
    if (socket) {
      socket.close();
    }
    
    connect();
  }, [socket, connect]);

  const sendMessage = useCallback((message: any): boolean => {
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        return false;
      }
    }
    return false;
  }, [socket]);

  const subscribe = useCallback((topic: string) => {
    setSubscriptions(prev => new Set([...prev, topic]));
    
    if (socket?.readyState === WebSocket.OPEN) {
      sendMessage({ type: 'subscribe', topic });
    }
  }, [socket, sendMessage]);

  const unsubscribe = useCallback((topic: string) => {
    setSubscriptions(prev => {
      const newSet = new Set(prev);
      newSet.delete(topic);
      return newSet;
    });
    
    if (socket?.readyState === WebSocket.OPEN) {
      sendMessage({ type: 'unsubscribe', topic });
    }
  }, [socket, sendMessage]);

  // Initialize connection
  useEffect(() => {
    isManuallyDisconnected.current = false;
    connect();
    
    return () => {
      isManuallyDisconnected.current = true;
      clearTimeouts();
      socket?.close();
    };
  }, [url]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeouts();
      if (socket) {
        socket.close();
      }
    };
  }, [socket, clearTimeouts]);

  return {
    socket,
    connectionState,
    lastMessage,
    subscribe,
    unsubscribe,
    sendMessage,
    reconnect,
    disconnect,
    subscriptions,
  };
}
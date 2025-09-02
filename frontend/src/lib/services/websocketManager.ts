import { EventEmitter } from 'events';

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  protocols?: string[];
}

export interface WebSocketMessage {
  type: string;
  topic?: string;
  data?: any;
  timestamp?: string;
  user_id?: string;
}

export type WebSocketEventType = 
  | 'connected'
  | 'disconnected' 
  | 'error'
  | 'message'
  | 'reconnecting'
  | 'subscription_confirmed'
  | 'subscription_error';

export class WebSocketManager extends EventEmitter {
  private socket: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private subscriptions = new Set<string>();
  private isManuallyDisconnected = false;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      protocols: [],
      ...config,
    };
  }

  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.isManuallyDisconnected) {
      return;
    }

    this.connectionState = 'connecting';
    this.emit('reconnecting', { attempt: this.reconnectAttempts + 1 });

    try {
      this.socket = new WebSocket(this.config.url, this.config.protocols);
      this.setupEventHandlers();
    } catch (error) {
      this.connectionState = 'error';
      this.emit('error', error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.isManuallyDisconnected = true;
    this.clearTimers();
    
    if (this.socket) {
      this.socket.close(1000, 'Manual disconnect');
      this.socket = null;
    }
    
    this.connectionState = 'disconnected';
    this.emit('disconnected', { reason: 'manual' });
  }

  subscribe(topic: string): void {
    this.subscriptions.add(topic);
    
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendMessage({
        type: 'subscribe',
        topic,
        timestamp: new Date().toISOString(),
      });
    }
  }

  unsubscribe(topic: string): void {
    this.subscriptions.delete(topic);
    
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendMessage({
        type: 'unsubscribe',
        topic,
        timestamp: new Date().toISOString(),
      });
    }
  }

  sendMessage(message: WebSocketMessage): boolean {
    if (this.socket?.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify({
          ...message,
          timestamp: message.timestamp || new Date().toISOString(),
        }));
        return true;
      } catch (error) {
        this.emit('error', error);
        return false;
      }
    }
    return false;
  }

  getConnectionState() {
    return this.connectionState;
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      this.emit('connected');
      
      // Resubscribe to all topics
      this.subscriptions.forEach(topic => {
        this.sendMessage({ type: 'subscribe', topic });
      });
      
      this.startHeartbeat();
    };

    this.socket.onclose = (event) => {
      this.connectionState = 'disconnected';
      this.clearTimers();
      
      this.emit('disconnected', { 
        code: event.code, 
        reason: event.reason,
        wasClean: event.wasClean 
      });
      
      // Auto-reconnect if not manually disconnected
      if (!this.isManuallyDisconnected && this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (error) => {
      this.connectionState = 'error';
      this.emit('error', error);
    };

    this.socket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        // Handle system messages
        if (message.type === 'pong') {
          return; // Heartbeat response
        }
        
        if (message.type === 'subscription_response') {
          if (message.data?.success) {
            this.emit('subscription_confirmed', { topic: message.topic });
          } else {
            this.emit('subscription_error', { topic: message.topic, error: message.data?.error });
          }
          return;
        }
        
        // Emit the message for listeners
        this.emit('message', message);
        
        // Emit topic-specific events
        if (message.topic) {
          this.emit(`message:${message.topic}`, message);
        }
        
        // Emit type-specific events
        this.emit(`message:${message.type}`, message);
        
      } catch (error) {
        this.emit('error', new Error(`Failed to parse WebSocket message: ${error}`));
      }
    };
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping' });
      }
    }, this.config.heartbeatInterval);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectAttempts++;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isManuallyDisconnected) {
        this.connect();
      }
    }, this.config.reconnectInterval);
  }

  private clearTimers(): void {
    this.clearHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// Create a singleton instance
const wsManager = new WebSocketManager({
  url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws',
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,
});

export default wsManager;
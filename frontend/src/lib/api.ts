import { APIConfig, APIException, GridListResponse, GridDetailsResponse, AuthResponse } from '@/types/api';
import { AuthenticationRequest, GridSummary, GridOrderDetail } from '@/types/trading';

class APIClient {
  private config: APIConfig;

  constructor(config: Partial<APIConfig> = {}) {
    this.config = {
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include', // Include cookies for auth
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.detail || errorMessage;
        } catch {
          // If JSON parsing fails, use the default error message
        }

        throw new APIException(errorMessage, response.status);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof APIException) {
        throw error;
      }

      // Handle network errors and retry logic
      if (retryCount < this.config.retryAttempts && 
          (error instanceof TypeError || (error as any)?.name === 'AbortError')) {
        await this.delay(this.config.retryDelay * (retryCount + 1));
        return this.request(endpoint, options, retryCount + 1);
      }

      throw new APIException(
        error instanceof Error ? error.message : 'Network request failed',
        0
      );
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Authentication endpoints
  async login(authRequest: AuthenticationRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(authRequest),
    });
  }

  // Grid trading endpoints
  async getGrids(tokenId?: string): Promise<GridSummary[]> {
    const params = tokenId ? `?token_id=${encodeURIComponent(tokenId)}` : '';
    const response = await this.request<GridListResponse>(`/api/v1/grids${params}`);
    return response.grids || [];
  }

  async getGridDetails(gridIdentity: string): Promise<GridOrderDetail[]> {
    const response = await this.request<GridDetailsResponse>(
      `/api/v1/grids/${encodeURIComponent(gridIdentity)}`
    );
    return response.grid_details || [];
  }

  async createGrid(gridConfig: {
    token_id?: string;
    pair?: string;
    lowerPrice?: number;
    upperPrice?: number;
    gridCount?: number;
    investment?: number;
    strategy?: string;
    value?: number;
    orders?: number;
    range?: number;
    identity?: string;
  }): Promise<string> {
    const response = await this.request<{ grid_id: string }>('/api/v1/grids', {
      method: 'POST',
      body: JSON.stringify(gridConfig),
    });
    return response.grid_id;
  }

  async stopGrid(gridId: string): Promise<boolean> {
    try {
      await this.request(`/api/v1/grids/${encodeURIComponent(gridId)}/stop`, {
        method: 'POST',
      });
      return true;
    } catch {
      return false;
    }
  }

  async pauseGrid(gridId: string): Promise<boolean> {
    try {
      await this.request(`/api/v1/grids/${encodeURIComponent(gridId)}/pause`, {
        method: 'POST',
      });
      return true;
    } catch {
      return false;
    }
  }

  async resumeGrid(gridId: string): Promise<boolean> {
    try {
      await this.request(`/api/v1/grids/${encodeURIComponent(gridId)}/resume`, {
        method: 'POST',
      });
      return true;
    } catch {
      return false;
    }
  }

  async redeemGrid(gridIdentity: string): Promise<any> {
    return this.request(`/api/v1/grids/${encodeURIComponent(gridIdentity)}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health');
  }

  // Update configuration
  updateConfig(newConfig: Partial<APIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Singleton instance
export const apiClient = new APIClient();

// WebSocket client for real-time updates
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();

  constructor(private baseUrl: string = 'ws://localhost:8000') {}

  connect(userId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = `${this.baseUrl}/ws/${userId}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected', null);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit(message.type, message);
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.emit('disconnected', { code: event.code, reason: event.reason });
      
      if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++;
          console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          this.connect(userId);
        }, this.reconnectDelay * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
  }

  subscribe(eventType: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    const callbacks = this.listeners.get(eventType)!;
    callbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  private emit(eventType: string, data: any): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('WebSocket event callback error:', error);
        }
      });
    }
  }

  // Subscribe to grid updates
  subscribeToGrids(): void {
    this.send({ type: 'subscribe_grids' });
  }
}

// Singleton WebSocket instance
export const wsClient = new WebSocketClient();
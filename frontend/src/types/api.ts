import { GridSummary, GridOrderDetail, Grid } from './trading';

export interface APIResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface GridListResponse extends APIResponse<GridSummary[]> {
  grids: GridSummary[];
}

export interface GridDetailsResponse extends APIResponse<GridOrderDetail[]> {
  grid_details: GridOrderDetail[];
}

export interface AuthResponse extends APIResponse<any> {
  wallet_address: string;
}

export interface WebSocketMessage {
  type: 'grid_update' | 'subscription_confirmed' | 'error' | 'ping';
  data?: any;
  topic?: string;
  timestamp?: string;
  error?: string;
}

export interface GridCreateRequest {
  token_id: string;
  value: number;
  orders: number;
  range: number;
  identity: string;
}

export interface GridRedeemRequest {
  grid_identity: string;
}

// API client configuration
export interface APIConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

// Error types
export interface APIError {
  message: string;
  status: number;
  code?: string;
  details?: any;
}

export class APIException extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIException';
  }
}
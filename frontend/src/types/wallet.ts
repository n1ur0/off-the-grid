// Nautilus wallet types based on official documentation
export interface NautilusAPI {
  connect(options?: { createErgoObject?: boolean }): Promise<boolean>;
  disconnect(): Promise<boolean>;
  isConnected(): Promise<boolean>;
  isAuthorized(): Promise<boolean>;
  getContext(): Promise<ErgoAPI>;
}

export interface ErgoAPI {
  get_balance(tokenId?: string): Promise<string>;
  get_change_address(): Promise<string>;
  get_used_addresses(): Promise<string[]>;
  get_unused_addresses(): Promise<string[]>;
  get_utxos(): Promise<any[]>;
  get_current_height(): Promise<number>;
  sign_tx(tx: any): Promise<any>;
  submit_tx(signedTx: any): Promise<string>;
  sign_data(data: string, address?: string): Promise<string>;
}

export interface ErgoConnector {
  nautilus?: NautilusAPI;
}

// Window extensions for browser wallet
declare global {
  interface Window {
    ergoConnector?: ErgoConnector;
    ergo?: ErgoAPI;
  }
}

export interface WalletState {
  isConnected: boolean;
  walletAddress: string | null;
  isAuthenticated: boolean;
  balance: string | null;
  loading: boolean;
  error: string | null;
}

export interface AuthenticationRequest {
  wallet_address: string;
  message: string;
  signature: string;
}
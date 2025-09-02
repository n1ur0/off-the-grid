import { NautilusAPI, ErgoAPI, WalletState } from '@/types/wallet';

export class NautilusWalletManager {
  private ergoContext: ErgoAPI | null = null;
  private listeners: ((state: Partial<WalletState>) => void)[] = [];

  /**
   * Check if Nautilus wallet is available in the browser
   */
  async checkAvailability(): Promise<boolean> {
    return typeof window !== 'undefined' && 
           window.ergoConnector?.nautilus !== undefined;
  }

  /**
   * Connect to Nautilus wallet using official EIP-12 pattern
   */
  async connect(): Promise<boolean> {
    if (!await this.checkAvailability()) {
      throw new Error('Nautilus wallet not available. Please install the extension.');
    }

    try {
      // Use controlled connection pattern from official docs
      const isConnected = await window.ergoConnector!.nautilus!.connect({ 
        createErgoObject: false 
      });
      
      if (isConnected) {
        this.ergoContext = await window.ergoConnector!.nautilus!.getContext();
        this.notifyListeners({ isConnected: true });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Wallet connection failed:', error);
      this.notifyListeners({ 
        isConnected: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      });
      return false;
    }
  }

  /**
   * Disconnect from wallet
   */
  async disconnect(): Promise<void> {
    try {
      if (window.ergoConnector?.nautilus) {
        await window.ergoConnector.nautilus.disconnect();
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    } finally {
      this.ergoContext = null;
      this.notifyListeners({ 
        isConnected: false, 
        walletAddress: null, 
        balance: null 
      });
    }
  }

  /**
   * Check if wallet is currently connected
   */
  async isConnected(): Promise<boolean> {
    try {
      return window.ergoConnector?.nautilus?.isConnected() ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Sign authentication message for login
   */
  async signAuthMessage(message: string): Promise<string> {
    if (!this.ergoContext) {
      throw new Error('Wallet not connected');
    }
    
    try {
      const signature = await this.ergoContext.sign_data(message);
      return signature;
    } catch (error) {
      if (error instanceof Error) {
        // Handle user rejection specifically
        if (error.message.includes('rejected') || error.message.includes('denied')) {
          throw new Error('Signature was rejected by user');
        }
      }
      throw new Error(`Authentication signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sign and submit transaction
   */
  async signTransaction(tx: any): Promise<string> {
    if (!this.ergoContext) {
      throw new Error('Wallet not connected');
    }
    
    try {
      const signedTx = await this.ergoContext.sign_tx(tx);
      const txId = await this.ergoContext.submit_tx(signedTx);
      return txId;
    } catch (error) {
      if (error instanceof Error) {
        // Handle user rejection specifically
        if (error.message.includes('rejected') || error.message.includes('denied')) {
          throw new Error('Transaction was rejected by user');
        }
      }
      throw new Error(`Transaction signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get UTXOs for the wallet
   */
  async getUtxos(): Promise<any[]> {
    if (!this.ergoContext) {
      throw new Error('Wallet not connected');
    }
    
    try {
      return await this.ergoContext.get_utxos();
    } catch (error) {
      throw new Error(`Failed to get UTXOs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get wallet network type
   */
  async getNetworkType(): Promise<string> {
    if (!this.ergoContext) {
      throw new Error('Wallet not connected');
    }
    
    try {
      // Check the current height to determine if mainnet or testnet
      const height = await this.ergoContext.get_current_height();
      // This is a heuristic - mainnet has much higher block heights
      return height > 500000 ? 'mainnet' : 'testnet';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get wallet address
   */
  async getWalletAddress(): Promise<string> {
    if (!this.ergoContext) {
      throw new Error('Wallet not connected');
    }
    
    try {
      return await this.ergoContext.get_change_address();
    } catch (error) {
      throw new Error(`Failed to get wallet address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get wallet balance for a specific token or ERG
   */
  async getBalance(tokenId?: string): Promise<string> {
    if (!this.ergoContext) {
      throw new Error('Wallet not connected');
    }
    
    try {
      return await this.ergoContext.get_balance(tokenId);
    } catch (error) {
      throw new Error(`Failed to get balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all used addresses
   */
  async getUsedAddresses(): Promise<string[]> {
    if (!this.ergoContext) {
      throw new Error('Wallet not connected');
    }
    
    return await this.ergoContext.get_used_addresses();
  }

  /**
   * Get current blockchain height
   */
  async getCurrentHeight(): Promise<number> {
    if (!this.ergoContext) {
      throw new Error('Wallet not connected');
    }
    
    return await this.ergoContext.get_current_height();
  }

  /**
   * Generate authentication challenge message
   */
  generateAuthMessage(timestamp: number = Date.now()): string {
    return `Off the Grid Authentication\nTimestamp: ${timestamp}\nPlease sign this message to authenticate.`;
  }

  /**
   * Subscribe to wallet state changes
   */
  subscribe(listener: (state: Partial<WalletState>) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(state: Partial<WalletState>): void {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in wallet state listener:', error);
      }
    });
  }

  /**
   * Initialize wallet state check with reconnection support
   */
  async initialize(): Promise<WalletState> {
    const initialState: WalletState = {
      isConnected: false,
      walletAddress: null,
      isAuthenticated: false,
      balance: null,
      loading: false,
      error: null,
    };

    if (!await this.checkAvailability()) {
      return {
        ...initialState,
        error: 'Nautilus wallet not available. Please install the extension.'
      };
    }

    try {
      const isConnected = await this.isConnected();
      if (isConnected) {
        this.ergoContext = await window.ergoConnector!.nautilus!.getContext();
        const address = await this.getWalletAddress();
        const balance = await this.getBalance();
        
        this.notifyListeners({ 
          isConnected: true, 
          walletAddress: address, 
          balance 
        });
        
        return {
          ...initialState,
          isConnected: true,
          walletAddress: address,
          balance,
        };
      }
    } catch (error) {
      console.error('Wallet initialization error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Initialization failed';
      
      this.notifyListeners({ error: errorMessage });
      
      return {
        ...initialState,
        error: errorMessage
      };
    }

    return initialState;
  }

  /**
   * Auto-reconnect on page refresh if previously connected
   */
  async autoReconnect(): Promise<boolean> {
    if (!await this.checkAvailability()) {
      return false;
    }

    try {
      // Check if wallet was previously authorized
      const isAuthorized = await window.ergoConnector!.nautilus!.isAuthorized();
      if (isAuthorized) {
        return await this.connect();
      }
    } catch (error) {
      console.error('Auto-reconnect failed:', error);
    }
    
    return false;
  }

  /**
   * Get balance for multiple tokens
   */
  async getTokenBalances(tokenIds: string[] = []): Promise<{ [tokenId: string]: string }> {
    if (!this.ergoContext) {
      throw new Error('Wallet not connected');
    }
    
    const balances: { [tokenId: string]: string } = {};
    
    try {
      // Get ERG balance
      balances['ERG'] = await this.getBalance();
      
      // Get token balances
      for (const tokenId of tokenIds) {
        try {
          balances[tokenId] = await this.getBalance(tokenId);
        } catch (error) {
          console.warn(`Failed to get balance for token ${tokenId}:`, error);
          balances[tokenId] = '0';
        }
      }
    } catch (error) {
      throw new Error(`Failed to get token balances: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return balances;
  }

  /**
   * Monitor account changes and notify listeners
   */
  setupAccountMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Monitor wallet connection changes
    const checkConnectionPeriodically = () => {
      setInterval(async () => {
        try {
          const isConnected = await this.isConnected();
          
          if (isConnected && !this.ergoContext) {
            // Wallet was connected externally, update context
            this.ergoContext = await window.ergoConnector!.nautilus!.getContext();
            const address = await this.getWalletAddress();
            const balance = await this.getBalance();
            
            this.notifyListeners({ 
              isConnected: true, 
              walletAddress: address, 
              balance 
            });
          } else if (!isConnected && this.ergoContext) {
            // Wallet was disconnected externally
            this.ergoContext = null;
            this.notifyListeners({ 
              isConnected: false, 
              walletAddress: null, 
              balance: null 
            });
          }
        } catch (error) {
          console.error('Connection monitoring error:', error);
        }
      }, 5000); // Check every 5 seconds
    };

    // Start monitoring after a short delay
    setTimeout(checkConnectionPeriodically, 1000);
  }
}

// Singleton instance
export const walletManager = new NautilusWalletManager();

// Initialize account monitoring when module loads
if (typeof window !== 'undefined') {
  walletManager.setupAccountMonitoring();
}
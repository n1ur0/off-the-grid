import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { walletManager } from '@/lib/wallet';
import { WalletState } from '@/types/wallet';
import { apiClient } from '@/lib/api';

interface AuthState extends WalletState {
  // JWT and session state
  authToken: string | null;
  sessionExpiry: number | null;
  lastActivity: number | null;
  
  // Actions
  connect: () => Promise<boolean>;
  disconnect: () => void;
  login: () => Promise<boolean>;
  logout: () => void;
  refreshBalance: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  checkSession: () => boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  initialize: () => Promise<void>;
  autoReconnect: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      isConnected: false,
      walletAddress: null,
      isAuthenticated: false,
      balance: null,
      loading: false,
      error: null,
      authToken: null,
      sessionExpiry: null,
      lastActivity: null,

      // Actions
      connect: async () => {
        const state = get();
        if (state.loading) return false;

        set({ loading: true, error: null });

        try {
          const connected = await walletManager.connect();
          
          if (connected) {
            const address = await walletManager.getWalletAddress();
            const balance = await walletManager.getBalance();
            
            set({ 
              isConnected: true, 
              walletAddress: address, 
              balance,
              loading: false 
            });
            
            return true;
          } else {
            set({ 
              isConnected: false, 
              walletAddress: null,
              balance: null,
              loading: false,
              error: 'Failed to connect to wallet'
            });
            return false;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Connection failed';
          set({ 
            isConnected: false,
            walletAddress: null, 
            balance: null,
            loading: false,
            error: errorMessage 
          });
          return false;
        }
      },

      disconnect: async () => {
        try {
          await walletManager.disconnect();
        } catch (error) {
          console.error('Disconnect error:', error);
        }
        
        set({ 
          isConnected: false,
          walletAddress: null,
          isAuthenticated: false,
          balance: null,
          error: null
        });
      },

      login: async () => {
        const state = get();
        if (!state.isConnected || !state.walletAddress) {
          set({ error: 'Wallet not connected' });
          return false;
        }

        set({ loading: true, error: null });

        try {
          // Generate authentication message
          const timestamp = Date.now();
          const message = walletManager.generateAuthMessage(timestamp);
          
          // Sign the message
          const signature = await walletManager.signAuthMessage(message);
          
          // Send authentication request to API
          const response = await apiClient.login({
            wallet_address: state.walletAddress,
            message,
            signature
          });

          if (response.success) {
            // Extract JWT from response or cookies
            const authToken = response.token || 'auth-token-from-cookie';
            const sessionExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
            
            set({ 
              isAuthenticated: true, 
              loading: false,
              authToken,
              sessionExpiry,
              lastActivity: Date.now()
            });
            return true;
          } else {
            set({ 
              isAuthenticated: false, 
              loading: false,
              error: response.error || 'Authentication failed'
            });
            return false;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Login failed';
          
          // Handle specific error types
          if (errorMessage.includes('rejected')) {
            set({ 
              isAuthenticated: false, 
              loading: false,
              error: 'Authentication was cancelled by user' 
            });
          } else {
            set({ 
              isAuthenticated: false, 
              loading: false,
              error: errorMessage 
            });
          }
          return false;
        }
      },

      logout: () => {
        // Clear JWT token and session data
        set({ 
          isAuthenticated: false,
          authToken: null,
          sessionExpiry: null,
          lastActivity: null,
          error: null 
        });
        
        // Clear any auth cookies
        if (typeof document !== 'undefined') {
          document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        }
      },

      refreshBalance: async () => {
        const state = get();
        if (!state.isConnected) return;

        try {
          const balance = await walletManager.getBalance();
          set({ 
            balance, 
            error: null,
            lastActivity: Date.now() 
          });
        } catch (error) {
          console.error('Failed to refresh balance:', error);
          set({ error: 'Failed to refresh balance' });
        }
      },

      refreshAuth: async () => {
        const state = get();
        if (!state.isConnected || !state.walletAddress) {
          return false;
        }

        try {
          // Check if we have a valid session
          if (state.authToken && state.sessionExpiry && Date.now() < state.sessionExpiry) {
            set({ 
              isAuthenticated: true,
              lastActivity: Date.now()
            });
            return true;
          }
          
          // Try to refresh the session
          return await get().login();
        } catch (error) {
          console.error('Auth refresh failed:', error);
          get().logout();
          return false;
        }
      },

      checkSession: () => {
        const state = get();
        
        // Check if session is expired
        if (state.sessionExpiry && Date.now() > state.sessionExpiry) {
          get().logout();
          return false;
        }
        
        // Check for inactivity (30 minutes)
        const thirtyMinutes = 30 * 60 * 1000;
        if (state.lastActivity && Date.now() - state.lastActivity > thirtyMinutes) {
          get().logout();
          return false;
        }
        
        return state.isAuthenticated;
      },

      setLoading: (loading: boolean) => set({ loading }),

      setError: (error: string | null) => set({ error }),

      clearError: () => set({ error: null }),

      autoReconnect: async () => {
        const state = get();
        
        // Don't auto-reconnect if already connected
        if (state.isConnected) return true;
        
        try {
          const success = await walletManager.autoReconnect();
          if (success) {
            const address = await walletManager.getWalletAddress();
            const balance = await walletManager.getBalance();
            
            set({ 
              isConnected: true, 
              walletAddress: address, 
              balance,
              lastActivity: Date.now() 
            });
            
            // Try to restore authentication if we have a valid session
            if (state.authToken && state.sessionExpiry && Date.now() < state.sessionExpiry) {
              set({ isAuthenticated: true });
            }
            
            return true;
          }
        } catch (error) {
          console.error('Auto-reconnect failed:', error);
        }
        
        return false;
      },

      initialize: async () => {
        set({ loading: true });

        try {
          // First try auto-reconnection
          const reconnected = await get().autoReconnect();
          
          if (!reconnected) {
            // Fall back to regular initialization
            const walletState = await walletManager.initialize();
            set({ 
              ...walletState, 
              loading: false 
            });
          } else {
            set({ loading: false });
          }

          // Set up wallet state listener
          walletManager.subscribe((newState) => {
            set({
              ...newState,
              lastActivity: Date.now()
            });
          });

          // Set up session checking interval
          setInterval(() => {
            get().checkSession();
          }, 60000); // Check every minute

        } catch (error) {
          console.error('Auth initialization error:', error);
          set({ 
            loading: false,
            error: error instanceof Error ? error.message : 'Initialization failed'
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      // Only persist certain fields
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        authToken: state.authToken,
        sessionExpiry: state.sessionExpiry,
        lastActivity: state.lastActivity,
        // Don't persist sensitive wallet state or errors
      }),
      // Clear persisted data if version changes
      version: 2, // Updated version to handle new fields
    }
  )
);
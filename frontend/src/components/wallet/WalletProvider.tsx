'use client';

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuthStore } from '@/lib/stores/auth';
import { WalletState } from '@/types/wallet';

interface WalletContextValue extends WalletState {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  login: () => Promise<boolean>;
  logout: () => void;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const {
    isConnected,
    walletAddress,
    isAuthenticated,
    balance,
    loading,
    error,
    connect,
    disconnect,
    login,
    logout,
    refreshBalance,
    initialize,
  } = useAuthStore();

  // Initialize wallet state on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Auto-refresh balance every 30 seconds if connected
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      refreshBalance();
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected, refreshBalance]);

  const contextValue: WalletContextValue = {
    isConnected,
    walletAddress,
    isAuthenticated,
    balance,
    loading,
    error,
    connect,
    disconnect,
    login,
    logout,
    refreshBalance,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}
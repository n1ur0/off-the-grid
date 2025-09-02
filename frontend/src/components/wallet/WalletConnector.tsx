'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from './WalletProvider';
import { 
  WalletIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  UserCircleIcon 
} from '@heroicons/react/24/outline';
import { walletManager } from '@/lib/wallet';

interface WalletConnectorProps {
  onConnected?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  showBalance?: boolean;
  showNetworkInfo?: boolean;
  tokenIds?: string[];
  compact?: boolean;
}

export function WalletConnector({ 
  onConnected, 
  className = '',
  variant = 'primary',
  size = 'md',
  showBalance = false,
  showNetworkInfo = false,
  tokenIds = [],
  compact = false
}: WalletConnectorProps) {
  const { 
    isConnected, 
    walletAddress, 
    loading, 
    error, 
    connect, 
    disconnect 
  } = useWallet();
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [tokenBalances, setTokenBalances] = useState<{ [key: string]: string }>({});
  const [networkType, setNetworkType] = useState<string>('unknown');
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  // Auto-retry connection after failures
  useEffect(() => {
    if (error && !isConnected && retryCount < 3) {
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        handleConnect(true); // Silent retry
      }, 2000 * Math.pow(2, retryCount)); // Exponential backoff
      
      return () => clearTimeout(timer);
    }
  }, [error, isConnected, retryCount]);

  // Fetch token balances and network info when connected
  useEffect(() => {
    if (isConnected && walletAddress) {
      fetchAdditionalInfo();
    } else {
      setTokenBalances({});
      setNetworkType('unknown');
    }
  }, [isConnected, walletAddress, tokenIds]);

  const fetchAdditionalInfo = async () => {
    try {
      if (showBalance && tokenIds.length > 0) {
        const balances = await walletManager.getTokenBalances(tokenIds);
        setTokenBalances(balances);
      }
      
      if (showNetworkInfo) {
        const network = await walletManager.getNetworkType();
        setNetworkType(network);
      }
    } catch (err) {
      console.error('Failed to fetch additional wallet info:', err);
    }
  };

  const handleConnect = async (silent = false) => {
    if (!silent) {
      setIsConnecting(true);
      setLastError(null);
    }
    
    try {
      const success = await connect();
      if (success) {
        setRetryCount(0); // Reset retry count on success
        if (onConnected) {
          onConnected();
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      setLastError(errorMessage);
      console.error('Connection error:', err);
    } finally {
      if (!silent) {
        setIsConnecting(false);
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setRetryCount(0);
      setLastError(null);
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  const formatBalance = (balance: string, decimals = 9): string => {
    try {
      const num = parseFloat(balance) / Math.pow(10, decimals);
      return num.toFixed(4);
    } catch {
      return '0.0000';
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const buttonSizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const buttonVariants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary'
  };

  if (isConnected && walletAddress) {
    if (compact) {
      return (
        <div className={`flex items-center space-x-2 ${className}`}>
          <div className="flex items-center space-x-1 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircleIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-green-800 dark:text-green-200">
              {formatAddress(walletAddress)}
            </span>
          </div>
          
          <button
            onClick={handleDisconnect}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            ×
          </button>
        </div>
      );
    }

    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center space-x-3">
            <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  {formatAddress(walletAddress)}
                </span>
                {showNetworkInfo && networkType !== 'unknown' && (
                  <span className={`text-xs px-2 py-1 rounded ${
                    networkType === 'mainnet' 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                      : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200'
                  }`}>
                    {networkType.toUpperCase()}
                  </span>
                )}
              </div>
              
              {showBalance && Object.keys(tokenBalances).length > 0 && (
                <div className="mt-2 space-y-1">
                  {Object.entries(tokenBalances).map(([tokenId, balance]) => (
                    <div key={tokenId} className="flex items-center space-x-2 text-xs text-green-700 dark:text-green-300">
                      <CurrencyDollarIcon className="h-3 w-3" />
                      <span>{tokenId === 'ERG' ? 'ERG' : `Token ${tokenId.slice(0, 8)}...`}:</span>
                      <span className="font-medium">{formatBalance(balance)} {tokenId === 'ERG' ? 'ERG' : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={handleDisconnect}
            className="text-sm text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 transition-colors font-medium"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <button
        onClick={() => handleConnect()}
        disabled={loading || isConnecting}
        className={`
          ${buttonVariants[variant]} 
          ${buttonSizes[size]}
          flex items-center space-x-2 
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200
          ${isConnecting ? 'animate-pulse' : ''}
        `}
      >
        {loading || isConnecting ? (
          <ArrowPathIcon className="h-5 w-5 animate-spin" />
        ) : (
          <WalletIcon className="h-5 w-5" />
        )}
        <span>
          {loading || isConnecting ? (
            retryCount > 0 ? `Retrying... (${retryCount}/3)` : 'Connecting...'
          ) : 'Connect Nautilus Wallet'}
        </span>
      </button>
      
      {retryCount > 0 && retryCount < 3 && (
        <div className="flex items-center justify-center mt-2">
          <div className="flex space-x-1">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={`h-1 w-8 rounded ${
                  i < retryCount ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {(error || lastError) && retryCount >= 3 && (
        <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-700 dark:text-red-300">
            <p className="font-medium">Connection Failed</p>
            <p className="mt-1">{error || lastError}</p>
            {(error || lastError)?.includes('not available') && (
              <p className="mt-2">
                <a 
                  href="https://chrome.google.com/webstore/detail/nautilus/gjlmehlldlphhljhpnlddaodbjjcchai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-600 dark:text-red-400 underline hover:text-red-800 dark:hover:text-red-200"
                >
                  Install Nautilus Wallet Extension
                </a>
              </p>
            )}
            {(error || lastError)?.includes('rejected') && (
              <p className="mt-2 text-xs">
                Please accept the connection request in your Nautilus wallet.
              </p>
            )}
            <button
              onClick={() => {
                setRetryCount(0);
                setLastError(null);
                handleConnect();
              }}
              className="mt-3 text-xs bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 px-3 py-1 rounded hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Wallet information for first-time users */}
      {!isConnected && !error && !lastError && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <UserCircleIcon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
              <p className="font-medium">New to Nautilus?</p>
              <p>
                Nautilus is the official wallet for the Ergo blockchain. It's secure, user-friendly, and supports all Ergo features.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <a 
                  href="https://chrome.google.com/webstore/detail/nautilus/gjlmehlldlphhljhpnlddaodbjjcchai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                >
                  Install Extension
                </a>
                <a 
                  href="https://docs.nautiluswallet.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline"
                >
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Connection status indicator */}
      {retryCount > 0 && retryCount < 3 && (
        <div className="flex items-center space-x-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
          <ArrowPathIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
          <span className="text-sm text-yellow-700 dark:text-yellow-300">
            Attempting to reconnect...
          </span>
        </div>
      )}
    </div>
  );
}
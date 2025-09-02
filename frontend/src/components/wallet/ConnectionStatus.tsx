'use client';

import React from 'react';
import { useWallet } from './WalletProvider';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  WifiIcon
} from '@heroicons/react/24/outline';

interface ConnectionStatusProps {
  variant?: 'full' | 'compact' | 'indicator';
  className?: string;
  showText?: boolean;
}

export function ConnectionStatus({ 
  variant = 'compact', 
  className = '',
  showText = true 
}: ConnectionStatusProps) {
  const { 
    isConnected, 
    isAuthenticated, 
    walletAddress, 
    loading, 
    error 
  } = useWallet();

  const getStatusInfo = () => {
    if (loading) {
      return {
        icon: ArrowPathIcon,
        text: 'Connecting...',
        className: 'text-yellow-600 dark:text-yellow-400',
        bgClassName: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
        animate: 'animate-spin'
      };
    }

    if (error) {
      return {
        icon: XCircleIcon,
        text: 'Connection Error',
        className: 'text-red-600 dark:text-red-400',
        bgClassName: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      };
    }

    if (isConnected && isAuthenticated) {
      return {
        icon: CheckCircleIcon,
        text: 'Connected & Authenticated',
        className: 'text-green-600 dark:text-green-400',
        bgClassName: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      };
    }

    if (isConnected) {
      return {
        icon: WifiIcon,
        text: 'Wallet Connected',
        className: 'text-blue-600 dark:text-blue-400',
        bgClassName: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      };
    }

    return {
      icon: XCircleIcon,
      text: 'Not Connected',
      className: 'text-gray-600 dark:text-gray-400',
      bgClassName: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
    };
  };

  const statusInfo = getStatusInfo();
  const IconComponent = statusInfo.icon;

  if (variant === 'indicator') {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <div className={`h-2 w-2 rounded-full ${
          isConnected && isAuthenticated ? 'bg-green-500' :
          isConnected ? 'bg-blue-500' :
          loading ? 'bg-yellow-500' :
          'bg-red-500'
        } ${loading ? 'animate-pulse' : ''}`} />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center space-x-1 ${className}`}>
        <IconComponent className={`h-4 w-4 ${statusInfo.className} ${statusInfo.animate || ''}`} />
        {showText && (
          <span className={`text-xs font-medium ${statusInfo.className}`}>
            {statusInfo.text}
          </span>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={`flex items-center space-x-2 p-2 rounded-lg border ${statusInfo.bgClassName} ${className}`}>
      <IconComponent className={`h-5 w-5 ${statusInfo.className} ${statusInfo.animate || ''}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${statusInfo.className}`}>
          {statusInfo.text}
        </p>
        {isConnected && walletAddress && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
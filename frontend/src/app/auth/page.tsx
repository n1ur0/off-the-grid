'use client';

import { Metadata } from 'next';
import { WalletConnector } from '@/components/wallet/WalletConnector';
import { ConnectionStatus } from '@/components/wallet/ConnectionStatus';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// Note: metadata should be moved to layout.tsx for client components

export default function AuthPage() {
  const { isConnected, isAuthenticated, login, loading } = useWallet();
  const router = useRouter();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async () => {
    if (!isConnected) return;
    
    setIsLoggingIn(true);
    setLoginError(null);
    
    try {
      const success = await login();
      if (success) {
        router.push('/dashboard');
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleWalletConnected = () => {
    // Auto-trigger login after wallet connection
    setTimeout(() => {
      handleLogin();
    }, 500);
  };
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <span className="text-6xl">⚡</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Connect Your Wallet
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Connect your Nautilus wallet to start trading with grid strategies on the Ergo blockchain
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <div className="space-y-4">
            {/* Connection Status */}
            <ConnectionStatus variant="full" />
            
            {/* Wallet Connection */}
            <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {isConnected ? 'Authenticate Wallet' : 'Connect Your Wallet'}
              </h3>
              
              {!isConnected ? (
                <WalletConnector onConnected={handleWalletConnected} />
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Wallet connected successfully. Click below to authenticate and access grid trading features.
                  </p>
                  
                  <button
                    onClick={handleLogin}
                    disabled={isLoggingIn || loading}
                    className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-medium transition-colors"
                  >
                    {isLoggingIn ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Signing Message...</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span>Authenticate with Signature</span>
                      </>
                    )}
                  </button>
                  
                  {loginError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-700 dark:text-red-300">{loginError}</p>
                    </div>
                  )}
                </div>
              )}
            
              <div className="mt-6 text-xs text-gray-500 dark:text-gray-400">
                <p>
                  By connecting your wallet, you agree to our Terms of Service and Privacy Policy.
                  Your wallet information is never stored on our servers.
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  New to Ergo?
                </h3>
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                  <p>
                    You'll need the Nautilus wallet to interact with Ergo blockchain. 
                    <a 
                      href="https://github.com/capt-nemo429/nautilus-wallet" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline hover:text-blue-600 dark:hover:text-blue-200"
                    >
                      Download Nautilus Wallet
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
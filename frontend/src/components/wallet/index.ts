// Wallet Components and Utilities Export Index

// Core wallet manager
export { walletManager, NautilusWalletManager } from '@/lib/wallet';

// React components
export { WalletProvider, useWallet } from './WalletProvider';
export { WalletConnector } from './WalletConnector';
export { ConnectionStatus } from './ConnectionStatus';

// Auth store
export { useAuthStore } from '@/lib/stores/auth';

// Types
export type { 
  WalletState, 
  AuthenticationRequest, 
  NautilusAPI, 
  ErgoAPI, 
  ErgoConnector 
} from '@/types/wallet';

// Usage example:
/*
import { WalletProvider, WalletConnector, ConnectionStatus } from '@/components/wallet';

function App() {
  return (
    <WalletProvider>
      <div>
        <ConnectionStatus variant="compact" />
        <WalletConnector showBalance tokenIds={['token1', 'token2']} />
      </div>
    </WalletProvider>
  );
}
*/
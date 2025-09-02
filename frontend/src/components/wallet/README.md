# Nautilus Wallet Integration

This directory contains the complete Nautilus wallet integration for the Off the Grid trading platform, built according to the PRP specifications and official Nautilus documentation patterns.

## Quick Start

```tsx
import { WalletProvider, WalletConnector, ConnectionStatus } from '@/components/wallet';

function App() {
  return (
    <WalletProvider>
      <ConnectionStatus variant="compact" />
      <WalletConnector 
        showBalance={true}
        tokenIds={['your-token-id']}
        onConnected={() => console.log('Wallet connected!')}
      />
    </WalletProvider>
  );
}
```

## Components

### WalletProvider
Context provider that manages global wallet state. Wrap your app root with this component.

**Features:**
- Auto-initialization on app start
- Automatic reconnection on page refresh
- Session management with JWT tokens
- Real-time connection monitoring

### WalletConnector
Main component for wallet connection and authentication.

**Props:**
- `onConnected?: () => void` - Callback after successful connection
- `variant?: 'primary' | 'secondary'` - Button styling
- `size?: 'sm' | 'md' | 'lg'` - Button size
- `showBalance?: boolean` - Display wallet balances
- `tokenIds?: string[]` - Custom tokens to display
- `compact?: boolean` - Compact display mode

**Features:**
- Auto-retry on connection failures (up to 3 attempts)
- Balance display for ERG and custom tokens
- Network type detection (mainnet/testnet)
- User-friendly error messages with solutions
- Mobile-responsive design

### ConnectionStatus
Displays current wallet connection status.

**Props:**
- `variant?: 'full' | 'compact' | 'indicator'` - Display mode
- `className?: string` - Custom CSS classes
- `showText?: boolean` - Show status text

**Variants:**
- `indicator`: Simple dot indicator
- `compact`: Icon + text
- `full`: Complete status card with address and error details

## Core Features

### 🔐 **Secure Authentication**
- EIP-12 compliant message signing
- JWT token management with HTTP-only cookies
- Session expiry and inactivity timeouts
- Automatic token refresh

### 🔄 **Auto-Reconnection**
- Page refresh persistence
- Browser restart recovery (if wallet still authorized)
- Network disconnection recovery
- Connection state monitoring every 5 seconds

### 💰 **Balance Management**
- ERG balance display with proper decimal conversion
- Multi-token support for custom tokens
- Auto-refresh every 30 seconds when connected
- Graceful handling of missing tokens

### 📱 **Responsive Design**
- Desktop-first with mobile optimization
- Compact modes for mobile navigation
- Touch-friendly buttons and interactions
- Adaptive error messages

### 🛠 **Developer Experience**
- TypeScript support throughout
- Comprehensive error handling
- Extensive logging for debugging
- Clean separation of concerns

## Security Features

### Message Signing
```typescript
// Authentication message format
const message = `Off the Grid Authentication
Timestamp: ${timestamp}
Please sign this message to authenticate.`;
```

### Session Management
- 24-hour session expiry
- 30-minute inactivity timeout
- Secure token storage
- Automatic cleanup on logout

### Error Handling
- User rejection detection
- Network error recovery
- Extension availability checking
- Graceful degradation

## Integration Points

### API Authentication
The wallet manager integrates with the FastAPI backend:

```typescript
// Login request format
interface AuthenticationRequest {
  wallet_address: string;
  message: string;
  signature: string;
}

// API response handling
const response = await apiClient.login(authRequest);
```

### WebSocket Connection
Authenticated users automatically connect to WebSocket for real-time updates:

```typescript
// WebSocket connection with user ID
wsClient.connect(walletAddress);
wsClient.subscribeToGrids();
```

### State Management
Uses Zustand for predictable state management:

```typescript
const { 
  isConnected, 
  isAuthenticated, 
  walletAddress, 
  balance,
  connect,
  login,
  logout 
} = useWallet();
```

## Configuration

### Environment Variables
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Package Dependencies
- `@nautilus-js/eip12-types`: Official Nautilus types
- `@heroicons/react`: UI icons
- `zustand`: State management

## Error Handling

### Common Error Scenarios
1. **Extension Not Installed**: Clear installation link
2. **Connection Rejected**: User-friendly retry option
3. **Network Issues**: Automatic retry with exponential backoff
4. **Session Expired**: Automatic logout and re-authentication prompt

### Error Messages
All error messages are user-friendly and actionable:
- "Nautilus wallet not available. Please install the extension."
- "Signature was rejected by user"
- "Session expired due to inactivity"

## Testing

See `test/wallet-integration.test.md` for comprehensive testing guide.

### Manual Testing
1. Install Nautilus extension
2. Navigate to `/auth`
3. Test connection flow
4. Verify authentication
5. Test page refresh behavior

### Automated Tests
```bash
npm test -- --testPathPattern="wallet"
npm run type-check
```

## Browser Support

### Desktop
- ✅ Chrome (Primary - Nautilus native support)
- ⚠️ Firefox (If Nautilus extension available)
- ⚠️ Safari/Edge (Graceful degradation with install prompt)

### Mobile
- 📱 Responsive design with desktop wallet requirement messaging
- 🔗 Working install links for mobile users to bookmark

## Advanced Usage

### Custom Token Balances
```tsx
<WalletConnector 
  showBalance={true}
  tokenIds={[
    '03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04',
    '0cd8c9f416e5b1ca9f986a7f10a84191dfb85941619e49e53c0dc30ebf83324b'
  ]}
/>
```

### Connection Callbacks
```tsx
<WalletConnector 
  onConnected={() => {
    // Custom logic after connection
    analytics.track('wallet_connected');
    router.push('/dashboard');
  }}
/>
```

### Transaction Signing (Future)
```typescript
// Available for future grid creation
const txId = await walletManager.signTransaction(gridCreationTx);
```

This integration provides a complete, production-ready Nautilus wallet solution following all Ergo blockchain best practices and official documentation patterns.
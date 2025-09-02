# Nautilus Wallet Integration Test Guide

## Overview
This guide provides comprehensive testing procedures for the Nautilus wallet integration in the Off the Grid trading platform.

## Test Scenarios

### 1. Wallet Detection and Installation
**Test Case 1.1: Nautilus Not Installed**
- Open the app without Nautilus extension installed
- Expected: Clear error message with install link
- Expected: "Install Nautilus Wallet Extension" link works

**Test Case 1.2: Nautilus Installed but Not Setup**
- Install Nautilus but don't create wallet
- Expected: Connection fails with appropriate error message

### 2. Wallet Connection Flow
**Test Case 2.1: Initial Connection**
- Navigate to `/auth` page
- Click "Connect Nautilus Wallet"
- Expected: Nautilus popup appears
- Accept connection in Nautilus
- Expected: Connection success, wallet address displayed

**Test Case 2.2: Connection Rejection**
- Click "Connect Nautilus Wallet"
- Reject connection in Nautilus popup
- Expected: Clear error message about user rejection
- Expected: Retry functionality available

**Test Case 2.3: Network Issues**
- Disconnect internet during connection
- Expected: Network error handling with retry options

### 3. Authentication Flow
**Test Case 3.1: Message Signing**
- Connect wallet successfully
- Click "Authenticate with Signature"
- Expected: Nautilus shows signing request
- Sign the message
- Expected: Authentication success, redirect to dashboard

**Test Case 3.2: Signing Rejection**
- Connect wallet
- Attempt authentication
- Reject signing in Nautilus
- Expected: Clear error about signature rejection
- Expected: Able to retry authentication

### 4. Auto-Reconnection
**Test Case 4.1: Page Refresh**
- Connect and authenticate wallet
- Refresh the page
- Expected: Wallet automatically reconnects
- Expected: Authentication state preserved

**Test Case 4.2: Browser Restart**
- Connect and authenticate wallet
- Close and reopen browser
- Expected: Wallet connection restored if still authorized
- Expected: Session restored within expiry time

### 5. Session Management
**Test Case 5.1: Session Expiry**
- Authenticate wallet
- Wait for session expiry (or mock time)
- Expected: Automatic logout
- Expected: Redirect to auth page for protected routes

**Test Case 5.2: Inactivity Timeout**
- Authenticate wallet
- Remain idle for 30+ minutes
- Expected: Session expires due to inactivity
- Expected: Clear notification about timeout

### 6. Balance Display and Token Support
**Test Case 6.1: ERG Balance**
- Connect wallet with ERG balance
- Expected: Balance displays correctly in nanoERG converted to ERG
- Expected: Balance updates when refreshed

**Test Case 6.2: Custom Tokens**
- Configure token IDs in WalletConnector props
- Connect wallet with custom tokens
- Expected: Token balances display
- Expected: Unknown tokens show as "0.0000"

### 7. Connection Status Indicators
**Test Case 7.1: Navigation Status**
- Navigate through app pages
- Expected: Connection status visible in navigation
- Expected: Different states (connecting, connected, authenticated) show correctly

**Test Case 7.2: Mobile Responsiveness**
- Test on mobile device
- Expected: Compact status indicators work
- Expected: Mobile navigation shows full status

### 8. Error Handling
**Test Case 8.1: Network Disconnection**
- Connect wallet
- Disconnect internet
- Attempt wallet operations
- Expected: Graceful error handling
- Expected: Auto-retry when connection restored

**Test Case 8.2: Wallet Lock**
- Connect and authenticate
- Lock Nautilus wallet
- Attempt wallet operations
- Expected: Appropriate error messages
- Expected: Prompt to unlock wallet

### 9. Transaction Signing (Future Use)
**Test Case 9.1: Transaction Preparation**
- Test transaction signing capability exists
- Expected: signTransaction method available
- Expected: Proper error handling for rejections

### 10. Multi-Tab Support
**Test Case 10.1: Multiple Tabs**
- Connect wallet in one tab
- Open app in another tab
- Expected: Connection state synchronized
- Expected: Changes in one tab reflect in others

## Performance Tests

### Load Time Tests
- Measure wallet initialization time
- Expected: < 2 seconds for connection check
- Expected: < 5 seconds for full initialization

### Memory Usage
- Monitor memory usage during extended use
- Expected: No memory leaks in wallet manager
- Expected: Proper cleanup on disconnection

## Security Tests

### Authentication Validation
- Verify message format follows security best practices
- Expected: Timestamp included in auth messages
- Expected: Unique challenge for each authentication

### Session Security
- Test JWT token handling
- Expected: Tokens stored securely (HTTP-only cookies)
- Expected: No sensitive data in localStorage

## Browser Compatibility

### Desktop Browsers
- Test on Chrome (primary Nautilus support)
- Test on Firefox (if Nautilus supports)
- Test on Edge/Safari (graceful degradation)

### Mobile Browsers
- Test responsive design
- Expected: Clear messaging about desktop requirement
- Expected: Links to install Nautilus work correctly

## API Integration Tests

### Authentication Endpoint
- Verify API login endpoint receives correct data
- Expected: wallet_address, message, signature sent
- Expected: Proper response handling

### WebSocket Connection
- Test WebSocket connection with authenticated user
- Expected: Connection established after authentication
- Expected: Real-time updates work correctly

## Deployment Verification

### Environment Variables
- Verify API_URL configuration
- Test WebSocket URL configuration
- Expected: Proper fallbacks for localhost development

### Build Process
- Test production build includes all wallet dependencies
- Expected: @nautilus-js/eip12-types included
- Expected: Type definitions properly bundled

## Manual Testing Checklist

□ Nautilus extension installed and configured
□ Create test wallet with some ERG
□ Navigate to `/auth` page
□ Test connection flow end-to-end
□ Test authentication flow
□ Verify navigation status indicators
□ Test page refresh behavior
□ Test session persistence
□ Verify error messages are user-friendly
□ Test mobile responsiveness
□ Verify all links work correctly
□ Test disconnection and reconnection

## Automated Tests

```bash
# Run component tests
npm test -- --testPathPattern="wallet"

# Run integration tests
npm run test:e2e

# Run type checking
npm run type-check
```

## Common Issues and Solutions

### Issue: "Nautilus not available"
- Solution: Install Nautilus extension
- Verify: Extension enabled in browser

### Issue: Connection timeout
- Solution: Check network connectivity
- Verify: Nautilus extension responsive

### Issue: Authentication fails
- Solution: Clear browser storage
- Retry: Full connection flow

### Issue: Balance not updating
- Solution: Manual refresh button
- Check: Network connectivity

This comprehensive test suite ensures the Nautilus wallet integration is robust, secure, and user-friendly across all supported scenarios.
# Real-Time Grid Monitoring Dashboard

A comprehensive real-time trading dashboard system for the Off the Grid platform, implementing Phase 3 Task 3.2 requirements with WebSocket-powered live updates, performance analytics, alert management, and portfolio oversight.

## 🚀 Key Features

### Real-Time Monitoring
- **Live Grid Status**: WebSocket-powered real-time updates for all active grid orders
- **Price Tracking**: Real-time price movements and trend indicators  
- **Order Execution**: Live visualization of order fills and grid activity
- **Connection Health**: Built-in connection status monitoring with auto-reconnect

### Performance Analytics
- **P&L Tracking**: Comprehensive profit/loss analysis with time series charts
- **Risk Metrics**: Sharpe ratio, maximum drawdown, volatility analysis
- **ROI Calculations**: Return on investment tracking across timeframes
- **Performance Distribution**: Individual grid performance comparison

### Alert System
- **Real-Time Notifications**: Configurable alerts for significant events
- **Smart Rules Engine**: Price changes, P&L thresholds, grid status alerts
- **Priority Management**: Critical, high, medium, low priority classifications
- **Sound Notifications**: Audio alerts for important events

### Portfolio Management
- **Multi-Grid Overview**: Consolidated view of all trading positions
- **Asset Allocation**: Visual breakdown of portfolio distribution
- **Risk Analysis**: Concentration, correlation, liquidity, and volatility risks
- **Rebalancing Recommendations**: AI-powered portfolio optimization suggestions

## 📁 Component Architecture

### Core Components

#### `TradingDashboard.tsx`
Main dashboard component with responsive sidebar navigation and view management.

```tsx
import { TradingDashboard } from '@/components/trading';

// Usage
<TradingDashboard />
```

#### `GridMonitoringDashboard.tsx`
Real-time grid monitoring with live status updates and comprehensive grid management.

**Features:**
- Live grid status table with sortable columns
- Real-time price updates and change indicators
- Active/inactive grid filtering
- Connection status monitoring
- Auto-refresh functionality

#### `PerformanceAnalytics.tsx`
Advanced performance analytics with multiple visualization modes.

**Features:**
- P&L time series charts (Area, Line, Bar)
- Risk metrics dashboard (Sharpe, Drawdown, Volatility)
- Performance distribution analysis
- Individual grid comparison
- Multiple timeframe support (1H, 1D, 7D, 30D, 3M, 1Y)

#### `AlertSystem.tsx`
Comprehensive alert management with configurable rules and notifications.

**Features:**
- Configurable alert rules (price, P&L, grid status)
- Real-time notifications with priority levels
- Sound notification support
- Alert history and management
- Rule-based automation

#### `PortfolioOverview.tsx`
Multi-grid portfolio management and risk analysis.

**Features:**
- Portfolio performance tracking
- Asset allocation visualization (Pie charts, TreeMaps)
- Risk analysis dashboard
- Rebalancing recommendations
- Correlation and concentration analysis

### Supporting Infrastructure

#### `useWebSocket.ts`
Custom React hook for managing WebSocket connections with advanced features.

**Features:**
- Auto-reconnection with exponential backoff
- Subscription management
- Heartbeat monitoring
- Connection state management
- Error handling and recovery

#### `websocketManager.ts`
Centralized WebSocket service for managing connections across the application.

**Features:**
- Singleton pattern for shared connections
- Event-driven architecture
- Topic subscription management
- Message routing and filtering
- Connection pooling

## 🔧 Setup and Configuration

### Environment Variables

```bash
# WebSocket Configuration
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws

# API Configuration  
NEXT_PUBLIC_API_URL=http://localhost:8000

# Feature Flags
NEXT_PUBLIC_ENABLE_SOUND_ALERTS=true
NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS=true
```

### Dependencies

The dashboard system requires the following dependencies:

```json
{
  "dependencies": {
    "recharts": "^2.8.0",
    "framer-motion": "^12.23.12",
    "lucide-react": "^0.295.0",
    "zustand": "^4.4.7",
    "clsx": "^2.0.0"
  }
}
```

### WebSocket Backend Integration

The dashboard connects to FastAPI WebSocket endpoints. Ensure your backend supports:

```python
# Expected WebSocket message formats
{
  "type": "grid_update",
  "topic": "grid_updates", 
  "data": {
    "grid_id": "...",
    "current_price": 1234.56,
    "status": "active",
    "pnl": 123.45
  }
}

{
  "type": "alert",
  "data": {
    "title": "Price Alert",
    "message": "BTC/ERG exceeded $50,000",
    "severity": "high",
    "priority": "high"
  }
}
```

## 📱 Mobile Responsiveness

All components are built with mobile-first responsive design:

- **Breakpoints**: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px)
- **Touch-friendly**: Large tap targets and swipe gestures
- **Adaptive Layouts**: Grid layouts collapse to single columns on mobile
- **Optimized Charts**: Charts resize and simplify on smaller screens

### Mobile-Specific Features
- Collapsible sidebar navigation
- Touch-optimized controls
- Reduced data density on small screens
- Swipe gestures for navigation

## 🎨 Theming and Customization

### Dark Mode Support
All components support both light and dark themes using Tailwind CSS dark mode classes:

```tsx
// Example theme-aware styling
className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
```

### Custom Color Schemes
Color schemes can be customized through CSS custom properties:

```css
:root {
  --color-primary: #3B82F6;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
}
```

## 🔔 Alert Configuration

### Alert Rule Types

```typescript
interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  category: 'price' | 'pnl' | 'volume' | 'grid_status' | 'performance';
  condition: 'above' | 'below' | 'equals' | 'change_percent';
  value: number;
  comparison_period?: '1m' | '5m' | '15m' | '1h' | '1d';
  notification_sound: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  gridIds?: string[]; // If empty, applies to all grids
}
```

### Default Alert Rules

1. **Price Surge +10%** - High priority, 15-minute window
2. **Price Drop -10%** - High priority, 15-minute window  
3. **Profit Exceeds $100** - Medium priority
4. **Loss Exceeds $50** - High priority
5. **Grid Stopped** - Critical priority

## 📊 Performance Considerations

### Optimization Strategies

1. **Data Virtualization**: Large datasets use virtual scrolling
2. **Memoization**: Heavy calculations cached with React.useMemo
3. **Debounced Updates**: WebSocket updates batched to prevent UI thrashing
4. **Chart Optimization**: Recharts configured for performance
5. **Memory Management**: Automatic cleanup of old data and subscriptions

### WebSocket Optimization

```typescript
// Connection pooling and message batching
const MESSAGE_BATCH_SIZE = 50;
const UPDATE_INTERVAL = 100; // ms

// Memory limits for historical data
const MAX_HISTORICAL_POINTS = 1000;
const CLEANUP_THRESHOLD = 1200;
```

## 🧪 Testing

### Component Testing

```bash
# Run component tests
npm test src/components/trading

# Test WebSocket functionality
npm test src/lib/hooks/useWebSocket.test.ts

# Test alert rules
npm test src/components/trading/AlertSystem.test.tsx
```

### Integration Testing

```bash
# Test real WebSocket connections
npm run test:e2e -- --spec="**/trading-dashboard.spec.ts"
```

## 🚀 Usage Examples

### Basic Dashboard Implementation

```tsx
import { TradingDashboard } from '@/components/trading';

function TradingPage() {
  return (
    <div className="min-h-screen">
      <TradingDashboard />
    </div>
  );
}
```

### Individual Component Usage

```tsx
import { 
  GridMonitoringDashboard,
  PerformanceAnalytics,
  AlertSystem,
  PortfolioOverview 
} from '@/components/trading';

function CustomDashboard() {
  return (
    <div className="space-y-8">
      <PortfolioOverview />
      <GridMonitoringDashboard />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <PerformanceAnalytics />
        <AlertSystem />
      </div>
    </div>
  );
}
```

### WebSocket Hook Usage

```tsx
import { useWebSocket } from '@/lib/hooks/useWebSocket';

function CustomComponent() {
  const { connectionState, subscribe, sendMessage } = useWebSocket({
    url: 'ws://localhost:8000/ws',
    onMessage: (message) => {
      console.log('Received:', message);
    }
  });

  useEffect(() => {
    if (connectionState === 'connected') {
      subscribe('grid_updates');
      subscribe('price_updates');
    }
  }, [connectionState, subscribe]);

  return (
    <div>
      Status: {connectionState}
    </div>
  );
}
```

## 🔧 Troubleshooting

### Common Issues

#### WebSocket Connection Failures
- **Check URL**: Ensure `NEXT_PUBLIC_WS_URL` is correctly set
- **CORS Policy**: Verify backend CORS settings allow WebSocket connections
- **Network**: Check firewall and proxy settings

#### Performance Issues
- **Memory Leaks**: Ensure components properly cleanup subscriptions
- **Update Frequency**: Reduce WebSocket update frequency if UI lags
- **Chart Performance**: Limit historical data points for better rendering

#### Alert System Issues
- **Sound Notifications**: Check browser audio permissions
- **Rule Conflicts**: Ensure alert rules don't conflict with each other
- **Priority Handling**: Verify priority levels are correctly configured

### Debug Mode

Enable debug logging in development:

```typescript
// Add to your environment
NEXT_PUBLIC_DEBUG_WEBSOCKET=true
NEXT_PUBLIC_DEBUG_ALERTS=true

// Will log detailed information to browser console
```

## 📈 Performance Benchmarks

### Recommended Limits
- **Concurrent Grid Monitoring**: Up to 50 active grids
- **Historical Data Points**: 1000 points per chart
- **Alert Rules**: Up to 20 active rules
- **WebSocket Messages**: 100 messages/second sustained

### Browser Compatibility
- **Chrome**: 90+ (recommended)
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

## 🤝 Contributing

### Code Style
- Follow existing TypeScript patterns
- Use functional components with hooks
- Implement proper error boundaries
- Add JSDoc comments for complex functions

### Pull Request Process
1. Add comprehensive tests for new features
2. Update documentation for API changes
3. Ensure mobile responsiveness
4. Test WebSocket connectivity
5. Verify performance impact

---

## 📄 License

This dashboard system is part of the Off the Grid trading platform and follows the project's main license terms.
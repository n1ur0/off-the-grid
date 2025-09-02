# Off the Grid API v2.0 Documentation

## Overview

The Off the Grid API v2.0 is a comprehensive RESTful API for the decentralized grid trading platform built on the Ergo blockchain. This enhanced version includes advanced features for trading bots, webhook notifications, comprehensive authentication, and real-time data streaming.

## Quick Start

### 1. Authentication

The API supports multiple authentication methods:

**JWT Bearer Tokens** (for web applications):
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "9fRAWhdxEsTcdb8PhGNrpfkCk4Dz8V3u5oT2YXQT1234567890abcdef",
    "message": "Login to Off the Grid - 2024-01-01T12:00:00Z",
    "signature": "your_wallet_signature_here"
  }'
```

**API Keys** (for bots and server-to-server):
```bash
curl -X GET "http://localhost:8000/api/v1/grids" \
  -H "X-API-Key: otg_your_api_key_here"
```

### 2. Create a Grid Order

```bash
curl -X POST "http://localhost:8000/api/v1/grids" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "token_id": "4ab9da11fc216660e974842cc3b7705e62ebb9e0bf5ff78e53f9cd40abadd117",
    "value": 1000000000,
    "orders": 5,
    "range": 0.1,
    "identity": "my-first-grid"
  }'
```

### 3. Set Up Webhooks

```bash
curl -X POST "http://localhost:8000/api/v1/webhooks" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["grid.created", "grid.order_filled"],
    "secret": "your_webhook_secret"
  }'
```

## API Features

### 🔐 Authentication & Authorization
- **Wallet-based authentication** using Ergo blockchain signatures
- **JWT tokens** for session management
- **API keys** for bot operations
- **Role-based access control** (RBAC) with permissions
- **Audit logging** for security compliance

### 📊 Grid Trading
- **Create/manage grid orders** with customizable parameters
- **Real-time order tracking** and profit monitoring
- **Bulk operations** for trading bots
- **Advanced filtering and querying** capabilities
- **Performance analytics** and reporting

### 🤖 Bot API (v2.0)
- **Bulk grid creation/management** (up to 50 grids per request)
- **Advanced analytics** with ROI calculations
- **Data export** in CSV/JSON formats
- **Real-time streaming** via Server-Sent Events
- **High-performance endpoints** with optimized rate limits

### 🔔 Webhook System
- **Event-driven notifications** for trading activities
- **Reliable delivery** with automatic retries
- **Signature verification** for security
- **Flexible filtering** and subscription management
- **Delivery analytics** and monitoring

### ⚡ Rate Limiting
- **Tier-based limits** (Free, Premium, Enterprise, Bot)
- **Distributed limiting** using Redis
- **Smart rate limiting** by endpoint type
- **Rate limit headers** in all responses
- **Automatic tier detection**

### 📈 Real-time Features
- **WebSocket connections** for live updates
- **Server-Sent Events** for streaming data
- **Grid order updates** in real-time
- **Token price alerts**
- **System notifications**

## API Endpoints

### Authentication (`/api/v1/auth`)
- `POST /login` - Authenticate with wallet signature
- `POST /logout` - End session
- `GET /me` - Get current user info
- `POST /verify` - Verify token validity
- `POST /api-keys` - Create API key
- `GET /api-keys` - List user's API keys
- `DELETE /api-keys/{id}` - Revoke API key

### Grid Trading (`/api/v1/grids`)
- `GET /` - List grid orders
- `POST /` - Create new grid order
- `GET /{id}` - Get grid details
- `DELETE /{id}` - Redeem grid order

### Bot API (`/api/v2/bot`)
- `POST /grids/bulk` - Create multiple grids
- `POST /grids/bulk-status` - Bulk status updates
- `POST /grids/query` - Advanced grid querying
- `GET /analytics/performance` - Performance metrics
- `GET /analytics/overview` - Trading analytics
- `GET /export/grids` - Export grid data
- `GET /stream/grids` - Real-time grid updates

### Webhooks (`/api/v1/webhooks`)
- `POST /` - Register webhook
- `GET /` - List webhooks
- `GET /{id}` - Get webhook details
- `PUT /{id}` - Update webhook
- `DELETE /{id}` - Delete webhook
- `POST /{id}/test` - Test webhook
- `GET /{id}/stats` - Webhook statistics

### Educational Progress (`/api/v1/progress`)
- `GET /{user_id}` - Get user progress
- `POST /module` - Update module progress
- `POST /quiz` - Record quiz attempt
- `POST /practice` - Create practice session
- `GET /validate-readiness/{user_id}` - Validate trading readiness

### Tokens (`/api/v1/tokens`)
- `GET /` - List available tokens
- `GET /{id}` - Get token details
- `POST /update` - Update token information
- `GET /stats/summary` - Token statistics

## Rate Limits

### Free Tier
- Trading Operations: 10/hour
- Data Retrieval: 100/hour
- Webhooks: 5/hour
- WebSocket Connections: 1

### Premium Tier
- Trading Operations: 100/hour
- Data Retrieval: 1,000/hour
- Webhooks: 50/hour
- WebSocket Connections: 5

### Bot Tier
- Trading Operations: 500/hour
- Data Retrieval: 5,000/hour
- Bulk Operations: 50/hour
- WebSocket Connections: 5

### Enterprise Tier
- All Operations: Unlimited
- Priority Support: Included
- Custom Integrations: Available

## Webhook Events

### Grid Events
- `grid.created` - New grid order created
- `grid.redeemed` - Grid order redeemed
- `grid.order_filled` - Individual order filled
- `grid.status_changed` - Grid status update
- `grid.profit_threshold` - Profit threshold reached

### User Events
- `user.progress_update` - Educational progress update
- `user.achievement_earned` - New achievement earned
- `user.certification_completed` - Certification completed

### System Events
- `system.maintenance` - Maintenance notifications
- `system.error` - System error alerts
- `token.price_alert` - Token price alerts

## Error Handling

All endpoints return structured error responses:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "error_code": "MACHINE_READABLE_CODE",
  "details": "Additional context",
  "timestamp": "2024-01-01T12:00:00Z",
  "error_id": "err_1234567890"
}
```

### Common Error Codes
- `UNAUTHORIZED` - Authentication required or invalid
- `FORBIDDEN` - Insufficient permissions
- `RATE_LIMITED` - Rate limit exceeded
- `VALIDATION_ERROR` - Invalid request data
- `NOT_FOUND` - Resource not found
- `BLOCKCHAIN_ERROR` - Blockchain interaction failed

## WebSocket API

Connect to real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/your_user_id');

ws.onopen = () => {
  // Subscribe to grid updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    topic: 'grids',
    filters: { token_id: 'specific_token_id' }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received update:', data);
};
```

## SDKs and Client Libraries

### Official SDKs
- **Python**: `pip install off-the-grid-sdk`
- **JavaScript/TypeScript**: `npm install @off-the-grid/sdk`
- **Rust**: `cargo add off-the-grid-sdk`

### Python SDK Example
```python
from off_the_grid import Client

client = Client(
    base_url="http://localhost:8000",
    api_key="your_api_key"
)

# Create grid order
grid = client.grids.create(
    token_id="4ab9da11fc216660e974842cc3b7705e62ebb9e0bf5ff78e53f9cd40abadd117",
    value=1000000000,
    orders=5,
    range=0.1,
    identity="python-sdk-grid"
)

print(f"Created grid: {grid.identity}")
```

## Testing

### Postman Collection
Import the provided Postman collection for comprehensive API testing:
- File: `off_the_grid_api.postman_collection.json`
- Includes all endpoints with examples
- Pre-configured authentication
- Environment variables setup

### Interactive Documentation
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Spec**: http://localhost:8000/openapi.json

## Support

### Documentation
- **API Docs**: https://docs.off-the-grid.io
- **Guides**: https://docs.off-the-grid.io/guides
- **Tutorials**: https://docs.off-the-grid.io/tutorials

### Community
- **GitHub**: https://github.com/off-the-grid/api
- **Discord**: https://discord.gg/off-the-grid
- **Forum**: https://forum.off-the-grid.io

### Contact
- **Email**: support@off-the-grid.io
- **Bug Reports**: https://github.com/off-the-grid/api/issues
- **Feature Requests**: https://github.com/off-the-grid/api/discussions

## License

MIT License - see LICENSE file for details.

---

**Version**: 2.0.0  
**Last Updated**: 2024-01-01  
**Next Update**: Phase 4 Task 4.2 - Advanced Analytics Dashboard
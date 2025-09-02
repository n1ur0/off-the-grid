# Off the Grid FastAPI Middleware

FastAPI middleware layer for the Off the Grid decentralized trading platform, bridging the Next.js frontend with the Rust CLI.

## Architecture

```
Next.js Frontend → FastAPI Middleware → Rust CLI → Blockchain
```

This middleware provides:
- REST API endpoints for grid trading operations
- WebSocket connections for real-time updates
- Wallet-based authentication with JWT tokens
- Background tasks for monitoring grid status
- Robust CLI subprocess management

## Quick Start

### Prerequisites

1. **Rust CLI Built**: Ensure the Off the Grid Rust CLI is built:
   ```bash
   # With Nix (recommended)
   nix build
   
   # Or with Cargo
   cargo build --release
   ```

2. **Python 3.11+**: Python environment with pip

### Installation

1. **Install dependencies**:
   ```bash
   cd api/
   pip install -r requirements.txt
   ```

2. **Configuration**: Copy and edit the environment file:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the server**:
   ```bash
   # Development server with auto-reload
   python run.py
   
   # Or directly with uvicorn
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

The API will be available at `http://localhost:8000`

## API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Authenticate with wallet signature
- `POST /api/v1/auth/logout` - Logout current user
- `GET /api/v1/auth/me` - Get current user info
- `POST /api/v1/auth/verify` - Verify token validity

### Grid Trading
- `GET /api/v1/grids` - List grid orders (paginated, filterable)
- `GET /api/v1/grids/{grid_identity}` - Get grid details
- `POST /api/v1/grids` - Create new grid order
- `DELETE /api/v1/grids/{grid_identity}` - Redeem grid order

### Tokens
- `GET /api/v1/tokens` - List available tokens
- `GET /api/v1/tokens/{token_id}` - Get specific token info
- `POST /api/v1/tokens/update` - Update token info from Spectrum
- `GET /api/v1/tokens/stats/summary` - Token statistics

### System
- `GET /health` - Health check endpoint

### WebSocket
- `WS /ws/{user_id}` - Real-time updates and communication

## WebSocket Usage

Connect to `/ws/{user_id}` and send JSON messages:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/user123');

// Subscribe to grid updates
ws.send(JSON.stringify({
  type: 'subscribe',
  topic: 'grids'
}));

// Subscribe to system updates
ws.send(JSON.stringify({
  type: 'subscribe', 
  topic: 'system'
}));

// Ping for connection health
ws.send(JSON.stringify({
  type: 'ping'
}));
```

### WebSocket Message Types

**Outgoing (Server → Client):**
- `connection_established` - Connection confirmed
- `grid_update` - Grid status updates (every 30s)
- `system_health` - System health reports (every 5min)
- `subscription_response` - Subscription confirmations
- `pong` - Response to ping

**Incoming (Client → Server):**
- `subscribe` - Subscribe to topic (`grids`, `system`, `tokens`)
- `unsubscribe` - Unsubscribe from topic
- `ping` - Connection health check
- `get_status` - Get connection status

## Authentication

The API uses wallet-based authentication:

1. **Sign Message**: Client signs a message with their Ergo wallet
2. **Send Signature**: POST to `/api/v1/auth/login` with wallet address, message, and signature
3. **Receive JWT**: Server verifies signature and returns JWT token
4. **Use Token**: Include `Authorization: Bearer <token>` header in subsequent requests

Example login flow:
```javascript
const authRequest = {
  wallet_address: "9f5ZKbECVTm25JTRQHDHGM5ehC8tUw5g1fCBQ4aaLWN74sSanUD",
  message: "Login to Off the Grid API",
  signature: "..." // Signature from Nautilus wallet
};

const response = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(authRequest)
});
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8000` | Server port |
| `WORKERS` | `1` | Uvicorn workers |
| `SECRET_KEY` | - | JWT signing key (required) |
| `CLI_PATH` | `../result/bin/off-the-grid` | Path to Rust CLI |
| `CLI_TIMEOUT` | `30.0` | CLI command timeout |
| `DEBUG` | `false` | Debug mode |
| `ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:3001` | CORS origins |
| `GRID_POLL_INTERVAL` | `30` | Grid polling interval (seconds) |

### CLI Integration

The middleware executes the Rust CLI as a subprocess for all blockchain operations:

- **Grid Operations**: `off-the-grid grid list/create/redeem/details`
- **Token Operations**: `off-the-grid tokens list/update` 
- **JSON Output**: All commands use `--json` flag for structured output
- **Error Handling**: Robust timeout and error handling for CLI calls
- **Path Discovery**: Automatic detection of CLI executable location

## Development

### Project Structure

```
api/
├── main.py              # FastAPI app setup and lifecycle
├── config.py            # Configuration management
├── models.py            # Pydantic models
├── cli_manager.py       # CLI subprocess management
├── auth.py              # Authentication system
├── websocket_manager.py # WebSocket connections
├── background_tasks.py  # Background task management
├── routes/              # API route modules
│   ├── auth.py          # Authentication endpoints
│   ├── grids.py         # Grid trading endpoints
│   └── tokens.py        # Token information endpoints
├── requirements.txt     # Python dependencies
├── run.py              # Development server script
├── .env                # Environment configuration
└── README.md           # This file
```

### Key Components

1. **CLIManager**: Robust subprocess execution with timeouts, error handling, and JSON parsing
2. **AuthManager**: JWT-based authentication with wallet signature verification
3. **ConnectionManager**: WebSocket connection management with topic subscriptions
4. **BackgroundTaskManager**: Periodic grid polling and system health monitoring

### Adding New Endpoints

1. Create new route file in `routes/`
2. Define Pydantic models in `models.py`
3. Add CLI operations to `cli_manager.py` 
4. Include router in `main.py`

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

## Production Deployment

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "run.py"]
```

### Environment Setup

For production:
- Set strong `SECRET_KEY`
- Configure proper `ALLOWED_ORIGINS`
- Set `DEBUG=false`
- Use production database if needed
- Configure proper logging
- Set up reverse proxy (nginx)
- Use multiple workers for scaling

### Monitoring

The API provides several monitoring endpoints:
- `/health` - Basic health check
- WebSocket system updates for real-time monitoring
- Built-in logging with configurable levels
- Background task health monitoring

## Security Considerations

- **JWT Tokens**: Secure token-based authentication
- **CORS**: Configurable allowed origins
- **Input Validation**: Comprehensive Pydantic model validation
- **Error Handling**: Sanitized error responses in production
- **CLI Isolation**: Subprocess isolation for CLI execution
- **Rate Limiting**: Consider adding rate limiting for production

## Troubleshooting

### Common Issues

1. **CLI Not Found**: Ensure Rust CLI is built and path is correct
2. **Permission Denied**: Check CLI executable permissions
3. **Connection Refused**: Verify port and host configuration
4. **CORS Errors**: Add frontend origin to `ALLOWED_ORIGINS`
5. **WebSocket Issues**: Check firewall and proxy configuration

### Logs

Check logs for detailed error information:
```bash
# View server logs
python run.py

# Or with uvicorn directly for more control
uvicorn main:app --log-level debug
```

### CLI Testing

Test CLI connectivity directly:
```bash
# Test basic CLI operation
./result/bin/off-the-grid --help

# Test with JSON output
./result/bin/off-the-grid grid list --json
```
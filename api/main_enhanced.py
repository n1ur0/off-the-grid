"""
Enhanced main FastAPI application for Off the Grid API
Integrates all Phase 4 Task 4.1 requirements including OpenAPI generation,
rate limiting, webhooks, bot API, and enhanced authentication
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware

# Import our modules
from config import get_settings
from cli_manager import get_cli_manager
from auth_enhanced import get_enhanced_auth_manager
from websocket_manager import get_connection_manager
from background_tasks import get_background_task_manager
from webhooks.manager import get_webhook_manager
from middleware.rate_limiting import RateLimitMiddleware
from openapi_config import get_enhanced_openapi_schema, get_tags_metadata

# Import models
from models import HealthCheckResponse, ErrorResponse

# Import all routes
from routes import auth, grids, tokens, progress
from routes import bot_api, webhooks, auth_enhanced

logger = logging.getLogger(__name__)
settings = get_settings()


# Enhanced lifecycle manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle with enhanced services"""
    logger.info("Starting Off the Grid API (Enhanced)...")
    
    # Initialize managers
    cli_manager = get_cli_manager()
    connection_manager = get_connection_manager()
    task_manager = get_background_task_manager()
    enhanced_auth_manager = get_enhanced_auth_manager()
    webhook_manager = await get_webhook_manager()
    
    # Test CLI connection on startup
    cli_test = await cli_manager.test_cli_connection()
    if cli_test.success:
        logger.info("CLI connection test passed")
    else:
        logger.warning(f"CLI connection test failed: {cli_test.error}")
    
    # Start background tasks
    await task_manager.start_all_tasks()
    
    # Start webhook workers
    await webhook_manager.start_workers(delivery_workers=5, retry_workers=2)
    
    # Initialize some demo data for enhanced auth
    _setup_demo_data(enhanced_auth_manager)
    
    logger.info("Off the Grid API (Enhanced) started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Off the Grid API (Enhanced)...")
    await task_manager.stop_all_tasks()
    await webhook_manager.stop_workers()
    logger.info("Off the Grid API (Enhanced) shutdown complete")


def _setup_demo_data(auth_manager):
    """Setup demo data for development/testing"""
    try:
        from auth_enhanced import UserRole
        
        # Create demo users with different roles
        demo_users = {
            "9fRAWhdxEsTcdb8PhGNrpfkCk4Dz8V3u5oT2YXQT1234567890abcdef": UserRole.ADMIN,
            "9fRAWhdxEsTcdb8PhGNrpfkCk4Dz8V3u5oT2YXQT1234567890abcde0": UserRole.PREMIUM,
            "9fRAWhdxEsTcdb8PhGNrpfkCk4Dz8V3u5oT2YXQT1234567890abcde1": UserRole.USER,
        }
        
        for user_id, role in demo_users.items():
            auth_manager.set_user_role(user_id, role)
        
        logger.info(f"Setup {len(demo_users)} demo users")
        
    except Exception as e:
        logger.warning(f"Failed to setup demo data: {e}")


# Create enhanced FastAPI app
app = FastAPI(
    title="Off the Grid API",
    description="Advanced decentralized grid trading platform API with comprehensive bot integration",
    version="2.0.0",
    lifespan=lifespan,
    openapi_tags=get_tags_metadata(),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={
        "name": "Off the Grid Support",
        "url": "https://off-the-grid.io/support",
        "email": "support@off-the-grid.io"
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT"
    },
    servers=[
        {"url": "http://localhost:8000", "description": "Development server"},
        {"url": "https://api.off-the-grid.io", "description": "Production server"},
    ]
)

# Add rate limiting middleware (before CORS to get accurate client IPs)
app.add_middleware(
    RateLimitMiddleware,
    redis_url=getattr(settings, 'redis_url', 'redis://localhost:6379/0')
)

# Add trusted host middleware for production
if not settings.debug:
    app.add_middleware(
        TrustedHostMiddleware, 
        allowed_hosts=["localhost", "127.0.0.1", "api.off-the-grid.io"]
    )

# CORS configuration with enhanced settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "*",
        "X-API-Key",
        "X-RateLimit-Tier", 
        "X-Webhook-Signature",
        "Authorization",
        "Content-Type"
    ],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining", 
        "X-RateLimit-Reset",
        "X-RateLimit-Tier",
        "X-RateLimit-Endpoint-Type",
        "Retry-After"
    ]
)

# Include all routers
app.include_router(auth.router)
app.include_router(auth_enhanced.router)
app.include_router(grids.router)
app.include_router(tokens.router)
app.include_router(progress.router)
app.include_router(bot_api.router)
app.include_router(webhooks.router)

# Set custom OpenAPI schema
app.openapi = lambda: get_enhanced_openapi_schema(app)


# Enhanced health check endpoint
@app.get("/health", response_model=HealthCheckResponse, tags=["system"])
async def health_check():
    """
    Comprehensive health check endpoint
    
    Performs health checks on all system components including:
    - CLI connection status
    - WebSocket connection manager
    - Redis connection (for rate limiting)
    - Webhook delivery system
    """
    cli_manager = get_cli_manager()
    connection_manager = get_connection_manager()
    
    # Test CLI status
    cli_test = await cli_manager.test_cli_connection()
    cli_status = "healthy" if cli_test.success else "unhealthy"
    
    # Get WebSocket stats
    ws_stats = connection_manager.get_stats()
    
    # Test Redis connection for rate limiting
    redis_status = "healthy"
    try:
        from middleware.rate_limiting import get_rate_limit_manager
        rate_manager = await get_rate_limit_manager()
        await rate_manager.redis.ping()
    except Exception as e:
        redis_status = f"unhealthy: {str(e)}"
        logger.warning(f"Redis health check failed: {e}")
    
    # Test webhook system
    webhook_status = "healthy"
    try:
        webhook_manager = await get_webhook_manager()
        # Check if workers are running
        active_deliveries = len(webhook_manager.active_deliveries)
        webhook_status = f"healthy ({active_deliveries} active deliveries)"
    except Exception as e:
        webhook_status = f"unhealthy: {str(e)}"
        logger.warning(f"Webhook health check failed: {e}")
    
    overall_status = "healthy"
    if cli_status != "healthy" or redis_status != "healthy" or "unhealthy" in webhook_status:
        overall_status = "degraded"
    
    return HealthCheckResponse(
        status=overall_status,
        timestamp=datetime.utcnow(),
        version="2.0.0",
        cli_status=cli_status,
        dependencies={
            "websocket_connections": str(ws_stats["active_connections"]),
            "cli_response_time": f"{cli_test.execution_time or 0:.3f}s",
            "redis_status": redis_status,
            "webhook_system": webhook_status,
            "api_features": "enhanced_auth,rate_limiting,webhooks,bot_api"
        }
    )


# Enhanced WebSocket endpoint with authentication
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """
    Enhanced WebSocket endpoint for real-time communication
    
    Supports:
    - Grid order updates
    - Token price alerts  
    - Webhook event notifications
    - System status updates
    """
    connection_manager = get_connection_manager()
    
    # Basic user validation (in production, verify JWT token from query params)
    if not user_id or len(user_id) < 10:
        await websocket.close(code=4001, reason="Invalid user ID")
        return
    
    await connection_manager.connect(websocket, user_id, {
        "user_id": user_id,
        "connected_at": datetime.utcnow().isoformat(),
        "features": ["grid_updates", "token_alerts", "webhook_events"]
    })
    
    try:
        while True:
            # Listen for messages from client
            data = await websocket.receive_text()
            
            # Enhanced message handling with different message types
            try:
                import json
                message = json.loads(data)
                message_type = message.get("type", "unknown")
                
                if message_type == "subscribe":
                    # Handle subscription to specific topics
                    topic = message.get("topic")
                    await connection_manager.handle_subscription(user_id, topic, message.get("filters", {}))
                    
                elif message_type == "unsubscribe":
                    # Handle unsubscription
                    topic = message.get("topic")  
                    await connection_manager.handle_unsubscription(user_id, topic)
                    
                elif message_type == "ping":
                    # Handle ping/pong for connection keepalive
                    await connection_manager.send_to_user(user_id, {
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    
                else:
                    # Handle other message types
                    await connection_manager.handle_message(user_id, data)
                    
            except json.JSONDecodeError:
                # Handle non-JSON messages
                await connection_manager.handle_message(user_id, data)
            
    except WebSocketDisconnect:
        connection_manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        connection_manager.disconnect(user_id)


# API Information endpoints
@app.get("/api/info", tags=["system"])
async def api_info():
    """
    Get comprehensive API information
    
    Returns detailed information about API capabilities, version, and features.
    """
    from auth_enhanced import UserRole, Permission
    
    return {
        "api_version": "2.0.0",
        "title": "Off the Grid API",
        "description": "Advanced decentralized grid trading platform",
        "features": {
            "authentication": {
                "methods": ["jwt", "api_key", "wallet_signature"],
                "roles": [role.value for role in UserRole],
                "permissions": [perm.value for perm in Permission]
            },
            "rate_limiting": {
                "enabled": True,
                "backend": "redis",
                "tiers": ["free", "premium", "enterprise", "bot"]
            },
            "webhooks": {
                "enabled": True,
                "max_retries": 3,
                "supported_events": [
                    "grid.created", "grid.redeemed", "grid.order_filled",
                    "user.progress_update", "user.achievement_earned", 
                    "system.maintenance", "token.price_alert"
                ]
            },
            "bot_api": {
                "enabled": True,
                "version": "2.0",
                "bulk_operations": True,
                "streaming": True,
                "analytics": True
            },
            "real_time": {
                "websockets": True,
                "server_sent_events": True,
                "subscriptions": True
            }
        },
        "endpoints": {
            "authentication": "/api/v1/auth",
            "grid_trading": "/api/v1/grids", 
            "bot_api": "/api/v2/bot",
            "webhooks": "/api/v1/webhooks",
            "educational": "/api/v1/progress",
            "tokens": "/api/v1/tokens"
        },
        "documentation": {
            "interactive": "/docs",
            "redoc": "/redoc",
            "openapi": "/openapi.json"
        },
        "support": {
            "email": "support@off-the-grid.io",
            "discord": "https://discord.gg/off-the-grid",
            "github": "https://github.com/off-the-grid/api"
        }
    }


@app.get("/api/stats", tags=["system"])
async def api_stats(request: Request):
    """
    Get API usage statistics
    
    Returns real-time statistics about API usage, rate limiting, and system health.
    """
    try:
        from middleware.rate_limiting import get_rate_limit_manager
        rate_manager = await get_rate_limit_manager()
        
        # Get global rate limiting stats
        rate_stats = await rate_manager.get_global_stats(hours=24)
        
        # Get webhook manager stats
        webhook_manager = await get_webhook_manager()
        webhook_stats = {
            "active_deliveries": len(webhook_manager.active_deliveries),
            "delivery_queue_size": webhook_manager.delivery_queue.qsize(),
            "retry_queue_size": webhook_manager.retry_queue.qsize()
        }
        
        # Get WebSocket stats
        connection_manager = get_connection_manager()
        ws_stats = connection_manager.get_stats()
        
        return {
            "timestamp": datetime.utcnow(),
            "rate_limiting": rate_stats,
            "webhooks": webhook_stats,
            "websockets": ws_stats,
            "system": {
                "version": "2.0.0",
                "uptime": "calculated_at_startup",  # Would calculate actual uptime
                "environment": "development" if settings.debug else "production"
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get API stats: {e}")
        return {
            "error": "Failed to retrieve statistics",
            "timestamp": datetime.utcnow()
        }


# Global exception handlers with enhanced error reporting
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Enhanced global exception handler with detailed logging"""
    # Extract user info for audit logging
    user_id = "anonymous"
    try:
        # Try to get user from various auth methods
        auth_header = request.headers.get("Authorization")
        api_key = request.headers.get("X-API-Key")
        
        if api_key:
            enhanced_auth = get_enhanced_auth_manager()
            api_key_info = enhanced_auth.verify_api_key(api_key)
            if api_key_info:
                user_id = api_key_info.user_id
        elif auth_header and auth_header.startswith("Bearer "):
            # Could decode JWT to get user_id
            pass
    except:
        pass  # Use anonymous if we can't determine user
    
    # Log the exception with context
    logger.error(
        f"Unhandled exception on {request.method} {request.url} for user {user_id}: {exc}", 
        exc_info=True,
        extra={
            "user_id": user_id,
            "method": request.method,
            "url": str(request.url),
            "headers": dict(request.headers),
            "client_ip": request.client.host if request.client else None
        }
    )
    
    # Create enhanced error response
    error_id = f"err_{int(datetime.utcnow().timestamp())}"
    
    error_response = ErrorResponse(
        success=False,
        error="Internal server error",
        details=str(exc) if settings.debug else "An unexpected error occurred. Please contact support if this persists.",
        error_code="INTERNAL_SERVER_ERROR",
        timestamp=datetime.utcnow()
    )
    
    # Add error ID for tracking
    error_dict = error_response.dict()
    error_dict["error_id"] = error_id
    
    return JSONResponse(
        status_code=500,
        content=error_dict,
        headers={
            "X-Error-ID": error_id,
            "X-API-Version": "2.0.0"
        }
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Enhanced HTTP exception handler with rate limit information"""
    logger.warning(f"HTTP {exc.status_code} on {request.method} {request.url}: {exc.detail}")
    
    error_response = ErrorResponse(
        success=False,
        error=exc.detail,
        error_code=f"HTTP_{exc.status_code}",
        timestamp=datetime.utcnow()
    )
    
    # Add rate limit headers if this is a 429 error
    headers = {"X-API-Version": "2.0.0"}
    if exc.status_code == 429:
        # Rate limit headers would be added by middleware
        pass
    
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response.dict(),
        headers=headers
    )


# Development server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main_enhanced:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload and settings.debug,
        log_level=settings.log_level,
        access_log=True
    )
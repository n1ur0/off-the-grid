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
from auth import get_auth_manager
from websocket_manager import get_connection_manager
from background_tasks import get_background_task_manager
from models import HealthCheckResponse, ErrorResponse
from routes import auth, grids, tokens, progress

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Get settings
settings = get_settings()

# Lifecycle manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle"""
    logger.info("Starting Off the Grid API...")
    
    # Initialize managers
    cli_manager = get_cli_manager()
    connection_manager = get_connection_manager()
    task_manager = get_background_task_manager()
    
    # Test CLI connection on startup
    cli_test = await cli_manager.test_cli_connection()
    if cli_test.success:
        logger.info("CLI connection test passed")
    else:
        logger.warning(f"CLI connection test failed: {cli_test.error}")
    
    # Start background tasks
    await task_manager.start_all_tasks()
    
    logger.info("Off the Grid API started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Off the Grid API...")
    await task_manager.stop_all_tasks()
    logger.info("Off the Grid API shutdown complete")

# Create FastAPI app
app = FastAPI(
    title="Off the Grid API",
    description="FastAPI middleware for Off the Grid decentralized trading platform",
    version="1.0.0",
    lifespan=lifespan
)

# Add middleware
if not settings.debug:
    app.add_middleware(
        TrustedHostMiddleware, 
        allowed_hosts=["localhost", "127.0.0.1"]
    )

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(grids.router)
app.include_router(tokens.router)
app.include_router(progress.router)




# Health check endpoint
@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Health check endpoint"""
    cli_manager = get_cli_manager()
    connection_manager = get_connection_manager()
    
    # Test CLI status
    cli_test = await cli_manager.test_cli_connection()
    cli_status = "healthy" if cli_test.success else "unhealthy"
    
    # Get WebSocket stats
    ws_stats = connection_manager.get_stats()
    
    return HealthCheckResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        version="1.0.0",
        cli_status=cli_status,
        dependencies={
            "websocket_connections": str(ws_stats["active_connections"]),
            "cli_response_time": f"{cli_test.execution_time or 0:.3f}s"
        }
    )


# WebSocket endpoint for real-time updates
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time communication"""
    connection_manager = get_connection_manager()
    
    await connection_manager.connect(websocket, user_id, {"user_id": user_id})
    
    try:
        while True:
            # Listen for messages from client
            data = await websocket.receive_text()
            await connection_manager.handle_message(user_id, data)
            
    except WebSocketDisconnect:
        connection_manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        connection_manager.disconnect(user_id)



# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception on {request.method} {request.url}: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            success=False,
            error="Internal server error",
            details=str(exc) if settings.debug else "An unexpected error occurred",
            error_code="INTERNAL_SERVER_ERROR",
            timestamp=datetime.utcnow()
        ).dict()
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """HTTP exception handler"""
    logger.warning(f"HTTP {exc.status_code} on {request.method} {request.url}: {exc.detail}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            success=False,
            error=exc.detail,
            error_code=f"HTTP_{exc.status_code}",
            timestamp=datetime.utcnow()
        ).dict()
    )

# Development server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload and settings.debug,
        log_level=settings.log_level
    )
"""
Rate limiting middleware for Off the Grid API
Implements distributed rate limiting using Redis with different limits for different user tiers
"""
import asyncio
import json
import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum

import redis.asyncio as redis
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class UserTier(str, Enum):
    """User tier levels for rate limiting"""
    FREE = "free"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"
    BOT = "bot"


class EndpointType(str, Enum):
    """Endpoint categories for different rate limits"""
    TRADING = "trading"          # Grid creation, redemption
    DATA_RETRIEVAL = "data"      # Listing, details, stats
    AUTHENTICATION = "auth"      # Login, token refresh
    WEBHOOK = "webhook"          # Webhook operations
    BULK_OPERATIONS = "bulk"     # Bot bulk operations
    STREAMING = "streaming"      # Real-time endpoints
    EDUCATIONAL = "educational"  # Progress tracking, quizzes


# Rate limit configurations per tier and endpoint type
RATE_LIMIT_CONFIG = {
    UserTier.FREE: {
        EndpointType.TRADING: {"requests": 10, "window": 3600},        # 10/hour
        EndpointType.DATA_RETRIEVAL: {"requests": 100, "window": 3600}, # 100/hour
        EndpointType.AUTHENTICATION: {"requests": 20, "window": 3600},  # 20/hour
        EndpointType.WEBHOOK: {"requests": 5, "window": 3600},          # 5/hour
        EndpointType.BULK_OPERATIONS: {"requests": 0, "window": 3600},  # Not allowed
        EndpointType.STREAMING: {"requests": 10, "window": 3600},       # 10/hour
        EndpointType.EDUCATIONAL: {"requests": 50, "window": 3600},     # 50/hour
    },
    UserTier.PREMIUM: {
        EndpointType.TRADING: {"requests": 100, "window": 3600},        # 100/hour
        EndpointType.DATA_RETRIEVAL: {"requests": 1000, "window": 3600}, # 1000/hour
        EndpointType.AUTHENTICATION: {"requests": 50, "window": 3600},   # 50/hour
        EndpointType.WEBHOOK: {"requests": 50, "window": 3600},          # 50/hour
        EndpointType.BULK_OPERATIONS: {"requests": 10, "window": 3600},  # 10/hour
        EndpointType.STREAMING: {"requests": 100, "window": 3600},       # 100/hour
        EndpointType.EDUCATIONAL: {"requests": 200, "window": 3600},     # 200/hour
    },
    UserTier.ENTERPRISE: {
        EndpointType.TRADING: {"requests": 1000, "window": 3600},       # 1000/hour
        EndpointType.DATA_RETRIEVAL: {"requests": 10000, "window": 3600}, # 10000/hour
        EndpointType.AUTHENTICATION: {"requests": 200, "window": 3600},   # 200/hour
        EndpointType.WEBHOOK: {"requests": 500, "window": 3600},          # 500/hour
        EndpointType.BULK_OPERATIONS: {"requests": 100, "window": 3600},  # 100/hour
        EndpointType.STREAMING: {"requests": 1000, "window": 3600},       # 1000/hour
        EndpointType.EDUCATIONAL: {"requests": 1000, "window": 3600},     # 1000/hour
    },
    UserTier.BOT: {
        EndpointType.TRADING: {"requests": 500, "window": 3600},        # 500/hour
        EndpointType.DATA_RETRIEVAL: {"requests": 5000, "window": 3600}, # 5000/hour
        EndpointType.AUTHENTICATION: {"requests": 50, "window": 3600},   # 50/hour
        EndpointType.WEBHOOK: {"requests": 200, "window": 3600},         # 200/hour
        EndpointType.BULK_OPERATIONS: {"requests": 50, "window": 3600},  # 50/hour
        EndpointType.STREAMING: {"requests": 500, "window": 3600},       # 500/hour
        EndpointType.EDUCATIONAL: {"requests": 100, "window": 3600},     # 100/hour
    }
}

# Endpoint path to type mapping
ENDPOINT_TYPE_MAPPING = {
    # Trading operations
    "/api/v1/grids": EndpointType.TRADING,
    "/api/v2/bot/grids": EndpointType.BULK_OPERATIONS,
    "/api/v2/bot/grids/bulk": EndpointType.BULK_OPERATIONS,
    "/api/v2/bot/grids/bulk-status": EndpointType.BULK_OPERATIONS,
    
    # Data retrieval
    "/api/v1/tokens": EndpointType.DATA_RETRIEVAL,
    "/api/v2/bot/grids/query": EndpointType.DATA_RETRIEVAL,
    "/api/v2/bot/analytics": EndpointType.DATA_RETRIEVAL,
    
    # Authentication
    "/api/v1/auth": EndpointType.AUTHENTICATION,
    
    # Webhooks
    "/api/v1/webhooks": EndpointType.WEBHOOK,
    
    # Streaming
    "/api/v2/bot/stream": EndpointType.STREAMING,
    "/ws": EndpointType.STREAMING,
    
    # Educational
    "/api/v1/progress": EndpointType.EDUCATIONAL,
}


class RateLimiter:
    """Redis-based distributed rate limiter"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        
    async def is_allowed(self, key: str, limit: int, window: int) -> Tuple[bool, Dict[str, Any]]:
        """
        Check if request is allowed using sliding window algorithm
        
        Args:
            key: Rate limiting key (e.g., "user:123:trading")
            limit: Maximum requests allowed in window
            window: Time window in seconds
            
        Returns:
            Tuple of (is_allowed, rate_limit_info)
        """
        if limit <= 0:
            return False, {
                "limit": 0,
                "remaining": 0,
                "reset": int((datetime.utcnow() + timedelta(seconds=window)).timestamp()),
                "retry_after": window
            }
        
        try:
            current_time = datetime.utcnow().timestamp()
            window_start = current_time - window
            
            # Use Redis pipeline for atomic operations
            pipe = self.redis.pipeline()
            
            # Remove old entries outside the window
            pipe.zremrangebyscore(key, 0, window_start)
            
            # Count current requests in window
            pipe.zcard(key)
            
            # Add current request
            pipe.zadd(key, {str(current_time): current_time})
            
            # Set expiration
            pipe.expire(key, window)
            
            # Execute pipeline
            results = await pipe.execute()
            current_count = results[1] + 1  # +1 for the request we just added
            
            # Check if limit is exceeded
            if current_count > limit:
                # Remove the request we just added since it's not allowed
                await self.redis.zrem(key, str(current_time))
                allowed = False
                remaining = 0
                retry_after = window
            else:
                allowed = True
                remaining = max(0, limit - current_count)
                retry_after = 0
            
            reset_time = int((datetime.utcnow() + timedelta(seconds=window)).timestamp())
            
            return allowed, {
                "limit": limit,
                "remaining": remaining,
                "reset": reset_time,
                "retry_after": retry_after
            }
            
        except Exception as e:
            logger.error(f"Rate limiting error for key {key}: {e}")
            # Fail open - allow request if Redis is down
            return True, {
                "limit": limit,
                "remaining": limit - 1,
                "reset": int((datetime.utcnow() + timedelta(seconds=window)).timestamp()),
                "retry_after": 0
            }
    
    async def get_usage_stats(self, key: str, window: int) -> Dict[str, Any]:
        """Get usage statistics for a key"""
        try:
            current_time = datetime.utcnow().timestamp()
            window_start = current_time - window
            
            # Get all requests in current window
            requests = await self.redis.zrangebyscore(key, window_start, current_time, withscores=True)
            
            return {
                "current_requests": len(requests),
                "window_seconds": window,
                "window_start": datetime.fromtimestamp(window_start),
                "window_end": datetime.fromtimestamp(current_time),
                "requests_timeline": [
                    {"timestamp": datetime.fromtimestamp(score), "request_id": member.decode()}
                    for member, score in requests
                ]
            }
            
        except Exception as e:
            logger.error(f"Error getting usage stats for key {key}: {e}")
            return {"error": str(e)}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for rate limiting"""
    
    def __init__(self, app, redis_url: str = "redis://localhost:6379/0"):
        super().__init__(app)
        self.redis_client = None
        self.redis_url = redis_url
        self.rate_limiter = None
        
    async def _ensure_redis_connection(self):
        """Ensure Redis connection is established"""
        if self.redis_client is None:
            try:
                self.redis_client = redis.from_url(self.redis_url, decode_responses=False)
                await self.redis_client.ping()
                self.rate_limiter = RateLimiter(self.redis_client)
                logger.info("Redis connection established for rate limiting")
            except Exception as e:
                logger.error(f"Failed to connect to Redis for rate limiting: {e}")
                # Continue without rate limiting if Redis is not available
                
    async def dispatch(self, request: Request, call_next):
        """Process request through rate limiting middleware"""
        # Skip rate limiting for health checks and static files
        if request.url.path in ["/health", "/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)
        
        # Ensure Redis connection
        await self._ensure_redis_connection()
        
        # Skip rate limiting if Redis is not available
        if not self.rate_limiter:
            logger.warning("Rate limiting disabled - Redis not available")
            return await call_next(request)
        
        # Determine user and tier
        user_id, user_tier = await self._get_user_info(request)
        
        # Skip rate limiting for unknown users (will be handled by auth middleware)
        if not user_id:
            return await call_next(request)
        
        # Determine endpoint type
        endpoint_type = self._get_endpoint_type(request.url.path)
        
        # Get rate limit configuration
        rate_config = RATE_LIMIT_CONFIG.get(user_tier, RATE_LIMIT_CONFIG[UserTier.FREE])
        limit_config = rate_config.get(endpoint_type, {"requests": 10, "window": 3600})
        
        # Create rate limiting key
        rate_key = f"rate_limit:{user_id}:{endpoint_type.value}"
        
        # Check rate limit
        allowed, rate_info = await self.rate_limiter.is_allowed(
            rate_key,
            limit_config["requests"],
            limit_config["window"]
        )
        
        # Add rate limit headers to response
        def add_rate_limit_headers(response: Response):
            response.headers["X-RateLimit-Limit"] = str(rate_info["limit"])
            response.headers["X-RateLimit-Remaining"] = str(rate_info["remaining"])
            response.headers["X-RateLimit-Reset"] = str(rate_info["reset"])
            response.headers["X-RateLimit-Tier"] = user_tier.value
            response.headers["X-RateLimit-Endpoint-Type"] = endpoint_type.value
            
            if not allowed:
                response.headers["Retry-After"] = str(rate_info["retry_after"])
        
        if not allowed:
            # Rate limit exceeded
            logger.warning(f"Rate limit exceeded for user {user_id}: {endpoint_type.value}")
            
            error_response = JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "error": "Rate limit exceeded",
                    "error_code": "RATE_LIMITED",
                    "details": f"Rate limit exceeded for {endpoint_type.value} operations",
                    "rate_limit": rate_info,
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            
            add_rate_limit_headers(error_response)
            return error_response
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers to successful response
        add_rate_limit_headers(response)
        
        return response
    
    async def _get_user_info(self, request: Request) -> Tuple[Optional[str], UserTier]:
        """Extract user ID and tier from request"""
        try:
            # Check for API key in header (for bots)
            api_key = request.headers.get("X-API-Key")
            if api_key:
                # In a real implementation, validate API key and get user info
                # For now, assume bot tier for any API key
                return f"api_key:{api_key[:8]}", UserTier.BOT
            
            # Check for JWT token in Authorization header
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                # In a real implementation, decode JWT and get user info
                # For now, extract from token (simplified)
                token = auth_header[7:]  # Remove "Bearer "
                return f"jwt:{token[:8]}", UserTier.FREE  # Default to free tier
            
            # Check for cookie authentication
            access_token = request.cookies.get("access_token")
            if access_token:
                return f"cookie:{access_token[:8]}", UserTier.FREE
            
            # No authentication found
            return None, UserTier.FREE
            
        except Exception as e:
            logger.error(f"Error extracting user info: {e}")
            return None, UserTier.FREE
    
    def _get_endpoint_type(self, path: str) -> EndpointType:
        """Determine endpoint type from request path"""
        # Check for exact matches first
        for endpoint_path, endpoint_type in ENDPOINT_TYPE_MAPPING.items():
            if path.startswith(endpoint_path):
                return endpoint_type
        
        # Default classification based on path patterns
        if "/auth" in path:
            return EndpointType.AUTHENTICATION
        elif "/grids" in path and "/bot/" in path:
            return EndpointType.BULK_OPERATIONS
        elif "/grids" in path:
            return EndpointType.TRADING
        elif "/webhooks" in path:
            return EndpointType.WEBHOOK
        elif "/progress" in path or "/educational" in path:
            return EndpointType.EDUCATIONAL
        elif "/stream" in path or path.startswith("/ws"):
            return EndpointType.STREAMING
        else:
            return EndpointType.DATA_RETRIEVAL


class RateLimitManager:
    """Manager for rate limiting operations and monitoring"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.rate_limiter = RateLimiter(redis_client)
    
    async def get_user_usage(self, user_id: str, tier: UserTier, hours: int = 1) -> Dict[str, Any]:
        """Get comprehensive usage statistics for a user"""
        usage_stats = {}
        
        for endpoint_type in EndpointType:
            key = f"rate_limit:{user_id}:{endpoint_type.value}"
            window = hours * 3600
            
            stats = await self.rate_limiter.get_usage_stats(key, window)
            
            # Get rate limit configuration
            rate_config = RATE_LIMIT_CONFIG.get(tier, RATE_LIMIT_CONFIG[UserTier.FREE])
            limit_config = rate_config.get(endpoint_type, {"requests": 10, "window": 3600})
            
            # Calculate usage percentage
            hourly_limit = limit_config["requests"] * hours
            usage_percentage = (stats.get("current_requests", 0) / hourly_limit * 100) if hourly_limit > 0 else 0
            
            usage_stats[endpoint_type.value] = {
                "requests_made": stats.get("current_requests", 0),
                "hourly_limit": hourly_limit,
                "usage_percentage": min(usage_percentage, 100),
                "window_hours": hours,
                "requests_timeline": stats.get("requests_timeline", [])
            }
        
        return {
            "user_id": user_id,
            "tier": tier.value,
            "time_window_hours": hours,
            "endpoint_usage": usage_stats,
            "generated_at": datetime.utcnow().isoformat()
        }
    
    async def reset_user_limits(self, user_id: str, endpoint_types: Optional[list] = None) -> Dict[str, int]:
        """Reset rate limits for a user (admin operation)"""
        if endpoint_types is None:
            endpoint_types = [e.value for e in EndpointType]
        
        reset_counts = {}
        
        for endpoint_type in endpoint_types:
            key = f"rate_limit:{user_id}:{endpoint_type}"
            
            try:
                # Get current count before reset
                count = await self.redis.zcard(key)
                
                # Delete the key (reset the limit)
                await self.redis.delete(key)
                
                reset_counts[endpoint_type] = count
                logger.info(f"Reset rate limit for user {user_id}, endpoint {endpoint_type}: {count} requests cleared")
                
            except Exception as e:
                logger.error(f"Error resetting rate limit for {user_id}:{endpoint_type}: {e}")
                reset_counts[endpoint_type] = -1
        
        return reset_counts
    
    async def get_global_stats(self, hours: int = 1) -> Dict[str, Any]:
        """Get global rate limiting statistics"""
        try:
            # Get all rate limiting keys
            pattern = f"rate_limit:*"
            keys = await self.redis.keys(pattern)
            
            # Group by endpoint type
            endpoint_stats = {}
            total_requests = 0
            
            for key in keys:
                key_str = key.decode() if isinstance(key, bytes) else key
                parts = key_str.split(":")
                
                if len(parts) >= 3:
                    endpoint_type = parts[2]
                    
                    # Count requests in window
                    window = hours * 3600
                    current_time = datetime.utcnow().timestamp()
                    window_start = current_time - window
                    
                    count = await self.redis.zcount(key, window_start, current_time)
                    
                    if endpoint_type not in endpoint_stats:
                        endpoint_stats[endpoint_type] = {"requests": 0, "users": 0}
                    
                    endpoint_stats[endpoint_type]["requests"] += count
                    endpoint_stats[endpoint_type]["users"] += 1
                    total_requests += count
            
            return {
                "time_window_hours": hours,
                "total_requests": total_requests,
                "total_users": len(keys),
                "endpoint_breakdown": endpoint_stats,
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting global rate limiting stats: {e}")
            return {"error": str(e)}


# Global rate limit manager instance
_rate_limit_manager: Optional[RateLimitManager] = None

async def get_rate_limit_manager(redis_url: str = "redis://localhost:6379/0") -> RateLimitManager:
    """Get rate limit manager instance"""
    global _rate_limit_manager
    
    if _rate_limit_manager is None:
        redis_client = redis.from_url(redis_url, decode_responses=False)
        await redis_client.ping()
        _rate_limit_manager = RateLimitManager(redis_client)
    
    return _rate_limit_manager
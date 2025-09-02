"""
Redis configuration and session management for Off the Grid trading platform.
Handles session tokens, JWT caching, real-time grid data, and WebSocket connections.
"""

import os
import json
import logging
import asyncio
from typing import Optional, Dict, Any, List, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from contextlib import asynccontextmanager

import redis
import redis.asyncio as aioredis
from redis.connection import ConnectionPool
from redis.exceptions import RedisError, ConnectionError as RedisConnectionError

# Configure logging
logger = logging.getLogger(__name__)

@dataclass
class RedisConfig:
    """Redis connection configuration."""
    host: str = "localhost"
    port: int = 6379
    db: int = 0
    password: Optional[str] = None
    username: Optional[str] = None
    decode_responses: bool = True
    health_check_interval: int = 30
    socket_connect_timeout: int = 5
    socket_keepalive: bool = True
    socket_keepalive_options: Dict[str, Any] = None
    retry_on_timeout: bool = True
    max_connections: int = 20

    def __post_init__(self):
        if self.socket_keepalive_options is None:
            self.socket_keepalive_options = {}

    @classmethod
    def from_env(cls) -> 'RedisConfig':
        """Create Redis configuration from environment variables."""
        return cls(
            host=os.getenv('REDIS_HOST', 'localhost'),
            port=int(os.getenv('REDIS_PORT', '6379')),
            db=int(os.getenv('REDIS_DB', '0')),
            password=os.getenv('REDIS_PASSWORD'),
            username=os.getenv('REDIS_USERNAME'),
            decode_responses=os.getenv('REDIS_DECODE_RESPONSES', 'true').lower() == 'true',
            max_connections=int(os.getenv('REDIS_MAX_CONNECTIONS', '20')),
        )

    def get_redis_url(self) -> str:
        """Get Redis URL for connection."""
        if self.password:
            if self.username:
                auth = f"{self.username}:{self.password}@"
            else:
                auth = f":{self.password}@"
        else:
            auth = ""
        
        return f"redis://{auth}{self.host}:{self.port}/{self.db}"

class RedisManager:
    """Redis connection and session management."""
    
    def __init__(self, config: Optional[RedisConfig] = None):
        self.config = config or RedisConfig.from_env()
        self._sync_client: Optional[redis.Redis] = None
        self._async_client: Optional[aioredis.Redis] = None
        self._connection_pool: Optional[ConnectionPool] = None
        self._async_connection_pool: Optional[aioredis.ConnectionPool] = None
        
        # Key prefixes for different data types
        self.SESSION_PREFIX = "session:"
        self.USER_PREFIX = "user:"
        self.GRID_DATA_PREFIX = "grid:"
        self.WEBSOCKET_PREFIX = "ws:"
        self.JWT_BLACKLIST_PREFIX = "jwt_blacklist:"
        self.ACTIVITY_PREFIX = "activity:"
        self.CACHE_PREFIX = "cache:"
        
        # Default TTL values (in seconds)
        self.SESSION_TTL = 3600 * 24 * 7  # 7 days
        self.JWT_BLACKLIST_TTL = 3600 * 24  # 24 hours
        self.GRID_DATA_TTL = 300  # 5 minutes
        self.USER_ACTIVITY_TTL = 3600  # 1 hour
        self.GENERAL_CACHE_TTL = 1800  # 30 minutes

    def get_sync_client(self) -> redis.Redis:
        """Get synchronous Redis client with connection pooling."""
        if self._sync_client is None:
            if self._connection_pool is None:
                self._connection_pool = ConnectionPool(
                    host=self.config.host,
                    port=self.config.port,
                    db=self.config.db,
                    password=self.config.password,
                    username=self.config.username,
                    decode_responses=self.config.decode_responses,
                    health_check_interval=self.config.health_check_interval,
                    socket_connect_timeout=self.config.socket_connect_timeout,
                    socket_keepalive=self.config.socket_keepalive,
                    socket_keepalive_options=self.config.socket_keepalive_options,
                    retry_on_timeout=self.config.retry_on_timeout,
                    max_connections=self.config.max_connections
                )
            
            self._sync_client = redis.Redis(connection_pool=self._connection_pool)
        
        return self._sync_client

    async def get_async_client(self) -> aioredis.Redis:
        """Get asynchronous Redis client with connection pooling."""
        if self._async_client is None:
            if self._async_connection_pool is None:
                self._async_connection_pool = aioredis.ConnectionPool.from_url(
                    self.config.get_redis_url(),
                    decode_responses=self.config.decode_responses,
                    health_check_interval=self.config.health_check_interval,
                    socket_connect_timeout=self.config.socket_connect_timeout,
                    socket_keepalive=self.config.socket_keepalive,
                    socket_keepalive_options=self.config.socket_keepalive_options,
                    retry_on_timeout=self.config.retry_on_timeout,
                    max_connections=self.config.max_connections
                )
            
            self._async_client = aioredis.Redis(connection_pool=self._async_connection_pool)
        
        return self._async_client

    async def health_check(self) -> bool:
        """Check Redis connection health."""
        try:
            client = await self.get_async_client()
            await client.ping()
            return True
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return False

    def health_check_sync(self) -> bool:
        """Synchronous Redis health check."""
        try:
            client = self.get_sync_client()
            client.ping()
            return True
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return False

    # Session Management Methods

    async def create_session(self, user_id: str, session_data: Dict[str, Any], 
                           ttl: Optional[int] = None) -> str:
        """Create a new user session."""
        try:
            client = await self.get_async_client()
            session_token = self._generate_session_token()
            session_key = f"{self.SESSION_PREFIX}{session_token}"
            
            session_data['user_id'] = user_id
            session_data['created_at'] = datetime.utcnow().isoformat()
            session_data['last_accessed'] = datetime.utcnow().isoformat()
            
            ttl = ttl or self.SESSION_TTL
            await client.setex(session_key, ttl, json.dumps(session_data))
            
            # Also store user's active sessions
            user_sessions_key = f"{self.USER_PREFIX}{user_id}:sessions"
            await client.sadd(user_sessions_key, session_token)
            await client.expire(user_sessions_key, ttl)
            
            logger.info(f"Created session {session_token} for user {user_id}")
            return session_token
            
        except RedisError as e:
            logger.error(f"Failed to create session: {e}")
            raise

    async def get_session(self, session_token: str) -> Optional[Dict[str, Any]]:
        """Retrieve session data."""
        try:
            client = await self.get_async_client()
            session_key = f"{self.SESSION_PREFIX}{session_token}"
            
            session_data = await client.get(session_key)
            if session_data:
                data = json.loads(session_data)
                # Update last accessed time
                data['last_accessed'] = datetime.utcnow().isoformat()
                await client.setex(session_key, self.SESSION_TTL, json.dumps(data))
                return data
            
            return None
            
        except (RedisError, json.JSONDecodeError) as e:
            logger.error(f"Failed to retrieve session {session_token}: {e}")
            return None

    async def update_session(self, session_token: str, session_data: Dict[str, Any]) -> bool:
        """Update existing session data."""
        try:
            client = await self.get_async_client()
            session_key = f"{self.SESSION_PREFIX}{session_token}"
            
            # Check if session exists
            if not await client.exists(session_key):
                return False
            
            session_data['last_accessed'] = datetime.utcnow().isoformat()
            await client.setex(session_key, self.SESSION_TTL, json.dumps(session_data))
            return True
            
        except RedisError as e:
            logger.error(f"Failed to update session {session_token}: {e}")
            return False

    async def delete_session(self, session_token: str) -> bool:
        """Delete a session."""
        try:
            client = await self.get_async_client()
            session_key = f"{self.SESSION_PREFIX}{session_token}"
            
            # Get user_id before deleting
            session_data = await client.get(session_key)
            if session_data:
                data = json.loads(session_data)
                user_id = data.get('user_id')
                
                # Remove from user's active sessions
                if user_id:
                    user_sessions_key = f"{self.USER_PREFIX}{user_id}:sessions"
                    await client.srem(user_sessions_key, session_token)
            
            # Delete the session
            result = await client.delete(session_key)
            return result > 0
            
        except (RedisError, json.JSONDecodeError) as e:
            logger.error(f"Failed to delete session {session_token}: {e}")
            return False

    async def get_user_sessions(self, user_id: str) -> List[str]:
        """Get all active sessions for a user."""
        try:
            client = await self.get_async_client()
            user_sessions_key = f"{self.USER_PREFIX}{user_id}:sessions"
            
            session_tokens = await client.smembers(user_sessions_key)
            return list(session_tokens) if session_tokens else []
            
        except RedisError as e:
            logger.error(f"Failed to get user sessions for {user_id}: {e}")
            return []

    async def delete_all_user_sessions(self, user_id: str) -> int:
        """Delete all sessions for a user."""
        try:
            client = await self.get_async_client()
            session_tokens = await self.get_user_sessions(user_id)
            
            deleted_count = 0
            for token in session_tokens:
                if await self.delete_session(token):
                    deleted_count += 1
            
            # Clean up user sessions set
            user_sessions_key = f"{self.USER_PREFIX}{user_id}:sessions"
            await client.delete(user_sessions_key)
            
            return deleted_count
            
        except RedisError as e:
            logger.error(f"Failed to delete user sessions for {user_id}: {e}")
            return 0

    # JWT Blacklist Management

    async def blacklist_jwt(self, jti: str, ttl: Optional[int] = None) -> bool:
        """Add JWT to blacklist."""
        try:
            client = await self.get_async_client()
            blacklist_key = f"{self.JWT_BLACKLIST_PREFIX}{jti}"
            
            ttl = ttl or self.JWT_BLACKLIST_TTL
            await client.setex(blacklist_key, ttl, "blacklisted")
            return True
            
        except RedisError as e:
            logger.error(f"Failed to blacklist JWT {jti}: {e}")
            return False

    async def is_jwt_blacklisted(self, jti: str) -> bool:
        """Check if JWT is blacklisted."""
        try:
            client = await self.get_async_client()
            blacklist_key = f"{self.JWT_BLACKLIST_PREFIX}{jti}"
            
            return await client.exists(blacklist_key) > 0
            
        except RedisError as e:
            logger.error(f"Failed to check JWT blacklist for {jti}: {e}")
            return False

    # Grid Data Caching

    async def cache_grid_data(self, grid_id: str, grid_data: Dict[str, Any], 
                            ttl: Optional[int] = None) -> bool:
        """Cache grid trading data."""
        try:
            client = await self.get_async_client()
            grid_key = f"{self.GRID_DATA_PREFIX}{grid_id}"
            
            grid_data['cached_at'] = datetime.utcnow().isoformat()
            ttl = ttl or self.GRID_DATA_TTL
            
            await client.setex(grid_key, ttl, json.dumps(grid_data))
            return True
            
        except RedisError as e:
            logger.error(f"Failed to cache grid data for {grid_id}: {e}")
            return False

    async def get_cached_grid_data(self, grid_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve cached grid data."""
        try:
            client = await self.get_async_client()
            grid_key = f"{self.GRID_DATA_PREFIX}{grid_id}"
            
            grid_data = await client.get(grid_key)
            if grid_data:
                return json.loads(grid_data)
            
            return None
            
        except (RedisError, json.JSONDecodeError) as e:
            logger.error(f"Failed to retrieve cached grid data for {grid_id}: {e}")
            return None

    # WebSocket Connection Management

    async def register_websocket_connection(self, user_id: str, connection_id: str, 
                                          metadata: Dict[str, Any]) -> bool:
        """Register WebSocket connection."""
        try:
            client = await self.get_async_client()
            ws_key = f"{self.WEBSOCKET_PREFIX}{user_id}:{connection_id}"
            
            connection_data = {
                'user_id': user_id,
                'connection_id': connection_id,
                'connected_at': datetime.utcnow().isoformat(),
                'metadata': metadata
            }
            
            await client.setex(ws_key, self.SESSION_TTL, json.dumps(connection_data))
            
            # Add to user's active connections set
            user_connections_key = f"{self.USER_PREFIX}{user_id}:connections"
            await client.sadd(user_connections_key, connection_id)
            await client.expire(user_connections_key, self.SESSION_TTL)
            
            return True
            
        except RedisError as e:
            logger.error(f"Failed to register WebSocket connection: {e}")
            return False

    async def unregister_websocket_connection(self, user_id: str, connection_id: str) -> bool:
        """Unregister WebSocket connection."""
        try:
            client = await self.get_async_client()
            ws_key = f"{self.WEBSOCKET_PREFIX}{user_id}:{connection_id}"
            
            await client.delete(ws_key)
            
            # Remove from user's active connections
            user_connections_key = f"{self.USER_PREFIX}{user_id}:connections"
            await client.srem(user_connections_key, connection_id)
            
            return True
            
        except RedisError as e:
            logger.error(f"Failed to unregister WebSocket connection: {e}")
            return False

    async def get_user_websocket_connections(self, user_id: str) -> List[str]:
        """Get all active WebSocket connections for a user."""
        try:
            client = await self.get_async_client()
            user_connections_key = f"{self.USER_PREFIX}{user_id}:connections"
            
            connection_ids = await client.smembers(user_connections_key)
            return list(connection_ids) if connection_ids else []
            
        except RedisError as e:
            logger.error(f"Failed to get WebSocket connections for {user_id}: {e}")
            return []

    # User Activity Tracking

    async def track_user_activity(self, user_id: str, activity_type: str, 
                                metadata: Dict[str, Any]) -> bool:
        """Track user activity for real-time monitoring."""
        try:
            client = await self.get_async_client()
            activity_key = f"{self.ACTIVITY_PREFIX}{user_id}:{activity_type}"
            
            activity_data = {
                'user_id': user_id,
                'activity_type': activity_type,
                'timestamp': datetime.utcnow().isoformat(),
                'metadata': metadata
            }
            
            await client.setex(activity_key, self.USER_ACTIVITY_TTL, json.dumps(activity_data))
            
            # Also add to recent activities list
            recent_activities_key = f"{self.USER_PREFIX}{user_id}:recent_activities"
            await client.lpush(recent_activities_key, json.dumps(activity_data))
            await client.ltrim(recent_activities_key, 0, 99)  # Keep last 100 activities
            await client.expire(recent_activities_key, self.USER_ACTIVITY_TTL)
            
            return True
            
        except RedisError as e:
            logger.error(f"Failed to track user activity: {e}")
            return False

    # General Caching

    async def set_cache(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set a cached value."""
        try:
            client = await self.get_async_client()
            cache_key = f"{self.CACHE_PREFIX}{key}"
            
            ttl = ttl or self.GENERAL_CACHE_TTL
            
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            
            await client.setex(cache_key, ttl, value)
            return True
            
        except RedisError as e:
            logger.error(f"Failed to set cache for {key}: {e}")
            return False

    async def get_cache(self, key: str, parse_json: bool = False) -> Optional[Any]:
        """Get a cached value."""
        try:
            client = await self.get_async_client()
            cache_key = f"{self.CACHE_PREFIX}{key}"
            
            value = await client.get(cache_key)
            if value and parse_json:
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value
            
            return value
            
        except RedisError as e:
            logger.error(f"Failed to get cache for {key}: {e}")
            return None

    async def delete_cache(self, key: str) -> bool:
        """Delete a cached value."""
        try:
            client = await self.get_async_client()
            cache_key = f"{self.CACHE_PREFIX}{key}"
            
            result = await client.delete(cache_key)
            return result > 0
            
        except RedisError as e:
            logger.error(f"Failed to delete cache for {key}: {e}")
            return False

    # Utility Methods

    def _generate_session_token(self) -> str:
        """Generate a unique session token."""
        import secrets
        return secrets.token_urlsafe(32)

    async def cleanup_expired_sessions(self) -> int:
        """Clean up expired sessions and related data."""
        try:
            client = await self.get_async_client()
            
            # This is a basic cleanup - in production, you might want to use Redis keyspace notifications
            # or a more sophisticated cleanup mechanism
            
            cleaned_count = 0
            
            # Get all session keys
            session_pattern = f"{self.SESSION_PREFIX}*"
            async for key in client.scan_iter(match=session_pattern):
                if not await client.exists(key):
                    cleaned_count += 1
            
            return cleaned_count
            
        except RedisError as e:
            logger.error(f"Failed to cleanup expired sessions: {e}")
            return 0

    async def get_stats(self) -> Dict[str, Any]:
        """Get Redis usage statistics."""
        try:
            client = await self.get_async_client()
            info = await client.info()
            
            # Count keys by prefix
            key_counts = {}
            for prefix in [self.SESSION_PREFIX, self.USER_PREFIX, self.GRID_DATA_PREFIX,
                          self.WEBSOCKET_PREFIX, self.JWT_BLACKLIST_PREFIX, self.CACHE_PREFIX]:
                pattern = f"{prefix.rstrip(':')}*"
                count = 0
                async for _ in client.scan_iter(match=pattern):
                    count += 1
                key_counts[prefix.rstrip(':')] = count
            
            return {
                'connected_clients': info.get('connected_clients', 0),
                'used_memory': info.get('used_memory_human', '0'),
                'total_commands_processed': info.get('total_commands_processed', 0),
                'key_counts': key_counts,
                'db_keys': info.get('db0', {}).get('keys', 0) if 'db0' in info else 0
            }
            
        except RedisError as e:
            logger.error(f"Failed to get Redis stats: {e}")
            return {}

    async def close(self):
        """Close Redis connections."""
        if self._async_client:
            await self._async_client.close()
        if self._async_connection_pool:
            await self._async_connection_pool.disconnect()

# Global Redis manager instance
redis_manager = RedisManager()

# Context manager for Redis operations
@asynccontextmanager
async def redis_client():
    """Async context manager for Redis client."""
    client = await redis_manager.get_async_client()
    try:
        yield client
    finally:
        # Connection pooling handles cleanup
        pass

# Dependency for FastAPI
async def get_redis() -> RedisManager:
    """Get Redis manager instance for dependency injection."""
    return redis_manager

# Health check endpoint helper
async def redis_health_check() -> Dict[str, Any]:
    """Comprehensive Redis health check."""
    try:
        is_healthy = await redis_manager.health_check()
        stats = await redis_manager.get_stats() if is_healthy else {}
        
        return {
            'healthy': is_healthy,
            'timestamp': datetime.utcnow().isoformat(),
            'stats': stats
        }
    except Exception as e:
        return {
            'healthy': False,
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }

# Export key components
__all__ = [
    'RedisConfig',
    'RedisManager',
    'redis_manager',
    'redis_client',
    'get_redis',
    'redis_health_check'
]
"""
Performance optimization and caching strategies for Off the Grid platform
Provides comprehensive caching solutions, database optimization, and performance monitoring
"""

import json
import time
import hashlib
import asyncio
from typing import Any, Dict, List, Optional, Union, Callable, Tuple
from datetime import datetime, timedelta
from functools import wraps
from dataclasses import dataclass, asdict

import aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.pool import QueuePool
from fastapi import Request, Response
from fastapi.responses import JSONResponse

from logging.python_logging import logger, log_performance_metric

@dataclass
class CacheConfig:
    """Cache configuration settings"""
    redis_url: str = "redis://localhost:6379/0"
    default_ttl: int = 3600  # 1 hour
    max_connections: int = 20
    connection_pool_size: int = 10
    
    # Cache key prefixes
    api_cache_prefix: str = "api:"
    user_cache_prefix: str = "user:"
    grid_cache_prefix: str = "grid:"
    token_cache_prefix: str = "token:"
    
    # Performance thresholds
    slow_query_threshold: float = 1.0  # seconds
    cache_hit_rate_threshold: float = 0.8  # 80%

@dataclass
class CacheMetrics:
    """Cache performance metrics"""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0
    errors: int = 0
    
    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total > 0 else 0.0

class RedisCache:
    """Redis-based caching implementation"""
    
    def __init__(self, config: CacheConfig):
        self.config = config
        self.redis: Optional[aioredis.Redis] = None
        self.metrics = CacheMetrics()
        self._connection_pool: Optional[aioredis.ConnectionPool] = None
    
    async def initialize(self):
        """Initialize Redis connection"""
        try:
            self._connection_pool = aioredis.ConnectionPool.from_url(
                self.config.redis_url,
                max_connections=self.config.max_connections,
                retry_on_timeout=True,
                health_check_interval=30
            )
            self.redis = aioredis.Redis(connection_pool=self._connection_pool)
            
            # Test connection
            await self.redis.ping()
            logger.info("Redis cache initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis cache: {e}")
            raise
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            start_time = time.time()
            
            if not self.redis:
                await self.initialize()
            
            value = await self.redis.get(key)
            duration = time.time() - start_time
            
            if value:
                self.metrics.hits += 1
                log_performance_metric(
                    logger, "cache_hit", duration,
                    details={"key": key, "operation": "get"}
                )
                return json.loads(value)
            else:
                self.metrics.misses += 1
                return None
                
        except Exception as e:
            self.metrics.errors += 1
            logger.error(f"Cache get error for key {key}: {e}")
            return None
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: Optional[int] = None,
        nx: bool = False  # Set only if not exists
    ) -> bool:
        """Set value in cache"""
        try:
            start_time = time.time()
            
            if not self.redis:
                await self.initialize()
            
            ttl = ttl or self.config.default_ttl
            serialized_value = json.dumps(value, default=str)
            
            if nx:
                result = await self.redis.set(key, serialized_value, ex=ttl, nx=True)
            else:
                result = await self.redis.set(key, serialized_value, ex=ttl)
            
            duration = time.time() - start_time
            
            if result:
                self.metrics.sets += 1
                log_performance_metric(
                    logger, "cache_set", duration,
                    details={"key": key, "ttl": ttl, "operation": "set"}
                )
                return True
            return False
            
        except Exception as e:
            self.metrics.errors += 1
            logger.error(f"Cache set error for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        try:
            start_time = time.time()
            
            if not self.redis:
                await self.initialize()
            
            result = await self.redis.delete(key)
            duration = time.time() - start_time
            
            if result:
                self.metrics.deletes += 1
                log_performance_metric(
                    logger, "cache_delete", duration,
                    details={"key": key, "operation": "delete"}
                )
                return True
            return False
            
        except Exception as e:
            self.metrics.errors += 1
            logger.error(f"Cache delete error for key {key}: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """Delete keys matching pattern"""
        try:
            if not self.redis:
                await self.initialize()
            
            keys = await self.redis.keys(pattern)
            if keys:
                result = await self.redis.delete(*keys)
                self.metrics.deletes += result
                return result
            return 0
            
        except Exception as e:
            self.metrics.errors += 1
            logger.error(f"Cache delete pattern error for pattern {pattern}: {e}")
            return 0
    
    async def increment(self, key: str, amount: int = 1, ttl: Optional[int] = None) -> int:
        """Increment counter in cache"""
        try:
            if not self.redis:
                await self.initialize()
            
            result = await self.redis.incr(key, amount)
            
            if ttl:
                await self.redis.expire(key, ttl)
            
            return result
            
        except Exception as e:
            self.metrics.errors += 1
            logger.error(f"Cache increment error for key {key}: {e}")
            return 0
    
    async def get_metrics(self) -> Dict[str, Any]:
        """Get cache performance metrics"""
        info = {}
        try:
            if self.redis:
                info = await self.redis.info()
        except Exception as e:
            logger.error(f"Error getting Redis info: {e}")
        
        return {
            "hits": self.metrics.hits,
            "misses": self.metrics.misses,
            "hit_rate": self.metrics.hit_rate,
            "sets": self.metrics.sets,
            "deletes": self.metrics.deletes,
            "errors": self.metrics.errors,
            "redis_info": {
                "connected_clients": info.get("connected_clients", 0),
                "used_memory": info.get("used_memory", 0),
                "used_memory_human": info.get("used_memory_human", "0B"),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
            }
        }

class CacheDecorators:
    """Cache decorators for functions and methods"""
    
    def __init__(self, cache: RedisCache):
        self.cache = cache
    
    def cached(
        self,
        ttl: Optional[int] = None,
        key_prefix: str = "",
        include_args: bool = True,
        include_kwargs: bool = True
    ):
        """Decorator for caching function results"""
        def decorator(func: Callable):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Generate cache key
                cache_key = self._generate_cache_key(
                    func, key_prefix, args, kwargs, include_args, include_kwargs
                )
                
                # Try to get from cache
                cached_result = await self.cache.get(cache_key)
                if cached_result is not None:
                    return cached_result
                
                # Execute function
                start_time = time.time()
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                
                # Cache the result
                await self.cache.set(cache_key, result, ttl)
                
                log_performance_metric(
                    logger, f"function_{func.__name__}", duration,
                    details={"cached": False, "cache_key": cache_key}
                )
                
                return result
            return wrapper
        return decorator
    
    def cache_invalidate(self, key_pattern: str):
        """Decorator for cache invalidation"""
        def decorator(func: Callable):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                result = await func(*args, **kwargs)
                
                # Invalidate cache
                await self.cache.delete_pattern(key_pattern)
                
                return result
            return wrapper
        return decorator
    
    def _generate_cache_key(
        self,
        func: Callable,
        prefix: str,
        args: tuple,
        kwargs: dict,
        include_args: bool,
        include_kwargs: bool
    ) -> str:
        """Generate cache key for function call"""
        key_parts = [prefix or func.__name__]
        
        if include_args:
            args_str = "_".join(str(arg) for arg in args)
            if args_str:
                key_parts.append(args_str)
        
        if include_kwargs:
            kwargs_str = "_".join(f"{k}:{v}" for k, v in sorted(kwargs.items()))
            if kwargs_str:
                key_parts.append(kwargs_str)
        
        key = ":".join(key_parts)
        
        # Hash long keys
        if len(key) > 200:
            key = hashlib.sha256(key.encode()).hexdigest()
        
        return key

class DatabaseOptimizer:
    """Database performance optimization"""
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.slow_queries: List[Dict[str, Any]] = []
    
    async def optimize_queries(self):
        """Optimize database queries"""
        try:
            # Analyze slow queries
            await self._analyze_slow_queries()
            
            # Update table statistics
            await self._update_statistics()
            
            # Check for missing indexes
            await self._check_missing_indexes()
            
            logger.info("Database optimization completed")
            
        except Exception as e:
            logger.error(f"Database optimization failed: {e}")
    
    async def _analyze_slow_queries(self):
        """Analyze slow queries from pg_stat_statements"""
        try:
            query = """
            SELECT 
                query,
                total_exec_time,
                mean_exec_time,
                calls,
                rows,
                100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
            FROM pg_stat_statements 
            WHERE mean_exec_time > 1000  -- More than 1 second
            ORDER BY mean_exec_time DESC 
            LIMIT 10
            """
            
            result = await self.db.execute(text(query))
            slow_queries = result.fetchall()
            
            for query_info in slow_queries:
                self.slow_queries.append({
                    "query": query_info.query[:100] + "..." if len(query_info.query) > 100 else query_info.query,
                    "mean_time_ms": query_info.mean_exec_time,
                    "total_time_ms": query_info.total_exec_time,
                    "calls": query_info.calls,
                    "cache_hit_percent": query_info.hit_percent or 0
                })
            
            logger.info(f"Found {len(slow_queries)} slow queries")
            
        except Exception as e:
            logger.error(f"Error analyzing slow queries: {e}")
    
    async def _update_statistics(self):
        """Update table statistics for better query planning"""
        try:
            await self.db.execute(text("ANALYZE;"))
            await self.db.commit()
            logger.info("Updated database statistics")
        except Exception as e:
            logger.error(f"Error updating statistics: {e}")
    
    async def _check_missing_indexes(self):
        """Check for potentially missing indexes"""
        try:
            query = """
            SELECT 
                schemaname,
                tablename,
                attname,
                n_distinct,
                correlation
            FROM pg_stats 
            WHERE schemaname = 'public'
            AND n_distinct > 100
            AND correlation < 0.1
            """
            
            result = await self.db.execute(text(query))
            candidates = result.fetchall()
            
            if candidates:
                logger.info(f"Found {len(candidates)} potential index candidates")
                for candidate in candidates:
                    logger.info(f"Consider index on {candidate.tablename}.{candidate.attname}")
                    
        except Exception as e:
            logger.error(f"Error checking missing indexes: {e}")

class APIResponseCache:
    """HTTP response caching middleware"""
    
    def __init__(self, cache: RedisCache, config: CacheConfig):
        self.cache = cache
        self.config = config
        
        # Define cacheable endpoints and their TTLs
        self.cache_config = {
            "/api/tokens": 300,      # 5 minutes
            "/api/grids": 60,        # 1 minute
            "/api/user/progress": 120, # 2 minutes
            "/health": 30,           # 30 seconds
        }
    
    async def __call__(self, request: Request, call_next):
        """Cache middleware for HTTP responses"""
        # Only cache GET requests
        if request.method != "GET":
            return await call_next(request)
        
        # Check if endpoint should be cached
        endpoint = request.url.path
        cache_ttl = self._get_cache_ttl(endpoint)
        
        if not cache_ttl:
            return await call_next(request)
        
        # Generate cache key
        cache_key = self._generate_response_cache_key(request)
        
        # Try to get cached response
        cached_response = await self.cache.get(cache_key)
        if cached_response:
            return JSONResponse(
                content=cached_response["content"],
                status_code=cached_response["status_code"],
                headers={
                    **cached_response.get("headers", {}),
                    "X-Cache": "HIT",
                    "X-Cache-Key": cache_key
                }
            )
        
        # Execute request
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time
        
        # Cache successful responses
        if 200 <= response.status_code < 300:
            try:
                # Read response content
                response_body = b""
                async for chunk in response.body_iterator:
                    response_body += chunk
                
                content = json.loads(response_body.decode())
                
                # Create cacheable response
                cacheable_response = {
                    "content": content,
                    "status_code": response.status_code,
                    "headers": dict(response.headers)
                }
                
                # Cache the response
                await self.cache.set(cache_key, cacheable_response, cache_ttl)
                
                # Create new response with cache headers
                return JSONResponse(
                    content=content,
                    status_code=response.status_code,
                    headers={
                        **dict(response.headers),
                        "X-Cache": "MISS",
                        "X-Cache-TTL": str(cache_ttl),
                        "X-Response-Time": f"{duration:.3f}s"
                    }
                )
                
            except Exception as e:
                logger.error(f"Error caching response: {e}")
        
        return response
    
    def _get_cache_ttl(self, endpoint: str) -> Optional[int]:
        """Get cache TTL for endpoint"""
        for pattern, ttl in self.cache_config.items():
            if endpoint.startswith(pattern):
                return ttl
        return None
    
    def _generate_response_cache_key(self, request: Request) -> str:
        """Generate cache key for HTTP response"""
        key_parts = [
            self.config.api_cache_prefix,
            request.method,
            request.url.path,
        ]
        
        # Include query parameters
        if request.query_params:
            query_string = "&".join(f"{k}={v}" for k, v in sorted(request.query_params.items()))
            key_parts.append(query_string)
        
        # Include user context if authenticated
        auth_header = request.headers.get("authorization")
        if auth_header:
            # Use hash of auth header to avoid storing sensitive data
            auth_hash = hashlib.sha256(auth_header.encode()).hexdigest()[:16]
            key_parts.append(f"auth:{auth_hash}")
        
        return ":".join(key_parts)

class PerformanceMonitor:
    """Performance monitoring and alerting"""
    
    def __init__(self, cache: RedisCache, db_optimizer: DatabaseOptimizer):
        self.cache = cache
        self.db_optimizer = db_optimizer
        self.performance_alerts: List[Dict[str, Any]] = []
    
    async def check_performance_metrics(self) -> Dict[str, Any]:
        """Check system performance metrics"""
        metrics = {
            "timestamp": datetime.utcnow().isoformat(),
            "cache": await self.cache.get_metrics(),
            "database": await self._get_database_metrics(),
            "alerts": self.performance_alerts.copy()
        }
        
        # Check for performance issues
        await self._check_cache_performance(metrics["cache"])
        await self._check_database_performance(metrics["database"])
        
        # Clear old alerts
        self.performance_alerts = [
            alert for alert in self.performance_alerts 
            if (datetime.utcnow() - datetime.fromisoformat(alert["timestamp"])).seconds < 3600
        ]
        
        return metrics
    
    async def _get_database_metrics(self) -> Dict[str, Any]:
        """Get database performance metrics"""
        try:
            # Connection stats
            conn_query = "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active'"
            conn_result = await self.db_optimizer.db.execute(text(conn_query))
            active_connections = conn_result.scalar()
            
            # Cache hit ratio
            cache_query = """
            SELECT 
                sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
            FROM pg_statio_user_tables
            """
            cache_result = await self.db_optimizer.db.execute(text(cache_query))
            cache_hit_ratio = cache_result.scalar() or 0
            
            return {
                "active_connections": active_connections,
                "cache_hit_ratio": float(cache_hit_ratio),
                "slow_queries_count": len(self.db_optimizer.slow_queries),
                "slow_queries": self.db_optimizer.slow_queries[-5:]  # Last 5
            }
            
        except Exception as e:
            logger.error(f"Error getting database metrics: {e}")
            return {"error": str(e)}
    
    async def _check_cache_performance(self, cache_metrics: Dict[str, Any]):
        """Check cache performance and generate alerts"""
        hit_rate = cache_metrics.get("hit_rate", 0)
        
        if hit_rate < self.cache.config.cache_hit_rate_threshold:
            alert = {
                "type": "cache_performance",
                "severity": "warning",
                "message": f"Cache hit rate ({hit_rate:.2%}) below threshold ({self.cache.config.cache_hit_rate_threshold:.2%})",
                "timestamp": datetime.utcnow().isoformat(),
                "metrics": cache_metrics
            }
            self.performance_alerts.append(alert)
            logger.warning(alert["message"])
    
    async def _check_database_performance(self, db_metrics: Dict[str, Any]):
        """Check database performance and generate alerts"""
        if "error" in db_metrics:
            return
        
        # Check connection count
        active_connections = db_metrics.get("active_connections", 0)
        if active_connections > 50:  # Configurable threshold
            alert = {
                "type": "database_connections",
                "severity": "warning",
                "message": f"High database connection count: {active_connections}",
                "timestamp": datetime.utcnow().isoformat(),
                "metrics": db_metrics
            }
            self.performance_alerts.append(alert)
            logger.warning(alert["message"])
        
        # Check cache hit ratio
        cache_hit_ratio = db_metrics.get("cache_hit_ratio", 0)
        if cache_hit_ratio < 90:  # Less than 90% cache hit ratio
            alert = {
                "type": "database_cache",
                "severity": "warning", 
                "message": f"Low database cache hit ratio: {cache_hit_ratio:.1f}%",
                "timestamp": datetime.utcnow().isoformat(),
                "metrics": db_metrics
            }
            self.performance_alerts.append(alert)
            logger.warning(alert["message"])

class OptimizationManager:
    """Main optimization manager"""
    
    def __init__(self, config: CacheConfig, db_session: AsyncSession):
        self.config = config
        self.cache = RedisCache(config)
        self.decorators = CacheDecorators(self.cache)
        self.db_optimizer = DatabaseOptimizer(db_session)
        self.performance_monitor = PerformanceMonitor(self.cache, self.db_optimizer)
        
        # Background tasks
        self._optimization_task: Optional[asyncio.Task] = None
    
    async def initialize(self):
        """Initialize optimization components"""
        await self.cache.initialize()
        logger.info("Optimization manager initialized")
    
    async def start_background_optimization(self):
        """Start background optimization tasks"""
        if self._optimization_task and not self._optimization_task.done():
            return
        
        self._optimization_task = asyncio.create_task(self._optimization_loop())
        logger.info("Started background optimization tasks")
    
    async def stop_background_optimization(self):
        """Stop background optimization tasks"""
        if self._optimization_task and not self._optimization_task.done():
            self._optimization_task.cancel()
            try:
                await self._optimization_task
            except asyncio.CancelledError:
                pass
        logger.info("Stopped background optimization tasks")
    
    async def _optimization_loop(self):
        """Background optimization loop"""
        while True:
            try:
                # Run database optimization every hour
                await self.db_optimizer.optimize_queries()
                
                # Check performance metrics
                metrics = await self.performance_monitor.check_performance_metrics()
                
                # Log performance summary
                logger.info(f"Performance check completed: {json.dumps(metrics, indent=2)}")
                
                # Sleep for 1 hour
                await asyncio.sleep(3600)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in optimization loop: {e}")
                await asyncio.sleep(300)  # Wait 5 minutes before retry
    
    def get_cache_decorator(self):
        """Get cache decorator for use in application"""
        return self.decorators.cached
    
    def get_invalidate_decorator(self):
        """Get cache invalidation decorator"""
        return self.decorators.cache_invalidate
    
    async def get_performance_report(self) -> Dict[str, Any]:
        """Get comprehensive performance report"""
        return await self.performance_monitor.check_performance_metrics()

# Example usage and integration
async def setup_optimization(app, config: CacheConfig, db_session: AsyncSession):
    """Set up optimization for FastAPI application"""
    
    # Create optimization manager
    optimization_manager = OptimizationManager(config, db_session)
    await optimization_manager.initialize()
    
    # Add response caching middleware
    response_cache = APIResponseCache(optimization_manager.cache, config)
    app.middleware("http")(response_cache)
    
    # Start background optimization
    await optimization_manager.start_background_optimization()
    
    # Add shutdown handler
    @app.on_event("shutdown")
    async def shutdown_optimization():
        await optimization_manager.stop_background_optimization()
    
    return optimization_manager
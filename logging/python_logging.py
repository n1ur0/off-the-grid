"""
Enhanced logging configuration for Off the Grid FastAPI application
Provides structured logging with correlation IDs, performance metrics, and security events
"""

import logging
import sys
import json
import time
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from contextvars import ContextVar
from functools import wraps

import structlog
from pythonjsonlogger import jsonlogger
from opentelemetry import trace
from opentelemetry.instrumentation.logging import LoggingInstrumentor

# Correlation ID context variable
correlation_id_var: ContextVar[str] = ContextVar('correlation_id', default='')

class CorrelationFilter(logging.Filter):
    """Add correlation ID to log records"""
    def filter(self, record):
        record.correlation_id = correlation_id_var.get('')
        record.trace_id = ''
        record.span_id = ''
        
        # Add OpenTelemetry trace information if available
        current_span = trace.get_current_span()
        if current_span and current_span.is_recording():
            span_context = current_span.get_span_context()
            if span_context.is_valid:
                record.trace_id = format(span_context.trace_id, '032x')
                record.span_id = format(span_context.span_id, '016x')
        
        return True

class SecurityFilter(logging.Filter):
    """Filter for security-related log entries"""
    def filter(self, record):
        # Mark security-related events
        security_keywords = [
            'authentication', 'authorization', 'login', 'logout',
            'failed', 'unauthorized', 'forbidden', 'suspicious',
            'rate_limit', 'csrf', 'sql_injection', 'xss'
        ]
        
        message = getattr(record, 'msg', '').lower()
        record.security_event = any(keyword in message for keyword in security_keywords)
        return True

class PerformanceFilter(logging.Filter):
    """Filter for performance-related log entries"""
    def filter(self, record):
        # Add performance context
        if hasattr(record, 'duration'):
            if record.duration > 5.0:  # Slow requests
                record.performance_issue = 'slow_request'
            elif record.duration > 10.0:  # Very slow requests
                record.performance_issue = 'very_slow_request'
        return True

class StructuredFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter with additional context"""
    
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        
        # Add standard fields
        log_record['timestamp'] = datetime.utcnow().isoformat()
        log_record['service'] = 'off-the-grid-api'
        log_record['environment'] = 'production'  # Set from environment
        
        # Add request context if available
        if hasattr(record, 'request_id'):
            log_record['request_id'] = record.request_id
        
        # Add user context if available
        if hasattr(record, 'user_id'):
            log_record['user_id'] = record.user_id
        
        # Add performance metrics
        if hasattr(record, 'duration'):
            log_record['duration_ms'] = round(record.duration * 1000, 2)
        
        # Add error details
        if record.levelno >= logging.ERROR and hasattr(record, 'exc_info'):
            log_record['error_type'] = record.exc_info[0].__name__ if record.exc_info[0] else None

def setup_logging(
    log_level: str = 'INFO',
    log_format: str = 'json',
    enable_correlation_id: bool = True,
    enable_security_logging: bool = True,
    enable_performance_logging: bool = True
) -> logging.Logger:
    """
    Set up comprehensive logging configuration
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format: Format type ('json' or 'text')
        enable_correlation_id: Enable correlation ID tracking
        enable_security_logging: Enable security event tracking
        enable_performance_logging: Enable performance monitoring
    
    Returns:
        Configured logger instance
    """
    
    # Clear existing handlers
    logging.getLogger().handlers = []
    
    # Create root logger
    logger = logging.getLogger()
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level.upper()))
    
    # Set formatter based on format type
    if log_format == 'json':
        formatter = StructuredFormatter(
            fmt='%(timestamp)s %(service)s %(name)s %(levelname)s %(correlation_id)s %(trace_id)s %(span_id)s %(message)s',
            datefmt='%Y-%m-%dT%H:%M:%S'
        )
    else:
        formatter = logging.Formatter(
            fmt='%(asctime)s - %(name)s - %(levelname)s - [%(correlation_id)s] - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    console_handler.setFormatter(formatter)
    
    # Add filters
    if enable_correlation_id:
        correlation_filter = CorrelationFilter()
        console_handler.addFilter(correlation_filter)
    
    if enable_security_logging:
        security_filter = SecurityFilter()
        console_handler.addFilter(security_filter)
    
    if enable_performance_logging:
        performance_filter = PerformanceFilter()
        console_handler.addFilter(performance_filter)
    
    logger.addHandler(console_handler)
    
    # File handlers for different log levels
    error_handler = logging.FileHandler('/var/log/off-the-grid/error.log')
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    if enable_correlation_id:
        error_handler.addFilter(correlation_filter)
    logger.addHandler(error_handler)
    
    # Security log handler
    if enable_security_logging:
        security_handler = logging.FileHandler('/var/log/off-the-grid/security.log')
        security_handler.setLevel(logging.INFO)
        security_handler.setFormatter(formatter)
        security_handler.addFilter(security_filter)
        if enable_correlation_id:
            security_handler.addFilter(correlation_filter)
        logger.addHandler(security_handler)
    
    # Performance log handler
    if enable_performance_logging:
        performance_handler = logging.FileHandler('/var/log/off-the-grid/performance.log')
        performance_handler.setLevel(logging.INFO)
        performance_handler.setFormatter(formatter)
        performance_handler.addFilter(performance_filter)
        if enable_correlation_id:
            performance_handler.addFilter(correlation_filter)
        logger.addHandler(performance_handler)
    
    # Configure third-party loggers
    logging.getLogger('uvicorn.access').setLevel(logging.INFO)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    
    # Initialize OpenTelemetry logging instrumentation
    LoggingInstrumentor().instrument(set_logging_format=True)
    
    return logger

def set_correlation_id(correlation_id: Optional[str] = None) -> str:
    """Set correlation ID for the current context"""
    if not correlation_id:
        correlation_id = str(uuid.uuid4())
    correlation_id_var.set(correlation_id)
    return correlation_id

def get_correlation_id() -> str:
    """Get current correlation ID"""
    return correlation_id_var.get('')

def log_security_event(
    logger: logging.Logger,
    event_type: str,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
):
    """Log security event with structured data"""
    extra = {
        'event_type': event_type,
        'security_event': True,
        'user_id': user_id,
        'ip_address': ip_address,
        'details': details or {}
    }
    logger.warning(f"Security event: {event_type}", extra=extra)

def log_performance_metric(
    logger: logging.Logger,
    metric_name: str,
    duration: float,
    details: Optional[Dict[str, Any]] = None
):
    """Log performance metric"""
    extra = {
        'metric_name': metric_name,
        'duration': duration,
        'performance_metric': True,
        'details': details or {}
    }
    logger.info(f"Performance metric: {metric_name}", extra=extra)

def log_business_event(
    logger: logging.Logger,
    event_type: str,
    user_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
):
    """Log business event"""
    extra = {
        'event_type': event_type,
        'business_event': True,
        'user_id': user_id,
        'details': details or {}
    }
    logger.info(f"Business event: {event_type}", extra=extra)

# Decorators for automatic logging
def log_function_call(logger: Optional[logging.Logger] = None):
    """Decorator to log function calls with performance metrics"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            func_logger = logger or logging.getLogger(func.__module__)
            start_time = time.time()
            
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                
                func_logger.debug(
                    f"Function {func.__name__} completed",
                    extra={'duration': duration, 'function': func.__name__}
                )
                return result
                
            except Exception as e:
                duration = time.time() - start_time
                func_logger.error(
                    f"Function {func.__name__} failed: {str(e)}",
                    extra={
                        'duration': duration,
                        'function': func.__name__,
                        'error': str(e)
                    },
                    exc_info=True
                )
                raise
        return wrapper
    return decorator

def log_api_call(logger: Optional[logging.Logger] = None):
    """Decorator to log API calls"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            func_logger = logger or logging.getLogger(func.__module__)
            start_time = time.time()
            
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                
                func_logger.info(
                    f"API call {func.__name__} completed",
                    extra={
                        'duration': duration,
                        'api_endpoint': func.__name__,
                        'status': 'success'
                    }
                )
                return result
                
            except Exception as e:
                duration = time.time() - start_time
                func_logger.error(
                    f"API call {func.__name__} failed: {str(e)}",
                    extra={
                        'duration': duration,
                        'api_endpoint': func.__name__,
                        'status': 'error',
                        'error': str(e)
                    },
                    exc_info=True
                )
                raise
        return wrapper
    return decorator

# Middleware for FastAPI
class LoggingMiddleware:
    """FastAPI middleware for request/response logging"""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
    
    async def __call__(self, request, call_next):
        # Set correlation ID
        correlation_id = set_correlation_id()
        
        # Log request
        start_time = time.time()
        self.logger.info(
            f"Request started: {request.method} {request.url}",
            extra={
                'method': request.method,
                'url': str(request.url),
                'headers': dict(request.headers),
                'correlation_id': correlation_id
            }
        )
        
        try:
            # Process request
            response = await call_next(request)
            duration = time.time() - start_time
            
            # Log response
            self.logger.info(
                f"Request completed: {request.method} {request.url}",
                extra={
                    'method': request.method,
                    'url': str(request.url),
                    'status_code': response.status_code,
                    'duration': duration,
                    'correlation_id': correlation_id
                }
            )
            
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            self.logger.error(
                f"Request failed: {request.method} {request.url}",
                extra={
                    'method': request.method,
                    'url': str(request.url),
                    'error': str(e),
                    'duration': duration,
                    'correlation_id': correlation_id
                },
                exc_info=True
            )
            raise

# Export configured logger
logger = setup_logging()
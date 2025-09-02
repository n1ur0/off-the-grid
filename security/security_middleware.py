"""
Enhanced security middleware for Off the Grid FastAPI application
Provides comprehensive security hardening, input validation, and threat protection
"""

import re
import time
import json
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from ipaddress import ip_address, ip_network
from urllib.parse import urlparse

from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import RequestResponseEndpoint
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

import bcrypt
from jose import JWTError, jwt
from passlib.context import CryptContext
import aioredis
from sqlalchemy.ext.asyncio import AsyncSession

from logging.python_logging import logger, log_security_event

class SecurityConfig:
    """Security configuration settings"""
    
    # Rate limiting
    RATE_LIMIT_REQUESTS = 100
    RATE_LIMIT_WINDOW = 3600  # 1 hour
    RATE_LIMIT_BURST = 20     # Burst allowance
    
    # Authentication
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
    REFRESH_TOKEN_EXPIRE_DAYS = 7
    JWT_ALGORITHM = "HS256"
    
    # Password policy
    MIN_PASSWORD_LENGTH = 12
    REQUIRE_UPPERCASE = True
    REQUIRE_LOWERCASE = True
    REQUIRE_DIGITS = True
    REQUIRE_SPECIAL = True
    
    # Security headers
    HSTS_MAX_AGE = 31536000  # 1 year
    CSP_POLICY = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' wss: https:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    
    # IP blocking
    BLOCKED_IPS = set()
    ALLOWED_IPS = set()  # If not empty, only these IPs are allowed
    
    # Input validation
    MAX_REQUEST_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_FIELD_SIZE = 1024 * 1024         # 1MB per field
    
    # Suspicious activity detection
    MAX_FAILED_ATTEMPTS = 5
    LOCKOUT_DURATION = 900  # 15 minutes

class SecurityHeaders:
    """Security headers for HTTP responses"""
    
    @staticmethod
    def get_headers(config: SecurityConfig) -> Dict[str, str]:
        return {
            # HSTS
            "Strict-Transport-Security": f"max-age={config.HSTS_MAX_AGE}; includeSubDomains; preload",
            
            # Content Security Policy
            "Content-Security-Policy": config.CSP_POLICY,
            
            # XSS Protection
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            
            # Referrer Policy
            "Referrer-Policy": "strict-origin-when-cross-origin",
            
            # Permissions Policy
            "Permissions-Policy": (
                "camera=(), microphone=(), geolocation=(), "
                "payment=(), usb=(), magnetometer=(), gyroscope=()"
            ),
            
            # Cache Control
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            
            # Server identification
            "Server": "Off-the-Grid-API",
            
            # Cross-domain policies
            "Cross-Origin-Embedder-Policy": "require-corp",
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Resource-Policy": "same-origin"
        }

class RateLimiter:
    """Advanced rate limiting with Redis backend"""
    
    def __init__(self, redis_client: aioredis.Redis, config: SecurityConfig):
        self.redis = redis_client
        self.config = config
    
    async def is_allowed(self, identifier: str, endpoint: str = "global") -> tuple[bool, dict]:
        """Check if request is allowed and return rate limit info"""
        key = f"rate_limit:{identifier}:{endpoint}"
        current_time = int(time.time())
        window_start = current_time - self.config.RATE_LIMIT_WINDOW
        
        # Use Redis sorted set for sliding window
        pipe = self.redis.pipeline()
        
        # Remove old entries
        pipe.zremrangebyscore(key, 0, window_start)
        
        # Count current requests
        pipe.zcard(key)
        
        # Add current request
        pipe.zadd(key, {str(current_time): current_time})
        
        # Set expiry
        pipe.expire(key, self.config.RATE_LIMIT_WINDOW)
        
        results = await pipe.execute()
        request_count = results[1]
        
        # Check burst limit (requests in last 60 seconds)
        burst_window_start = current_time - 60
        burst_count = await self.redis.zcount(key, burst_window_start, current_time)
        
        rate_info = {
            "requests": request_count,
            "limit": self.config.RATE_LIMIT_REQUESTS,
            "window": self.config.RATE_LIMIT_WINDOW,
            "reset_time": window_start + self.config.RATE_LIMIT_WINDOW,
            "burst_requests": burst_count,
            "burst_limit": self.config.RATE_LIMIT_BURST
        }
        
        # Check limits
        if burst_count > self.config.RATE_LIMIT_BURST:
            return False, rate_info
        
        if request_count > self.config.RATE_LIMIT_REQUESTS:
            return False, rate_info
        
        return True, rate_info

class InputValidator:
    """Comprehensive input validation and sanitization"""
    
    # Common attack patterns
    SQL_INJECTION_PATTERNS = [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)",
        r"(--|#|/\*|\*/)",
        r"(\b(OR|AND)\b\s+\d+\s*=\s*\d+)",
        r"(\b(OR|AND)\b\s+['\"][^'\"]*['\"])",
    ]
    
    XSS_PATTERNS = [
        r"<script[^>]*>",
        r"javascript:",
        r"vbscript:",
        r"onload\s*=",
        r"onerror\s*=",
        r"onclick\s*=",
        r"<iframe[^>]*>",
        r"<object[^>]*>",
        r"<embed[^>]*>",
    ]
    
    COMMAND_INJECTION_PATTERNS = [
        r"[;&|`$(){}[\]\\]",
        r"(cat|ls|pwd|whoami|id|uname|wget|curl|nc|netcat|bash|sh|cmd|powershell)",
    ]
    
    def __init__(self):
        self.sql_regex = re.compile("|".join(self.SQL_INJECTION_PATTERNS), re.IGNORECASE)
        self.xss_regex = re.compile("|".join(self.XSS_PATTERNS), re.IGNORECASE)
        self.cmd_regex = re.compile("|".join(self.COMMAND_INJECTION_PATTERNS), re.IGNORECASE)
    
    def validate_input(self, data: Any, field_name: str = "") -> Dict[str, Any]:
        """Validate input data for security threats"""
        threats = []
        
        if isinstance(data, str):
            threats.extend(self._check_string_threats(data, field_name))
        elif isinstance(data, dict):
            for key, value in data.items():
                sub_threats = self.validate_input(value, f"{field_name}.{key}")
                threats.extend(sub_threats["threats"])
        elif isinstance(data, list):
            for i, item in enumerate(data):
                sub_threats = self.validate_input(item, f"{field_name}[{i}]")
                threats.extend(sub_threats["threats"])
        
        return {
            "is_safe": len(threats) == 0,
            "threats": threats,
            "sanitized_data": self._sanitize_data(data) if threats else data
        }
    
    def _check_string_threats(self, text: str, field_name: str) -> List[Dict[str, str]]:
        """Check string for various security threats"""
        threats = []
        
        # SQL Injection
        if self.sql_regex.search(text):
            threats.append({
                "type": "sql_injection",
                "field": field_name,
                "description": "Potential SQL injection detected"
            })
        
        # XSS
        if self.xss_regex.search(text):
            threats.append({
                "type": "xss",
                "field": field_name,
                "description": "Potential XSS attack detected"
            })
        
        # Command Injection
        if self.cmd_regex.search(text):
            threats.append({
                "type": "command_injection",
                "field": field_name,
                "description": "Potential command injection detected"
            })
        
        # Path Traversal
        if "../" in text or "..\\" in text:
            threats.append({
                "type": "path_traversal",
                "field": field_name,
                "description": "Path traversal attempt detected"
            })
        
        # LDAP Injection
        if any(char in text for char in ["(", ")", "*", "\\", "/"]):
            if re.search(r"\([^)]*\*[^)]*\)", text):
                threats.append({
                    "type": "ldap_injection",
                    "field": field_name,
                    "description": "Potential LDAP injection detected"
                })
        
        return threats
    
    def _sanitize_data(self, data: Any) -> Any:
        """Basic data sanitization"""
        if isinstance(data, str):
            # Remove potentially dangerous characters
            sanitized = re.sub(r'[<>"\';()&+]', '', data)
            return sanitized.strip()
        elif isinstance(data, dict):
            return {k: self._sanitize_data(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._sanitize_data(item) for item in data]
        else:
            return data

class SecurityMiddleware(BaseHTTPMiddleware):
    """Comprehensive security middleware"""
    
    def __init__(
        self,
        app: FastAPI,
        config: SecurityConfig,
        redis_client: aioredis.Redis,
        db_session: AsyncSession
    ):
        super().__init__(app)
        self.config = config
        self.redis = redis_client
        self.db = db_session
        self.rate_limiter = RateLimiter(redis_client, config)
        self.input_validator = InputValidator()
        self.security_headers = SecurityHeaders()
    
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Main security middleware dispatch"""
        start_time = time.time()
        
        try:
            # 1. IP filtering
            client_ip = self._get_client_ip(request)
            if not self._is_ip_allowed(client_ip):
                log_security_event(
                    logger, "blocked_ip_access",
                    ip_address=client_ip,
                    details={"endpoint": str(request.url)}
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
            
            # 2. Rate limiting
            rate_limit_id = self._get_rate_limit_identifier(request)
            is_allowed, rate_info = await self.rate_limiter.is_allowed(
                rate_limit_id, request.url.path
            )
            
            if not is_allowed:
                log_security_event(
                    logger, "rate_limit_exceeded",
                    ip_address=client_ip,
                    details={"rate_info": rate_info, "endpoint": str(request.url)}
                )
                
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": "Rate limit exceeded",
                        "retry_after": rate_info["reset_time"] - int(time.time())
                    },
                    headers={
                        "X-RateLimit-Limit": str(rate_info["limit"]),
                        "X-RateLimit-Remaining": str(max(0, rate_info["limit"] - rate_info["requests"])),
                        "X-RateLimit-Reset": str(rate_info["reset_time"]),
                        "Retry-After": str(rate_info["reset_time"] - int(time.time()))
                    }
                )
            
            # 3. Request size validation
            if hasattr(request, "body"):
                body = await request.body()
                if len(body) > self.config.MAX_REQUEST_SIZE:
                    log_security_event(
                        logger, "request_size_exceeded",
                        ip_address=client_ip,
                        details={"size": len(body), "max_size": self.config.MAX_REQUEST_SIZE}
                    )
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Request too large"
                    )
            
            # 4. Input validation (for JSON requests)
            if request.headers.get("content-type") == "application/json":
                await self._validate_json_input(request, client_ip)
            
            # 5. CSRF protection for state-changing operations
            if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
                await self._validate_csrf_token(request, client_ip)
            
            # 6. Process request
            response = await call_next(request)
            
            # 7. Add security headers
            for header, value in self.security_headers.get_headers(self.config).items():
                response.headers[header] = value
            
            # 8. Add rate limit headers
            response.headers.update({
                "X-RateLimit-Limit": str(rate_info["limit"]),
                "X-RateLimit-Remaining": str(max(0, rate_info["limit"] - rate_info["requests"])),
                "X-RateLimit-Reset": str(rate_info["reset_time"])
            })
            
            # 9. Log successful request
            duration = time.time() - start_time
            logger.info(
                f"Request completed: {request.method} {request.url}",
                extra={
                    "method": request.method,
                    "url": str(request.url),
                    "status_code": response.status_code,
                    "duration": duration,
                    "ip_address": client_ip
                }
            )
            
            return response
            
        except HTTPException:
            raise
        except Exception as e:
            log_security_event(
                logger, "security_middleware_error",
                ip_address=client_ip,
                details={"error": str(e), "endpoint": str(request.url)}
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error"
            )
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request"""
        # Check for forwarded headers (in order of preference)
        forwarded_headers = [
            "CF-Connecting-IP",      # Cloudflare
            "X-Forwarded-For",       # Standard
            "X-Real-IP",             # Nginx
            "X-Client-IP",           # Alternative
            "True-Client-IP",        # Akamai
        ]
        
        for header in forwarded_headers:
            if ip := request.headers.get(header):
                # Take the first IP in comma-separated list
                return ip.split(",")[0].strip()
        
        # Fallback to client host
        return request.client.host if request.client else "unknown"
    
    def _is_ip_allowed(self, ip: str) -> bool:
        """Check if IP address is allowed"""
        try:
            client_ip = ip_address(ip)
            
            # Check blocked IPs
            for blocked_ip in self.config.BLOCKED_IPS:
                if client_ip in ip_network(blocked_ip, strict=False):
                    return False
            
            # Check allowed IPs (if configured)
            if self.config.ALLOWED_IPS:
                for allowed_ip in self.config.ALLOWED_IPS:
                    if client_ip in ip_network(allowed_ip, strict=False):
                        return True
                return False  # Not in allowed list
            
            return True  # No restrictions or not blocked
            
        except ValueError:
            # Invalid IP address
            return False
    
    def _get_rate_limit_identifier(self, request: Request) -> str:
        """Get identifier for rate limiting"""
        client_ip = self._get_client_ip(request)
        
        # Use user ID if authenticated, otherwise IP
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                token = auth_header.split(" ")[1]
                payload = jwt.decode(token, verify=False)  # Don't verify for rate limiting
                user_id = payload.get("sub")
                if user_id:
                    return f"user:{user_id}"
            except JWTError:
                pass
        
        return f"ip:{client_ip}"
    
    async def _validate_json_input(self, request: Request, client_ip: str):
        """Validate JSON input for security threats"""
        try:
            body = await request.body()
            if body:
                json_data = json.loads(body)
                validation_result = self.input_validator.validate_input(json_data)
                
                if not validation_result["is_safe"]:
                    log_security_event(
                        logger, "malicious_input_detected",
                        ip_address=client_ip,
                        details={
                            "threats": validation_result["threats"],
                            "endpoint": str(request.url)
                        }
                    )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid input detected"
                    )
        except json.JSONDecodeError:
            # Let the application handle JSON decode errors
            pass
        except UnicodeDecodeError:
            log_security_event(
                logger, "invalid_encoding_detected",
                ip_address=client_ip,
                details={"endpoint": str(request.url)}
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid character encoding"
            )
    
    async def _validate_csrf_token(self, request: Request, client_ip: str):
        """Validate CSRF token for state-changing operations"""
        # Skip CSRF validation for API endpoints with proper authentication
        if request.url.path.startswith("/api/"):
            auth_header = request.headers.get("authorization")
            if auth_header and auth_header.startswith("Bearer "):
                return  # API with bearer token is exempt
        
        csrf_token = request.headers.get("X-CSRF-Token") or request.cookies.get("csrf_token")
        session_token = request.cookies.get("session")
        
        if not csrf_token or not session_token:
            log_security_event(
                logger, "csrf_token_missing",
                ip_address=client_ip,
                details={"endpoint": str(request.url)}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token required"
            )
        
        # Validate CSRF token format and origin
        if not self._is_valid_csrf_token(csrf_token, session_token):
            log_security_event(
                logger, "invalid_csrf_token",
                ip_address=client_ip,
                details={"endpoint": str(request.url)}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid CSRF token"
            )
    
    def _is_valid_csrf_token(self, csrf_token: str, session_token: str) -> bool:
        """Validate CSRF token against session"""
        try:
            # Simple HMAC-based CSRF token validation
            expected_token = hashlib.sha256(
                f"{session_token}:csrf".encode()
            ).hexdigest()[:32]
            return secrets.compare_digest(csrf_token, expected_token)
        except Exception:
            return False

class PasswordValidator:
    """Password strength validation"""
    
    def __init__(self, config: SecurityConfig):
        self.config = config
    
    def validate_password(self, password: str) -> Dict[str, Any]:
        """Validate password strength"""
        errors = []
        
        if len(password) < self.config.MIN_PASSWORD_LENGTH:
            errors.append(f"Password must be at least {self.config.MIN_PASSWORD_LENGTH} characters long")
        
        if self.config.REQUIRE_UPPERCASE and not re.search(r"[A-Z]", password):
            errors.append("Password must contain at least one uppercase letter")
        
        if self.config.REQUIRE_LOWERCASE and not re.search(r"[a-z]", password):
            errors.append("Password must contain at least one lowercase letter")
        
        if self.config.REQUIRE_DIGITS and not re.search(r"\d", password):
            errors.append("Password must contain at least one digit")
        
        if self.config.REQUIRE_SPECIAL and not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            errors.append("Password must contain at least one special character")
        
        # Check for common patterns
        if self._has_common_patterns(password):
            errors.append("Password contains common patterns and is too predictable")
        
        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "strength_score": self._calculate_strength_score(password)
        }
    
    def _has_common_patterns(self, password: str) -> bool:
        """Check for common password patterns"""
        common_patterns = [
            r"123456",
            r"password",
            r"admin",
            r"qwerty",
            r"abc123",
            r"(\w)\1{3,}",  # Repeated characters
        ]
        
        for pattern in common_patterns:
            if re.search(pattern, password.lower()):
                return True
        
        return False
    
    def _calculate_strength_score(self, password: str) -> int:
        """Calculate password strength score (0-100)"""
        score = 0
        
        # Length bonus
        score += min(25, len(password) * 2)
        
        # Character variety
        if re.search(r"[a-z]", password):
            score += 10
        if re.search(r"[A-Z]", password):
            score += 10
        if re.search(r"\d", password):
            score += 10
        if re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            score += 15
        
        # Uniqueness
        unique_chars = len(set(password))
        score += min(20, unique_chars * 2)
        
        # Penalty for patterns
        if self._has_common_patterns(password):
            score -= 20
        
        return max(0, min(100, score))

def setup_security_middleware(
    app: FastAPI,
    config: SecurityConfig,
    redis_client: aioredis.Redis,
    db_session: AsyncSession
):
    """Set up all security middleware"""
    
    # HTTPS redirect (for production)
    app.add_middleware(HTTPSRedirectMiddleware)
    
    # Trusted hosts
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["localhost", "127.0.0.1", "*.offthegrid.io"]
    )
    
    # Session middleware
    app.add_middleware(
        SessionMiddleware,
        secret_key=secrets.token_urlsafe(32),
        https_only=True,
        same_site="strict"
    )
    
    # Main security middleware
    app.add_middleware(
        SecurityMiddleware,
        config=config,
        redis_client=redis_client,
        db_session=db_session
    )
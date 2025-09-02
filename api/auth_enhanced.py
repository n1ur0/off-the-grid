"""
Enhanced authentication system for Off the Grid API
Adds API key authentication, role-based access control, and audit logging
"""
import hashlib
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum

from fastapi import HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from config import get_settings
from auth import AuthManager, get_auth_manager
from models import WalletAuthRequest, AuthResponse

logger = logging.getLogger(__name__)

# Enhanced security setup
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserRole(str, Enum):
    """User roles for RBAC"""
    USER = "user"              # Basic user - can trade and use educational features
    PREMIUM = "premium"        # Premium user - higher limits and additional features
    BOT = "bot"               # Trading bot - bulk operations and bot API access
    MODERATOR = "moderator"    # Community moderator - user management features
    ADMIN = "admin"           # System administrator - full access
    DEVELOPER = "developer"    # API developer - webhooks and advanced features


class Permission(str, Enum):
    """System permissions"""
    # Basic permissions
    READ_GRIDS = "read:grids"
    CREATE_GRIDS = "create:grids"
    DELETE_GRIDS = "delete:grids"
    READ_TOKENS = "read:tokens"
    UPDATE_TOKENS = "update:tokens"
    
    # Educational permissions
    READ_PROGRESS = "read:progress"
    WRITE_PROGRESS = "write:progress"
    READ_ACHIEVEMENTS = "read:achievements"
    AWARD_ACHIEVEMENTS = "award:achievements"
    
    # Webhook permissions
    MANAGE_WEBHOOKS = "manage:webhooks"
    TRIGGER_WEBHOOKS = "trigger:webhooks"
    
    # Bot permissions
    BULK_OPERATIONS = "bulk:operations"
    ADVANCED_ANALYTICS = "advanced:analytics"
    EXPORT_DATA = "export:data"
    
    # Administrative permissions
    MANAGE_USERS = "manage:users"
    MANAGE_RATE_LIMITS = "manage:rate_limits"
    SYSTEM_ADMIN = "system:admin"
    VIEW_AUDIT_LOGS = "view:audit_logs"


# Role-permission mapping
ROLE_PERMISSIONS = {
    UserRole.USER: [
        Permission.READ_GRIDS,
        Permission.CREATE_GRIDS,
        Permission.DELETE_GRIDS,
        Permission.READ_TOKENS,
        Permission.READ_PROGRESS,
        Permission.WRITE_PROGRESS,
        Permission.READ_ACHIEVEMENTS,
    ],
    UserRole.PREMIUM: [
        # All user permissions plus:
        Permission.MANAGE_WEBHOOKS,
        Permission.UPDATE_TOKENS,
        Permission.EXPORT_DATA,
    ],
    UserRole.BOT: [
        # Core bot permissions
        Permission.READ_GRIDS,
        Permission.CREATE_GRIDS,
        Permission.DELETE_GRIDS,
        Permission.READ_TOKENS,
        Permission.BULK_OPERATIONS,
        Permission.ADVANCED_ANALYTICS,
        Permission.EXPORT_DATA,
        Permission.MANAGE_WEBHOOKS,
    ],
    UserRole.DEVELOPER: [
        # All premium permissions plus:
        Permission.TRIGGER_WEBHOOKS,
        Permission.ADVANCED_ANALYTICS,
    ],
    UserRole.MODERATOR: [
        # User permissions plus moderation:
        Permission.MANAGE_USERS,
        Permission.AWARD_ACHIEVEMENTS,
        Permission.VIEW_AUDIT_LOGS,
    ],
    UserRole.ADMIN: [
        # All permissions
        *[perm for perm in Permission]
    ]
}


class ApiKey(BaseModel):
    """API key model"""
    id: str
    name: str
    key_hash: str
    user_id: str
    role: UserRole
    permissions: List[Permission]
    created_at: datetime
    last_used_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_active: bool = True
    rate_limit_tier: str = "bot"
    metadata: Dict[str, Any] = {}


class ApiKeyCreateRequest(BaseModel):
    """Request to create new API key"""
    name: str
    role: UserRole = UserRole.BOT
    permissions: Optional[List[Permission]] = None
    expires_days: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class AuditLogEntry(BaseModel):
    """Audit log entry"""
    id: str
    user_id: str
    action: str
    resource: str
    resource_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    metadata: Dict[str, Any] = {}
    timestamp: datetime
    success: bool
    error_message: Optional[str] = None


class EnhancedAuthManager(AuthManager):
    """Enhanced authentication manager with RBAC and API keys"""
    
    def __init__(self):
        super().__init__()
        # In-memory storage for demo - use database in production
        self.api_keys: Dict[str, ApiKey] = {}
        self.user_roles: Dict[str, UserRole] = {}
        self.audit_logs: List[AuditLogEntry] = []
    
    def generate_api_key(self) -> tuple[str, str]:
        """Generate API key and its hash"""
        # Generate secure random key
        key = f"otg_{''.join(secrets.choice('abcdefghijklmnopqrstuvwxyz0123456789') for _ in range(32))}"
        
        # Hash the key for storage
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        
        return key, key_hash
    
    def create_api_key(self, user_id: str, request: ApiKeyCreateRequest) -> tuple[ApiKey, str]:
        """Create new API key for user"""
        key, key_hash = self.generate_api_key()
        
        # Determine permissions
        if request.permissions:
            # Validate requested permissions against role
            role_perms = self.get_role_permissions(request.role)
            permissions = [p for p in request.permissions if p in role_perms]
        else:
            permissions = self.get_role_permissions(request.role)
        
        # Set expiration
        expires_at = None
        if request.expires_days:
            expires_at = datetime.utcnow() + timedelta(days=request.expires_days)
        
        api_key = ApiKey(
            id=secrets.token_urlsafe(16),
            name=request.name,
            key_hash=key_hash,
            user_id=user_id,
            role=request.role,
            permissions=permissions,
            created_at=datetime.utcnow(),
            expires_at=expires_at,
            metadata=request.metadata or {}
        )
        
        # Store API key
        self.api_keys[key_hash] = api_key
        
        logger.info(f"Created API key '{request.name}' for user {user_id}")
        
        return api_key, key
    
    def verify_api_key(self, key: str) -> Optional[ApiKey]:
        """Verify API key and return associated info"""
        if not key or not key.startswith('otg_'):
            return None
        
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        api_key = self.api_keys.get(key_hash)
        
        if not api_key:
            return None
        
        # Check if key is active
        if not api_key.is_active:
            return None
        
        # Check if key is expired
        if api_key.expires_at and api_key.expires_at < datetime.utcnow():
            return None
        
        # Update last used timestamp
        api_key.last_used_at = datetime.utcnow()
        
        return api_key
    
    def get_role_permissions(self, role: UserRole) -> List[Permission]:
        """Get all permissions for a role"""
        permissions = ROLE_PERMISSIONS.get(role, [])
        
        # Add inherited permissions for certain roles
        if role == UserRole.PREMIUM:
            permissions.extend(ROLE_PERMISSIONS[UserRole.USER])
        elif role == UserRole.DEVELOPER:
            permissions.extend(ROLE_PERMISSIONS[UserRole.PREMIUM])
            permissions.extend(ROLE_PERMISSIONS[UserRole.USER])
        elif role == UserRole.MODERATOR:
            permissions.extend(ROLE_PERMISSIONS[UserRole.USER])
        
        return list(set(permissions))  # Remove duplicates
    
    def has_permission(self, user_id: str, permission: Permission, api_key: Optional[ApiKey] = None) -> bool:
        """Check if user has specific permission"""
        if api_key:
            return permission in api_key.permissions
        
        user_role = self.user_roles.get(user_id, UserRole.USER)
        user_permissions = self.get_role_permissions(user_role)
        
        return permission in user_permissions
    
    def set_user_role(self, user_id: str, role: UserRole):
        """Set user role (admin operation)"""
        self.user_roles[user_id] = role
        logger.info(f"Set role {role.value} for user {user_id}")
    
    def get_user_role(self, user_id: str) -> UserRole:
        """Get user role"""
        return self.user_roles.get(user_id, UserRole.USER)
    
    def revoke_api_key(self, key_id: str, user_id: str) -> bool:
        """Revoke API key"""
        for api_key in self.api_keys.values():
            if api_key.id == key_id and api_key.user_id == user_id:
                api_key.is_active = False
                logger.info(f"Revoked API key '{api_key.name}' for user {user_id}")
                return True
        
        return False
    
    def get_user_api_keys(self, user_id: str) -> List[ApiKey]:
        """Get all API keys for user"""
        return [key for key in self.api_keys.values() if key.user_id == user_id]
    
    def log_audit_event(
        self, 
        user_id: str, 
        action: str, 
        resource: str,
        resource_id: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Log audit event"""
        entry = AuditLogEntry(
            id=secrets.token_urlsafe(16),
            user_id=user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata or {},
            timestamp=datetime.utcnow(),
            success=success,
            error_message=error_message
        )
        
        self.audit_logs.append(entry)
        
        # Keep only last 10000 entries in memory
        if len(self.audit_logs) > 10000:
            self.audit_logs = self.audit_logs[-10000:]
    
    def get_audit_logs(
        self, 
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        resource: Optional[str] = None,
        limit: int = 100
    ) -> List[AuditLogEntry]:
        """Get audit logs with filtering"""
        logs = self.audit_logs
        
        if user_id:
            logs = [log for log in logs if log.user_id == user_id]
        
        if action:
            logs = [log for log in logs if log.action == action]
        
        if resource:
            logs = [log for log in logs if log.resource == resource]
        
        # Sort by timestamp (newest first) and limit
        logs.sort(key=lambda x: x.timestamp, reverse=True)
        
        return logs[:limit]


# Global enhanced auth manager
_enhanced_auth_manager: Optional[EnhancedAuthManager] = None

def get_enhanced_auth_manager() -> EnhancedAuthManager:
    """Get or create enhanced auth manager"""
    global _enhanced_auth_manager
    if _enhanced_auth_manager is None:
        _enhanced_auth_manager = EnhancedAuthManager()
    return _enhanced_auth_manager


# Enhanced authentication dependencies

async def get_api_key_user(
    x_api_key: Optional[str] = Header(None, description="API Key"),
    auth_manager: EnhancedAuthManager = Depends(get_enhanced_auth_manager)
) -> str:
    """Authenticate using API key"""
    if not x_api_key:
        raise HTTPException(
            status_code=401,
            detail="API key required",
            headers={"WWW-Authenticate": "ApiKey"}
        )
    
    api_key = auth_manager.verify_api_key(x_api_key)
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired API key",
            headers={"WWW-Authenticate": "ApiKey"}
        )
    
    return api_key.user_id


async def get_current_user_with_role(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_api_key: Optional[str] = Header(None),
    auth_manager: EnhancedAuthManager = Depends(get_enhanced_auth_manager)
) -> tuple[str, UserRole, Optional[ApiKey]]:
    """Get current user with role information"""
    api_key = None
    
    # Try API key authentication first
    if x_api_key:
        api_key = auth_manager.verify_api_key(x_api_key)
        if api_key:
            return api_key.user_id, api_key.role, api_key
    
    # Try JWT authentication
    if credentials:
        wallet_address = auth_manager.verify_token(credentials.credentials)
        if wallet_address:
            role = auth_manager.get_user_role(wallet_address)
            return wallet_address, role, None
    
    raise HTTPException(
        status_code=401,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer, ApiKey"}
    )


def require_permission(permission: Permission):
    """Decorator to require specific permission"""
    def permission_dependency(
        user_info: tuple[str, UserRole, Optional[ApiKey]] = Depends(get_current_user_with_role),
        auth_manager: EnhancedAuthManager = Depends(get_enhanced_auth_manager)
    ):
        user_id, role, api_key = user_info
        
        if not auth_manager.has_permission(user_id, permission, api_key):
            raise HTTPException(
                status_code=403,
                detail=f"Permission required: {permission.value}"
            )
        
        return user_info
    
    return permission_dependency


def require_role(required_role: UserRole):
    """Decorator to require specific role"""
    def role_dependency(
        user_info: tuple[str, UserRole, Optional[ApiKey]] = Depends(get_current_user_with_role)
    ):
        user_id, role, api_key = user_info
        
        # Admin role can access everything
        if role == UserRole.ADMIN:
            return user_info
        
        if role != required_role:
            raise HTTPException(
                status_code=403,
                detail=f"Role required: {required_role.value}"
            )
        
        return user_info
    
    return role_dependency


# Audit logging decorator
def audit_action(action: str, resource: str):
    """Decorator to automatically log audit events"""
    def audit_decorator(func):
        async def wrapper(*args, **kwargs):
            # Extract user info and auth manager from dependency injection
            auth_manager = get_enhanced_auth_manager()
            user_id = None
            
            # Try to find user_id in kwargs
            for key, value in kwargs.items():
                if key == "current_user":
                    user_id = value
                    break
                elif isinstance(value, tuple) and len(value) >= 1:
                    # Might be user_info tuple from get_current_user_with_role
                    user_id = value[0]
                    break
            
            try:
                result = await func(*args, **kwargs)
                
                if user_id:
                    auth_manager.log_audit_event(
                        user_id=user_id,
                        action=action,
                        resource=resource,
                        success=True
                    )
                
                return result
                
            except Exception as e:
                if user_id:
                    auth_manager.log_audit_event(
                        user_id=user_id,
                        action=action,
                        resource=resource,
                        success=False,
                        error_message=str(e)
                    )
                raise
        
        return wrapper
    return audit_decorator
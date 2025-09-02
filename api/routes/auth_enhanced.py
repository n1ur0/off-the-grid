"""
Enhanced authentication routes for Off the Grid API
Includes API key management, role management, and audit logging
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Query, Path, Request

from auth_enhanced import (
    get_enhanced_auth_manager, EnhancedAuthManager, get_current_user_with_role,
    require_permission, require_role, audit_action, UserRole, Permission,
    ApiKey, ApiKeyCreateRequest, AuditLogEntry
)
from models import SuccessResponse, PaginationParams

logger = logging.getLogger(__name__)

# Create router for enhanced auth endpoints
router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


@router.post("/api-keys", response_model=Dict[str, Any])
@audit_action("create", "api_key")
async def create_api_key(
    request: ApiKeyCreateRequest,
    user_info: tuple[str, UserRole, Optional[ApiKey]] = Depends(require_permission(Permission.BULK_OPERATIONS)),
    auth_manager: EnhancedAuthManager = Depends(get_enhanced_auth_manager)
):
    """
    Create new API key
    
    Creates a new API key for the authenticated user. API keys are used for
    bot operations and server-to-server authentication.
    
    **Security Notes:**
    - API key is only shown once during creation
    - Keys can be set to expire automatically
    - Permissions are limited by user role
    """
    user_id, user_role, current_api_key = user_info
    
    try:
        api_key, raw_key = auth_manager.create_api_key(user_id, request)
        
        return {
            "api_key": {
                "id": api_key.id,
                "name": api_key.name,
                "role": api_key.role.value,
                "permissions": [p.value for p in api_key.permissions],
                "created_at": api_key.created_at,
                "expires_at": api_key.expires_at,
                "is_active": api_key.is_active
            },
            "key": raw_key,  # Only shown once
            "warning": "Store this key securely. It will not be shown again."
        }
        
    except Exception as e:
        logger.error(f"Failed to create API key: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create API key"
        )


@router.get("/api-keys", response_model=List[Dict[str, Any]])
async def list_api_keys(
    user_info: tuple[str, UserRole, Optional[ApiKey]] = Depends(get_current_user_with_role),
    auth_manager: EnhancedAuthManager = Depends(get_enhanced_auth_manager)
):
    """
    List user's API keys
    
    Returns all API keys for the current user (without the actual key values).
    """
    user_id, user_role, current_api_key = user_info
    
    try:
        api_keys = auth_manager.get_user_api_keys(user_id)
        
        return [
            {
                "id": key.id,
                "name": key.name,
                "role": key.role.value,
                "permissions": [p.value for p in key.permissions],
                "created_at": key.created_at,
                "last_used_at": key.last_used_at,
                "expires_at": key.expires_at,
                "is_active": key.is_active,
                "rate_limit_tier": key.rate_limit_tier
            }
            for key in api_keys
        ]
        
    except Exception as e:
        logger.error(f"Failed to list API keys: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to list API keys"
        )


@router.delete("/api-keys/{key_id}", response_model=SuccessResponse)
@audit_action("revoke", "api_key")
async def revoke_api_key(
    key_id: str = Path(..., description="API key ID"),
    user_info: tuple[str, UserRole, Optional[ApiKey]] = Depends(get_current_user_with_role),
    auth_manager: EnhancedAuthManager = Depends(get_enhanced_auth_manager)
):
    """
    Revoke API key
    
    Permanently revokes an API key. This action cannot be undone.
    """
    user_id, user_role, current_api_key = user_info
    
    success = auth_manager.revoke_api_key(key_id, user_id)
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail="API key not found"
        )
    
    return SuccessResponse(
        success=True,
        message=f"API key {key_id} revoked successfully"
    )


@router.get("/permissions", response_model=Dict[str, List[str]])
async def get_user_permissions(
    user_info: tuple[str, UserRole, Optional[ApiKey]] = Depends(get_current_user_with_role),
    auth_manager: EnhancedAuthManager = Depends(get_enhanced_auth_manager)
):
    """
    Get current user's permissions
    
    Returns all permissions available to the current user based on their role
    and API key (if using API key authentication).
    """
    user_id, user_role, api_key = user_info
    
    if api_key:
        permissions = [p.value for p in api_key.permissions]
        source = "api_key"
        role = api_key.role.value
    else:
        permissions = [p.value for p in auth_manager.get_role_permissions(user_role)]
        source = "user_role"
        role = user_role.value
    
    return {
        "permissions": permissions,
        "role": role,
        "source": source,
        "user_id": user_id
    }


@router.get("/roles", response_model=Dict[str, List[str]])
async def get_available_roles():
    """
    Get available roles and their permissions
    
    Returns information about all available user roles and their associated permissions.
    """
    from auth_enhanced import ROLE_PERMISSIONS
    
    return {
        role.value: [perm.value for perm in perms]
        for role, perms in ROLE_PERMISSIONS.items()
    }


# Admin endpoints for user management

@router.put("/users/{user_id}/role", response_model=SuccessResponse)
@audit_action("update", "user_role")
async def set_user_role(
    user_id: str = Path(..., description="Target user ID"),
    role: UserRole = ...,
    admin_info: tuple[str, UserRole, Optional[ApiKey]] = Depends(require_role(UserRole.ADMIN)),
    auth_manager: EnhancedAuthManager = Depends(get_enhanced_auth_manager)
):
    """
    Set user role (Admin only)
    
    Updates the role for a specific user. Only accessible by administrators.
    """
    admin_user_id, admin_role, admin_api_key = admin_info
    
    try:
        auth_manager.set_user_role(user_id, role)
        
        return SuccessResponse(
            success=True,
            message=f"User {user_id} role updated to {role.value}",
            data={
                "user_id": user_id,
                "new_role": role.value,
                "updated_by": admin_user_id
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to set user role: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update user role"
        )


@router.get("/users/{user_id}/role", response_model=Dict[str, str])
async def get_user_role(
    user_id: str = Path(..., description="User ID"),
    admin_info: tuple[str, UserRole, Optional[ApiKey]] = Depends(require_permission(Permission.MANAGE_USERS)),
    auth_manager: EnhancedAuthManager = Depends(get_enhanced_auth_manager)
):
    """
    Get user role
    
    Returns the role for a specific user. Requires user management permissions.
    """
    role = auth_manager.get_user_role(user_id)
    
    return {
        "user_id": user_id,
        "role": role.value
    }


# Audit logging endpoints

@router.get("/audit-logs", response_model=List[Dict[str, Any]])
async def get_audit_logs(
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    action: Optional[str] = Query(None, description="Filter by action"),
    resource: Optional[str] = Query(None, description="Filter by resource"),
    limit: int = Query(100, ge=1, le=1000, description="Number of logs to return"),
    admin_info: tuple[str, UserRole, Optional[ApiKey]] = Depends(require_permission(Permission.VIEW_AUDIT_LOGS)),
    auth_manager: EnhancedAuthManager = Depends(get_enhanced_auth_manager)
):
    """
    Get audit logs
    
    Returns audit logs with optional filtering. Requires audit log viewing permissions.
    """
    try:
        logs = auth_manager.get_audit_logs(
            user_id=user_id,
            action=action,
            resource=resource,
            limit=limit
        )
        
        return [
            {
                "id": log.id,
                "user_id": log.user_id,
                "action": log.action,
                "resource": log.resource,
                "resource_id": log.resource_id,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "metadata": log.metadata,
                "timestamp": log.timestamp,
                "success": log.success,
                "error_message": log.error_message
            }
            for log in logs
        ]
        
    except Exception as e:
        logger.error(f"Failed to get audit logs: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve audit logs"
        )


@router.get("/audit-logs/stats", response_model=Dict[str, Any])
async def get_audit_stats(
    hours: int = Query(24, ge=1, le=168, description="Time window in hours"),
    admin_info: tuple[str, UserRole, Optional[ApiKey]] = Depends(require_permission(Permission.VIEW_AUDIT_LOGS)),
    auth_manager: EnhancedAuthManager = Depends(get_enhanced_auth_manager)
):
    """
    Get audit log statistics
    
    Returns statistics about audit logs including action counts, success rates, and trends.
    """
    try:
        # Get logs from the specified time window
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        all_logs = auth_manager.get_audit_logs(limit=10000)
        
        # Filter by time window
        logs_in_window = [
            log for log in all_logs
            if log.timestamp >= cutoff_time
        ]
        
        # Calculate statistics
        total_events = len(logs_in_window)
        successful_events = len([log for log in logs_in_window if log.success])
        failed_events = total_events - successful_events
        
        # Group by action
        action_counts = {}
        for log in logs_in_window:
            action_counts[log.action] = action_counts.get(log.action, 0) + 1
        
        # Group by resource
        resource_counts = {}
        for log in logs_in_window:
            resource_counts[log.resource] = resource_counts.get(log.resource, 0) + 1
        
        # Group by user
        user_counts = {}
        for log in logs_in_window:
            user_counts[log.user_id] = user_counts.get(log.user_id, 0) + 1
        
        # Calculate success rate
        success_rate = (successful_events / total_events * 100) if total_events > 0 else 0
        
        return {
            "time_window_hours": hours,
            "total_events": total_events,
            "successful_events": successful_events,
            "failed_events": failed_events,
            "success_rate": round(success_rate, 2),
            "action_breakdown": action_counts,
            "resource_breakdown": resource_counts,
            "top_users": dict(sorted(user_counts.items(), key=lambda x: x[1], reverse=True)[:10]),
            "generated_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Failed to get audit stats: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to calculate audit statistics"
        )


# Session management endpoints

@router.get("/sessions", response_model=Dict[str, Any])
async def get_user_sessions(
    user_info: tuple[str, UserRole, Optional[ApiKey]] = Depends(get_current_user_with_role),
    auth_manager: EnhancedAuthManager = Depends(get_enhanced_auth_manager)
):
    """
    Get user session information
    
    Returns information about the current user's active sessions and API keys.
    """
    user_id, user_role, api_key = user_info
    
    # Get user's API keys
    api_keys = auth_manager.get_user_api_keys(user_id)
    active_api_keys = [key for key in api_keys if key.is_active]
    
    # Calculate session info
    session_info = {
        "user_id": user_id,
        "current_role": user_role.value,
        "authentication_method": "api_key" if api_key else "jwt",
        "current_permissions": [
            p.value for p in (api_key.permissions if api_key else auth_manager.get_role_permissions(user_role))
        ],
        "api_keys": {
            "total": len(api_keys),
            "active": len(active_api_keys),
            "expired": len([key for key in api_keys if key.expires_at and key.expires_at < datetime.utcnow()])
        }
    }
    
    if api_key:
        session_info["current_api_key"] = {
            "id": api_key.id,
            "name": api_key.name,
            "created_at": api_key.created_at,
            "last_used_at": api_key.last_used_at,
            "expires_at": api_key.expires_at
        }
    
    return session_info


@router.post("/verify-permissions", response_model=Dict[str, bool])
async def verify_permissions(
    permissions: List[Permission],
    user_info: tuple[str, UserRole, Optional[ApiKey]] = Depends(get_current_user_with_role),
    auth_manager: EnhancedAuthManager = Depends(get_enhanced_auth_manager)
):
    """
    Verify if user has specific permissions
    
    Checks if the current user has all the specified permissions.
    Useful for frontend applications to conditionally show/hide features.
    """
    user_id, user_role, api_key = user_info
    
    results = {}
    for permission in permissions:
        results[permission.value] = auth_manager.has_permission(user_id, permission, api_key)
    
    return results
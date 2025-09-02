"""
Webhook management routes for Off the Grid API
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Query, Path, BackgroundTasks
from pydantic import BaseModel

from auth import get_current_user, get_api_key_user
from webhooks.manager import get_webhook_manager, WebhookManager
from webhooks.models import (
    WebhookRegistration, WebhookRegistrationRequest, WebhookUpdateRequest,
    WebhookListResponse, WebhookDeliveryListResponse, WebhookStatsResponse,
    WebhookTestRequest, WebhookVerificationRequest, WebhookEventType,
    WebhookStatus
)
from models import SuccessResponse, PaginationParams

logger = logging.getLogger(__name__)

# Create router for webhook endpoints
router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


class WebhookEventRequest(BaseModel):
    """Request to manually trigger webhook event (for testing/admin)"""
    event_type: WebhookEventType
    data: Dict[str, Any]
    user_id: Optional[str] = None
    correlation_id: Optional[str] = None


@router.post("/", response_model=WebhookRegistration)
async def register_webhook(
    request: WebhookRegistrationRequest,
    current_user: str = Depends(get_current_user),
    webhook_manager: WebhookManager = Depends(get_webhook_manager)
):
    """
    Register a new webhook endpoint
    
    Registers a webhook URL to receive event notifications. The webhook will
    be called with a POST request containing the event data and a signature
    for verification.
    
    **Signature Verification:**
    - Signature is sent in `X-Webhook-Signature` header
    - Format: `sha256=<signature>`
    - Computed as HMAC-SHA256 of request body using your secret
    
    **Retry Policy:**
    - Failed deliveries are retried up to 3 times by default
    - Exponential backoff with jitter (1m, 2m, 4m delays)
    - Webhooks with high failure rates may be automatically disabled
    """
    logger.info(f"Registering webhook for user {current_user}: {request.url}")
    
    try:
        webhook = webhook_manager.register_webhook(current_user, request)
        return webhook
    except Exception as e:
        logger.error(f"Failed to register webhook: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to register webhook"
        )


@router.get("/", response_model=WebhookListResponse)
async def list_webhooks(
    status: Optional[WebhookStatus] = Query(None, description="Filter by webhook status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: str = Depends(get_current_user),
    webhook_manager: WebhookManager = Depends(get_webhook_manager)
):
    """
    Get list of registered webhooks
    
    Returns a paginated list of webhooks registered by the current user,
    optionally filtered by status.
    """
    try:
        webhooks = webhook_manager.get_user_webhooks(current_user, status)
        
        # Apply pagination
        total_count = len(webhooks)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_webhooks = webhooks[start_idx:end_idx]
        
        return WebhookListResponse(
            webhooks=paginated_webhooks,
            total_count=total_count,
            page=page,
            page_size=page_size
        )
        
    except Exception as e:
        logger.error(f"Failed to list webhooks: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve webhooks"
        )


@router.get("/{webhook_id}", response_model=WebhookRegistration)
async def get_webhook(
    webhook_id: str = Path(..., description="Webhook ID"),
    current_user: str = Depends(get_current_user),
    webhook_manager: WebhookManager = Depends(get_webhook_manager)
):
    """
    Get webhook details
    
    Returns detailed information about a specific webhook registration
    including delivery statistics and configuration.
    """
    try:
        webhooks = webhook_manager.get_user_webhooks(current_user)
        webhook = next((w for w in webhooks if w.id == webhook_id), None)
        
        if not webhook:
            raise HTTPException(
                status_code=404,
                detail="Webhook not found"
            )
        
        return webhook
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get webhook {webhook_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve webhook"
        )


@router.put("/{webhook_id}", response_model=WebhookRegistration)
async def update_webhook(
    webhook_id: str = Path(..., description="Webhook ID"),
    request: WebhookUpdateRequest = ...,
    current_user: str = Depends(get_current_user),
    webhook_manager: WebhookManager = Depends(get_webhook_manager)
):
    """
    Update webhook configuration
    
    Updates webhook settings including URL, events, filters, and retry configuration.
    Only provided fields will be updated, others remain unchanged.
    """
    logger.info(f"Updating webhook {webhook_id} for user {current_user}")
    
    try:
        webhook = webhook_manager.update_webhook(webhook_id, current_user, request)
        
        if not webhook:
            raise HTTPException(
                status_code=404,
                detail="Webhook not found"
            )
        
        return webhook
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update webhook {webhook_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update webhook"
        )


@router.delete("/{webhook_id}", response_model=SuccessResponse)
async def delete_webhook(
    webhook_id: str = Path(..., description="Webhook ID"),
    current_user: str = Depends(get_current_user),
    webhook_manager: WebhookManager = Depends(get_webhook_manager)
):
    """
    Delete webhook registration
    
    Permanently deletes a webhook registration. This cannot be undone.
    Any pending deliveries for this webhook will be cancelled.
    """
    logger.info(f"Deleting webhook {webhook_id} for user {current_user}")
    
    try:
        success = webhook_manager.delete_webhook(webhook_id, current_user)
        
        if not success:
            raise HTTPException(
                status_code=404,
                detail="Webhook not found"
            )
        
        return SuccessResponse(
            success=True,
            message=f"Webhook {webhook_id} deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete webhook {webhook_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete webhook"
        )


@router.post("/{webhook_id}/test", response_model=SuccessResponse)
async def test_webhook(
    webhook_id: str = Path(..., description="Webhook ID"),
    request: WebhookTestRequest = ...,
    current_user: str = Depends(get_current_user),
    webhook_manager: WebhookManager = Depends(get_webhook_manager)
):
    """
    Test webhook endpoint
    
    Sends a test event to the webhook endpoint to verify it's working correctly.
    This is useful for testing webhook integration and signature verification.
    """
    logger.info(f"Testing webhook {webhook_id} for user {current_user}")
    
    try:
        result = await webhook_manager.test_webhook(
            webhook_id, 
            request.event_type,
            request.test_data
        )
        
        return SuccessResponse(
            success=True,
            message=f"Test event sent to webhook {webhook_id}",
            data=result
        )
        
    except Exception as e:
        logger.error(f"Failed to test webhook {webhook_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to test webhook"
        )


@router.get("/{webhook_id}/deliveries", response_model=WebhookDeliveryListResponse)
async def get_webhook_deliveries(
    webhook_id: str = Path(..., description="Webhook ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by delivery status"),
    current_user: str = Depends(get_current_user),
    webhook_manager: WebhookManager = Depends(get_webhook_manager)
):
    """
    Get webhook delivery history
    
    Returns a paginated list of delivery attempts for the webhook,
    including status, response codes, and error messages.
    """
    try:
        # Verify webhook ownership
        webhooks = webhook_manager.get_user_webhooks(current_user)
        webhook = next((w for w in webhooks if w.id == webhook_id), None)
        
        if not webhook:
            raise HTTPException(
                status_code=404,
                detail="Webhook not found"
            )
        
        # In a real implementation, fetch deliveries from database
        deliveries = []  # Placeholder
        
        return WebhookDeliveryListResponse(
            deliveries=deliveries,
            total_count=len(deliveries),
            page=page,
            page_size=page_size
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get deliveries for webhook {webhook_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve deliveries"
        )


@router.get("/{webhook_id}/stats", response_model=WebhookStatsResponse)
async def get_webhook_stats(
    webhook_id: str = Path(..., description="Webhook ID"),
    hours: int = Query(24, ge=1, le=8760, description="Statistics time window in hours"),
    current_user: str = Depends(get_current_user),
    webhook_manager: WebhookManager = Depends(get_webhook_manager)
):
    """
    Get webhook delivery statistics
    
    Returns delivery statistics for the webhook including success/failure rates,
    response times, and recent delivery status.
    """
    try:
        # Verify webhook ownership
        webhooks = webhook_manager.get_user_webhooks(current_user)
        webhook = next((w for w in webhooks if w.id == webhook_id), None)
        
        if not webhook:
            raise HTTPException(
                status_code=404,
                detail="Webhook not found"
            )
        
        stats = webhook_manager.get_delivery_stats(webhook_id, hours)
        
        return WebhookStatsResponse(
            webhook_id=webhook_id,
            total_deliveries=stats["total_deliveries"],
            successful_deliveries=stats["successful_deliveries"],
            failed_deliveries=stats["failed_deliveries"],
            success_rate=stats["success_rate"],
            avg_response_time_ms=stats["avg_response_time_ms"],
            last_success_at=stats.get("last_success_at"),
            last_failure_at=stats.get("last_failure_at"),
            current_status=webhook.status,
            events_subscribed=webhook.events
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get stats for webhook {webhook_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve webhook statistics"
        )


# Webhook verification endpoint (called by webhook providers)
@router.post("/verify", response_model=Dict[str, str])
async def verify_webhook(request: WebhookVerificationRequest):
    """
    Webhook verification endpoint
    
    This endpoint is used for webhook verification challenges.
    When registering a webhook, some services send a verification
    challenge that must be echoed back to confirm the endpoint.
    """
    return {"challenge": request.challenge}


# Admin/Bot endpoints for triggering events
@router.post("/events/trigger", response_model=SuccessResponse)
async def trigger_webhook_event(
    request: WebhookEventRequest,
    background_tasks: BackgroundTasks,
    current_user: str = Depends(get_current_user),  # Could also use API key auth for bots
    webhook_manager: WebhookManager = Depends(get_webhook_manager)
):
    """
    Manually trigger a webhook event
    
    This endpoint allows manual triggering of webhook events for testing
    or administrative purposes. Events will be delivered to all matching
    webhook registrations.
    """
    logger.info(f"Manual webhook event trigger by {current_user}: {request.event_type}")
    
    try:
        # Emit event in background to avoid blocking the request
        background_tasks.add_task(
            webhook_manager.emit_event,
            request.event_type,
            request.data,
            request.user_id,
            request.correlation_id
        )
        
        return SuccessResponse(
            success=True,
            message=f"Webhook event {request.event_type} triggered",
            data={
                "event_type": request.event_type,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to trigger webhook event: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to trigger webhook event"
        )


@router.get("/events/types", response_model=List[Dict[str, str]])
async def get_webhook_event_types():
    """
    Get available webhook event types
    
    Returns a list of all available webhook event types with descriptions.
    Use this to discover what events can be subscribed to.
    """
    event_types = []
    
    for event_type in WebhookEventType:
        # Create description based on event type
        description = ""
        if "grid" in event_type.value:
            description = "Grid trading related event"
        elif "user" in event_type.value:
            description = "User progress/activity event"
        elif "system" in event_type.value:
            description = "System notification event"
        elif "bot" in event_type.value:
            description = "Bot API related event"
        elif "token" in event_type.value:
            description = "Token/market data event"
        
        event_types.append({
            "event_type": event_type.value,
            "description": description,
            "category": event_type.value.split(".")[0]
        })
    
    return event_types
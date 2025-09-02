"""
Webhook system models for Off the Grid API
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, HttpUrl, validator
from uuid import uuid4


class WebhookEventType(str, Enum):
    """Supported webhook event types"""
    # Grid events
    GRID_CREATED = "grid.created"
    GRID_REDEEMED = "grid.redeemed" 
    GRID_ORDER_FILLED = "grid.order_filled"
    GRID_STATUS_CHANGED = "grid.status_changed"
    GRID_PROFIT_THRESHOLD = "grid.profit_threshold"
    
    # User events
    USER_PROGRESS_UPDATE = "user.progress_update"
    USER_ACHIEVEMENT_EARNED = "user.achievement_earned"
    USER_CERTIFICATION_COMPLETED = "user.certification_completed"
    
    # System events
    SYSTEM_MAINTENANCE = "system.maintenance"
    SYSTEM_ERROR = "system.error"
    TOKEN_PRICE_ALERT = "token.price_alert"
    
    # Bot events
    BOT_API_RATE_LIMIT = "bot.rate_limit_exceeded"
    BOT_API_ERROR = "bot.api_error"


class WebhookStatus(str, Enum):
    """Webhook registration status"""
    ACTIVE = "active"
    PAUSED = "paused"
    DISABLED = "disabled"
    FAILED = "failed"


class WebhookDeliveryStatus(str, Enum):
    """Webhook delivery status"""
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    RETRYING = "retrying"


class WebhookRegistration(BaseModel):
    """Webhook registration model"""
    id: str = Field(default_factory=lambda: str(uuid4()))
    user_id: str
    url: HttpUrl
    events: List[WebhookEventType]
    secret: str = Field(..., min_length=16, description="Webhook secret for signature verification")
    status: WebhookStatus = WebhookStatus.ACTIVE
    filters: Optional[Dict[str, Any]] = Field(None, description="Event filtering criteria")
    retry_config: Optional[Dict[str, Any]] = Field(None, description="Retry configuration")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_delivery_at: Optional[datetime] = None
    delivery_success_count: int = 0
    delivery_failure_count: int = 0
    
    @validator('events')
    def validate_events(cls, v):
        if not v:
            raise ValueError("At least one event type must be specified")
        return v
    
    @validator('retry_config')
    def validate_retry_config(cls, v):
        if v is None:
            return {
                "max_attempts": 3,
                "backoff_multiplier": 2,
                "initial_delay_seconds": 60,
                "max_delay_seconds": 3600
            }
        return v


class WebhookEvent(BaseModel):
    """Webhook event model"""
    id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: WebhookEventType
    data: Dict[str, Any]
    user_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    source: str = Field(default="api", description="Event source system")
    correlation_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class WebhookDelivery(BaseModel):
    """Webhook delivery model"""
    id: str = Field(default_factory=lambda: str(uuid4()))
    webhook_id: str
    event_id: str
    url: HttpUrl
    payload: Dict[str, Any]
    headers: Dict[str, str]
    status: WebhookDeliveryStatus = WebhookDeliveryStatus.PENDING
    response_status_code: Optional[int] = None
    response_body: Optional[str] = None
    response_headers: Optional[Dict[str, str]] = None
    error_message: Optional[str] = None
    attempt_count: int = 0
    max_attempts: int = 3
    scheduled_at: datetime = Field(default_factory=datetime.utcnow)
    delivered_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)


# Request/Response Models for API endpoints

class WebhookRegistrationRequest(BaseModel):
    """Request to register a new webhook"""
    url: HttpUrl
    events: List[WebhookEventType]
    secret: str = Field(..., min_length=16, max_length=256)
    filters: Optional[Dict[str, Any]] = None
    retry_config: Optional[Dict[str, Any]] = None
    description: Optional[str] = Field(None, max_length=500)


class WebhookUpdateRequest(BaseModel):
    """Request to update webhook registration"""
    url: Optional[HttpUrl] = None
    events: Optional[List[WebhookEventType]] = None
    secret: Optional[str] = Field(None, min_length=16, max_length=256)
    status: Optional[WebhookStatus] = None
    filters: Optional[Dict[str, Any]] = None
    retry_config: Optional[Dict[str, Any]] = None
    description: Optional[str] = Field(None, max_length=500)


class WebhookListResponse(BaseModel):
    """Response for webhook list endpoint"""
    webhooks: List[WebhookRegistration]
    total_count: int
    page: Optional[int] = None
    page_size: Optional[int] = None


class WebhookDeliveryListResponse(BaseModel):
    """Response for webhook delivery list endpoint"""
    deliveries: List[WebhookDelivery]
    total_count: int
    page: Optional[int] = None
    page_size: Optional[int] = None


class WebhookStatsResponse(BaseModel):
    """Webhook statistics response"""
    webhook_id: str
    total_deliveries: int
    successful_deliveries: int
    failed_deliveries: int
    success_rate: float
    avg_response_time_ms: Optional[float] = None
    last_success_at: Optional[datetime] = None
    last_failure_at: Optional[datetime] = None
    current_status: WebhookStatus
    events_subscribed: List[WebhookEventType]


class WebhookTestRequest(BaseModel):
    """Request to test webhook endpoint"""
    event_type: WebhookEventType = WebhookEventType.SYSTEM_MAINTENANCE
    test_data: Dict[str, Any] = Field(default_factory=lambda: {"test": True, "message": "Test webhook delivery"})


class WebhookVerificationRequest(BaseModel):
    """Request for webhook verification"""
    challenge: str = Field(..., description="Challenge string to echo back")


# Event-specific payload models

class GridCreatedEventData(BaseModel):
    """Grid created event data"""
    grid_identity: str
    token_id: str
    user_id: str
    value: int
    orders: int
    range: float
    created_at: datetime


class GridOrderFilledEventData(BaseModel):
    """Grid order filled event data"""
    grid_identity: str
    order_type: str  # "Buy" or "Sell"
    amount: str
    price: str
    filled_at: datetime
    transaction_id: str
    user_id: str


class UserProgressEventData(BaseModel):
    """User progress update event data"""
    user_id: str
    module_code: str
    completion_status: str
    progress_percentage: int
    achievement_earned: Optional[str] = None
    updated_at: datetime


class SystemMaintenanceEventData(BaseModel):
    """System maintenance event data"""
    maintenance_type: str  # "scheduled", "emergency"
    start_time: datetime
    estimated_duration_minutes: Optional[int] = None
    affected_services: List[str]
    message: str


class TokenPriceAlertEventData(BaseModel):
    """Token price alert event data"""
    token_id: str
    token_symbol: Optional[str] = None
    current_price: float
    threshold_price: float
    threshold_type: str  # "above", "below"
    percentage_change: float
    user_id: str
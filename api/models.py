"""
Pydantic models for Off the Grid API
"""
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, validator


class OrderType(str, Enum):
    """Grid order types"""
    BUY = "Buy"
    SELL = "Sell"


class GridStatus(str, Enum):
    """Grid status types"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    PARTIALLY_FILLED = "partially_filled"
    COMPLETED = "completed"


# Authentication Models
class WalletAuthRequest(BaseModel):
    """Request model for wallet-based authentication"""
    wallet_address: str = Field(..., min_length=51, max_length=51, description="Ergo wallet address")
    message: str = Field(..., min_length=1, description="Message to sign")
    signature: str = Field(..., min_length=1, description="Wallet signature")

    @validator('wallet_address')
    def validate_wallet_address(cls, v):
        if not v.startswith('9'):
            raise ValueError('Ergo wallet address must start with "9"')
        return v


class AuthResponse(BaseModel):
    """Response model for authentication"""
    success: bool
    wallet_address: str
    access_token: Optional[str] = None
    expires_in: Optional[int] = None


# Grid Trading Models
class GridCreateRequest(BaseModel):
    """Request model for creating a grid order"""
    token_id: str = Field(..., min_length=64, max_length=64, description="Token ID (64 character hex)")
    value: int = Field(..., gt=0, description="ERG value in nanoERGs")
    orders: int = Field(..., gt=0, le=100, description="Number of orders (max 100)")
    range: float = Field(..., gt=0, le=1.0, description="Price range as percentage (0.0-1.0)")
    identity: str = Field(..., min_length=1, max_length=64, description="Grid identity/name")

    @validator('token_id')
    def validate_token_id(cls, v):
        if not all(c in '0123456789abcdef' for c in v.lower()):
            raise ValueError('Token ID must be a valid hex string')
        return v.lower()


class GridOrderDetail(BaseModel):
    """Individual grid order detail"""
    order_type: OrderType
    amount: str = Field(..., description="Token amount with unit")
    price: str = Field(..., description="Price with unit")


class GridSummary(BaseModel):
    """Summary information for a grid order"""
    grid_identity: str
    token_id: str
    sell_orders: int = Field(..., ge=0)
    buy_orders: int = Field(..., ge=0)
    bid_price: str
    ask_price: str
    profit_erg: int = Field(..., ge=0)
    profit_token: str
    total_erg: int = Field(..., ge=0)
    total_tokens: str
    status: Optional[GridStatus] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class GridDetailsResponse(BaseModel):
    """Detailed grid information response"""
    grid_identity: str
    token_id: str
    orders: List[GridOrderDetail]
    summary: GridSummary
    raw_data: Optional[Dict[str, Any]] = None


class GridListResponse(BaseModel):
    """Response model for grid list"""
    grids: List[GridSummary]
    total_count: int
    page: Optional[int] = None
    page_size: Optional[int] = None


# Token Models
class TokenInfo(BaseModel):
    """Token information model"""
    token_id: str
    name: Optional[str] = None
    symbol: Optional[str] = None
    decimals: Optional[int] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None


class TokenListResponse(BaseModel):
    """Response model for token list"""
    tokens: List[TokenInfo]
    total_count: int


# WebSocket Models
class WebSocketMessage(BaseModel):
    """Base WebSocket message model"""
    type: str
    data: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None


class SubscribeMessage(BaseModel):
    """WebSocket subscription message"""
    type: str = "subscribe"
    topic: str = Field(..., pattern="^(grids|tokens|system)$")
    filters: Optional[Dict[str, Any]] = None


class GridUpdateMessage(BaseModel):
    """Grid update WebSocket message"""
    type: str = "grid_update"
    grid_identity: str
    data: GridSummary
    timestamp: datetime


# API Response Models
class SuccessResponse(BaseModel):
    """Generic success response"""
    success: bool = True
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    """Error response model"""
    success: bool = False
    error: str
    details: Optional[str] = None
    error_code: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# CLI Command Models
class CLICommandResult(BaseModel):
    """Result from CLI command execution"""
    success: bool
    data: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None
    error: Optional[str] = None
    stderr: Optional[str] = None
    exit_code: Optional[int] = None
    execution_time: Optional[float] = None


# Health Check Models
class HealthCheckResponse(BaseModel):
    """Health check response"""
    status: str = "healthy"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: Optional[str] = None
    cli_status: Optional[str] = None
    dependencies: Optional[Dict[str, str]] = None


# Pagination Models
class PaginationParams(BaseModel):
    """Pagination parameters"""
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=500)
    
    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


# Filter Models
class GridFilterParams(BaseModel):
    """Grid filtering parameters"""
    token_id: Optional[str] = None
    status: Optional[GridStatus] = None
    min_profit: Optional[int] = None
    max_profit: Optional[int] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None


# Educational Progress Models
class CompletionStatus(str, Enum):
    """Module completion status"""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class DifficultyLevel(str, Enum):
    """Difficulty levels"""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class AchievementType(str, Enum):
    """Achievement types"""
    EDUCATION = "education"
    PRACTICE = "practice"
    PERFORMANCE = "performance"
    MILESTONE = "milestone"
    SPECIAL = "special"


class QuestionType(str, Enum):
    """Quiz question types"""
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    DRAG_DROP = "drag_drop"
    NUMERIC = "numeric"


# Educational Progress Request Models
class ModuleProgressRequest(BaseModel):
    """Request to update module progress"""
    user_id: str = Field(..., description="User UUID")
    module_id: str = Field(..., description="Module UUID")
    time_spent_minutes: Optional[int] = Field(None, ge=0, description="Additional time spent")
    progress_percentage: Optional[int] = Field(None, ge=0, le=100, description="Progress percentage")
    completion_status: Optional[CompletionStatus] = None
    metadata: Optional[Dict[str, Any]] = None


class QuizAttemptRequest(BaseModel):
    """Request to record quiz attempt"""
    user_id: str = Field(..., description="User UUID")
    module_id: str = Field(..., description="Module UUID")
    questions_answers: Dict[str, Any] = Field(..., description="Question answers mapping")
    time_taken_minutes: Optional[int] = Field(None, ge=0, description="Time taken for quiz")


class PracticeSessionRequest(BaseModel):
    """Request to log practice trading session"""
    user_id: str = Field(..., description="User UUID")
    session_name: Optional[str] = Field(None, max_length=255, description="Session name")
    trade_config: Dict[str, Any] = Field(..., description="Trading configuration")
    simulation_parameters: Dict[str, Any] = Field(..., description="Simulation parameters")
    base_token: str = Field(..., max_length=10, description="Base token symbol")
    quote_token: str = Field(..., max_length=10, description="Quote token symbol")
    initial_balance_base: float = Field(..., gt=0, description="Initial base token balance")
    initial_balance_quote: float = Field(..., gt=0, description="Initial quote token balance")
    duration_minutes: Optional[int] = Field(None, ge=0, description="Session duration")
    market_conditions: Optional[str] = Field(None, max_length=50, description="Market conditions")


class PracticeSessionCompleteRequest(BaseModel):
    """Request to complete practice trading session"""
    session_id: str = Field(..., description="Practice session UUID")
    simulation_results: Dict[str, Any] = Field(..., description="Complete simulation results")
    final_balance_base: float = Field(..., ge=0, description="Final base token balance")
    final_balance_quote: float = Field(..., ge=0, description="Final quote token balance")
    total_pnl_percentage: float = Field(..., description="Total PnL percentage")
    trades_executed: int = Field(..., ge=0, description="Number of trades executed")
    performance_rating: Optional[str] = Field(None, max_length=20, description="Performance rating")
    lessons_learned: Optional[List[str]] = Field(None, description="Lessons learned")


# Educational Progress Response Models
class ModuleProgressResponse(BaseModel):
    """Module progress response"""
    id: str
    user_id: str
    module_id: str
    module_code: str
    module_title: str
    completion_status: CompletionStatus
    progress_percentage: int
    time_spent_minutes: int
    best_score: Optional[int] = None
    completion_date: Optional[datetime] = None
    first_started_at: datetime
    last_accessed_at: datetime
    attempts_count: int
    metadata: Dict[str, Any] = Field(default_factory=dict)


class QuizAttemptResponse(BaseModel):
    """Quiz attempt response"""
    id: str
    user_id: str
    module_id: str
    attempt_number: int
    score: int
    max_score: int
    percentage_score: float
    time_taken_minutes: Optional[int] = None
    completed: bool
    passed: bool
    attempt_date: datetime
    feedback: Optional[Dict[str, Any]] = None


class PracticeTradeResponse(BaseModel):
    """Practice trade session response"""
    id: str
    user_id: str
    session_name: Optional[str] = None
    base_token: str
    quote_token: str
    initial_balance_base: float
    initial_balance_quote: float
    final_balance_base: Optional[float] = None
    final_balance_quote: Optional[float] = None
    total_pnl_percentage: Optional[float] = None
    trades_executed: int
    duration_minutes: Optional[int] = None
    market_conditions: Optional[str] = None
    performance_rating: Optional[str] = None
    lessons_learned: List[str] = Field(default_factory=list)
    completed: bool
    created_at: datetime
    completed_at: Optional[datetime] = None


class AchievementResponse(BaseModel):
    """Achievement response"""
    id: str
    achievement_code: str
    title: str
    description: Optional[str] = None
    achievement_type: AchievementType
    reward_points: int
    badge_icon: Optional[str] = None
    earned_at: Optional[datetime] = None
    criteria: Dict[str, Any] = Field(default_factory=dict)


class UserProgressSummary(BaseModel):
    """Comprehensive user progress summary"""
    user_id: str
    completed_modules: List[str] = Field(default_factory=list, description="List of completed module codes")
    in_progress_modules: List[str] = Field(default_factory=list, description="List of in-progress module codes")
    total_time_spent_minutes: int = Field(default=0, description="Total learning time")
    average_quiz_score: float = Field(default=0.0, description="Average quiz score percentage")
    practice_trades_count: int = Field(default=0, description="Number of practice trades completed")
    practice_time_spent_minutes: int = Field(default=0, description="Total practice trading time")
    achievements_earned: int = Field(default=0, description="Number of achievements earned")
    certification_progress: float = Field(default=0.0, description="Overall certification progress percentage")
    is_ready_for_live_trading: bool = Field(default=False, description="Ready for live trading")
    next_recommended_module: Optional[str] = Field(None, description="Next recommended module code")


class DetailedUserProgressResponse(BaseModel):
    """Detailed user progress response"""
    summary: UserProgressSummary
    module_progress: List[ModuleProgressResponse]
    recent_quiz_attempts: List[QuizAttemptResponse]
    practice_sessions: List[PracticeTradeResponse]
    achievements: List[AchievementResponse]
    competency_validation: Dict[str, Any] = Field(default_factory=dict)


class CompetencyValidationResponse(BaseModel):
    """Competency validation response"""
    user_id: str
    is_ready_for_live_trading: bool
    requirements_met: Dict[str, bool] = Field(default_factory=dict)
    missing_requirements: List[str] = Field(default_factory=list)
    completion_percentage: float
    estimated_time_to_completion_hours: Optional[float] = None
    recommendations: List[str] = Field(default_factory=list)
    validation_date: datetime = Field(default_factory=datetime.utcnow)


class EducationalModuleResponse(BaseModel):
    """Educational module information response"""
    id: str
    module_code: str
    title: str
    description: Optional[str] = None
    difficulty_level: DifficultyLevel
    estimated_duration_minutes: int
    prerequisites: List[str] = Field(default_factory=list)
    learning_objectives: List[str] = Field(default_factory=list)
    passing_score: int
    is_active: bool
    sort_order: int
    user_progress: Optional[ModuleProgressResponse] = None
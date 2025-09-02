"""
SQLAlchemy database models and connection setup for Off the Grid trading platform.
Implements all database models with proper relationships and connection pooling.
"""

import os
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    create_engine, Column, String, Integer, Boolean, Text, DECIMAL, 
    DateTime, JSON, ForeignKey, UniqueConstraint, Index, CheckConstraint,
    func, and_, or_, text
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship, validates
from sqlalchemy.dialects.postgresql import UUID, INET, JSONB
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool
import uuid

# Configure logging
logger = logging.getLogger(__name__)

# Base class for all models
Base = declarative_base()

# Database connection configuration
class DatabaseConfig:
    """Database configuration and connection management."""
    
    def __init__(self):
        self.database_url = self._get_database_url()
        self.engine: Optional[Engine] = None
        self.SessionLocal: Optional[sessionmaker] = None
    
    def _get_database_url(self) -> str:
        """Get database URL from environment variables."""
        database_url = os.getenv('DATABASE_URL')
        
        if not database_url:
            # Build from individual components
            host = os.getenv('POSTGRES_HOST', 'localhost')
            port = os.getenv('POSTGRES_PORT', '5432')
            database = os.getenv('POSTGRES_DB', 'off_the_grid')
            user = os.getenv('POSTGRES_USER', 'postgres')
            password = os.getenv('POSTGRES_PASSWORD', 'postgres')
            
            database_url = f"postgresql://{user}:{password}@{host}:{port}/{database}"
        
        return database_url
    
    def create_engine(self) -> Engine:
        """Create database engine with connection pooling."""
        if self.engine is None:
            self.engine = create_engine(
                self.database_url,
                poolclass=QueuePool,
                pool_size=10,  # Number of connections to maintain permanently
                max_overflow=20,  # Additional connections that can be created
                pool_pre_ping=True,  # Verify connections before use
                pool_recycle=3600,  # Recycle connections after 1 hour
                echo=os.getenv('SQL_ECHO', 'false').lower() == 'true'
            )
        return self.engine
    
    def create_session_factory(self) -> sessionmaker:
        """Create session factory."""
        if self.SessionLocal is None:
            engine = self.create_engine()
            self.SessionLocal = sessionmaker(
                autocommit=False,
                autoflush=False,
                bind=engine
            )
        return self.SessionLocal

# Global database configuration
db_config = DatabaseConfig()

def get_db_session() -> Session:
    """Get database session. Use this in dependency injection."""
    SessionLocal = db_config.create_session_factory()
    session = SessionLocal()
    try:
        return session
    except Exception:
        session.close()
        raise

def get_db():
    """Database dependency for FastAPI."""
    db = get_db_session()
    try:
        yield db
    finally:
        db.close()

# Model definitions

class User(Base):
    """User model for wallet-based authentication and profile management."""
    
    __tablename__ = 'users'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wallet_address = Column(String(52), unique=True, nullable=False, index=True)
    username = Column(String(50), unique=True, nullable=True)
    email = Column(String(255), unique=True, nullable=True)
    profile_data = Column(JSONB, default=dict)
    trading_experience_level = Column(
        String(20), 
        default='beginner',
        nullable=False
    )
    is_certified = Column(Boolean, default=False, nullable=False)
    certification_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    educational_progress = relationship("EducationalProgress", back_populates="user", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")
    practice_trades = relationship("PracticeTrade", back_populates="user", cascade="all, delete-orphan")
    achievements = relationship("UserAchievement", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    activities = relationship("UserActivity", back_populates="user", cascade="all, delete-orphan")
    grid_trading_history = relationship("GridTradingHistory", back_populates="user", cascade="all, delete-orphan")
    
    # Constraints and validations
    __table_args__ = (
        CheckConstraint("LENGTH(wallet_address) >= 50", name='valid_wallet_address'),
        CheckConstraint(
            "trading_experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')",
            name='valid_experience_level'
        ),
        Index('idx_users_wallet_address', 'wallet_address'),
        Index('idx_users_created_at', 'created_at'),
        Index('idx_users_last_login', 'last_login_at'),
    )
    
    @validates('wallet_address')
    def validate_wallet_address(self, key, address):
        if not address or len(address) < 50:
            raise ValueError("Invalid wallet address format")
        return address
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            'id': str(self.id),
            'wallet_address': self.wallet_address,
            'username': self.username,
            'email': self.email,
            'profile_data': self.profile_data,
            'trading_experience_level': self.trading_experience_level,
            'is_certified': self.is_certified,
            'certification_date': self.certification_date.isoformat() if self.certification_date else None,
            'created_at': self.created_at.isoformat(),
            'last_login_at': self.last_login_at.isoformat() if self.last_login_at else None,
            'is_active': self.is_active
        }

class EducationalModule(Base):
    """Educational module definitions."""
    
    __tablename__ = 'educational_modules'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_code = Column(String(20), unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    difficulty_level = Column(String(20), default='beginner', nullable=False)
    estimated_duration_minutes = Column(Integer, default=30)
    prerequisites = Column(JSONB, default=list)
    learning_objectives = Column(JSONB, default=list)
    content_metadata = Column(JSONB, default=dict)
    passing_score = Column(Integer, default=70)
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    # Relationships
    progress = relationship("EducationalProgress", back_populates="module", cascade="all, delete-orphan")
    quiz_questions = relationship("QuizQuestion", back_populates="module", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="module", cascade="all, delete-orphan")
    
    __table_args__ = (
        CheckConstraint(
            "difficulty_level IN ('beginner', 'intermediate', 'advanced')",
            name='valid_difficulty_level'
        ),
    )

class EducationalProgress(Base):
    """Track user progress through educational modules."""
    
    __tablename__ = 'educational_progress'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    module_id = Column(UUID(as_uuid=True), ForeignKey('educational_modules.id', ondelete='CASCADE'), nullable=False)
    completion_status = Column(String(20), default='not_started', nullable=False)
    progress_percentage = Column(Integer, default=0, nullable=False)
    time_spent_minutes = Column(Integer, default=0)
    best_score = Column(Integer, nullable=True)
    completion_date = Column(DateTime(timezone=True), nullable=True)
    first_started_at = Column(DateTime(timezone=True), default=func.now())
    last_accessed_at = Column(DateTime(timezone=True), default=func.now())
    attempts_count = Column(Integer, default=0)
    meta_data = Column(JSONB, default=dict)
    
    # Relationships
    user = relationship("User", back_populates="educational_progress")
    module = relationship("EducationalModule", back_populates="progress")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'module_id'),
        CheckConstraint(
            "completion_status IN ('not_started', 'in_progress', 'completed', 'failed')",
            name='valid_completion_status'
        ),
        CheckConstraint(
            "progress_percentage >= 0 AND progress_percentage <= 100",
            name='valid_progress_percentage'
        ),
        Index('idx_educational_progress_user_id', 'user_id'),
        Index('idx_educational_progress_module_id', 'module_id'),
        Index('idx_educational_progress_status', 'completion_status'),
        Index('idx_educational_progress_last_accessed', 'last_accessed_at'),
    )

class QuizQuestion(Base):
    """Quiz questions for educational modules."""
    
    __tablename__ = 'quiz_questions'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id = Column(UUID(as_uuid=True), ForeignKey('educational_modules.id', ondelete='CASCADE'), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(20), default='multiple_choice', nullable=False)
    options = Column(JSONB, nullable=False)
    correct_answers = Column(JSONB, nullable=False)
    explanation = Column(Text)
    difficulty = Column(Integer, default=1)
    points = Column(Integer, default=1)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Relationships
    module = relationship("EducationalModule", back_populates="quiz_questions")
    
    __table_args__ = (
        CheckConstraint(
            "question_type IN ('multiple_choice', 'true_false', 'drag_drop', 'numeric')",
            name='valid_question_type'
        ),
        CheckConstraint(
            "difficulty >= 1 AND difficulty <= 5",
            name='valid_difficulty'
        ),
    )

class QuizAttempt(Base):
    """User quiz attempts and scores."""
    
    __tablename__ = 'quiz_attempts'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    module_id = Column(UUID(as_uuid=True), ForeignKey('educational_modules.id', ondelete='CASCADE'), nullable=False)
    attempt_number = Column(Integer, nullable=False)
    questions_answers = Column(JSONB, nullable=False)
    score = Column(Integer, nullable=False)
    max_score = Column(Integer, nullable=False)
    time_taken_minutes = Column(Integer)
    completed = Column(Boolean, default=False)
    passed = Column(Boolean, default=False)
    attempt_date = Column(DateTime(timezone=True), default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="quiz_attempts")
    module = relationship("EducationalModule", back_populates="quiz_attempts")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'module_id', 'attempt_number'),
        Index('idx_quiz_attempts_user_module', 'user_id', 'module_id'),
        Index('idx_quiz_attempts_date', 'attempt_date'),
    )

class PracticeTrade(Base):
    """Practice trading sessions and simulations."""
    
    __tablename__ = 'practice_trades'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    session_name = Column(String(255))
    trade_config = Column(JSONB, nullable=False)
    simulation_parameters = Column(JSONB, nullable=False)
    simulation_results = Column(JSONB, nullable=False)
    base_token = Column(String(10), nullable=False)
    quote_token = Column(String(10), nullable=False)
    initial_balance_base = Column(DECIMAL(20, 8), nullable=False)
    initial_balance_quote = Column(DECIMAL(20, 8), nullable=False)
    final_balance_base = Column(DECIMAL(20, 8))
    final_balance_quote = Column(DECIMAL(20, 8))
    total_pnl_percentage = Column(DECIMAL(10, 4))
    trades_executed = Column(Integer, default=0)
    duration_minutes = Column(Integer)
    market_conditions = Column(String(50))
    performance_rating = Column(String(20))
    lessons_learned = Column(JSONB, default=list)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", back_populates="practice_trades")
    
    __table_args__ = (
        Index('idx_practice_trades_user_id', 'user_id'),
        Index('idx_practice_trades_created_at', 'created_at'),
        Index('idx_practice_trades_performance', 'performance_rating'),
    )

class Achievement(Base):
    """Achievement definitions."""
    
    __tablename__ = 'achievements'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    achievement_code = Column(String(50), unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    achievement_type = Column(String(30), nullable=False)
    criteria = Column(JSONB, nullable=False)
    reward_points = Column(Integer, default=0)
    badge_icon = Column(String(255))
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Relationships
    user_achievements = relationship("UserAchievement", back_populates="achievement", cascade="all, delete-orphan")
    
    __table_args__ = (
        CheckConstraint(
            "achievement_type IN ('education', 'practice', 'performance', 'milestone', 'special')",
            name='valid_achievement_type'
        ),
    )

class UserAchievement(Base):
    """User achievements earned."""
    
    __tablename__ = 'user_achievements'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    achievement_id = Column(UUID(as_uuid=True), ForeignKey('achievements.id', ondelete='CASCADE'), nullable=False)
    earned_at = Column(DateTime(timezone=True), default=func.now())
    meta_data = Column(JSONB, default=dict)
    
    # Relationships
    user = relationship("User", back_populates="achievements")
    achievement = relationship("Achievement", back_populates="user_achievements")
    
    __table_args__ = (
        UniqueConstraint('user_id', 'achievement_id'),
        Index('idx_user_achievements_user_id', 'user_id'),
        Index('idx_user_achievements_earned_at', 'earned_at'),
    )

class UserSession(Base):
    """User authentication sessions."""
    
    __tablename__ = 'user_sessions'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    session_token = Column(String(255), unique=True, nullable=False)
    refresh_token = Column(String(255), unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    refresh_expires_at = Column(DateTime(timezone=True))
    ip_address = Column(INET)
    user_agent = Column(Text)
    meta_data = Column(JSONB, default=dict)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now())
    last_accessed_at = Column(DateTime(timezone=True), default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="sessions")
    
    __table_args__ = (
        Index('idx_user_sessions_token', 'session_token'),
        Index('idx_user_sessions_user_id', 'user_id'),
        Index('idx_user_sessions_expires', 'expires_at'),
    )

class UserActivity(Base):
    """User activity logging for audit trail."""
    
    __tablename__ = 'user_activities'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    activity_type = Column(String(50), nullable=False)
    activity_description = Column(Text)
    resource_type = Column(String(50))
    resource_id = Column(UUID(as_uuid=True))
    meta_data = Column(JSONB, default=dict)
    ip_address = Column(INET)
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="activities")
    
    __table_args__ = (
        Index('idx_user_activities_user_id', 'user_id'),
        Index('idx_user_activities_type', 'activity_type'),
        Index('idx_user_activities_created_at', 'created_at'),
    )

class GridTradingHistory(Base):
    """Real grid trading performance tracking."""
    
    __tablename__ = 'grid_trading_history'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    grid_order_id = Column(String(64), nullable=False)
    base_token = Column(String(10), nullable=False)
    quote_token = Column(String(10), nullable=False)
    grid_config = Column(JSONB, nullable=False)
    initial_investment_erg = Column(DECIMAL(20, 8))
    initial_investment_usd = Column(DECIMAL(20, 2))
    current_value_erg = Column(DECIMAL(20, 8))
    current_value_usd = Column(DECIMAL(20, 2))
    realized_pnl_erg = Column(DECIMAL(20, 8), default=0)
    unrealized_pnl_erg = Column(DECIMAL(20, 8), default=0)
    total_fees_paid = Column(DECIMAL(20, 8), default=0)
    trades_executed = Column(Integer, default=0)
    grid_status = Column(String(20), default='active', nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", back_populates="grid_trading_history")
    
    __table_args__ = (
        CheckConstraint(
            "grid_status IN ('active', 'completed', 'cancelled', 'failed')",
            name='valid_grid_status'
        ),
        Index('idx_grid_trading_user_id', 'user_id'),
        Index('idx_grid_trading_status', 'grid_status'),
        Index('idx_grid_trading_created_at', 'created_at'),
    )

class TokenInfo(Base):
    """Token information cache."""
    
    __tablename__ = 'token_info'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_id = Column(String(64), unique=True, nullable=False)
    token_name = Column(String(100))
    token_symbol = Column(String(10))
    decimals = Column(Integer, default=0)
    description = Column(Text)
    logo_url = Column(String(500))
    website_url = Column(String(500))
    is_verified = Column(Boolean, default=False)
    market_cap_usd = Column(DECIMAL(20, 2))
    current_price_usd = Column(DECIMAL(20, 8))
    volume_24h_usd = Column(DECIMAL(20, 2))
    price_change_24h_percent = Column(DECIMAL(10, 4))
    last_updated = Column(DateTime(timezone=True), default=func.now())
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    __table_args__ = (
        Index('idx_token_info_symbol', 'token_symbol'),
        Index('idx_token_info_updated', 'last_updated'),
    )

# Database utility functions

def create_tables(engine: Engine = None):
    """Create all tables in the database."""
    if engine is None:
        engine = db_config.create_engine()
    
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")

def drop_tables(engine: Engine = None):
    """Drop all tables from the database. Use with caution!"""
    if engine is None:
        engine = db_config.create_engine()
    
    # Drop all database objects including views and constraints
    with engine.connect() as conn:
        # Drop all views first
        conn.execute(text("DROP VIEW IF EXISTS active_users_today CASCADE"))
        conn.execute(text("DROP VIEW IF EXISTS user_progress_summary CASCADE"))
        conn.execute(text("DROP VIEW IF EXISTS competency_dashboard CASCADE"))
        conn.execute(text("DROP VIEW IF EXISTS certificate_expiration_alerts CASCADE"))
        
        # Get all table names and drop them with CASCADE to handle foreign keys
        result = conn.execute(text("""
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
        """))
        tables = [row[0] for row in result]
        
        for table in tables:
            try:
                conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
            except Exception as e:
                logger.warning(f"Could not drop table {table}: {e}")
        
        conn.commit()
    
    # Also use SQLAlchemy's drop_all as backup
    Base.metadata.drop_all(bind=engine)
    logger.info("Database tables dropped")

# Connection health check
def check_database_health() -> bool:
    """Check if database connection is healthy."""
    try:
        engine = db_config.create_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False

# Export key components
__all__ = [
    'Base',
    'DatabaseConfig',
    'db_config',
    'get_db_session',
    'get_db',
    'User',
    'EducationalModule',
    'EducationalProgress',
    'QuizQuestion',
    'QuizAttempt',
    'PracticeTrade',
    'Achievement',
    'UserAchievement',
    'UserSession',
    'UserActivity',
    'GridTradingHistory',
    'TokenInfo',
    'create_tables',
    'drop_tables',
    'check_database_health'
]
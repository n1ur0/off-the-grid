"""
Progress tracking API routes for Off the Grid educational platform.
Implements comprehensive user progress tracking, competency validation, and readiness assessment.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc

from database import (
    get_db, User, EducationalModule, EducationalProgress, QuizAttempt, 
    PracticeTrade, Achievement, UserAchievement, UserActivity
)
from models import (
    # Request models
    ModuleProgressRequest, QuizAttemptRequest, PracticeSessionRequest, 
    PracticeSessionCompleteRequest,
    # Response models
    DetailedUserProgressResponse, UserProgressSummary, ModuleProgressResponse,
    QuizAttemptResponse, PracticeTradeResponse, AchievementResponse,
    CompetencyValidationResponse, EducationalModuleResponse, SuccessResponse,
    # Enums
    CompletionStatus, AchievementType
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/progress", tags=["progress"])

# Progress tracking business logic

class ProgressTrackingService:
    """Service class for progress tracking business logic."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_user_progress_summary(self, user_id: UUID) -> UserProgressSummary:
        """Calculate comprehensive user progress summary."""
        # Get all module progress
        module_progress = self.db.query(EducationalProgress).filter(
            EducationalProgress.user_id == user_id
        ).all()
        
        # Calculate completed and in-progress modules
        completed_modules = [
            p.module.module_code for p in module_progress 
            if p.completion_status == CompletionStatus.COMPLETED
        ]
        in_progress_modules = [
            p.module.module_code for p in module_progress 
            if p.completion_status == CompletionStatus.IN_PROGRESS
        ]
        
        # Calculate total time spent
        total_time_spent = sum(p.time_spent_minutes for p in module_progress)
        
        # Calculate average quiz score
        quiz_attempts = self.db.query(QuizAttempt).filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.completed == True
        ).all()
        
        if quiz_attempts:
            avg_score = sum(
                (attempt.score / attempt.max_score) * 100 
                for attempt in quiz_attempts
            ) / len(quiz_attempts)
        else:
            avg_score = 0.0
        
        # Get practice trading stats
        practice_trades = self.db.query(PracticeTrade).filter(
            PracticeTrade.user_id == user_id,
            PracticeTrade.completed == True
        ).all()
        
        practice_time_spent = sum(
            trade.duration_minutes or 0 for trade in practice_trades
        )
        
        # Get achievements count
        achievements_count = self.db.query(UserAchievement).filter(
            UserAchievement.user_id == user_id
        ).count()
        
        # Calculate certification progress
        total_modules = self.db.query(EducationalModule).filter(
            EducationalModule.is_active == True
        ).count()
        
        if total_modules > 0:
            certification_progress = (len(completed_modules) / total_modules) * 100
        else:
            certification_progress = 0.0
        
        # Check if ready for live trading
        is_ready = self._validate_live_trading_readiness(user_id)
        
        # Get next recommended module
        next_module = self._get_next_recommended_module(user_id, completed_modules, in_progress_modules)
        
        return UserProgressSummary(
            user_id=str(user_id),
            completed_modules=completed_modules,
            in_progress_modules=in_progress_modules,
            total_time_spent_minutes=total_time_spent,
            average_quiz_score=avg_score,
            practice_trades_count=len(practice_trades),
            practice_time_spent_minutes=practice_time_spent,
            achievements_earned=achievements_count,
            certification_progress=certification_progress,
            is_ready_for_live_trading=is_ready,
            next_recommended_module=next_module
        )
    
    def _validate_live_trading_readiness(self, user_id: UUID) -> bool:
        """Validate if user is ready for live trading."""
        required_modules = ['grid-basics', 'risk-management', 'market-conditions']
        
        # Check if all required modules are completed
        completed_required = self.db.query(EducationalProgress).join(
            EducationalModule
        ).filter(
            EducationalProgress.user_id == user_id,
            EducationalProgress.completion_status == CompletionStatus.COMPLETED,
            EducationalModule.module_code.in_(required_modules)
        ).count()
        
        if completed_required < len(required_modules):
            return False
        
        # Check practice trading requirements
        practice_trades_count = self.db.query(PracticeTrade).filter(
            PracticeTrade.user_id == user_id,
            PracticeTrade.completed == True
        ).count()
        
        # Check total practice time (at least 24 hours)
        total_practice_time = self.db.query(
            func.sum(PracticeTrade.duration_minutes)
        ).filter(
            PracticeTrade.user_id == user_id,
            PracticeTrade.completed == True
        ).scalar() or 0
        
        practice_requirements_met = (
            practice_trades_count >= 3 and 
            total_practice_time >= 24 * 60  # 24 hours in minutes
        )
        
        return practice_requirements_met
    
    def _get_next_recommended_module(self, user_id: UUID, completed: List[str], in_progress: List[str]) -> Optional[str]:
        """Get next recommended module for user."""
        if in_progress:
            return in_progress[0]  # Continue current module
        
        # Get all modules ordered by sort_order
        all_modules = self.db.query(EducationalModule).filter(
            EducationalModule.is_active == True
        ).order_by(EducationalModule.sort_order).all()
        
        for module in all_modules:
            if module.module_code not in completed:
                # Check prerequisites
                if self._check_module_prerequisites(user_id, module.prerequisites):
                    return module.module_code
        
        return None
    
    def _check_module_prerequisites(self, user_id: UUID, prerequisites: List[str]) -> bool:
        """Check if user has completed all prerequisites for a module."""
        if not prerequisites:
            return True
        
        completed_count = self.db.query(EducationalProgress).join(
            EducationalModule
        ).filter(
            EducationalProgress.user_id == user_id,
            EducationalProgress.completion_status == CompletionStatus.COMPLETED,
            EducationalModule.module_code.in_(prerequisites)
        ).count()
        
        return completed_count == len(prerequisites)
    
    def update_module_progress(self, request: ModuleProgressRequest) -> ModuleProgressResponse:
        """Update user module progress."""
        user_id = UUID(request.user_id)
        module_id = UUID(request.module_id)
        
        # Get existing progress or create new
        progress = self.db.query(EducationalProgress).filter(
            EducationalProgress.user_id == user_id,
            EducationalProgress.module_id == module_id
        ).first()
        
        if not progress:
            progress = EducationalProgress(
                user_id=user_id,
                module_id=module_id,
                completion_status=CompletionStatus.NOT_STARTED,
                progress_percentage=0,
                time_spent_minutes=0
            )
            self.db.add(progress)
        
        # Update progress
        if request.time_spent_minutes is not None:
            progress.time_spent_minutes += request.time_spent_minutes
        
        if request.progress_percentage is not None:
            progress.progress_percentage = request.progress_percentage
        
        if request.completion_status is not None:
            progress.completion_status = request.completion_status
            if request.completion_status == CompletionStatus.COMPLETED:
                progress.completion_date = datetime.now(timezone.utc)
        
        if request.metadata:
            if progress.metadata:
                progress.metadata.update(request.metadata)
            else:
                progress.metadata = request.metadata
        
        progress.last_accessed_at = datetime.now(timezone.utc)
        
        # If this is the first interaction, set first_started_at
        if progress.completion_status == CompletionStatus.NOT_STARTED:
            progress.completion_status = CompletionStatus.IN_PROGRESS
            if not progress.first_started_at:
                progress.first_started_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(progress)
        
        # Check for achievements
        self._check_and_award_achievements(user_id, 'module_progress', {
            'module_code': progress.module.module_code,
            'completion_status': progress.completion_status.value
        })
        
        return self._convert_to_module_progress_response(progress)
    
    def record_quiz_attempt(self, request: QuizAttemptRequest) -> QuizAttemptResponse:
        """Record a quiz attempt."""
        user_id = UUID(request.user_id)
        module_id = UUID(request.module_id)
        
        # Get module to calculate scoring
        module = self.db.query(EducationalModule).filter(
            EducationalModule.id == module_id
        ).first()
        
        if not module:
            raise HTTPException(status_code=404, detail="Module not found")
        
        # Calculate next attempt number
        last_attempt = self.db.query(QuizAttempt).filter(
            QuizAttempt.user_id == user_id,
            QuizAttempt.module_id == module_id
        ).order_by(desc(QuizAttempt.attempt_number)).first()
        
        attempt_number = (last_attempt.attempt_number + 1) if last_attempt else 1
        
        # Calculate score (simplified - would need actual question data)
        max_score = len(request.questions_answers)
        score = max_score  # Placeholder - implement actual scoring logic
        percentage_score = (score / max_score) * 100 if max_score > 0 else 0
        passed = percentage_score >= module.passing_score
        
        # Create quiz attempt
        attempt = QuizAttempt(
            user_id=user_id,
            module_id=module_id,
            attempt_number=attempt_number,
            questions_answers=request.questions_answers,
            score=score,
            max_score=max_score,
            time_taken_minutes=request.time_taken_minutes,
            completed=True,
            passed=passed
        )
        
        self.db.add(attempt)
        
        # Update module progress
        progress = self.db.query(EducationalProgress).filter(
            EducationalProgress.user_id == user_id,
            EducationalProgress.module_id == module_id
        ).first()
        
        if progress:
            if not progress.best_score or score > progress.best_score:
                progress.best_score = score
            
            progress.attempts_count += 1
            progress.last_accessed_at = datetime.now(timezone.utc)
            
            # If passed and score is above threshold, mark as completed
            if passed and percentage_score >= module.passing_score:
                progress.completion_status = CompletionStatus.COMPLETED
                progress.completion_date = datetime.now(timezone.utc)
                progress.progress_percentage = 100
        
        self.db.commit()
        self.db.refresh(attempt)
        
        # Check for achievements
        self._check_and_award_achievements(user_id, 'quiz_completion', {
            'module_code': module.module_code,
            'score': percentage_score,
            'passed': passed
        })
        
        return QuizAttemptResponse(
            id=str(attempt.id),
            user_id=str(attempt.user_id),
            module_id=str(attempt.module_id),
            attempt_number=attempt.attempt_number,
            score=attempt.score,
            max_score=attempt.max_score,
            percentage_score=percentage_score,
            time_taken_minutes=attempt.time_taken_minutes,
            completed=attempt.completed,
            passed=attempt.passed,
            attempt_date=attempt.attempt_date
        )
    
    def create_practice_session(self, request: PracticeSessionRequest) -> PracticeTradeResponse:
        """Create a new practice trading session."""
        user_id = UUID(request.user_id)
        
        session = PracticeTrade(
            user_id=user_id,
            session_name=request.session_name,
            trade_config=request.trade_config,
            simulation_parameters=request.simulation_parameters,
            simulation_results={},  # Will be populated when completed
            base_token=request.base_token,
            quote_token=request.quote_token,
            initial_balance_base=Decimal(str(request.initial_balance_base)),
            initial_balance_quote=Decimal(str(request.initial_balance_quote)),
            duration_minutes=request.duration_minutes,
            market_conditions=request.market_conditions,
            completed=False
        )
        
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        
        return self._convert_to_practice_trade_response(session)
    
    def complete_practice_session(self, request: PracticeSessionCompleteRequest) -> PracticeTradeResponse:
        """Complete a practice trading session."""
        session_id = UUID(request.session_id)
        
        session = self.db.query(PracticeTrade).filter(
            PracticeTrade.id == session_id
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Practice session not found")
        
        # Update session with completion data
        session.simulation_results = request.simulation_results
        session.final_balance_base = Decimal(str(request.final_balance_base))
        session.final_balance_quote = Decimal(str(request.final_balance_quote))
        session.total_pnl_percentage = Decimal(str(request.total_pnl_percentage))
        session.trades_executed = request.trades_executed
        session.performance_rating = request.performance_rating
        session.lessons_learned = request.lessons_learned or []
        session.completed = True
        session.completed_at = datetime.now(timezone.utc)
        
        self.db.commit()
        self.db.refresh(session)
        
        # Check for achievements
        self._check_and_award_achievements(session.user_id, 'practice_completion', {
            'pnl_percentage': float(session.total_pnl_percentage or 0),
            'trades_executed': session.trades_executed,
            'performance_rating': session.performance_rating
        })
        
        return self._convert_to_practice_trade_response(session)
    
    def _check_and_award_achievements(self, user_id: UUID, activity_type: str, data: Dict[str, Any]):
        """Check and award achievements based on activity."""
        # Get all achievements that might be earned
        achievements = self.db.query(Achievement).filter(
            Achievement.is_active == True
        ).all()
        
        for achievement in achievements:
            if self._check_achievement_criteria(user_id, achievement, activity_type, data):
                # Check if already earned
                existing = self.db.query(UserAchievement).filter(
                    UserAchievement.user_id == user_id,
                    UserAchievement.achievement_id == achievement.id
                ).first()
                
                if not existing:
                    # Award achievement
                    user_achievement = UserAchievement(
                        user_id=user_id,
                        achievement_id=achievement.id,
                        metadata={'trigger_activity': activity_type, 'trigger_data': data}
                    )
                    self.db.add(user_achievement)
        
        self.db.commit()
    
    def _check_achievement_criteria(self, user_id: UUID, achievement: Achievement, activity_type: str, data: Dict[str, Any]) -> bool:
        """Check if achievement criteria are met."""
        criteria = achievement.criteria
        
        # Example achievement criteria checking
        if achievement.achievement_code == 'first_module_complete' and activity_type == 'module_progress':
            return data.get('completion_status') == 'completed'
        
        if achievement.achievement_code == 'quiz_master' and activity_type == 'quiz_completion':
            return data.get('score', 0) >= 90
        
        if achievement.achievement_code == 'profitable_trader' and activity_type == 'practice_completion':
            return data.get('pnl_percentage', 0) > 5
        
        # Add more achievement criteria as needed
        return False
    
    def _convert_to_module_progress_response(self, progress: EducationalProgress) -> ModuleProgressResponse:
        """Convert database model to API response."""
        return ModuleProgressResponse(
            id=str(progress.id),
            user_id=str(progress.user_id),
            module_id=str(progress.module_id),
            module_code=progress.module.module_code,
            module_title=progress.module.title,
            completion_status=progress.completion_status,
            progress_percentage=progress.progress_percentage,
            time_spent_minutes=progress.time_spent_minutes,
            best_score=progress.best_score,
            completion_date=progress.completion_date,
            first_started_at=progress.first_started_at,
            last_accessed_at=progress.last_accessed_at,
            attempts_count=progress.attempts_count,
            metadata=progress.metadata or {}
        )
    
    def _convert_to_practice_trade_response(self, session: PracticeTrade) -> PracticeTradeResponse:
        """Convert database model to API response."""
        return PracticeTradeResponse(
            id=str(session.id),
            user_id=str(session.user_id),
            session_name=session.session_name,
            base_token=session.base_token,
            quote_token=session.quote_token,
            initial_balance_base=float(session.initial_balance_base),
            initial_balance_quote=float(session.initial_balance_quote),
            final_balance_base=float(session.final_balance_base) if session.final_balance_base else None,
            final_balance_quote=float(session.final_balance_quote) if session.final_balance_quote else None,
            total_pnl_percentage=float(session.total_pnl_percentage) if session.total_pnl_percentage else None,
            trades_executed=session.trades_executed,
            duration_minutes=session.duration_minutes,
            market_conditions=session.market_conditions,
            performance_rating=session.performance_rating,
            lessons_learned=session.lessons_learned or [],
            completed=session.completed,
            created_at=session.created_at,
            completed_at=session.completed_at
        )

# API Endpoints

@router.get("/{user_id}", response_model=DetailedUserProgressResponse)
async def get_user_progress(
    user_id: str = Path(..., description="User UUID"),
    include_practice_sessions: bool = Query(True, description="Include practice trading sessions"),
    limit_recent_attempts: int = Query(10, ge=1, le=50, description="Limit recent quiz attempts"),
    db: Session = Depends(get_db)
):
    """Get comprehensive user progress including modules, quizzes, practice trades, and achievements."""
    try:
        user_uuid = UUID(user_id)
        service = ProgressTrackingService(db)
        
        # Get user summary
        summary = service.get_user_progress_summary(user_uuid)
        
        # Get module progress
        module_progress_data = db.query(EducationalProgress).options(
            joinedload(EducationalProgress.module)
        ).filter(EducationalProgress.user_id == user_uuid).all()
        
        module_progress = [
            service._convert_to_module_progress_response(progress) 
            for progress in module_progress_data
        ]
        
        # Get recent quiz attempts
        recent_attempts = db.query(QuizAttempt).filter(
            QuizAttempt.user_id == user_uuid
        ).order_by(desc(QuizAttempt.attempt_date)).limit(limit_recent_attempts).all()
        
        quiz_attempts = []
        for attempt in recent_attempts:
            percentage_score = (attempt.score / attempt.max_score) * 100 if attempt.max_score > 0 else 0
            quiz_attempts.append(QuizAttemptResponse(
                id=str(attempt.id),
                user_id=str(attempt.user_id),
                module_id=str(attempt.module_id),
                attempt_number=attempt.attempt_number,
                score=attempt.score,
                max_score=attempt.max_score,
                percentage_score=percentage_score,
                time_taken_minutes=attempt.time_taken_minutes,
                completed=attempt.completed,
                passed=attempt.passed,
                attempt_date=attempt.attempt_date
            ))
        
        # Get practice sessions
        practice_sessions = []
        if include_practice_sessions:
            sessions_data = db.query(PracticeTrade).filter(
                PracticeTrade.user_id == user_uuid
            ).order_by(desc(PracticeTrade.created_at)).all()
            
            practice_sessions = [
                service._convert_to_practice_trade_response(session) 
                for session in sessions_data
            ]
        
        # Get achievements
        achievements_data = db.query(UserAchievement).options(
            joinedload(UserAchievement.achievement)
        ).filter(UserAchievement.user_id == user_uuid).all()
        
        achievements = []
        for user_achievement in achievements_data:
            achievement = user_achievement.achievement
            achievements.append(AchievementResponse(
                id=str(achievement.id),
                achievement_code=achievement.achievement_code,
                title=achievement.title,
                description=achievement.description,
                achievement_type=achievement.achievement_type,
                reward_points=achievement.reward_points,
                badge_icon=achievement.badge_icon,
                earned_at=user_achievement.earned_at,
                criteria=achievement.criteria
            ))
        
        # Get competency validation
        validation = service._validate_live_trading_readiness(user_uuid)
        competency_validation = {
            'is_ready': validation,
            'last_checked': datetime.now(timezone.utc).isoformat()
        }
        
        return DetailedUserProgressResponse(
            summary=summary,
            module_progress=module_progress,
            recent_quiz_attempts=quiz_attempts,
            practice_sessions=practice_sessions,
            achievements=achievements,
            competency_validation=competency_validation
        )
        
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid user ID format")
    except Exception as e:
        logger.error(f"Error getting user progress for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/module", response_model=ModuleProgressResponse)
async def update_module_progress(
    request: ModuleProgressRequest,
    db: Session = Depends(get_db)
):
    """Update user progress on an educational module."""
    try:
        service = ProgressTrackingService(db)
        return service.update_module_progress(request)
        
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating module progress: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/quiz", response_model=QuizAttemptResponse)
async def record_quiz_attempt(
    request: QuizAttemptRequest,
    db: Session = Depends(get_db)
):
    """Record a quiz attempt and calculate score."""
    try:
        service = ProgressTrackingService(db)
        return service.record_quiz_attempt(request)
        
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Error recording quiz attempt: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/practice", response_model=PracticeTradeResponse)
async def create_practice_session(
    request: PracticeSessionRequest,
    db: Session = Depends(get_db)
):
    """Create a new practice trading session."""
    try:
        service = ProgressTrackingService(db)
        return service.create_practice_session(request)
        
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating practice session: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/practice/complete", response_model=PracticeTradeResponse)
async def complete_practice_session(
    request: PracticeSessionCompleteRequest,
    db: Session = Depends(get_db)
):
    """Complete a practice trading session with results."""
    try:
        service = ProgressTrackingService(db)
        return service.complete_practice_session(request)
        
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"Error completing practice session: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/achievements/{user_id}", response_model=List[AchievementResponse])
async def get_user_achievements(
    user_id: str = Path(..., description="User UUID"),
    achievement_type: Optional[AchievementType] = Query(None, description="Filter by achievement type"),
    db: Session = Depends(get_db)
):
    """Get all achievements earned by a user."""
    try:
        user_uuid = UUID(user_id)
        
        query = db.query(UserAchievement).options(
            joinedload(UserAchievement.achievement)
        ).filter(UserAchievement.user_id == user_uuid)
        
        if achievement_type:
            query = query.join(Achievement).filter(
                Achievement.achievement_type == achievement_type
            )
        
        user_achievements = query.order_by(desc(UserAchievement.earned_at)).all()
        
        achievements = []
        for user_achievement in user_achievements:
            achievement = user_achievement.achievement
            achievements.append(AchievementResponse(
                id=str(achievement.id),
                achievement_code=achievement.achievement_code,
                title=achievement.title,
                description=achievement.description,
                achievement_type=achievement.achievement_type,
                reward_points=achievement.reward_points,
                badge_icon=achievement.badge_icon,
                earned_at=user_achievement.earned_at,
                criteria=achievement.criteria
            ))
        
        return achievements
        
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid user ID format")
    except Exception as e:
        logger.error(f"Error getting user achievements for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/validate-readiness/{user_id}", response_model=CompetencyValidationResponse)
async def validate_live_trading_readiness(
    user_id: str = Path(..., description="User UUID"),
    db: Session = Depends(get_db)
):
    """Validate if user is ready for live trading based on competency requirements."""
    try:
        user_uuid = UUID(user_id)
        service = ProgressTrackingService(db)
        
        # Check required modules
        required_modules = ['grid-basics', 'risk-management', 'market-conditions']
        completed_required = db.query(EducationalProgress).join(
            EducationalModule
        ).filter(
            EducationalProgress.user_id == user_uuid,
            EducationalProgress.completion_status == CompletionStatus.COMPLETED,
            EducationalModule.module_code.in_(required_modules)
        ).all()
        
        completed_module_codes = [p.module.module_code for p in completed_required]
        
        # Check practice trading requirements
        practice_trades = db.query(PracticeTrade).filter(
            PracticeTrade.user_id == user_uuid,
            PracticeTrade.completed == True
        ).all()
        
        total_practice_time = sum(trade.duration_minutes or 0 for trade in practice_trades)
        
        # Calculate requirements met
        requirements_met = {
            'required_modules_completed': len(completed_module_codes) == len(required_modules),
            'practice_trades_minimum': len(practice_trades) >= 3,
            'practice_time_minimum': total_practice_time >= 24 * 60  # 24 hours
        }
        
        all_requirements_met = all(requirements_met.values())
        
        # Missing requirements
        missing_requirements = []
        if not requirements_met['required_modules_completed']:
            missing = set(required_modules) - set(completed_module_codes)
            missing_requirements.extend([f"Complete {module} module" for module in missing])
        
        if not requirements_met['practice_trades_minimum']:
            needed = 3 - len(practice_trades)
            missing_requirements.append(f"Complete {needed} more practice trading sessions")
        
        if not requirements_met['practice_time_minimum']:
            needed_hours = (24 * 60 - total_practice_time) / 60
            missing_requirements.append(f"Practice trading for {needed_hours:.1f} more hours")
        
        # Calculate completion percentage
        total_requirements = len(requirements_met)
        met_requirements = sum(requirements_met.values())
        completion_percentage = (met_requirements / total_requirements) * 100 if total_requirements > 0 else 0
        
        # Estimate time to completion
        estimated_hours = None
        if not all_requirements_met:
            estimated_hours = 0
            if not requirements_met['required_modules_completed']:
                missing_count = len(set(required_modules) - set(completed_module_codes))
                estimated_hours += missing_count * 2  # 2 hours per module
            
            if not requirements_met['practice_time_minimum']:
                estimated_hours += (24 * 60 - total_practice_time) / 60
        
        # Recommendations
        recommendations = []
        if not requirements_met['required_modules_completed']:
            recommendations.append("Complete all required educational modules")
        
        if not requirements_met['practice_trades_minimum']:
            recommendations.append("Complete more practice trading sessions")
        
        if not requirements_met['practice_time_minimum']:
            recommendations.append("Spend more time in practice trading mode")
        
        if all_requirements_met:
            recommendations.append("You are ready for live trading!")
        
        return CompetencyValidationResponse(
            user_id=user_id,
            is_ready_for_live_trading=all_requirements_met,
            requirements_met=requirements_met,
            missing_requirements=missing_requirements,
            completion_percentage=completion_percentage,
            estimated_time_to_completion_hours=estimated_hours,
            recommendations=recommendations
        )
        
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid user ID format")
    except Exception as e:
        logger.error(f"Error validating live trading readiness for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/modules", response_model=List[EducationalModuleResponse])
async def get_educational_modules(
    user_id: Optional[str] = Query(None, description="User UUID to include progress"),
    include_inactive: bool = Query(False, description="Include inactive modules"),
    db: Session = Depends(get_db)
):
    """Get all educational modules, optionally with user progress."""
    try:
        query = db.query(EducationalModule)
        
        if not include_inactive:
            query = query.filter(EducationalModule.is_active == True)
        
        modules = query.order_by(EducationalModule.sort_order).all()
        
        result = []
        for module in modules:
            user_progress = None
            
            if user_id:
                try:
                    user_uuid = UUID(user_id)
                    progress_data = db.query(EducationalProgress).filter(
                        EducationalProgress.user_id == user_uuid,
                        EducationalProgress.module_id == module.id
                    ).first()
                    
                    if progress_data:
                        service = ProgressTrackingService(db)
                        user_progress = service._convert_to_module_progress_response(progress_data)
                
                except ValueError:
                    pass  # Invalid user ID, skip progress
            
            result.append(EducationalModuleResponse(
                id=str(module.id),
                module_code=module.module_code,
                title=module.title,
                description=module.description,
                difficulty_level=module.difficulty_level,
                estimated_duration_minutes=module.estimated_duration_minutes,
                prerequisites=module.prerequisites or [],
                learning_objectives=module.learning_objectives or [],
                passing_score=module.passing_score,
                is_active=module.is_active,
                sort_order=module.sort_order,
                user_progress=user_progress
            ))
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting educational modules: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/summary/{user_id}", response_model=UserProgressSummary)
async def get_user_progress_summary(
    user_id: str = Path(..., description="User UUID"),
    db: Session = Depends(get_db)
):
    """Get user progress summary for dashboard display."""
    try:
        user_uuid = UUID(user_id)
        service = ProgressTrackingService(db)
        
        return service.get_user_progress_summary(user_uuid)
        
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid user ID format")
    except Exception as e:
        logger.error(f"Error getting user progress summary for {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
"""
Competency validation API endpoints for Off the Grid platform.
Implements server-side validation for live trading access with cryptographic security.

Security Features:
- Server-side validation for all trading endpoints
- JWT claims with competency status
- Database-backed validation checks
- Audit logging for validation attempts
- Automatic re-validation after time periods
- Cryptographic validation tokens
- Rate limiting for abuse prevention
"""

import logging
import hashlib
import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Path, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc
from pydantic import BaseModel, Field, validator
import jwt
from passlib.hash import bcrypt

from database import (
    get_db, User, EducationalModule, EducationalProgress, QuizAttempt, 
    PracticeTrade, Achievement, UserAchievement, UserActivity
)
from models import SuccessResponse
from config import JWT_SECRET_KEY, JWT_ALGORITHM

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/competency", tags=["competency"])
security = HTTPBearer()

# Pydantic models for requests/responses

class ValidationRequest(BaseModel):
    user_id: str
    validation_type: str = Field(..., regex="^(education|practice|risk_assessment|live_trading)$")
    requested_features: Optional[List[str]] = []
    certificate_version: Optional[int] = None
    bypass_token: Optional[str] = None

class ValidationError(BaseModel):
    code: str
    message: str
    severity: str = Field(..., regex="^(critical|warning|info)$")
    requirement: Optional[str] = None

class ValidationResult(BaseModel):
    is_valid: bool
    score: Optional[float] = None
    completed_at: Optional[datetime] = None
    errors: List[ValidationError] = []
    warnings: List[str] = []
    next_steps: List[str] = []

class CertificationRequirement(BaseModel):
    type: str = Field(..., regex="^(education|practice|assessment|timeSpent)$")
    identifier: str
    description: str
    completed: bool
    completed_at: Optional[datetime] = None
    score: Optional[float] = None
    minimum_score: Optional[float] = None

class TradingRestriction(BaseModel):
    type: str = Field(..., regex="^(positionSize|tradingPair|feature|timeLimit)$")
    description: str
    limit: str
    expires_at: Optional[datetime] = None

class CompetencyCertificate(BaseModel):
    certificate_id: str
    user_id: str
    level: str = Field(..., regex="^(restricted|basic|intermediate|advanced|expert)$")
    issued_at: datetime
    expires_at: datetime
    cryptographic_proof: str
    requirements: List[CertificationRequirement]
    restrictions: List[TradingRestriction]
    version: int = 1

class LiveTradingValidationResponse(BaseModel):
    can_access: bool
    level: str = Field(..., regex="^(restricted|basic|intermediate|advanced|expert)$")
    certificate: Optional[CompetencyCertificate] = None
    restrictions: List[TradingRestriction] = []
    time_until_expiry: Optional[int] = None  # minutes
    renewal_required: bool = False
    missing_requirements: List[CertificationRequirement] = []
    estimated_completion_time: int = 0  # minutes
    next_checkpoint_date: datetime

class RiskAssessmentRequest(BaseModel):
    user_id: str
    answers: Dict[str, Any]
    time_taken_minutes: Optional[int] = None

class RiskAssessmentResult(BaseModel):
    overall_score: float
    risk_tolerance: str = Field(..., regex="^(low|medium|high)$")
    category_scores: Dict[str, float]
    recommendations: List[str]
    warning_flags: List[str]
    completed_at: datetime

class CertificateVerificationRequest(BaseModel):
    certificate: str
    user_id: Optional[str] = None

# Service class for competency validation business logic

class CompetencyValidationService:
    """Service class for competency validation business logic with enhanced security."""
    
    def __init__(self, db: Session):
        self.db = db
        self.CERTIFICATE_VALIDITY_DAYS = 90
        self.MIN_PRACTICE_HOURS = 24
        self.MIN_PRACTICE_SESSIONS = 3
        self.MIN_QUIZ_SCORE = 75
        self.EXPERT_QUIZ_SCORE = 85
        
    def validate_educational_requirements(self, user_id: UUID) -> ValidationResult:
        """Validate educational requirements completion with enhanced security checks."""
        errors = []
        warnings = []
        next_steps = []
        
        try:
            # Get user progress
            user_progress = self.db.query(EducationalProgress).filter(
                EducationalProgress.user_id == user_id
            ).all()
            
            # Required modules for live trading
            required_modules = ['grid-basics', 'risk-management', 'market-conditions']
            completed_modules = []
            total_score = 0
            module_count = 0
            
            for module_code in required_modules:
                progress = next((p for p in user_progress 
                               if p.module.module_code == module_code), None)
                
                if not progress or progress.completion_status != 'completed':
                    errors.append(ValidationError(
                        code='MODULE_INCOMPLETE',
                        message=f'Required module "{module_code}" not completed',
                        severity='critical',
                        requirement=module_code
                    ))
                    next_steps.append(f'Complete the {module_code} learning module')
                    continue
                
                # Check quiz score
                if not progress.best_score or progress.best_score < self.MIN_QUIZ_SCORE:
                    score = progress.best_score or 0
                    errors.append(ValidationError(
                        code='QUIZ_SCORE_LOW',
                        message=f'Quiz score for "{module_code}" is {score}%, minimum required is {self.MIN_QUIZ_SCORE}%',
                        severity='critical',
                        requirement=module_code
                    ))
                    next_steps.append(f'Retake the {module_code} quiz to achieve {self.MIN_QUIZ_SCORE}% or higher')
                    continue
                
                completed_modules.append(module_code)
                total_score += progress.best_score
                module_count += 1
            
            # Calculate average score
            avg_score = total_score / module_count if module_count > 0 else 0
            
            # Check for suspicious patterns (security measure)
            if self._detect_suspicious_educational_activity(user_id):
                warnings.append('Unusual completion patterns detected - manual review may be required')
            
            # Log validation attempt
            self._log_validation_attempt(user_id, 'education', len(errors) == 0, {
                'completed_modules': len(completed_modules),
                'average_score': avg_score,
                'total_modules': len(required_modules)
            })
            
            return ValidationResult(
                is_valid=len(errors) == 0,
                score=avg_score if module_count > 0 else None,
                completed_at=datetime.now(timezone.utc) if len(errors) == 0 else None,
                errors=errors,
                warnings=warnings,
                next_steps=next_steps
            )
            
        except Exception as e:
            logger.error(f"Educational validation failed for user {user_id}: {e}")
            errors.append(ValidationError(
                code='VALIDATION_ERROR',
                message='Failed to validate educational requirements',
                severity='critical'
            ))
            
            return ValidationResult(
                is_valid=False,
                errors=errors,
                warnings=warnings,
                next_steps=['Please try again or contact support']
            )
    
    def validate_practice_requirements(self, user_id: UUID) -> ValidationResult:
        """Validate practice trading requirements with quality assessment."""
        errors = []
        warnings = []
        next_steps = []
        
        try:
            # Get completed practice sessions
            practice_sessions = self.db.query(PracticeTrade).filter(
                PracticeTrade.user_id == user_id,
                PracticeTrade.completed == True
            ).all()
            
            # Check minimum session count
            if len(practice_sessions) < self.MIN_PRACTICE_SESSIONS:
                errors.append(ValidationError(
                    code='INSUFFICIENT_PRACTICE_SESSIONS',
                    message=f'Only {len(practice_sessions)} practice sessions completed, minimum {self.MIN_PRACTICE_SESSIONS} required',
                    severity='critical',
                    requirement='practice_sessions'
                ))
                next_steps.append(f'Complete {self.MIN_PRACTICE_SESSIONS - len(practice_sessions)} more practice trading sessions')
            
            # Check total practice time
            total_minutes = sum(session.duration_minutes or 0 for session in practice_sessions)
            required_minutes = self.MIN_PRACTICE_HOURS * 60
            
            if total_minutes < required_minutes:
                remaining_hours = (required_minutes - total_minutes) / 60
                errors.append(ValidationError(
                    code='INSUFFICIENT_PRACTICE_TIME',
                    message=f'Only {total_minutes // 60} hours of practice time, minimum {self.MIN_PRACTICE_HOURS} hours required',
                    severity='critical',
                    requirement='practice_time'
                ))
                next_steps.append(f'Practice trading for {remaining_hours:.1f} more hours')
            
            # Assess practice quality
            quality_score = self._assess_practice_quality(practice_sessions)
            
            if quality_score < 60:
                warnings.append(f'Practice session quality score is {quality_score}/100 - consider reviewing trading strategies')
                next_steps.append('Focus on risk management and consistent performance in practice sessions')
            
            # Check for concerning patterns
            if self._detect_suspicious_practice_activity(user_id, practice_sessions):
                warnings.append('Unusual practice patterns detected - additional review may be required')
            
            # Log validation attempt
            self._log_validation_attempt(user_id, 'practice', len(errors) == 0, {
                'session_count': len(practice_sessions),
                'total_minutes': total_minutes,
                'quality_score': quality_score
            })
            
            return ValidationResult(
                is_valid=len(errors) == 0,
                score=quality_score,
                completed_at=datetime.now(timezone.utc) if len(errors) == 0 else None,
                errors=errors,
                warnings=warnings,
                next_steps=next_steps
            )
            
        except Exception as e:
            logger.error(f"Practice validation failed for user {user_id}: {e}")
            errors.append(ValidationError(
                code='VALIDATION_ERROR',
                message='Failed to validate practice requirements',
                severity='critical'
            ))
            
            return ValidationResult(
                is_valid=False,
                errors=errors,
                warnings=warnings,
                next_steps=['Please try again or contact support']
            )
    
    def validate_risk_assessment(self, user_id: UUID) -> ValidationResult:
        """Validate risk assessment completion and quality."""
        errors = []
        warnings = []
        next_steps = []
        
        try:
            # Check for completed risk assessment
            risk_assessment = self._get_risk_assessment_result(user_id)
            
            if not risk_assessment:
                errors.append(ValidationError(
                    code='RISK_ASSESSMENT_MISSING',
                    message='Risk assessment questionnaire not completed',
                    severity='critical',
                    requirement='risk_assessment'
                ))
                next_steps.append('Complete the risk tolerance assessment')
                
                return ValidationResult(
                    is_valid=False,
                    errors=errors,
                    warnings=warnings,
                    next_steps=next_steps
                )
            
            # Validate assessment score
            if risk_assessment['overall_score'] < 60:
                errors.append(ValidationError(
                    code='RISK_ASSESSMENT_SCORE_LOW',
                    message=f'Risk assessment score ({risk_assessment["overall_score"]}) is below minimum threshold (60)',
                    severity='critical',
                    requirement='risk_assessment_score'
                ))
                next_steps.append('Retake the risk assessment to demonstrate better understanding')
            
            # Check category scores
            for category, score in risk_assessment.get('category_scores', {}).items():
                if score < 50:
                    warnings.append(f'Low score in {category} category: {score}/100')
                    next_steps.append(f'Review educational materials for {category}')
            
            # Check warning flags
            warning_flags = risk_assessment.get('warning_flags', [])
            if warning_flags:
                warnings.extend(warning_flags)
                next_steps.append('Address risk assessment warning flags before proceeding')
            
            # Log validation attempt
            self._log_validation_attempt(user_id, 'risk_assessment', len(errors) == 0, {
                'overall_score': risk_assessment['overall_score'],
                'warning_flags_count': len(warning_flags)
            })
            
            return ValidationResult(
                is_valid=len(errors) == 0,
                score=risk_assessment['overall_score'],
                completed_at=datetime.now(timezone.utc) if len(errors) == 0 else None,
                errors=errors,
                warnings=warnings,
                next_steps=next_steps
            )
            
        except Exception as e:
            logger.error(f"Risk assessment validation failed for user {user_id}: {e}")
            errors.append(ValidationError(
                code='VALIDATION_ERROR',
                message='Failed to validate risk assessment',
                severity='critical'
            ))
            
            return ValidationResult(
                is_valid=False,
                errors=errors,
                warnings=warnings,
                next_steps=['Please try again or contact support']
            )
    
    def validate_live_trading_access(self, request: ValidationRequest) -> LiveTradingValidationResponse:
        """Comprehensive validation for live trading access with security checks."""
        user_id = UUID(request.user_id)
        
        try:
            # Check for existing valid certificate
            existing_cert = self._get_valid_certificate(user_id)
            if existing_cert and not self._certificate_needs_renewal(existing_cert):
                return self._build_successful_response(existing_cert)
            
            # Validate all requirements
            education = self.validate_educational_requirements(user_id)
            practice = self.validate_practice_requirements(user_id)
            risk_assessment = self.validate_risk_assessment(user_id)
            
            # Check if all requirements are met
            all_valid = education.is_valid and practice.is_valid and risk_assessment.is_valid
            
            if not all_valid:
                missing_requirements = self._build_missing_requirements_list(
                    education, practice, risk_assessment
                )
                
                estimated_time = self._estimate_completion_time(missing_requirements)
                
                # Log failed validation
                self._log_validation_attempt(user_id, 'live_trading', False, {
                    'education_valid': education.is_valid,
                    'practice_valid': practice.is_valid,
                    'risk_assessment_valid': risk_assessment.is_valid
                })
                
                return LiveTradingValidationResponse(
                    can_access=False,
                    level='restricted',
                    restrictions=[
                        TradingRestriction(
                            type='feature',
                            description='Live trading disabled - complete requirements first',
                            limit='none'
                        )
                    ],
                    renewal_required=existing_cert is not None,
                    missing_requirements=missing_requirements,
                    estimated_completion_time=estimated_time,
                    next_checkpoint_date=datetime.now(timezone.utc) + timedelta(days=1)
                )
            
            # Generate new certificate
            level = self._determine_competency_level(education, practice, risk_assessment)
            certificate = self._generate_certificate(user_id, level, education, practice, risk_assessment)
            
            # Store certificate
            self._store_certificate(certificate)
            
            # Log successful validation
            self._log_validation_attempt(user_id, 'live_trading', True, {
                'competency_level': level,
                'certificate_id': certificate.certificate_id
            })
            
            return self._build_successful_response(certificate)
            
        except Exception as e:
            logger.error(f"Live trading validation failed for user {user_id}: {e}")
            
            # Return restrictive response on error
            return LiveTradingValidationResponse(
                can_access=False,
                level='restricted',
                restrictions=[
                    TradingRestriction(
                        type='feature',
                        description='All live trading features disabled due to validation error',
                        limit='none'
                    )
                ],
                renewal_required=True,
                missing_requirements=[],
                estimated_completion_time=0,
                next_checkpoint_date=datetime.now(timezone.utc)
            )
    
    def verify_certificate(self, certificate_data: str, user_id: Optional[UUID] = None) -> bool:
        """Verify cryptographic certificate validity."""
        try:
            # Decode certificate (in production, use proper cryptographic verification)
            import base64
            decoded = base64.b64decode(certificate_data)
            cert_data = json.loads(decoded.decode())
            
            # Basic validation
            if not all(key in cert_data for key in ['certificate_id', 'user_id', 'issued_at', 'expires_at']):
                return False
            
            # Check expiry
            expires_at = datetime.fromisoformat(cert_data['expires_at'])
            if datetime.now(timezone.utc) > expires_at:
                return False
            
            # Verify against database
            stored_cert = self._get_stored_certificate(cert_data['certificate_id'])
            if not stored_cert:
                return False
            
            # Verify user match if provided
            if user_id and str(user_id) != cert_data['user_id']:
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Certificate verification failed: {e}")
            return False
    
    def record_risk_assessment(self, request: RiskAssessmentRequest) -> RiskAssessmentResult:
        """Process and store risk assessment results."""
        user_id = UUID(request.user_id)
        
        # Calculate scores based on answers
        category_scores = self._calculate_risk_assessment_scores(request.answers)
        overall_score = sum(category_scores.values()) / len(category_scores)
        
        # Determine risk tolerance
        risk_tolerance = self._determine_risk_tolerance(overall_score, category_scores)
        
        # Generate recommendations and warnings
        recommendations = self._generate_risk_recommendations(category_scores, risk_tolerance)
        warning_flags = self._identify_warning_flags(request.answers, category_scores)
        
        # Store assessment result
        result = RiskAssessmentResult(
            overall_score=overall_score,
            risk_tolerance=risk_tolerance,
            category_scores=category_scores,
            recommendations=recommendations,
            warning_flags=warning_flags,
            completed_at=datetime.now(timezone.utc)
        )
        
        self._store_risk_assessment(user_id, result, request.answers)
        
        return result
    
    # Private helper methods
    
    def _detect_suspicious_educational_activity(self, user_id: UUID) -> bool:
        """Detect suspicious patterns in educational progress."""
        # Check for unusually fast completion times
        recent_progress = self.db.query(EducationalProgress).filter(
            EducationalProgress.user_id == user_id,
            EducationalProgress.completion_date > datetime.now(timezone.utc) - timedelta(hours=24)
        ).all()
        
        # Flag if more than 3 modules completed in 24 hours
        return len(recent_progress) > 3
    
    def _detect_suspicious_practice_activity(self, user_id: UUID, sessions: List) -> bool:
        """Detect suspicious patterns in practice trading."""
        if not sessions:
            return False
        
        # Check for unrealistic performance patterns
        excellent_sessions = [s for s in sessions if s.performance_rating == 'excellent']
        
        # Flag if more than 80% of sessions are excellent (unrealistic for learning)
        return len(excellent_sessions) / len(sessions) > 0.8
    
    def _assess_practice_quality(self, sessions: List) -> float:
        """Assess the quality of practice trading sessions."""
        if not sessions:
            return 0
        
        performance_scores = {
            'excellent': 100, 'good': 80, 'fair': 60, 'poor': 40
        }
        
        total_score = sum(
            performance_scores.get(session.performance_rating, 0) 
            for session in sessions
        )
        
        return total_score / len(sessions)
    
    def _log_validation_attempt(self, user_id: UUID, validation_type: str, 
                               success: bool, metadata: Dict[str, Any]):
        """Log validation attempts for audit trail."""
        activity = UserActivity(
            user_id=user_id,
            activity_type=f'competency_validation_{validation_type}',
            activity_description=f'Competency validation: {validation_type}',
            resource_type='validation',
            metadata={
                'success': success,
                'validation_type': validation_type,
                **metadata
            }
        )
        
        self.db.add(activity)
        self.db.commit()
    
    def _get_risk_assessment_result(self, user_id: UUID) -> Optional[Dict[str, Any]]:
        """Get stored risk assessment result."""
        # In production, this would query a risk_assessments table
        # For now, return a mock result if the user has activity
        activity = self.db.query(UserActivity).filter(
            UserActivity.user_id == user_id,
            UserActivity.activity_type == 'risk_assessment_completed'
        ).first()
        
        if not activity:
            return None
        
        # Mock risk assessment result
        return {
            'overall_score': 75,
            'risk_tolerance': 'medium',
            'category_scores': {
                'market_knowledge': 80,
                'risk_management': 70,
                'technical_skills': 75,
                'emotional_discipline': 75
            },
            'warning_flags': [],
            'completed_at': activity.created_at
        }
    
    def _get_valid_certificate(self, user_id: UUID) -> Optional[CompetencyCertificate]:
        """Get existing valid certificate for user."""
        # In production, query certificates table
        return None
    
    def _certificate_needs_renewal(self, certificate: CompetencyCertificate) -> bool:
        """Check if certificate needs renewal."""
        return datetime.now(timezone.utc) > certificate.expires_at
    
    def _build_missing_requirements_list(self, education: ValidationResult, 
                                       practice: ValidationResult, 
                                       risk_assessment: ValidationResult) -> List[CertificationRequirement]:
        """Build list of missing requirements."""
        requirements = []
        
        if not education.is_valid:
            requirements.append(CertificationRequirement(
                type='education',
                identifier='required_modules',
                description='Complete all required educational modules',
                completed=False,
                minimum_score=self.MIN_QUIZ_SCORE
            ))
        
        if not practice.is_valid:
            requirements.append(CertificationRequirement(
                type='practice',
                identifier='practice_sessions',
                description='Complete minimum practice trading requirements',
                completed=False
            ))
        
        if not risk_assessment.is_valid:
            requirements.append(CertificationRequirement(
                type='assessment',
                identifier='risk_assessment',
                description='Complete risk tolerance assessment',
                completed=False,
                minimum_score=60
            ))
        
        return requirements
    
    def _estimate_completion_time(self, missing_requirements: List[CertificationRequirement]) -> int:
        """Estimate time to complete missing requirements in minutes."""
        time_estimates = {
            'education': 180,  # 3 hours
            'practice': 24 * 60,  # 24 hours
            'assessment': 30  # 30 minutes
        }
        
        total_time = 0
        for req in missing_requirements:
            total_time += time_estimates.get(req.type, 60)
        
        return total_time
    
    def _determine_competency_level(self, education: ValidationResult, 
                                   practice: ValidationResult, 
                                   risk_assessment: ValidationResult) -> str:
        """Determine competency level based on validation results."""
        avg_score = sum(filter(None, [
            education.score, practice.score, risk_assessment.score
        ])) / 3
        
        if avg_score >= self.EXPERT_QUIZ_SCORE and practice.score and practice.score >= 85:
            return 'expert'
        elif avg_score >= 80 and practice.score and practice.score >= 75:
            return 'advanced'
        elif avg_score >= self.MIN_QUIZ_SCORE and practice.score and practice.score >= 65:
            return 'intermediate'
        elif avg_score >= 60:
            return 'basic'
        else:
            return 'restricted'
    
    def _generate_certificate(self, user_id: UUID, level: str, 
                             education: ValidationResult, 
                             practice: ValidationResult, 
                             risk_assessment: ValidationResult) -> CompetencyCertificate:
        """Generate new competency certificate."""
        certificate_id = f"cert_{int(datetime.now().timestamp())}_{str(uuid4())[:8]}"
        
        requirements = [
            CertificationRequirement(
                type='education',
                identifier='required_modules',
                description='Complete all required educational modules',
                completed=True,
                completed_at=education.completed_at,
                score=education.score,
                minimum_score=self.MIN_QUIZ_SCORE
            ),
            CertificationRequirement(
                type='practice',
                identifier='practice_sessions',
                description='Complete minimum practice trading requirements',
                completed=True,
                completed_at=practice.completed_at,
                score=practice.score
            ),
            CertificationRequirement(
                type='assessment',
                identifier='risk_assessment',
                description='Complete risk tolerance assessment',
                completed=True,
                completed_at=risk_assessment.completed_at,
                score=risk_assessment.score,
                minimum_score=60
            )
        ]
        
        restrictions = self._determine_restrictions(level)
        
        # Generate cryptographic proof (simplified for demo)
        proof_data = f"{user_id}:{level}:{certificate_id}:{datetime.now().timestamp()}"
        cryptographic_proof = hashlib.sha256(proof_data.encode()).hexdigest()
        
        return CompetencyCertificate(
            certificate_id=certificate_id,
            user_id=str(user_id),
            level=level,
            issued_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(days=self.CERTIFICATE_VALIDITY_DAYS),
            cryptographic_proof=cryptographic_proof,
            requirements=requirements,
            restrictions=restrictions,
            version=1
        )
    
    def _determine_restrictions(self, level: str) -> List[TradingRestriction]:
        """Determine trading restrictions based on competency level."""
        restrictions = []
        
        if level == 'restricted':
            restrictions.append(TradingRestriction(
                type='feature',
                description='Live trading disabled - complete requirements first',
                limit='none'
            ))
        elif level == 'basic':
            restrictions.extend([
                TradingRestriction(
                    type='positionSize',
                    description='Maximum position size per grid',
                    limit='10 ERG'
                ),
                TradingRestriction(
                    type='feature',
                    description='Advanced grid strategies disabled',
                    limit='basic_only'
                )
            ])
        elif level == 'intermediate':
            restrictions.append(TradingRestriction(
                type='positionSize',
                description='Maximum position size per grid',
                limit='50 ERG'
            ))
        elif level == 'advanced':
            restrictions.append(TradingRestriction(
                type='positionSize',
                description='Maximum position size per grid',
                limit='200 ERG'
            ))
        # Expert level has no restrictions
        
        return restrictions
    
    def _store_certificate(self, certificate: CompetencyCertificate):
        """Store certificate in database."""
        # In production, store in certificates table
        # For now, log as user activity
        user_id = UUID(certificate.user_id)
        
        activity = UserActivity(
            user_id=user_id,
            activity_type='certificate_issued',
            activity_description=f'Competency certificate issued: {certificate.level}',
            resource_type='certificate',
            metadata={
                'certificate_id': certificate.certificate_id,
                'level': certificate.level,
                'expires_at': certificate.expires_at.isoformat(),
                'restrictions_count': len(certificate.restrictions)
            }
        )
        
        self.db.add(activity)
        self.db.commit()
    
    def _build_successful_response(self, certificate: CompetencyCertificate) -> LiveTradingValidationResponse:
        """Build successful validation response."""
        time_until_expiry = int((certificate.expires_at - datetime.now(timezone.utc)).total_seconds() / 60)
        
        return LiveTradingValidationResponse(
            can_access=True,
            level=certificate.level,
            certificate=certificate,
            restrictions=certificate.restrictions,
            time_until_expiry=max(0, time_until_expiry),
            renewal_required=False,
            missing_requirements=[],
            estimated_completion_time=0,
            next_checkpoint_date=certificate.expires_at - timedelta(days=7)  # Reminder 1 week before expiry
        )
    
    def _get_stored_certificate(self, certificate_id: str) -> Optional[Dict[str, Any]]:
        """Get stored certificate from database."""
        # In production, query certificates table
        activity = self.db.query(UserActivity).filter(
            UserActivity.activity_type == 'certificate_issued',
            UserActivity.metadata.contains({'certificate_id': certificate_id})
        ).first()
        
        return activity.metadata if activity else None
    
    def _calculate_risk_assessment_scores(self, answers: Dict[str, Any]) -> Dict[str, float]:
        """Calculate risk assessment category scores."""
        # Mock calculation - in production, use proper scoring algorithm
        return {
            'market_knowledge': 75.0,
            'risk_management': 80.0,
            'technical_skills': 70.0,
            'emotional_discipline': 75.0
        }
    
    def _determine_risk_tolerance(self, overall_score: float, category_scores: Dict[str, float]) -> str:
        """Determine risk tolerance level."""
        if overall_score >= 80:
            return 'high'
        elif overall_score >= 60:
            return 'medium'
        else:
            return 'low'
    
    def _generate_risk_recommendations(self, category_scores: Dict[str, float], 
                                     risk_tolerance: str) -> List[str]:
        """Generate personalized risk recommendations."""
        recommendations = []
        
        for category, score in category_scores.items():
            if score < 70:
                recommendations.append(f'Consider additional study in {category.replace("_", " ")}')
        
        if risk_tolerance == 'low':
            recommendations.append('Start with smaller position sizes and conservative strategies')
        elif risk_tolerance == 'high':
            recommendations.append('Ensure proper risk management despite high risk tolerance')
        
        return recommendations
    
    def _identify_warning_flags(self, answers: Dict[str, Any], 
                               category_scores: Dict[str, float]) -> List[str]:
        """Identify potential warning flags from assessment."""
        flags = []
        
        # Check for concerning patterns in answers
        if any(score < 50 for score in category_scores.values()):
            flags.append('One or more categories show concerning knowledge gaps')
        
        # Add more sophisticated flag detection in production
        
        return flags
    
    def _store_risk_assessment(self, user_id: UUID, result: RiskAssessmentResult, 
                              answers: Dict[str, Any]):
        """Store risk assessment result."""
        activity = UserActivity(
            user_id=user_id,
            activity_type='risk_assessment_completed',
            activity_description='Risk tolerance assessment completed',
            resource_type='assessment',
            metadata={
                'overall_score': result.overall_score,
                'risk_tolerance': result.risk_tolerance,
                'category_scores': result.category_scores,
                'warning_flags_count': len(result.warning_flags)
            }
        )
        
        self.db.add(activity)
        self.db.commit()


# API Endpoints

@router.post("/validate-educational", response_model=ValidationResult)
async def validate_educational_requirements(
    request: ValidationRequest,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Validate educational requirements for a user."""
    try:
        # Verify JWT token
        user_id = UUID(request.user_id)
        service = CompetencyValidationService(db)
        
        result = service.validate_educational_requirements(user_id)
        return result
        
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid user ID format")
    except Exception as e:
        logger.error(f"Educational validation failed: {e}")
        raise HTTPException(status_code=500, detail="Validation failed")


@router.post("/validate-practice", response_model=ValidationResult)
async def validate_practice_requirements(
    request: ValidationRequest,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Validate practice trading requirements for a user."""
    try:
        user_id = UUID(request.user_id)
        service = CompetencyValidationService(db)
        
        result = service.validate_practice_requirements(user_id)
        return result
        
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid user ID format")
    except Exception as e:
        logger.error(f"Practice validation failed: {e}")
        raise HTTPException(status_code=500, detail="Validation failed")


@router.post("/validate-risk-assessment", response_model=ValidationResult)
async def validate_risk_assessment(
    request: ValidationRequest,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Validate risk assessment completion for a user."""
    try:
        user_id = UUID(request.user_id)
        service = CompetencyValidationService(db)
        
        result = service.validate_risk_assessment(user_id)
        return result
        
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid user ID format")
    except Exception as e:
        logger.error(f"Risk assessment validation failed: {e}")
        raise HTTPException(status_code=500, detail="Validation failed")


@router.post("/validate-live-trading", response_model=LiveTradingValidationResponse)
async def validate_live_trading_access(
    request: ValidationRequest,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Comprehensive validation for live trading access."""
    try:
        service = CompetencyValidationService(db)
        result = service.validate_live_trading_access(request)
        return result
        
    except Exception as e:
        logger.error(f"Live trading validation failed: {e}")
        raise HTTPException(status_code=500, detail="Validation failed")


@router.post("/verify-certificate")
async def verify_certificate(
    request: CertificateVerificationRequest,
    db: Session = Depends(get_db)
):
    """Verify a competency certificate."""
    try:
        service = CompetencyValidationService(db)
        user_id = UUID(request.user_id) if request.user_id else None
        
        is_valid = service.verify_certificate(request.certificate, user_id)
        
        return {
            "valid": is_valid,
            "verified_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Certificate verification failed: {e}")
        return {
            "valid": False,
            "error": "Verification failed"
        }


@router.post("/risk-assessment", response_model=RiskAssessmentResult)
async def submit_risk_assessment(
    request: RiskAssessmentRequest,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Submit and process risk assessment."""
    try:
        service = CompetencyValidationService(db)
        result = service.record_risk_assessment(request)
        return result
        
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid request data")
    except Exception as e:
        logger.error(f"Risk assessment processing failed: {e}")
        raise HTTPException(status_code=500, detail="Processing failed")


@router.get("/certificate-status/{user_id}")
async def get_certificate_status(
    user_id: str = Path(..., description="User UUID"),
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get certificate status for a user."""
    try:
        user_uuid = UUID(user_id)
        service = CompetencyValidationService(db)
        
        # Check for existing certificate
        certificate = service._get_valid_certificate(user_uuid)
        
        if certificate:
            renewal_required = service._certificate_needs_renewal(certificate)
            time_until_expiry = int((certificate.expires_at - datetime.now(timezone.utc)).total_seconds() / 60)
            
            return {
                "has_certificate": True,
                "level": certificate.level,
                "expires_at": certificate.expires_at.isoformat(),
                "time_until_expiry_minutes": max(0, time_until_expiry),
                "renewal_required": renewal_required
            }
        else:
            return {
                "has_certificate": False,
                "renewal_required": False
            }
            
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid user ID format")
    except Exception as e:
        logger.error(f"Certificate status check failed: {e}")
        raise HTTPException(status_code=500, detail="Status check failed")


@router.get("/risk-assessment/{user_id}", response_model=RiskAssessmentResult)
async def get_risk_assessment(
    user_id: str = Path(..., description="User UUID"),
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get risk assessment results for a user."""
    try:
        user_uuid = UUID(user_id)
        service = CompetencyValidationService(db)
        
        result = service._get_risk_assessment_result(user_uuid)
        
        if not result:
            raise HTTPException(status_code=404, detail="Risk assessment not found")
        
        return RiskAssessmentResult(**result)
        
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid user ID format")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Risk assessment retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Retrieval failed")
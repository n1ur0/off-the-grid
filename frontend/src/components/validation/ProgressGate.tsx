/**
 * ProgressGate - Component for displaying progress requirements and validation
 * 
 * Features:
 * - Real-time progress tracking
 * - Visual progress indicators
 * - Clear next steps guidance
 * - Interactive requirement completion
 * - Milestone celebrations
 */

'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import CompetencyValidator, { ValidationResult, ValidationError } from '@/lib/validation/CompetencyValidator';
import { useAuthStore } from '@/lib/stores/auth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';

interface ProgressGateProps {
  children?: ReactNode;
  autoValidate?: boolean;
  showCelebration?: boolean;
  onProgressUpdate?: (progress: ProgressSummary) => void;
  onRequirementsComplete?: () => void;
}

interface ProgressSummary {
  education: ValidationResult;
  practice: ValidationResult;
  riskAssessment: ValidationResult;
  overallProgress: number;
  isComplete: boolean;
  nextAction: string;
  estimatedTimeRemaining: number;
}

interface ValidationState {
  isLoading: boolean;
  education: ValidationResult | null;
  practice: ValidationResult | null;
  riskAssessment: ValidationResult | null;
  error: string | null;
  lastUpdated: Date | null;
}

const ProgressGate: React.FC<ProgressGateProps> = ({
  children,
  autoValidate = true,
  showCelebration = true,
  onProgressUpdate,
  onRequirementsComplete
}) => {
  const router = useRouter();
  const { isAuthenticated, walletAddress } = useAuthStore();
  
  const [validationState, setValidationState] = useState<ValidationState>({
    isLoading: false,
    education: null,
    practice: null,
    riskAssessment: null,
    error: null,
    lastUpdated: null
  });

  const [showCelebration, setShowCelebration] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-validate on mount and auth changes
  useEffect(() => {
    if (autoValidate && isAuthenticated && walletAddress) {
      validateAllRequirements();
      
      // Set up periodic updates (every 30 seconds)
      const interval = setInterval(() => {
        if (!validationState.isLoading) {
          validateAllRequirements();
        }
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, walletAddress, autoValidate]);

  // Check for completion and trigger callbacks
  useEffect(() => {
    if (validationState.education && validationState.practice && validationState.riskAssessment) {
      const progress = calculateProgressSummary();
      
      if (onProgressUpdate) {
        onProgressUpdate(progress);
      }
      
      if (progress.isComplete) {
        if (showCelebration && !showCelebration) {
          setShowCelebration(true);
        }
        
        if (onRequirementsComplete) {
          onRequirementsComplete();
        }
      }
    }
  }, [validationState.education, validationState.practice, validationState.riskAssessment]);

  const validateAllRequirements = async () => {
    if (!walletAddress) return;

    setValidationState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [education, practice, riskAssessment] = await Promise.all([
        CompetencyValidator.validateEducationalRequirements(walletAddress),
        CompetencyValidator.validatePracticeRequirements(walletAddress),
        CompetencyValidator.validateRiskAssessment(walletAddress)
      ]);

      setValidationState({
        isLoading: false,
        education,
        practice,
        riskAssessment,
        error: null,
        lastUpdated: new Date()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      setValidationState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await validateAllRequirements();
    setRefreshing(false);
  };

  const calculateProgressSummary = (): ProgressSummary => {
    if (!validationState.education || !validationState.practice || !validationState.riskAssessment) {
      return {
        education: validationState.education || { isValid: false, errors: [], warnings: [], nextSteps: [] },
        practice: validationState.practice || { isValid: false, errors: [], warnings: [], nextSteps: [] },
        riskAssessment: validationState.riskAssessment || { isValid: false, errors: [], warnings: [], nextSteps: [] },
        overallProgress: 0,
        isComplete: false,
        nextAction: 'Loading...',
        estimatedTimeRemaining: 0
      };
    }

    const { education, practice, riskAssessment } = validationState;
    
    // Calculate overall progress (equal weighting)
    const educationWeight = education.isValid ? 33.33 : 0;
    const practiceWeight = practice.isValid ? 33.33 : 0;
    const riskWeight = riskAssessment.isValid ? 33.34 : 0;
    const overallProgress = educationWeight + practiceWeight + riskWeight;

    const isComplete = education.isValid && practice.isValid && riskAssessment.isValid;

    // Determine next action
    let nextAction = 'Complete all requirements';
    let estimatedTimeRemaining = 0;

    if (!education.isValid) {
      nextAction = 'Complete educational modules';
      estimatedTimeRemaining += 120; // 2 hours estimated
    } else if (!practice.isValid) {
      nextAction = 'Complete practice trading sessions';
      estimatedTimeRemaining += 24 * 60; // 24 hours estimated
    } else if (!riskAssessment.isValid) {
      nextAction = 'Complete risk assessment';
      estimatedTimeRemaining += 30; // 30 minutes estimated
    } else {
      nextAction = 'Ready for certification!';
    }

    return {
      education,
      practice,
      riskAssessment,
      overallProgress: Math.round(overallProgress),
      isComplete,
      nextAction,
      estimatedTimeRemaining
    };
  };

  // Loading state
  if (validationState.isLoading && !validationState.lastUpdated) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading your progress...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (validationState.error) {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert variant="error" title="Unable to Load Progress">
          <p className="mb-4">{validationState.error}</p>
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={refreshing}>
            {refreshing ? 'Retrying...' : 'Try Again'}
          </Button>
        </Alert>
      </div>
    );
  }

  const progress = calculateProgressSummary();

  return (
    <div className="space-y-6">
      {/* Celebration Modal */}
      {showCelebration && progress.isComplete && (
        <CelebrationModal onClose={() => setShowCelebration(false)} />
      )}

      {/* Progress Overview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Trading Readiness Progress
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Complete all requirements to access live trading
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {progress.overallProgress}%
            </div>
            <Button 
              onClick={handleRefresh} 
              variant="ghost" 
              size="sm"
              disabled={refreshing || validationState.isLoading}
            >
              {refreshing || validationState.isLoading ? 'Updating...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-6">
          <div 
            className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress.overallProgress}%` }}
          />
        </div>

        {/* Next Action */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-200">
                Next Step: {progress.nextAction}
              </p>
              {progress.estimatedTimeRemaining > 0 && (
                <p className="text-sm text-blue-600 dark:text-blue-300">
                  Estimated time: {Math.ceil(progress.estimatedTimeRemaining / 60)} hours
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Requirements Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RequirementCard
            title="Education"
            description="Complete learning modules"
            validation={progress.education}
            icon="📚"
            onActionClick={() => router.push('/learn')}
          />
          
          <RequirementCard
            title="Practice Trading"
            description="Gain hands-on experience"
            validation={progress.practice}
            icon="📈"
            onActionClick={() => router.push('/learn?tab=practice')}
          />
          
          <RequirementCard
            title="Risk Assessment"
            description="Demonstrate risk understanding"
            validation={progress.riskAssessment}
            icon="📝"
            onActionClick={() => router.push('/certification?section=risk')}
          />
        </div>

        {/* Action Buttons */}
        {progress.isComplete ? (
          <div className="mt-6 text-center">
            <Button 
              onClick={() => router.push('/certification')} 
              variant="primary"
              size="lg"
            >
              Get Certified for Live Trading
            </Button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => router.push('/learn')} variant="primary">
              Continue Learning
            </Button>
            <Button onClick={() => router.push('/certification')} variant="outline">
              View Detailed Progress
            </Button>
          </div>
        )}
      </Card>

      {children}
    </div>
  );
};

// Individual requirement card component
interface RequirementCardProps {
  title: string;
  description: string;
  validation: ValidationResult;
  icon: string;
  onActionClick: () => void;
}

const RequirementCard: React.FC<RequirementCardProps> = ({
  title,
  description,
  validation,
  icon,
  onActionClick
}) => {
  const isComplete = validation.isValid;
  const criticalErrors = validation.errors.filter(e => e.severity === 'critical').length;
  const warnings = validation.warnings.length;

  return (
    <div className={`border rounded-lg p-4 transition-all ${
      isComplete 
        ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10' 
        : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          <span className="text-2xl mr-3">{icon}</span>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          </div>
        </div>
        
        {isComplete ? (
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        ) : (
          <div className="flex-shrink-0">
            <div className={`w-6 h-6 rounded-full border-2 ${
              criticalErrors > 0 
                ? 'border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-900/20' 
                : 'border-gray-300 dark:border-gray-600'
            }`} />
          </div>
        )}
      </div>

      {/* Status indicators */}
      {validation.score && (
        <div className="mb-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Score</span>
            <span className={`font-medium ${
              validation.score >= 75 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
            }`}>
              {validation.score}%
            </span>
          </div>
        </div>
      )}

      {/* Errors and warnings summary */}
      {(criticalErrors > 0 || warnings > 0) && (
        <div className="mb-3 space-y-1">
          {criticalErrors > 0 && (
            <div className="flex items-center text-sm text-red-600 dark:text-red-400">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {criticalErrors} issue{criticalErrors !== 1 ? 's' : ''}
            </div>
          )}
          
          {warnings > 0 && (
            <div className="flex items-center text-sm text-orange-600 dark:text-orange-400">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {warnings} warning{warnings !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      <Button 
        onClick={onActionClick} 
        variant={isComplete ? "outline" : "primary"} 
        size="sm" 
        className="w-full"
      >
        {isComplete ? 'Review' : 'Start'}
      </Button>
    </div>
  );
};

// Celebration modal for when all requirements are complete
interface CelebrationModalProps {
  onClose: () => void;
}

const CelebrationModal: React.FC<CelebrationModalProps> = ({ onClose }) => {
  const router = useRouter();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-mx-4 text-center">
        <div className="text-6xl mb-4">🎉</div>
        
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Congratulations!
        </h2>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          You've completed all the requirements for live trading access. 
          You're now ready to get certified!
        </p>

        <div className="flex space-x-3">
          <Button onClick={onClose} variant="outline" size="sm">
            Continue
          </Button>
          <Button 
            onClick={() => {
              onClose();
              router.push('/certification');
            }} 
            variant="primary" 
            size="sm"
          >
            Get Certified
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProgressGate;
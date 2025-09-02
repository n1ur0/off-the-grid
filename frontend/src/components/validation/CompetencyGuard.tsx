/**
 * CompetencyGuard - Route protection component for live trading features
 * 
 * Security Features:
 * - Multi-layer validation before allowing access
 * - Real-time competency status checking
 * - Graceful degradation with educational prompts
 * - Time-based validation caching to prevent abuse
 * - Progressive access based on competency level
 */

'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth';
import CompetencyValidator, { 
  LiveTradingValidationRequest, 
  LiveTradingValidationResponse, 
  CompetencyLevel,
  TradingRestriction 
} from '@/lib/validation/CompetencyValidator';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface CompetencyGuardProps {
  children: ReactNode;
  requiredLevel?: CompetencyLevel;
  requiredFeatures?: string[];
  fallback?: ReactNode;
  showProgress?: boolean;
  redirectOnFail?: string;
  allowPartialAccess?: boolean;
  onAccessDenied?: (validation: LiveTradingValidationResponse) => void;
  onAccessGranted?: (validation: LiveTradingValidationResponse) => void;
}

interface ValidationState {
  isValidating: boolean;
  hasAccess: boolean;
  validation: LiveTradingValidationResponse | null;
  error: string | null;
  lastChecked: Date | null;
}

const CompetencyGuard: React.FC<CompetencyGuardProps> = ({
  children,
  requiredLevel = 'basic',
  requiredFeatures = ['live_trading'],
  fallback,
  showProgress = true,
  redirectOnFail,
  allowPartialAccess = false,
  onAccessDenied,
  onAccessGranted
}) => {
  const router = useRouter();
  const { isAuthenticated, walletAddress } = useAuthStore();
  
  const [validationState, setValidationState] = useState<ValidationState>({
    isValidating: true,
    hasAccess: false,
    validation: null,
    error: null,
    lastChecked: null
  });

  const [showWarning, setShowWarning] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Validate competency on mount and when auth state changes
  useEffect(() => {
    if (isAuthenticated && walletAddress) {
      validateCompetency();
      
      // Set up periodic revalidation (every 5 minutes)
      const interval = setInterval(validateCompetency, 5 * 60 * 1000);
      return () => clearInterval(interval);
    } else {
      setValidationState(prev => ({
        ...prev,
        isValidating: false,
        hasAccess: false,
        validation: null,
        error: 'Authentication required'
      }));
    }
  }, [isAuthenticated, walletAddress]);

  // Show warning for restricted access if applicable
  useEffect(() => {
    if (validationState.validation && validationState.hasAccess) {
      const hasRestrictions = validationState.validation.restrictions.length > 0;
      if (hasRestrictions && !warningDismissed) {
        setShowWarning(true);
      }
    }
  }, [validationState.validation, validationState.hasAccess, warningDismissed]);

  const validateCompetency = async () => {
    if (!walletAddress) return;

    // Use cached validation if recent (< 5 minutes old)
    const cacheTimeout = 5 * 60 * 1000;
    if (validationState.lastChecked && 
        Date.now() - validationState.lastChecked.getTime() < cacheTimeout &&
        validationState.validation) {
      return;
    }

    setValidationState(prev => ({ ...prev, isValidating: true, error: null }));

    try {
      const request: LiveTradingValidationRequest = {
        userId: walletAddress, // Using wallet address as user ID
        requestedFeatures: requiredFeatures,
        certificateVersion: validationState.validation?.certificate?.version
      };

      const validation = await CompetencyValidator.validateLiveTradingAccess(request);
      
      // Check if user meets minimum requirements
      const meetsLevelRequirement = compareLevels(validation.level, requiredLevel) >= 0;
      const hasRequiredFeatures = allowPartialAccess || 
        requiredFeatures.every(feature => !hasFeatureRestriction(validation.restrictions, feature));

      const hasAccess = validation.canAccess && meetsLevelRequirement && hasRequiredFeatures;

      setValidationState({
        isValidating: false,
        hasAccess,
        validation,
        error: null,
        lastChecked: new Date()
      });

      // Trigger callbacks
      if (hasAccess && onAccessGranted) {
        onAccessGranted(validation);
      } else if (!hasAccess && onAccessDenied) {
        onAccessDenied(validation);
      }

      // Redirect if access denied and redirect path provided
      if (!hasAccess && redirectOnFail) {
        router.push(redirectOnFail);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      
      setValidationState({
        isValidating: false,
        hasAccess: false,
        validation: null,
        error: errorMessage,
        lastChecked: new Date()
      });

      if (onAccessDenied) {
        onAccessDenied({
          canAccess: false,
          level: 'restricted',
          restrictions: [],
          renewalRequired: true,
          missingRequirements: [],
          estimatedCompletionTime: 0,
          nextCheckpointDate: new Date()
        });
      }
    }
  };

  const handleRetryValidation = () => {
    // Clear cache and revalidate
    setValidationState(prev => ({
      ...prev,
      lastChecked: null
    }));
    validateCompetency();
  };

  const handleDismissWarning = () => {
    setWarningDismissed(true);
    setShowWarning(false);
  };

  // Loading state
  if (validationState.isValidating) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Validating trading competency...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (validationState.error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Alert variant="error" title="Validation Error">
          <p className="mb-4">{validationState.error}</p>
          <div className="flex space-x-3">
            <Button onClick={handleRetryValidation} variant="outline" size="sm">
              Retry Validation
            </Button>
            <Button onClick={() => router.push('/learn')} variant="primary" size="sm">
              Complete Requirements
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  // Access denied state
  if (!validationState.hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <AccessDeniedFallback 
        validation={validationState.validation}
        showProgress={showProgress}
        onRetry={handleRetryValidation}
      />
    );
  }

  // Access granted - render children with optional warning
  return (
    <>
      {showWarning && validationState.validation && (
        <div className="mb-6">
          <Alert variant="warning" title="Trading Restrictions Active">
            <div className="mb-3">
              <p>You have access to live trading with the following restrictions:</p>
              <ul className="mt-2 list-disc list-inside space-y-1">
                {validationState.validation.restrictions.map((restriction, index) => (
                  <li key={index} className="text-sm">
                    {restriction.description}: {restriction.limit}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex space-x-3">
              <Button onClick={handleDismissWarning} variant="outline" size="sm">
                I Understand
              </Button>
              <Button onClick={() => router.push('/certification')} variant="primary" size="sm">
                Upgrade Level
              </Button>
            </div>
          </Alert>
        </div>
      )}
      {children}
    </>
  );
};

// Component for access denied state
interface AccessDeniedFallbackProps {
  validation: LiveTradingValidationResponse | null;
  showProgress: boolean;
  onRetry: () => void;
}

const AccessDeniedFallback: React.FC<AccessDeniedFallbackProps> = ({
  validation,
  showProgress,
  onRetry
}) => {
  const router = useRouter();

  const missingRequirements = validation?.missingRequirements || [];
  const estimatedTime = validation?.estimatedCompletionTime || 0;
  const renewalRequired = validation?.renewalRequired || false;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Live Trading Access Required
          </h2>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {renewalRequired 
              ? 'Your trading certification has expired and needs to be renewed.'
              : 'You need to complete competency requirements before accessing live trading features.'
            }
          </p>

          {estimatedTime > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
              <p className="text-blue-800 dark:text-blue-200">
                Estimated completion time: <strong>{Math.ceil(estimatedTime / 60)} hours</strong>
              </p>
            </div>
          )}
        </div>

        {showProgress && missingRequirements.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Required Completions
            </h3>
            
            <div className="space-y-3">
              {missingRequirements.map((requirement, index) => (
                <RequirementCard key={index} requirement={requirement} />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={() => router.push('/learn')} 
            variant="primary"
            size="lg"
          >
            Start Learning
          </Button>
          
          <Button 
            onClick={() => router.push('/certification')} 
            variant="outline"
            size="lg"
          >
            View Progress
          </Button>
          
          <Button 
            onClick={onRetry} 
            variant="ghost"
            size="lg"
          >
            Refresh Status
          </Button>
        </div>
      </Card>
    </div>
  );
};

// Component for individual requirement display
interface RequirementCardProps {
  requirement: any; // CertificationRequirement
}

const RequirementCard: React.FC<RequirementCardProps> = ({ requirement }) => {
  const getIcon = () => {
    switch (requirement.type) {
      case 'education':
        return '📚';
      case 'practice':
        return '📈';
      case 'assessment':
        return '📝';
      case 'timeSpent':
        return '⏱️';
      default:
        return '✓';
    }
  };

  const getStatusColor = () => {
    return requirement.completed 
      ? 'text-green-600 dark:text-green-400' 
      : 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex-shrink-0 mr-4">
        <span className="text-2xl">{getIcon()}</span>
      </div>
      
      <div className="flex-grow">
        <h4 className="font-medium text-gray-900 dark:text-white">
          {requirement.description}
        </h4>
        
        {requirement.score !== undefined && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Score: {requirement.score}%
            {requirement.minimumScore && ` (minimum: ${requirement.minimumScore}%)`}
          </p>
        )}
      </div>
      
      <div className={`flex-shrink-0 ${getStatusColor()}`}>
        {requirement.completed ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </div>
  );
};

// Utility functions
function compareLevels(userLevel: CompetencyLevel, requiredLevel: CompetencyLevel): number {
  const levelOrder: CompetencyLevel[] = ['restricted', 'basic', 'intermediate', 'advanced', 'expert'];
  return levelOrder.indexOf(userLevel) - levelOrder.indexOf(requiredLevel);
}

function hasFeatureRestriction(restrictions: TradingRestriction[], feature: string): boolean {
  return restrictions.some(restriction => 
    restriction.type === 'feature' && 
    (restriction.limit === 'none' || restriction.limit.toString().includes(feature))
  );
}

export default CompetencyGuard;
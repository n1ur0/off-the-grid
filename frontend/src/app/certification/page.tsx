/**
 * Certification Interface Page - Complete competency validation and certification management
 * 
 * Features:
 * - Progress tracking with real-time updates
 * - Interactive requirement completion
 * - Certification generation and management
 * - Risk assessment interface
 * - Certificate verification and renewal
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth';
import CompetencyValidator, { 
  ValidationResult, 
  CompetencyCertificate,
  LiveTradingValidationResponse 
} from '@/lib/validation/CompetencyValidator';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Modal } from '@/components/ui/Modal';
import ProgressGate from '@/components/validation/ProgressGate';

interface CertificationState {
  isLoading: boolean;
  error: string | null;
  currentCertificate: CompetencyCertificate | null;
  validationResult: LiveTradingValidationResponse | null;
  showRiskAssessment: boolean;
  showCertificateGenerator: boolean;
  showCelebration: boolean;
}

interface RiskAssessmentAnswers {
  [key: string]: string | number | boolean;
}

const CertificationPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, walletAddress, isConnected } = useAuthStore();
  
  const [state, setState] = useState<CertificationState>({
    isLoading: true,
    error: null,
    currentCertificate: null,
    validationResult: null,
    showRiskAssessment: false,
    showCertificateGenerator: false,
    showCelebration: false
  });

  const [riskAssessmentAnswers, setRiskAssessmentAnswers] = useState<RiskAssessmentAnswers>({});
  const [activeTab, setActiveTab] = useState('overview');

  // Handle initial section navigation
  useEffect(() => {
    const section = searchParams.get('section');
    if (section) {
      setActiveTab(section);
    }
  }, [searchParams]);

  // Load certification status on mount
  useEffect(() => {
    if (isAuthenticated && walletAddress) {
      loadCertificationStatus();
    } else {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Please connect your wallet to access certification features' 
      }));
    }
  }, [isAuthenticated, walletAddress]);

  const loadCertificationStatus = async () => {
    if (!walletAddress) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check current certification status
      const validationRequest = {
        userId: walletAddress,
        requestedFeatures: ['live_trading']
      };

      const validationResult = await CompetencyValidator.validateLiveTradingAccess(validationRequest);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        validationResult,
        currentCertificate: validationResult.certificate || null
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load certification status';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  };

  const handleStartRiskAssessment = () => {
    setState(prev => ({ ...prev, showRiskAssessment: true }));
  };

  const handleRiskAssessmentComplete = async (answers: RiskAssessmentAnswers) => {
    if (!walletAddress) return;

    try {
      // Submit risk assessment (would call API endpoint)
      // For now, store locally and update state
      setRiskAssessmentAnswers(answers);
      setState(prev => ({ ...prev, showRiskAssessment: false }));
      
      // Reload status to reflect completion
      await loadCertificationStatus();
      
    } catch (error) {
      console.error('Risk assessment submission failed:', error);
    }
  };

  const handleGenerateCertificate = async () => {
    if (!walletAddress) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Generate certificate
      const certificate = await CompetencyValidator.generateCertification(walletAddress);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        currentCertificate: certificate,
        showCelebration: true
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Certificate generation failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  };

  const handleCertificateRenewal = async () => {
    if (!walletAddress || !state.currentCertificate) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Renew certificate with updated competency data
      const newCertificate = await CompetencyValidator.generateCertification(walletAddress);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        currentCertificate: newCertificate
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Certificate renewal failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  };

  const handleProgressComplete = () => {
    setState(prev => ({ ...prev, showCertificateGenerator: true }));
  };

  // Loading state
  if (state.isLoading && !state.validationResult) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Loading certification status...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="error" title="Unable to Load Certification">
          <p className="mb-4">{state.error}</p>
          <div className="flex space-x-3">
            <Button onClick={loadCertificationStatus} variant="outline" size="sm">
              Try Again
            </Button>
            {!isConnected && (
              <Button onClick={() => router.push('/auth')} variant="primary" size="sm">
                Connect Wallet
              </Button>
            )}
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Trading Certification
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Complete your competency validation to access live trading features
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'progress', label: 'Progress', icon: '📈' },
            { id: 'risk', label: 'Risk Assessment', icon: '📝' },
            { id: 'certificate', label: 'Certificate', icon: '🏆' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <CertificationOverview
          validationResult={state.validationResult}
          currentCertificate={state.currentCertificate}
          onStartAssessment={handleStartRiskAssessment}
          onRenewCertificate={handleCertificateRenewal}
        />
      )}

      {activeTab === 'progress' && (
        <ProgressGate
          onRequirementsComplete={handleProgressComplete}
          showCelebration={true}
        />
      )}

      {activeTab === 'risk' && (
        <RiskAssessmentSection
          onStartAssessment={handleStartRiskAssessment}
          hasCompleted={Object.keys(riskAssessmentAnswers).length > 0}
        />
      )}

      {activeTab === 'certificate' && (
        <CertificateSection
          certificate={state.currentCertificate}
          validationResult={state.validationResult}
          onGenerateCertificate={handleGenerateCertificate}
          onRenewCertificate={handleCertificateRenewal}
          isLoading={state.isLoading}
        />
      )}

      {/* Risk Assessment Modal */}
      {state.showRiskAssessment && (
        <RiskAssessmentModal
          onComplete={handleRiskAssessmentComplete}
          onClose={() => setState(prev => ({ ...prev, showRiskAssessment: false }))}
        />
      )}

      {/* Certificate Generation Modal */}
      {state.showCertificateGenerator && (
        <CertificateGeneratorModal
          onGenerate={handleGenerateCertificate}
          onClose={() => setState(prev => ({ ...prev, showCertificateGenerator: false }))}
          isLoading={state.isLoading}
        />
      )}

      {/* Success Celebration Modal */}
      {state.showCelebration && state.currentCertificate && (
        <CertificateCelebrationModal
          certificate={state.currentCertificate}
          onClose={() => setState(prev => ({ ...prev, showCelebration: false }))}
        />
      )}
    </div>
  );
};

// Component for certification overview
interface CertificationOverviewProps {
  validationResult: LiveTradingValidationResponse | null;
  currentCertificate: CompetencyCertificate | null;
  onStartAssessment: () => void;
  onRenewCertificate: () => void;
}

const CertificationOverview: React.FC<CertificationOverviewProps> = ({
  validationResult,
  currentCertificate,
  onStartAssessment,
  onRenewCertificate
}) => {
  const router = useRouter();

  if (!validationResult) {
    return (
      <div className="text-center py-12">
        <LoadingSpinner />
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Loading certification overview...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Current Status
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Your live trading access level
            </p>
          </div>
          
          <div className="text-right">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              validationResult.canAccess
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {validationResult.canAccess ? '✓ Certified' : '⚠ Not Certified'}
            </div>
            
            <div className="text-lg font-bold text-gray-900 dark:text-white mt-1 capitalize">
              {validationResult.level}
            </div>
          </div>
        </div>

        {/* Restrictions */}
        {validationResult.restrictions.length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Current Restrictions
            </h4>
            <ul className="space-y-1">
              {validationResult.restrictions.map((restriction, index) => (
                <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                  <span className="w-2 h-2 bg-orange-400 rounded-full mr-2" />
                  {restriction.description}: {restriction.limit}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-3">
          {!validationResult.canAccess ? (
            <Button onClick={() => router.push('/learn')} variant="primary">
              Complete Requirements
            </Button>
          ) : currentCertificate && validationResult.renewalRequired ? (
            <Button onClick={onRenewCertificate} variant="primary">
              Renew Certificate
            </Button>
          ) : (
            <Button onClick={() => router.push('/trade')} variant="primary">
              Start Trading
            </Button>
          )}
          
          <Button onClick={onStartAssessment} variant="outline">
            Retake Risk Assessment
          </Button>
        </div>
      </Card>

      {/* Missing Requirements */}
      {validationResult.missingRequirements.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Missing Requirements
          </h3>
          
          <div className="space-y-3">
            {validationResult.missingRequirements.map((requirement, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {requirement.description}
                    </p>
                    {requirement.minimumScore && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Minimum score: {requirement.minimumScore}%
                      </p>
                    )}
                  </div>
                </div>
                
                <Button 
                  onClick={() => {
                    if (requirement.type === 'education') router.push('/learn');
                    else if (requirement.type === 'practice') router.push('/learn?tab=practice');
                    else if (requirement.type === 'assessment') onStartAssessment();
                  }}
                  size="sm"
                  variant="outline"
                >
                  Complete
                </Button>
              </div>
            ))}
          </div>
          
          {validationResult.estimatedCompletionTime > 0 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Estimated completion time: <strong>{Math.ceil(validationResult.estimatedCompletionTime / 60)} hours</strong>
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

// Risk Assessment Section Component
interface RiskAssessmentSectionProps {
  onStartAssessment: () => void;
  hasCompleted: boolean;
}

const RiskAssessmentSection: React.FC<RiskAssessmentSectionProps> = ({
  onStartAssessment,
  hasCompleted
}) => {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">📝</span>
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Risk Tolerance Assessment
          </h3>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {hasCompleted 
              ? 'You have completed the risk assessment. You can retake it to update your profile.'
              : 'Complete our comprehensive risk assessment to understand your trading profile and ensure appropriate safety measures.'
            }
          </p>
          
          {hasCompleted && (
            <div className="mb-6">
              <div className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded-full text-sm font-medium">
                ✓ Assessment Completed
              </div>
            </div>
          )}
          
          <Button onClick={onStartAssessment} variant="primary" size="lg">
            {hasCompleted ? 'Retake Assessment' : 'Start Assessment'}
          </Button>
        </div>
      </Card>
      
      {/* Assessment Info */}
      <Card className="p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
          What the Assessment Covers
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { title: 'Market Knowledge', description: 'Understanding of trading concepts and market dynamics' },
            { title: 'Risk Management', description: 'Ability to manage and mitigate trading risks' },
            { title: 'Technical Skills', description: 'Proficiency with trading tools and analysis' },
            { title: 'Emotional Discipline', description: 'Psychological readiness for trading decisions' }
          ].map((category, index) => (
            <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
              <h5 className="font-medium text-gray-900 dark:text-white mb-1">
                {category.title}
              </h5>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {category.description}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// Certificate Section Component
interface CertificateSectionProps {
  certificate: CompetencyCertificate | null;
  validationResult: LiveTradingValidationResponse | null;
  onGenerateCertificate: () => void;
  onRenewCertificate: () => void;
  isLoading: boolean;
}

const CertificateSection: React.FC<CertificateSectionProps> = ({
  certificate,
  validationResult,
  onGenerateCertificate,
  onRenewCertificate,
  isLoading
}) => {
  if (!certificate) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-2xl">🏆</span>
          </div>
          
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Certificate Yet
          </h3>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Complete all requirements to generate your trading competency certificate.
          </p>
          
          {validationResult?.canAccess ? (
            <Button 
              onClick={onGenerateCertificate} 
              variant="primary" 
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? 'Generating...' : 'Generate Certificate'}
            </Button>
          ) : (
            <Button 
              onClick={() => window.location.href = '/learn'} 
              variant="outline" 
              size="lg"
            >
              Complete Requirements
            </Button>
          )}
        </Card>
      </div>
    );
  }

  const timeUntilExpiry = validationResult?.timeUntilExpiry || 0;
  const daysUntilExpiry = Math.ceil(timeUntilExpiry / (60 * 24));

  return (
    <div className="space-y-6">
      {/* Certificate Display */}
      <Card className="p-6 bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-primary-200 dark:border-primary-800">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center">
            <span className="text-3xl">🏆</span>
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Trading Competency Certificate
          </h3>
          
          <div className="inline-flex items-center px-4 py-2 bg-primary-100 dark:bg-primary-900/40 rounded-full text-primary-800 dark:text-primary-200 font-medium mb-4">
            Level: {certificate.level.charAt(0).toUpperCase() + certificate.level.slice(1)}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Issued</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {certificate.issuedAt.toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Expires</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {certificate.expiresAt.toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Certificate ID</p>
              <p className="font-mono text-xs text-gray-900 dark:text-white">
                {certificate.certificateId.slice(0, 16)}...
              </p>
            </div>
          </div>
          
          {/* Expiry Warning */}
          {daysUntilExpiry < 30 && (
            <Alert variant="warning" className="mb-4">
              <p>Certificate expires in {daysUntilExpiry} days. Consider renewing soon.</p>
            </Alert>
          )}
          
          <div className="flex space-x-3 justify-center">
            <Button onClick={onRenewCertificate} variant="primary" disabled={isLoading}>
              {isLoading ? 'Renewing...' : 'Renew Certificate'}
            </Button>
            <Button variant="outline">
              Download Certificate
            </Button>
          </div>
        </div>
      </Card>
      
      {/* Certificate Requirements */}
      <Card className="p-6">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          Certificate Requirements Met
        </h4>
        
        <div className="space-y-3">
          {certificate.requirements.map((requirement, index) => (
            <div key={index} className="flex items-center p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
              <div className="w-6 h-6 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              
              <div className="flex-grow">
                <p className="font-medium text-gray-900 dark:text-white">
                  {requirement.description}
                </p>
                {requirement.score && (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Score: {requirement.score}%
                  </p>
                )}
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {requirement.completedAt?.toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// Placeholder components for modals (would be implemented separately)
const RiskAssessmentModal = ({ onComplete, onClose }: any) => (
  <Modal open={true} onClose={onClose}>
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4">Risk Assessment</h3>
      <p className="mb-4">Risk assessment interface would be implemented here.</p>
      <div className="flex space-x-3">
        <Button onClick={() => onComplete({})} variant="primary">
          Complete Assessment
        </Button>
        <Button onClick={onClose} variant="outline">
          Cancel
        </Button>
      </div>
    </div>
  </Modal>
);

const CertificateGeneratorModal = ({ onGenerate, onClose, isLoading }: any) => (
  <Modal open={true} onClose={onClose}>
    <div className="p-6">
      <h3 className="text-lg font-semibold mb-4">Generate Certificate</h3>
      <p className="mb-4">Ready to generate your trading competency certificate?</p>
      <div className="flex space-x-3">
        <Button onClick={onGenerate} variant="primary" disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate'}
        </Button>
        <Button onClick={onClose} variant="outline">
          Cancel
        </Button>
      </div>
    </div>
  </Modal>
);

const CertificateCelebrationModal = ({ certificate, onClose }: any) => (
  <Modal open={true} onClose={onClose}>
    <div className="p-6 text-center">
      <div className="text-6xl mb-4">🎉</div>
      <h3 className="text-2xl font-bold mb-2">Certificate Generated!</h3>
      <p className="mb-4">Your trading competency certificate has been successfully generated.</p>
      <Button onClick={onClose} variant="primary">
        Continue
      </Button>
    </div>
  </Modal>
);

export default CertificationPage;
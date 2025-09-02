'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlayIcon, 
  PauseIcon, 
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  BookOpenIcon,
  GlobeAltIcon,
  FireIcon
} from '@heroicons/react/24/outline';
import { InteractiveGrid } from './InteractiveGrid';
import { useEducationStore } from '../../lib/stores/education';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  scenario: ScenarioConfig;
  objectives: string[];
  tips: string[];
  expectedOutcome: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
}

interface ScenarioConfig {
  id: string;
  name: string;
  description: string;
  pricePattern: 'trending-up' | 'trending-down' | 'sideways' | 'volatile' | 'breakout';
  initialPrice: number;
  priceRange: [number, number];
  gridCount: number;
  volatility: number;
  duration: number;
}

interface GridScenarioTutorialProps {
  onComplete?: (results: TutorialResults) => void;
  startingLevel?: 'beginner' | 'intermediate' | 'advanced';
  enableProgress?: boolean;
}

interface TutorialResults {
  completedSteps: number;
  totalProfit: number;
  successRate: number;
  timeSpent: number;
  achievements: string[];
}

const TUTORIAL_SCENARIOS: TutorialStep[] = [
  {
    id: 'basic-sideways',
    title: 'Grid Trading Basics',
    description: 'Learn the fundamentals with a perfect sideways market where price oscillates within your range.',
    scenario: {
      id: 'basic-sideways',
      name: 'Perfect Sideways Market',
      description: 'Price moves cleanly within range',
      pricePattern: 'sideways',
      initialPrice: 1.0,
      priceRange: [0.85, 1.15],
      gridCount: 8,
      volatility: 0.008,
      duration: 60
    },
    objectives: [
      'Watch buy orders fill when price drops',
      'See sell orders execute when price rises',
      'Understand how profits accumulate',
      'Learn to read the profit zones'
    ],
    tips: [
      'Grid trading works best when price stays within your range',
      'Each completed buy-sell cycle generates profit',
      'The more price oscillates, the more profits you make'
    ],
    expectedOutcome: 'Multiple profitable trades as price bounces between grid levels',
    difficulty: 'beginner',
    duration: 3
  },
  {
    id: 'trending-market',
    title: 'Handling Trending Markets',
    description: 'Experience what happens when price trends upward through your grid range.',
    scenario: {
      id: 'trending-up',
      name: 'Bull Market Trend',
      description: 'Price gradually rises through grid',
      pricePattern: 'trending-up',
      initialPrice: 1.0,
      priceRange: [0.9, 1.2],
      gridCount: 10,
      volatility: 0.012,
      duration: 50
    },
    objectives: [
      'Observe sell orders filling as price rises',
      'Notice reduced buying opportunities',
      'Understand trend vs grid performance',
      'Learn when to adjust your strategy'
    ],
    tips: [
      'Trending markets can leave you with less of the appreciating asset',
      'Consider wider ranges for trending markets',
      'Monitor for potential range adjustments'
    ],
    expectedOutcome: 'Profits from sell orders but missing upside gains',
    difficulty: 'intermediate',
    duration: 4
  },
  {
    id: 'high-volatility',
    title: 'High Volatility Mastery',
    description: 'Navigate extreme price swings that can rapidly fill multiple grid levels.',
    scenario: {
      id: 'volatile',
      name: 'Market Chaos',
      description: 'Extreme price volatility',
      pricePattern: 'volatile',
      initialPrice: 1.0,
      priceRange: [0.8, 1.3],
      gridCount: 12,
      volatility: 0.025,
      duration: 40
    },
    objectives: [
      'Handle rapid order fills',
      'Manage risk in volatile conditions',
      'Maximize profits from large swings',
      'Learn volatility management techniques'
    ],
    tips: [
      'High volatility can fill many orders quickly',
      'Wider grids help manage large price swings',
      'Risk management becomes critical'
    ],
    expectedOutcome: 'High profit potential but increased risk exposure',
    difficulty: 'advanced',
    duration: 5
  },
  {
    id: 'breakout-scenario',
    title: 'Breakout Risk Management',
    description: 'Learn to handle the worst-case scenario when price breaks out of your range.',
    scenario: {
      id: 'breakout',
      name: 'Range Breakout',
      description: 'Price escapes the grid range',
      pricePattern: 'breakout',
      initialPrice: 1.0,
      priceRange: [0.9, 1.1],
      gridCount: 8,
      volatility: 0.018,
      duration: 45
    },
    objectives: [
      'Understand breakout risks',
      'Learn damage limitation strategies',
      'Practice risk assessment',
      'Plan for range adjustments'
    ],
    tips: [
      'Breakouts are the main risk in grid trading',
      'Wider initial ranges help prevent breakouts',
      'Have a plan for when breakouts occur'
    ],
    expectedOutcome: 'Experience losses but learn critical risk management',
    difficulty: 'advanced',
    duration: 6
  },
  {
    id: 'bear-market',
    title: 'Bear Market Navigation',
    description: 'Master grid trading during sustained downward price movement.',
    scenario: {
      id: 'trending-down',
      name: 'Bear Market Decline',
      description: 'Sustained price decline',
      pricePattern: 'trending-down',
      initialPrice: 1.0,
      priceRange: [0.7, 1.0],
      gridCount: 10,
      volatility: 0.015,
      duration: 55
    },
    objectives: [
      'Accumulate assets at lower prices',
      'Understand dollar-cost averaging effects',
      'Learn position management in downtrends',
      'Practice patience in declining markets'
    ],
    tips: [
      'Bear markets let you accumulate more assets',
      'Grid trading provides natural dollar-cost averaging',
      'Be prepared for unrealized losses during trends'
    ],
    expectedOutcome: 'Asset accumulation but temporary unrealized losses',
    difficulty: 'intermediate',
    duration: 4
  },
  {
    id: 'optimization-challenge',
    title: 'Grid Optimization Challenge',
    description: 'Apply all your knowledge to optimize grid parameters for maximum profitability.',
    scenario: {
      id: 'mixed-conditions',
      name: 'Mixed Market Conditions',
      description: 'Complex market with multiple phases',
      pricePattern: 'volatile',
      initialPrice: 1.0,
      priceRange: [0.8, 1.25],
      gridCount: 15,
      volatility: 0.02,
      duration: 70
    },
    objectives: [
      'Optimize grid spacing',
      'Balance risk and reward',
      'Adapt to changing conditions',
      'Maximize total returns'
    ],
    tips: [
      'Consider market phases when setting parameters',
      'Dynamic adjustment may be necessary',
      'Risk management is as important as profit maximization'
    ],
    expectedOutcome: 'Test your mastery with complex market conditions',
    difficulty: 'advanced',
    duration: 8
  }
];

export function GridScenarioTutorial({
  onComplete,
  startingLevel = 'beginner',
  enableProgress = true
}: GridScenarioTutorialProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepResults, setStepResults] = useState<{ [stepId: string]: any }>({});
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [completedObjectives, setCompletedObjectives] = useState<Set<string>>(new Set());
  const [achievements, setAchievements] = useState<string[]>([]);
  
  const educationStore = useEducationStore();
  
  // Filter scenarios based on starting level
  const availableScenarios = useMemo(() => {
    if (startingLevel === 'beginner') return TUTORIAL_SCENARIOS;
    if (startingLevel === 'intermediate') return TUTORIAL_SCENARIOS.filter(s => s.difficulty !== 'beginner');
    return TUTORIAL_SCENARIOS.filter(s => s.difficulty === 'advanced');
  }, [startingLevel]);
  
  const currentStep = availableScenarios[currentStepIndex];
  const isLastStep = currentStepIndex === availableScenarios.length - 1;
  
  // Handle step progression
  const handleNextStep = useCallback(() => {
    if (isLastStep) {
      // Calculate final results
      const totalProfit = Object.values(stepResults).reduce((sum: number, result: any) => 
        sum + (result?.totalProfit || 0), 0
      );
      const completedSteps = Object.keys(stepResults).length;
      const successRate = completedSteps / availableScenarios.length;
      const timeSpent = startTime ? (Date.now() - startTime.getTime()) / 1000 : 0;
      
      const results: TutorialResults = {
        completedSteps,
        totalProfit,
        successRate,
        timeSpent,
        achievements
      };
      
      onComplete?.(results);
      
      // Update education store
      if (enableProgress) {
        educationStore.completeLesson('grid-trading', 'scenario-tutorial', timeSpent);
      }
    } else {
      setCurrentStepIndex(prev => prev + 1);
      setCompletedObjectives(new Set());
      setShowHint(false);
      setIsPlaying(false);
    }
  }, [isLastStep, stepResults, availableScenarios.length, achievements, startTime, onComplete, enableProgress, educationStore]);
  
  const handlePrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
      setCompletedObjectives(new Set());
      setShowHint(false);
      setIsPlaying(false);
    }
  }, [currentStepIndex]);
  
  // Initialize step timer
  useEffect(() => {
    if (!startTime) {
      setStartTime(new Date());
    }
  }, [startTime]);
  
  // Handle order fills to track objectives
  const handleOrderFilled = useCallback((order: any) => {
    const step = currentStep;
    if (!step) return;
    
    // Check if objectives are met
    const newCompletedObjectives = new Set(completedObjectives);
    
    // Simple objective tracking based on order type and step
    if (order.type === 'buy' && step.objectives.some(obj => obj.includes('buy orders'))) {
      newCompletedObjectives.add('buy-order-filled');
    }
    if (order.type === 'sell' && step.objectives.some(obj => obj.includes('sell orders'))) {
      newCompletedObjectives.add('sell-order-filled');
    }
    if (order.profit && order.profit > 0) {
      newCompletedObjectives.add('profit-generated');
    }
    
    setCompletedObjectives(newCompletedObjectives);
    
    // Update step results
    setStepResults(prev => ({
      ...prev,
      [step.id]: {
        ...prev[step.id],
        ordersFilled: (prev[step.id]?.ordersFilled || 0) + 1,
        totalProfit: (prev[step.id]?.totalProfit || 0) + (order.profit || 0)
      }
    }));
    
    // Check for achievements
    if (!achievements.includes('first-order') && newCompletedObjectives.size > 0) {
      setAchievements(prev => [...prev, 'first-order']);
    }
  }, [currentStep, completedObjectives, achievements]);
  
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };
  
  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return <BookOpenIcon className="h-4 w-4" />;
      case 'intermediate': return <GlobeAltIcon className="h-4 w-4" />;
      case 'advanced': return <FireIcon className="h-4 w-4" />;
      default: return <ChartBarIcon className="h-4 w-4" />;
    }
  };
  
  if (!currentStep) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">No scenarios available for your level.</p>
      </div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-6"
    >
      {/* Tutorial Header */}
      <motion.div
        className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white p-6"
        layoutId="tutorial-header"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <motion.div
              className="p-2 bg-white bg-opacity-20 rounded-lg"
              whileHover={{ scale: 1.05 }}
            >
              {getDifficultyIcon(currentStep.difficulty)}
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold">{currentStep.title}</h1>
              <p className="text-blue-100">{currentStep.description}</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(currentStep.difficulty)} bg-white`}>
              {getDifficultyIcon(currentStep.difficulty)}
              <span>{currentStep.difficulty}</span>
            </div>
            <div className="text-sm text-blue-100 mt-2">
              Step {currentStepIndex + 1} of {availableScenarios.length}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-blue-500 bg-opacity-30 rounded-full h-2">
          <motion.div
            className="bg-white h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStepIndex + 1) / availableScenarios.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </motion.div>
      
      {/* Tutorial Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Sidebar - Objectives and Tips */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="xl:col-span-1 space-y-4"
        >
          {/* Learning Objectives */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
              <CheckIcon className="h-5 w-5 text-green-500" />
              <span>Objectives</span>
            </h3>
            
            <div className="space-y-2">
              {currentStep.objectives.map((objective, index) => {
                const isCompleted = completedObjectives.has(`objective-${index}`) || 
                                   completedObjectives.size > index;
                
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex items-start space-x-3 p-2 rounded-lg transition-all duration-200 ${
                      isCompleted 
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' 
                        : 'bg-gray-50 dark:bg-gray-700 border border-transparent'
                    }`}
                  >
                    <motion.div
                      className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isCompleted 
                          ? 'bg-green-500 border-green-500' 
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      animate={{
                        scale: isCompleted ? [1, 1.2, 1] : 1,
                        backgroundColor: isCompleted ? '#10b981' : 'transparent'
                      }}
                    >
                      {isCompleted && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                        >
                          <CheckIcon className="h-3 w-3 text-white" />
                        </motion.div>
                      )}
                    </motion.div>
                    <span className={`text-sm ${
                      isCompleted 
                        ? 'text-green-800 dark:text-green-300 font-medium' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {objective}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
          
          {/* Tips */}
          <motion.div
            className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-700 p-4"
            whileHover={{ scale: 1.02 }}
          >
            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-3 flex items-center space-x-2">
              <LightBulbIcon className="h-5 w-5" />
              <span>Pro Tips</span>
            </h3>
            
            <AnimatePresence mode="wait">
              {!showHint ? (
                <motion.button
                  key="show-hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowHint(true)}
                  className="text-sm text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100 underline"
                >
                  Click to reveal helpful tips
                </motion.button>
              ) : (
                <motion.div
                  key="hints"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2"
                >
                  {currentStep.tips.map((tip, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="text-sm text-yellow-800 dark:text-yellow-300 flex items-start space-x-2"
                    >
                      <span className="font-bold mt-0.5">•</span>
                      <span>{tip}</span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          {/* Expected Outcome */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700 p-4">
            <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center space-x-2">
              <ChartBarIcon className="h-5 w-5" />
              <span>Expected Outcome</span>
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {currentStep.expectedOutcome}
            </p>
          </div>
        </motion.div>
        
        {/* Main Content - Interactive Grid */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="xl:col-span-3"
        >
          <InteractiveGrid
            initialPrice={currentStep.scenario.initialPrice}
            priceRange={currentStep.scenario.priceRange}
            gridCount={currentStep.scenario.gridCount}
            onOrderFilled={handleOrderFilled}
            showAdvancedControls={currentStep.difficulty !== 'beginner'}
            enableDragInteraction={true}
            educationMode={true}
            scenario={currentStep.scenario}
          />
        </motion.div>
      </div>
      
      {/* Tutorial Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePrevStep}
              disabled={currentStepIndex === 0}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span>Previous</span>
            </motion.button>
            
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Estimated time: {currentStep.duration} minutes
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {completedObjectives.size} of {currentStep.objectives.length} objectives completed
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNextStep}
              className="flex items-center space-x-2 px-6 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <span>{isLastStep ? 'Complete Tutorial' : 'Next Step'}</span>
              <ArrowRightIcon className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
      </motion.div>
      
      {/* Achievements Toast */}
      <AnimatePresence>
        {achievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.8 }}
            className="fixed bottom-6 right-6 bg-green-500 text-white rounded-xl shadow-2xl p-4 max-w-sm z-50"
          >
            <div className="flex items-center space-x-3">
              <ShieldCheckIcon className="h-6 w-6" />
              <div>
                <div className="font-semibold">Achievement Unlocked!</div>
                <div className="text-sm opacity-90">
                  {achievements[achievements.length - 1] === 'first-order' 
                    ? 'First Order Filled' 
                    : 'New Achievement'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Export types for external use
export type { TutorialResults, ScenarioConfig };
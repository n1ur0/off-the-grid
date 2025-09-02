'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AcademicCapIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  LightBulbIcon,
  FireIcon,
  SparklesIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';

import { InteractiveGrid } from './InteractiveGrid';
import { RiskVisualization } from './RiskVisualization';
import { PriceRangeSelector } from './PriceRangeSelector';
import { GridScenarioTutorial } from './GridScenarioTutorial';
import { MobileGridControls } from './MobileGridControls';
import { useEducationStore } from '../../lib/stores/education';

interface WorkshopSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  component: React.ReactNode;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;
}

interface GridTradingWorkshopProps {
  initialSection?: string;
  showProgress?: boolean;
  enableMobileControls?: boolean;
}

export function GridTradingWorkshop({
  initialSection = 'interactive-basics',
  showProgress = true,
  enableMobileControls = true
}: GridTradingWorkshopProps) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [workshopProgress, setWorkshopProgress] = useState(0);
  const [startTime] = useState(new Date());
  const [insights, setInsights] = useState<any[]>([]);
  
  // Grid parameters state for consistency across components
  const [gridParams, setGridParams] = useState({
    initialPrice: 1.0,
    priceRange: [0.85, 1.15] as [number, number],
    gridCount: 10,
    currentPrice: 1.0,
    simulationSpeed: 1,
    isSimulating: false,
    totalProfit: 0,
    filledOrders: 0
  });
  
  const educationStore = useEducationStore();
  
  // Handle educational insights from components
  const handleInsight = useCallback((insight: any) => {
    setInsights(prev => [...prev.slice(-4), insight]); // Keep last 5 insights
  }, []);
  
  // Handle section completion
  const handleSectionComplete = useCallback((sectionId: string) => {
    setCompletedSections(prev => {
      const newSet = new Set(prev);
      newSet.add(sectionId);
      
      // Update progress
      const progress = (newSet.size / workshopSections.length) * 100;
      setWorkshopProgress(progress);
      
      // Update education store
      const timeSpent = (Date.now() - startTime.getTime()) / 1000;
      educationStore.updateLessonProgress('grid-trading', 'workshop', timeSpent);
      
      return newSet;
    });
  }, [educationStore, startTime]);
  
  // Workshop sections configuration
  const workshopSections: WorkshopSection[] = [
    {
      id: 'interactive-basics',
      title: 'Interactive Grid Basics',
      description: 'Learn grid trading fundamentals with hands-on interaction',
      icon: ChartBarIcon,
      difficulty: 'beginner',
      estimatedTime: 5,
      component: (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
            <div className="flex items-center space-x-3 mb-4">
              <LightBulbIcon className="h-6 w-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-300">
                Grid Trading Fundamentals
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700 dark:text-blue-300">
              <div>
                <h4 className="font-medium mb-2">How It Works:</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Place buy orders below current price</li>
                  <li>Place sell orders above current price</li>
                  <li>Profit from each completed buy-sell cycle</li>
                  <li>Works best in ranging markets</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Key Benefits:</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Automated execution</li>
                  <li>Profit from volatility</li>
                  <li>No market direction prediction needed</li>
                  <li>Consistent income in range-bound markets</li>
                </ul>
              </div>
            </div>
          </div>
          
          <InteractiveGrid
            initialPrice={gridParams.initialPrice}
            priceRange={gridParams.priceRange}
            gridCount={gridParams.gridCount}
            onOrderFilled={(order) => {
              setGridParams(prev => ({
                ...prev,
                totalProfit: prev.totalProfit + (order.profit || 0),
                filledOrders: prev.filledOrders + 1
              }));
            }}
            showAdvancedControls={false}
            enableDragInteraction={true}
            educationMode={true}
            onInsight={handleInsight}
          />
        </div>
      )
    },
    {
      id: 'price-range-selection',
      title: 'Price Range Optimization',
      description: 'Master the art of selecting optimal price ranges for your grids',
      icon: CurrencyDollarIcon,
      difficulty: 'intermediate',
      estimatedTime: 7,
      component: (
        <div className="space-y-6">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-200 dark:border-green-700">
            <div className="flex items-center space-x-3 mb-4">
              <SparklesIcon className="h-6 w-6 text-green-600" />
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">
                Range Selection Strategy
              </h3>
            </div>
            <div className="text-sm text-green-700 dark:text-green-300 space-y-3">
              <p>
                <strong>The key to successful grid trading is choosing the right price range.</strong> 
                Too narrow and you risk breakouts; too wide and you miss trading opportunities.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-600">
                  <h4 className="font-medium text-gray-900 dark:text-white">Conservative</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Wide ranges based on long-term support/resistance
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-600">
                  <h4 className="font-medium text-gray-900 dark:text-white">Balanced</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Medium ranges with statistical analysis
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-600">
                  <h4 className="font-medium text-gray-900 dark:text-white">Aggressive</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Tight ranges for maximum trading frequency
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <PriceRangeSelector
            currentPrice={gridParams.currentPrice}
            onRangeSelected={(min, max) => {
              setGridParams(prev => ({ ...prev, priceRange: [min, max] }));
            }}
            enableRecommendations={true}
            showEducationalTips={true}
          />
        </div>
      )
    },
    {
      id: 'risk-assessment',
      title: 'Risk Management & Analysis',
      description: 'Understand and manage the risks associated with grid trading',
      icon: ShieldCheckIcon,
      difficulty: 'advanced',
      estimatedTime: 10,
      component: (
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6 border border-red-200 dark:border-red-700">
            <div className="flex items-center space-x-3 mb-4">
              <ShieldCheckIcon className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-300">
                Understanding Grid Trading Risks
              </h3>
            </div>
            <div className="text-sm text-red-700 dark:text-red-300 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Primary Risks:</h4>
                  <ul className="space-y-1 list-disc list-inside">
                    <li><strong>Breakout Risk:</strong> Price moves outside your range</li>
                    <li><strong>Trend Risk:</strong> Sustained directional movement</li>
                    <li><strong>Volatility Risk:</strong> Extreme price swings</li>
                    <li><strong>Opportunity Cost:</strong> Missing trend profits</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Risk Mitigation:</h4>
                  <ul className="space-y-1 list-disc list-inside">
                    <li><strong>Position Sizing:</strong> Never risk more than 5-10%</li>
                    <li><strong>Stop Losses:</strong> Set maximum acceptable losses</li>
                    <li><strong>Range Selection:</strong> Use statistical analysis</li>
                    <li><strong>Diversification:</strong> Multiple grids/timeframes</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <RiskVisualization
            portfolioValue={10000}
            gridAllocation={30}
            riskTolerance="moderate"
            onRiskParametersChange={(params) => {
              console.log('Risk parameters updated:', params);
            }}
            enableInteractiveScenarios={true}
          />
        </div>
      )
    },
    {
      id: 'scenario-training',
      title: 'Scenario-Based Training',
      description: 'Practice with different market scenarios to master grid trading',
      icon: FireIcon,
      difficulty: 'advanced',
      estimatedTime: 15,
      component: (
        <div className="space-y-6">
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-700">
            <div className="flex items-center space-x-3 mb-4">
              <FireIcon className="h-6 w-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-300">
                Master Different Market Conditions
              </h3>
            </div>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Experience how grid trading performs across various market scenarios. 
              Each scenario teaches different aspects of grid trading strategy and risk management.
            </p>
          </div>
          
          <GridScenarioTutorial
            startingLevel="beginner"
            onComplete={(results) => {
              console.log('Tutorial completed:', results);
              handleSectionComplete('scenario-training');
            }}
            enableProgress={true}
          />
        </div>
      )
    }
  ];
  
  const currentSection = workshopSections.find(section => section.id === activeSection);
  
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-300';
      case 'intermediate': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'advanced': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Workshop Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl text-white p-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center space-x-3">
              <AcademicCapIcon className="h-8 w-8" />
              <span>Grid Trading Workshop</span>
            </h1>
            <p className="text-xl opacity-90">
              Master sophisticated grid trading through interactive learning
            </p>
          </div>
          
          {showProgress && (
            <div className="text-right">
              <div className="flex items-center space-x-2 mb-2">
                <TrophyIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Progress</span>
              </div>
              <div className="w-32 bg-white bg-opacity-20 rounded-full h-3 mb-1">
                <motion.div
                  className="bg-white h-3 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${workshopProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="text-sm opacity-75">
                {completedSections.size} of {workshopSections.length} completed
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1 space-y-3"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Workshop Sections
          </h2>
          
          {workshopSections.map((section, index) => {
            const isActive = section.id === activeSection;
            const isCompleted = completedSections.has(section.id);
            const IconComponent = section.icon;
            
            return (
              <motion.button
                key={section.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveSection(section.id)}
                className={`w-full p-4 rounded-xl text-left transition-all duration-200 border ${
                  isActive
                    ? 'bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-600'
                    : isCompleted
                    ? 'bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-700 dark:hover:bg-green-900/30'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`p-2 rounded-lg ${
                    isActive 
                      ? 'bg-blue-500 text-white'
                      : isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                  }`}>
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                      {section.title}
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${getDifficultyColor(section.difficulty)}`}>
                        {section.difficulty}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ~{section.estimatedTime}min
                      </span>
                    </div>
                  </div>
                  {isCompleted && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
                    >
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </motion.div>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                  {section.description}
                </p>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Main Content */}
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3"
        >
          {currentSection && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {currentSection.title}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {currentSection.description}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSectionComplete(currentSection.id)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    Mark Complete
                  </button>
                </div>
                
                {currentSection.component}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Mobile Controls */}
      {enableMobileControls && (
        <MobileGridControls
          currentPrice={gridParams.currentPrice}
          priceRange={gridParams.priceRange}
          gridCount={gridParams.gridCount}
          simulationSpeed={gridParams.simulationSpeed}
          isSimulating={gridParams.isSimulating}
          totalProfit={gridParams.totalProfit}
          filledOrders={gridParams.filledOrders}
          totalOrders={gridParams.gridCount}
          onPriceChange={(price) => setGridParams(prev => ({ ...prev, currentPrice: price }))}
          onRangeChange={(range) => setGridParams(prev => ({ ...prev, priceRange: range }))}
          onGridCountChange={(count) => setGridParams(prev => ({ ...prev, gridCount: count }))}
          onSpeedChange={(speed) => setGridParams(prev => ({ ...prev, simulationSpeed: speed }))}
          onSimulationToggle={() => setGridParams(prev => ({ ...prev, isSimulating: !prev.isSimulating }))}
          onReset={() => setGridParams(prev => ({ ...prev, totalProfit: 0, filledOrders: 0 }))}
        />
      )}

      {/* Insights Feed */}
      <AnimatePresence>
        {insights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-20 md:bottom-6 right-6 max-w-sm z-30"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center space-x-2">
                <LightBulbIcon className="h-4 w-4 text-yellow-500" />
                <span>Latest Insights</span>
              </h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {insights.slice(-3).map((insight, index) => (
                  <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>{insight.title}:</strong> {insight.message}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
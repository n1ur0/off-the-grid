'use client';

import React from 'react';
import { 
  InteractiveGrid, 
  RiskVisualization, 
  PriceRangeSelector, 
  GridScenarioTutorial,
  GridTradingWorkshop 
} from '../components/education';

/**
 * Comprehensive example showing how to use all the interactive grid trading 
 * educational components in the Off the Grid platform.
 * 
 * This example demonstrates:
 * 1. Basic InteractiveGrid usage
 * 2. Risk analysis and visualization
 * 3. Price range selection optimization
 * 4. Scenario-based learning
 * 5. Complete workshop experience
 * 6. Mobile-responsive design
 */

// Example 1: Basic Interactive Grid
export function BasicGridExample() {
  const handleOrderFilled = (order: any) => {
    console.log('Order filled:', order);
    // Track user progress, update analytics, show notifications, etc.
  };

  const handleEducationalInsight = (insight: any) => {
    console.log('Educational insight:', insight);
    // Display learning tips, update progress, unlock achievements, etc.
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Basic Interactive Grid</h2>
      
      <InteractiveGrid
        initialPrice={1.0}
        priceRange={[0.85, 1.15]}
        gridCount={10}
        onOrderFilled={handleOrderFilled}
        showAdvancedControls={false}
        enableDragInteraction={true}
        educationMode={true}
        onInsight={handleEducationalInsight}
        scenario={{
          id: 'demo-sideways',
          name: 'Demo Market',
          description: 'Perfect for learning',
          pricePattern: 'sideways',
          volatility: 0.01,
          duration: 60
        }}
      />
    </div>
  );
}

// Example 2: Risk Analysis Dashboard
export function RiskAnalysisExample() {
  const handleRiskParametersChange = (params: any) => {
    console.log('Risk parameters updated:', params);
    // Update grid configurations, show warnings, calculate new metrics
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Risk Analysis Dashboard</h2>
      
      <RiskVisualization
        portfolioValue={10000}
        gridAllocation={30}
        riskTolerance="moderate"
        onRiskParametersChange={handleRiskParametersChange}
        enableInteractiveScenarios={true}
      />
    </div>
  );
}

// Example 3: Price Range Optimization
export function PriceRangeExample() {
  const handleRangeSelected = (min: number, max: number) => {
    console.log('Range selected:', { min, max });
    // Update grid configuration, recalculate metrics, show impact analysis
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Price Range Optimization</h2>
      
      <PriceRangeSelector
        currentPrice={1.0}
        historicalData={[]} // Provide real historical data in production
        onRangeSelected={handleRangeSelected}
        enableRecommendations={true}
        showEducationalTips={true}
      />
    </div>
  );
}

// Example 4: Scenario-Based Tutorial
export function ScenarioTutorialExample() {
  const handleTutorialComplete = (results: any) => {
    console.log('Tutorial completed:', results);
    // Update user progress, unlock achievements, show completion certificate
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Scenario-Based Learning</h2>
      
      <GridScenarioTutorial
        startingLevel="beginner"
        onComplete={handleTutorialComplete}
        enableProgress={true}
      />
    </div>
  );
}

// Example 5: Complete Workshop Experience
export function ComprehensiveWorkshopExample() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <GridTradingWorkshop
        initialSection="interactive-basics"
        showProgress={true}
        enableMobileControls={true}
      />
    </div>
  );
}

// Example 6: Custom Integration for Learning Modules
export function CustomLearningModuleExample() {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [userProgress, setUserProgress] = React.useState({
    gridsCompleted: 0,
    totalProfit: 0,
    scenariosCompleted: 0,
    riskAssessmentCompleted: false
  });

  const learningSteps = [
    {
      title: "Grid Trading Basics",
      component: (
        <InteractiveGrid
          initialPrice={1.0}
          priceRange={[0.9, 1.1]}
          gridCount={8}
          educationMode={true}
          onOrderFilled={(order) => {
            setUserProgress(prev => ({
              ...prev,
              totalProfit: prev.totalProfit + (order.profit || 0),
              gridsCompleted: prev.gridsCompleted + 1
            }));
          }}
        />
      )
    },
    {
      title: "Risk Assessment",
      component: (
        <RiskVisualization
          portfolioValue={5000}
          gridAllocation={20}
          riskTolerance="conservative"
          onRiskParametersChange={() => {
            setUserProgress(prev => ({
              ...prev,
              riskAssessmentCompleted: true
            }));
          }}
        />
      )
    },
    {
      title: "Advanced Scenarios",
      component: (
        <GridScenarioTutorial
          startingLevel="intermediate"
          onComplete={(results) => {
            setUserProgress(prev => ({
              ...prev,
              scenariosCompleted: results.completedSteps
            }));
          }}
        />
      )
    }
  ];

  const canAdvance = () => {
    switch (currentStep) {
      case 0: return userProgress.gridsCompleted >= 3;
      case 1: return userProgress.riskAssessmentCompleted;
      case 2: return userProgress.scenariosCompleted >= 2;
      default: return false;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Grid Trading Mastery Course</h1>
        
        {/* Progress Indicator */}
        <div className="flex items-center space-x-4 mb-6">
          {learningSteps.map((_, index) => (
            <div
              key={index}
              className={`flex items-center justify-center w-8 h-8 rounded-full ${
                index <= currentStep
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-300 text-gray-600'
              }`}
            >
              {index + 1}
            </div>
          ))}
        </div>
        
        {/* Progress Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{userProgress.gridsCompleted}</div>
            <div className="text-sm text-gray-600">Grids Completed</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">${userProgress.totalProfit.toFixed(2)}</div>
            <div className="text-sm text-gray-600">Total Profit</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
            <div className="text-2xl font-bold text-purple-600">{userProgress.scenariosCompleted}</div>
            <div className="text-sm text-gray-600">Scenarios Done</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
            <div className="text-2xl font-bold text-orange-600">
              {userProgress.riskAssessmentCompleted ? '✓' : '○'}
            </div>
            <div className="text-sm text-gray-600">Risk Assessment</div>
          </div>
        </div>
      </div>

      {/* Current Learning Step */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{learningSteps[currentStep].title}</h2>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentStep(Math.min(learningSteps.length - 1, currentStep + 1))}
              disabled={!canAdvance() || currentStep === learningSteps.length - 1}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
        
        {learningSteps[currentStep].component}
        
        {!canAdvance() && currentStep < learningSteps.length - 1 && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              Complete the current exercises to advance to the next step.
              {currentStep === 0 && " Fill at least 3 grid orders to continue."}
              {currentStep === 1 && " Complete the risk assessment to continue."}
              {currentStep === 2 && " Complete at least 2 scenarios to continue."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Export all examples for easy import
export {
  BasicGridExample,
  RiskAnalysisExample,
  PriceRangeExample,
  ScenarioTutorialExample,
  ComprehensiveWorkshopExample,
  CustomLearningModuleExample
};
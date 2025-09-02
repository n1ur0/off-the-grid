'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  InteractiveGrid, 
  GridSimulator, 
  PriceRangeSelector, 
  RiskVisualization 
} from '@/components/education';

export default function DemoPage() {
  const [selectedComponent, setSelectedComponent] = useState('interactive-grid');

  const components = [
    { id: 'interactive-grid', name: 'Interactive Grid', description: 'Basic grid trading visualization' },
    { id: 'grid-simulator', name: 'Grid Simulator', description: 'Full trading simulation' },
    { id: 'price-range-selector', name: 'Range Selector', description: 'Optimal price range selection' },
    { id: 'risk-visualization', name: 'Risk Dashboard', description: 'Comprehensive risk assessment' }
  ];

  const renderComponent = () => {
    switch (selectedComponent) {
      case 'interactive-grid':
        return (
          <InteractiveGrid 
            initialPrice={1.2}
            priceRange={[1.0, 1.4]}
            gridCount={12}
            showAdvancedControls={true}
            enableDragInteraction={true}
            onOrderFilled={(order) => console.log('Order filled:', order)}
          />
        );
      case 'grid-simulator':
        return (
          <GridSimulator 
            initialCapital={10000}
            defaultGridSpacing={0.05}
            enableAdvancedFeatures={true}
          />
        );
      case 'price-range-selector':
        return (
          <PriceRangeSelector 
            currentPrice={1.2}
            enableRecommendations={true}
            showEducationalTips={true}
            onRangeSelected={(min, max) => console.log('Range selected:', min, max)}
          />
        );
      case 'risk-visualization':
        return (
          <RiskVisualization 
            portfolioValue={50000}
            gridAllocation={35}
            riskTolerance="moderate"
            enableInteractiveScenarios={true}
            onRiskParametersChange={(params) => console.log('Risk params:', params)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Grid Trading Education Components
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Interactive visualizations to teach grid trading concepts
          </p>
        </motion.div>

        {/* Component Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {components.map((component, index) => (
              <motion.button
                key={component.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedComponent(component.id)}
                className={`p-4 rounded-lg border text-left transition-all duration-200 ${
                  selectedComponent === component.id
                    ? 'bg-blue-500 text-white border-blue-500 shadow-lg'
                    : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:hover:bg-gray-700'
                }`}
              >
                <h3 className="font-semibold mb-1">{component.name}</h3>
                <p className={`text-sm ${
                  selectedComponent === component.id 
                    ? 'text-blue-100' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {component.description}
                </p>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Component Display */}
        <motion.div
          key={selectedComponent}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {renderComponent()}
        </motion.div>
      </div>
    </div>
  );
}
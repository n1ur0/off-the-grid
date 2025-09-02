'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronUpIcon,
  ChevronDownIcon,
  AdjustmentsHorizontalIcon,
  DevicePhoneMobileIcon,
  FingerPrintIcon,
  EyeIcon,
  HandRaisedIcon,
  PlusIcon,
  MinusIcon
} from '@heroicons/react/24/outline';

interface MobileGridControlsProps {
  currentPrice: number;
  priceRange: [number, number];
  gridCount: number;
  simulationSpeed: number;
  isSimulating: boolean;
  onPriceChange: (price: number) => void;
  onRangeChange: (range: [number, number]) => void;
  onGridCountChange: (count: number) => void;
  onSpeedChange: (speed: number) => void;
  onSimulationToggle: () => void;
  onReset: () => void;
  totalProfit: number;
  filledOrders: number;
  totalOrders: number;
}

export function MobileGridControls({
  currentPrice,
  priceRange,
  gridCount,
  simulationSpeed,
  isSimulating,
  onPriceChange,
  onRangeChange,
  onGridCountChange,
  onSpeedChange,
  onSimulationToggle,
  onReset,
  totalProfit,
  filledOrders,
  totalOrders
}: MobileGridControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeControl, setActiveControl] = useState<string | null>(null);
  const [showTouchTips, setShowTouchTips] = useState(true);

  // Touch gesture handlers
  const handlePriceTouch = useCallback((direction: 'up' | 'down') => {
    const step = 0.001;
    const newPrice = direction === 'up' 
      ? Math.min(priceRange[1] * 1.02, currentPrice + step)
      : Math.max(priceRange[0] * 0.98, currentPrice - step);
    onPriceChange(parseFloat(newPrice.toFixed(4)));
  }, [currentPrice, priceRange, onPriceChange]);

  const handleRangeTouch = useCallback((bound: 'min' | 'max', direction: 'up' | 'down') => {
    const step = 0.01;
    const [min, max] = priceRange;
    
    if (bound === 'min') {
      const newMin = direction === 'up' 
        ? Math.min(max - 0.01, min + step)
        : Math.max(0.01, min - step);
      onRangeChange([parseFloat(newMin.toFixed(4)), max]);
    } else {
      const newMax = direction === 'up' 
        ? max + step
        : Math.max(min + 0.01, max - step);
      onRangeChange([min, parseFloat(newMax.toFixed(4))]);
    }
  }, [priceRange, onRangeChange]);

  const handleGridCountTouch = useCallback((direction: 'up' | 'down') => {
    const newCount = direction === 'up' 
      ? Math.min(20, gridCount + 1)
      : Math.max(3, gridCount - 1);
    onGridCountChange(newCount);
  }, [gridCount, onGridCountChange]);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      {/* Touch Tips Overlay */}
      <AnimatePresence>
        {showTouchTips && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute -top-16 left-4 right-4 bg-blue-500 text-white rounded-lg p-3 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FingerPrintIcon className="h-5 w-5" />
                <span className="text-sm font-medium">Touch to control grid parameters</span>
              </div>
              <button
                onClick={() => setShowTouchTips(false)}
                className="p-1 rounded-full hover:bg-blue-600 transition-colors"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Stats Bar */}
      <motion.div
        className="px-4 py-3 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20"
        animate={{ 
          height: isExpanded ? '60px' : '80px'
        }}
      >
        <div className="flex items-center justify-between">
          {/* Quick Stats */}
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <motion.div 
                className="text-lg font-bold text-gray-900 dark:text-white"
                key={currentPrice}
                initial={{ scale: 1.1, color: '#3b82f6' }}
                animate={{ scale: 1, color: 'inherit' }}
              >
                ${currentPrice.toFixed(4)}
              </motion.div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Price</div>
            </div>
            
            <div className="text-center">
              <motion.div 
                className={`text-lg font-bold ${
                  totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}
                key={totalProfit}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
              >
                ${totalProfit.toFixed(2)}
              </motion.div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Profit</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {filledOrders}/{totalOrders}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Orders</div>
            </div>
          </div>

          {/* Expand Controls */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm"
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronUpIcon className="h-4 w-4" />}
          </motion.button>
        </div>
      </motion.div>

      {/* Expanded Controls */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-200 dark:border-gray-700"
          >
            {/* Touch Control Sections */}
            <div className="p-4 space-y-4">
              {/* Price Control */}
              <motion.div
                className={`p-3 rounded-lg border transition-all duration-200 ${
                  activeControl === 'price'
                    ? 'bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-600'
                    : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600'
                }`}
                onTouchStart={() => setActiveControl('price')}
                onTouchEnd={() => setTimeout(() => setActiveControl(null), 200)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Current Price: ${currentPrice.toFixed(4)}
                  </span>
                  <div className="flex items-center space-x-2">
                    <motion.button
                      whileTap={{ scale: 0.9, backgroundColor: '#ef4444' }}
                      onTouchStart={() => handlePriceTouch('down')}
                      className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center dark:bg-red-900/30 dark:text-red-400"
                    >
                      <MinusIcon className="h-4 w-4" />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9, backgroundColor: '#22c55e' }}
                      onTouchStart={() => handlePriceTouch('up')}
                      className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center dark:bg-green-900/30 dark:text-green-400"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </motion.button>
                  </div>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center space-x-1">
                  <HandRaisedIcon className="h-3 w-3" />
                  <span>Tap + or - to adjust price manually</span>
                </div>
              </motion.div>

              {/* Range Controls */}
              <motion.div
                className={`p-3 rounded-lg border transition-all duration-200 ${
                  activeControl === 'range'
                    ? 'bg-purple-50 border-purple-300 dark:bg-purple-900/30 dark:border-purple-600'
                    : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600'
                }`}
                onTouchStart={() => setActiveControl('range')}
                onTouchEnd={() => setTimeout(() => setActiveControl(null), 200)}
              >
                <div className="space-y-2">
                  {/* Lower Bound */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Lower: ${priceRange[0].toFixed(4)}
                    </span>
                    <div className="flex items-center space-x-2">
                      <motion.button
                        whileTap={{ scale: 0.9, backgroundColor: '#ef4444' }}
                        onTouchStart={() => handleRangeTouch('min', 'down')}
                        className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs dark:bg-red-900/30 dark:text-red-400"
                      >
                        -
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9, backgroundColor: '#22c55e' }}
                        onTouchStart={() => handleRangeTouch('min', 'up')}
                        className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs dark:bg-green-900/30 dark:text-green-400"
                      >
                        +
                      </motion.button>
                    </div>
                  </div>
                  
                  {/* Upper Bound */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Upper: ${priceRange[1].toFixed(4)}
                    </span>
                    <div className="flex items-center space-x-2">
                      <motion.button
                        whileTap={{ scale: 0.9, backgroundColor: '#ef4444' }}
                        onTouchStart={() => handleRangeTouch('max', 'down')}
                        className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs dark:bg-red-900/30 dark:text-red-400"
                      >
                        -
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9, backgroundColor: '#22c55e' }}
                        onTouchStart={() => handleRangeTouch('max', 'up')}
                        className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs dark:bg-green-900/30 dark:text-green-400"
                      >
                        +
                      </motion.button>
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center space-x-1 mt-2">
                  <EyeIcon className="h-3 w-3" />
                  <span>Range: {((priceRange[1] - priceRange[0]) / currentPrice * 100).toFixed(1)}%</span>
                </div>
              </motion.div>

              {/* Grid Count & Speed */}
              <div className="grid grid-cols-2 gap-4">
                <motion.div
                  className={`p-3 rounded-lg border transition-all duration-200 ${
                    activeControl === 'grid'
                      ? 'bg-green-50 border-green-300 dark:bg-green-900/30 dark:border-green-600'
                      : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600'
                  }`}
                  onTouchStart={() => setActiveControl('grid')}
                  onTouchEnd={() => setTimeout(() => setActiveControl(null), 200)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Grid: {gridCount}
                    </span>
                    <div className="flex items-center space-x-1">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onTouchStart={() => handleGridCountTouch('down')}
                        className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs dark:bg-red-900/30 dark:text-red-400"
                      >
                        -
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onTouchStart={() => handleGridCountTouch('up')}
                        className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs dark:bg-green-900/30 dark:text-green-400"
                      >
                        +
                      </motion.button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Orders</div>
                </motion.div>

                <motion.div
                  className="p-3 rounded-lg border bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Speed: {simulationSpeed}x
                    </span>
                    <div className="flex items-center space-x-1">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onTouchStart={() => onSpeedChange(Math.max(0.5, simulationSpeed - 0.5))}
                        className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs dark:bg-blue-900/30 dark:text-blue-400"
                      >
                        -
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onTouchStart={() => onSpeedChange(Math.min(3, simulationSpeed + 0.5))}
                        className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs dark:bg-blue-900/30 dark:text-blue-400"
                      >
                        +
                      </motion.button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Simulation</div>
                </motion.div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onSimulationToggle}
                  className={`flex-1 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                    isSimulating
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {isSimulating ? 'Pause Simulation' : 'Start Simulation'}
                </motion.button>
                
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={onReset}
                  className="px-4 py-3 rounded-lg font-medium text-sm bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-all duration-200"
                >
                  Reset
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Usage Tips */}
      <motion.div
        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-center"
        animate={{ 
          opacity: activeControl ? 1 : 0.7,
          scale: activeControl ? 1.02 : 1 
        }}
      >
        <div className="flex items-center justify-center space-x-2 text-sm">
          <DevicePhoneMobileIcon className="h-4 w-4" />
          <span>
            {activeControl === 'price' ? 'Adjusting price manually' :
             activeControl === 'range' ? 'Modifying grid range' :
             activeControl === 'grid' ? 'Changing grid density' :
             'Touch controls for mobile grid trading'}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
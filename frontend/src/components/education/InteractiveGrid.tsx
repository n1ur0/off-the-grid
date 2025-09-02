'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  PlayIcon, 
  PauseIcon, 
  ArrowPathIcon, 
  AdjustmentsHorizontalIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  BoltIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { useEducationStore } from '../../lib/stores/education';

interface GridLevel {
  id: string;
  price: number;
  type: 'buy' | 'sell';
  filled: boolean;
  amount: number;
  fillTime?: Date;
  profit?: number;
  potentialProfit?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  executionProbability?: number;
}

interface PricePoint {
  price: number;
  timestamp: Date;
  momentum?: number;
  volatility?: number;
}

interface ScenarioConfig {
  id: string;
  name: string;
  description: string;
  pricePattern: 'trending-up' | 'trending-down' | 'sideways' | 'volatile' | 'breakout';
  volatility: number;
  duration: number;
  startPrice?: number;
}

interface EducationalInsight {
  id: string;
  trigger: 'order_fill' | 'price_breakout' | 'profit_milestone' | 'risk_warning';
  title: string;
  message: string;
  type: 'success' | 'warning' | 'info' | 'error';
  actionable?: boolean;
}

interface InteractiveGridProps {
  initialPrice?: number;
  priceRange?: [number, number];
  gridCount?: number;
  onOrderFilled?: (order: GridLevel) => void;
  showAdvancedControls?: boolean;
  enableDragInteraction?: boolean;
  educationMode?: boolean;
  scenario?: ScenarioConfig;
  onInsight?: (insight: EducationalInsight) => void;
}

export function InteractiveGrid({
  initialPrice = 1.0,
  priceRange = [0.8, 1.2],
  gridCount = 10,
  onOrderFilled,
  showAdvancedControls = false,
  enableDragInteraction = true,
  educationMode = true,
  scenario,
  onInsight
}: InteractiveGridProps) {
  // Core state
  const [currentPrice, setCurrentPrice] = useState(initialPrice);
  const [isSimulating, setIsSimulating] = useState(false);
  const [gridLevels, setGridLevels] = useState<GridLevel[]>([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Array<{ type: string; price: number; profit: number; time: Date }>>([]);
  
  // Enhanced controls
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [hoveredLevel, setHoveredLevel] = useState<string | null>(null);
  const [draggedPrice, setDraggedPrice] = useState<number | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string>('sideways');
  const [showRiskAnalysis, setShowRiskAnalysis] = useState(false);
  const [showProfitProjections, setShowProfitProjections] = useState(false);
  
  // Educational features
  const [insights, setInsights] = useState<EducationalInsight[]>([]);
  const [currentInsight, setCurrentInsight] = useState<EducationalInsight | null>(null);
  const [showEducationalOverlay, setShowEducationalOverlay] = useState(educationMode);
  const [learningProgress, setLearningProgress] = useState(0);
  
  // Performance tracking
  const [sessionStats, setSessionStats] = useState({
    totalTrades: 0,
    successfulTrades: 0,
    maxProfit: 0,
    maxDrawdown: 0,
    timeInProfit: 0,
    breakoutEvents: 0
  });
  
  // Refs for advanced interactions
  const chartRef = useRef<HTMLDivElement>(null);
  const educationStore = useEducationStore();

  // Initialize grid levels with unique IDs
  const initializeGridLevels = useCallback(() => {
    const [minPrice, maxPrice] = priceRange;
    const step = (maxPrice - minPrice) / (gridCount - 1);
    const levels: GridLevel[] = [];

    for (let i = 0; i < gridCount; i++) {
      const price = minPrice + (step * i);
      levels.push({
        id: `grid-${i}`,
        price: parseFloat(price.toFixed(4)),
        type: price < initialPrice ? 'buy' : 'sell',
        filled: false,
        amount: 10
      });
    }

    return levels;
  }, [priceRange, gridCount, initialPrice]);

  useEffect(() => {
    setGridLevels(initializeGridLevels());
    setPriceHistory([{ price: initialPrice, timestamp: new Date() }]);
  }, [initializeGridLevels, initialPrice]);

  // Enhanced price simulation with momentum
  useEffect(() => {
    if (!isSimulating) return;

    const baseInterval = 800;
    const interval = setInterval(() => {
      setCurrentPrice(prev => {
        // Add momentum and volatility
        const momentum = (Math.random() - 0.5) * 0.01;
        const volatility = Math.random() * 0.015;
        const change = momentum + (Math.random() - 0.5) * volatility;
        
        const newPrice = Math.max(
          priceRange[0] * 0.98, 
          Math.min(priceRange[1] * 1.02, prev + change)
        );
        
        const finalPrice = parseFloat(newPrice.toFixed(4));
        
        // Update price history
        setPriceHistory(prevHistory => {
          const newHistory = [...prevHistory, { price: finalPrice, timestamp: new Date() }];
          return newHistory.slice(-50); // Keep last 50 points
        });
        
        return finalPrice;
      });
    }, baseInterval / simulationSpeed);

    return () => clearInterval(interval);
  }, [isSimulating, priceRange, simulationSpeed]);

  // Enhanced order filling logic
  useEffect(() => {
    setGridLevels(prevLevels => {
      return prevLevels.map(level => {
        if (level.filled) return level;

        const shouldFill = level.type === 'buy' 
          ? currentPrice <= level.price 
          : currentPrice >= level.price;

        if (shouldFill) {
          const profit = level.type === 'buy' 
            ? (currentPrice - level.price) * level.amount
            : (level.price - currentPrice) * level.amount;
          
          const filledLevel = { 
            ...level, 
            filled: true, 
            fillTime: new Date(),
            profit 
          };
          
          setTotalProfit(prev => prev + profit);
          setTradeHistory(prev => [...prev, {
            type: level.type,
            price: level.price,
            profit,
            time: new Date()
          }]);
          
          onOrderFilled?.(filledLevel);
          return filledLevel;
        }

        return level;
      });
    });
  }, [currentPrice, onOrderFilled]);

  const resetSimulation = useCallback(() => {
    setIsSimulating(false);
    setCurrentPrice(initialPrice);
    setTotalProfit(0);
    setTradeHistory([]);
    setPriceHistory([{ price: initialPrice, timestamp: new Date() }]);
    setGridLevels(initializeGridLevels());
    setHoveredLevel(null);
    setDraggedPrice(null);
  }, [initialPrice, initializeGridLevels]);

  const maxPrice = useMemo(() => Math.max(...gridLevels.map(l => l.price)), [gridLevels]);
  const minPrice = useMemo(() => Math.min(...gridLevels.map(l => l.price)), [gridLevels]);
  const priceRangeSize = maxPrice - minPrice;

  const handlePriceDrag = useCallback((price: number) => {
    if (!enableDragInteraction) return;
    setDraggedPrice(price);
    setCurrentPrice(price);
  }, [enableDragInteraction]);

  const filledBuyOrders = useMemo(() => gridLevels.filter(l => l.filled && l.type === 'buy'), [gridLevels]);
  const filledSellOrders = useMemo(() => gridLevels.filter(l => l.filled && l.type === 'sell'), [gridLevels]);
  const unrealizedPnL = useMemo(() => {
    return filledBuyOrders.reduce((sum, order) => sum + (currentPrice - order.price) * order.amount, 0) +
           filledSellOrders.reduce((sum, order) => sum + (order.price - currentPrice) * order.amount, 0);
  }, [filledBuyOrders, filledSellOrders, currentPrice]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 overflow-hidden"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <motion.h3 
            className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2"
            layoutId="grid-title"
          >
            <span>Interactive Grid Simulator</span>
            {enableDragInteraction && (
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">
                Drag to explore
              </span>
            )}
          </motion.h3>
          
          <div className="flex items-center space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsSimulating(!isSimulating)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isSimulating
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg hover:shadow-xl'
                  : 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              <motion.div
                animate={{ rotate: isSimulating ? 0 : 0 }}
                transition={{ duration: 0.2 }}
              >
                {isSimulating ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
              </motion.div>
              {isSimulating ? 'Pause' : 'Start'}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={resetSimulation}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Reset
            </motion.button>
          </div>
        </div>

        {/* Enhanced Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 text-center border border-blue-200 dark:border-blue-700"
          >
            <motion.div
              key={currentPrice}
              initial={{ scale: 1.2, color: '#3b82f6' }}
              animate={{ scale: 1, color: '#1f2937' }}
              className="text-2xl font-bold text-gray-900 dark:text-white"
            >
              ${currentPrice.toFixed(4)}
            </motion.div>
            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Current Price</div>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            className={`rounded-lg p-4 text-center border ${
              totalProfit >= 0
                ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700'
                : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700'
            }`}
          >
            <motion.div
              key={totalProfit}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className={`text-2xl font-bold ${
                totalProfit >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              ${totalProfit.toFixed(4)}
            </motion.div>
            <div className={`text-sm font-medium ${
              totalProfit >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              Realized P&L
            </div>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            className={`rounded-lg p-4 text-center border ${
              unrealizedPnL >= 0
                ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700'
                : 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700'
            }`}
          >
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                color: unrealizedPnL >= 0 ? '#059669' : '#ea580c'
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-2xl font-bold"
            >
              ${unrealizedPnL.toFixed(4)}
            </motion.div>
            <div className={`text-sm font-medium ${
              unrealizedPnL >= 0 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-orange-600 dark:text-orange-400'
            }`}>
              Unrealized P&L
            </div>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 text-center border border-purple-200 dark:border-purple-700"
          >
            <motion.div
              key={gridLevels.filter(l => l.filled).length}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="text-2xl font-bold text-gray-900 dark:text-white"
            >
              {gridLevels.filter(l => l.filled).length}/{gridLevels.length}
            </motion.div>
            <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Orders Filled</div>
          </motion.div>
        </div>

        {/* Advanced Controls */}
        <AnimatePresence>
          {showAdvancedControls && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Simulation Speed: {simulationSpeed}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.5"
                    value={simulationSpeed}
                    onChange={(e) => setSimulationSpeed(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Enhanced Grid Visualization */}
      <div className="relative h-96 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 mb-6 overflow-hidden">
        {/* Background patterns */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-blue-50/20 to-transparent dark:via-blue-900/10" />
        </div>
        
        <div className="h-full relative">
          {/* Enhanced Price Axis */}
          <div className="absolute left-0 top-0 h-full w-20 flex flex-col justify-between text-xs font-mono">
            {Array.from({ length: 9 }, (_, i) => {
              const price = maxPrice - (priceRangeSize * i / 8);
              return (
                <motion.span
                  key={i}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-1 rounded shadow-sm"
                >
                  ${price.toFixed(3)}
                </motion.span>
              );
            })}
          </div>

          {/* Grid Container */}
          <div className="ml-20 h-full relative">
            {/* Profit/Loss Zones */}
            <div className="absolute inset-0">
              {/* Buy zone (below current price) */}
              <motion.div
                className="absolute left-0 right-0 bg-gradient-to-t from-green-100/60 to-green-50/20 dark:from-green-900/20 dark:to-green-800/10"
                style={{
                  top: `${((maxPrice - currentPrice) / priceRangeSize) * 100}%`,
                  bottom: 0
                }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              
              {/* Sell zone (above current price) */}
              <motion.div
                className="absolute left-0 right-0 bg-gradient-to-b from-red-100/60 to-red-50/20 dark:from-red-900/20 dark:to-red-800/10"
                style={{
                  top: 0,
                  bottom: `${100 - ((maxPrice - currentPrice) / priceRangeSize) * 100}%`
                }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
              />
            </div>

            {/* Price History Line */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {priceHistory.length > 1 && (
                <motion.path
                  d={priceHistory.map((point, i) => {
                    const x = (i / (priceHistory.length - 1)) * 100;
                    const y = ((maxPrice - point.price) / priceRangeSize) * 100;
                    return `${i === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                  }).join(' ')}
                  stroke="url(#priceGradient)"
                  strokeWidth="2"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5 }}
                />
              )}
              <defs>
                <linearGradient id="priceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                </linearGradient>
              </defs>
            </svg>

            {/* Grid Levels */}
            <AnimatePresence>
              {gridLevels.map((level, index) => {
                const position = ((maxPrice - level.price) / priceRangeSize) * 100;
                const isNearPrice = Math.abs(level.price - currentPrice) < priceRangeSize * 0.05;
                
                return (
                  <motion.div
                    key={level.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="absolute left-0 right-0 flex items-center group cursor-pointer"
                    style={{ top: `${position}%` }}
                    onMouseEnter={() => setHoveredLevel(level.id)}
                    onMouseLeave={() => setHoveredLevel(null)}
                  >
                    {/* Grid Line */}
                    <motion.div
                      className={`absolute left-0 right-0 border-t-2 ${
                        level.filled
                          ? level.type === 'buy'
                            ? 'border-green-400'
                            : 'border-red-400'
                          : 'border-dashed border-gray-300 dark:border-gray-600'
                      }`}
                      animate={{
                        opacity: isNearPrice ? [0.5, 1, 0.5] : 0.7,
                        scale: hoveredLevel === level.id ? 1.02 : 1
                      }}
                      transition={{
                        opacity: { duration: 2, repeat: isNearPrice ? Infinity : 0 },
                        scale: { duration: 0.2 }
                      }}
                    />

                    {/* Order Indicator */}
                    <motion.div
                      className={`relative z-10 w-4 h-4 rounded-full border-3 shadow-lg ${
                        level.filled
                          ? level.type === 'buy'
                            ? 'bg-green-500 border-green-600 shadow-green-300'
                            : 'bg-red-500 border-red-600 shadow-red-300'
                          : level.type === 'buy'
                            ? 'bg-white border-green-400 hover:bg-green-50 dark:bg-gray-800 dark:hover:bg-green-900/20'
                            : 'bg-white border-red-400 hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-red-900/20'
                      }`}
                      animate={{
                        scale: level.filled ? [1, 1.2, 1] : hoveredLevel === level.id ? 1.3 : 1,
                        boxShadow: level.filled 
                          ? level.type === 'buy'
                            ? ['0 0 0 rgba(34, 197, 94, 0)', '0 0 20px rgba(34, 197, 94, 0.5)', '0 0 0 rgba(34, 197, 94, 0)']
                            : ['0 0 0 rgba(239, 68, 68, 0)', '0 0 20px rgba(239, 68, 68, 0.5)', '0 0 0 rgba(239, 68, 68, 0)']
                          : undefined
                      }}
                      transition={{
                        scale: { duration: level.filled ? 0.6 : 0.2 },
                        boxShadow: { duration: 1.5, repeat: level.filled ? Infinity : 0 }
                      }}
                    />

                    {/* Order Label */}
                    <AnimatePresence>
                      {(hoveredLevel === level.id || level.filled) && (
                        <motion.div
                          initial={{ opacity: 0, x: -10, scale: 0.8 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -10, scale: 0.8 }}
                          className={`ml-4 px-3 py-1 rounded-lg text-xs font-medium shadow-lg ${
                            level.type === 'buy'
                              ? 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/40 dark:text-green-300'
                              : 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/40 dark:text-red-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span>{level.type.toUpperCase()} @ ${level.price}</span>
                            {level.filled && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="text-xs opacity-75"
                              >
                                ✓ Filled
                              </motion.span>
                            )}
                          </div>
                          {level.profit !== undefined && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-xs mt-1"
                            >
                              Profit: ${level.profit.toFixed(4)}
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Current Price Line with Enhanced Animation */}
            <motion.div
              className="absolute left-0 right-0 z-20 flex items-center"
              style={{ top: `${((maxPrice - currentPrice) / priceRangeSize) * 100}%` }}
              animate={{
                y: draggedPrice ? 0 : [0, -2, 0],
              }}
              transition={{
                y: { duration: 2, repeat: Infinity }
              }}
              drag={enableDragInteraction ? "y" : false}
              dragConstraints={{
                top: -((maxPrice - priceRange[1]) / priceRangeSize) * 100,
                bottom: -((maxPrice - priceRange[0]) / priceRangeSize) * 100
              }}
              onDrag={(_, info) => {
                if (!enableDragInteraction) return;
                const newPrice = maxPrice - (info.point.y / window.innerHeight) * priceRangeSize;
                const clampedPrice = Math.max(priceRange[0], Math.min(priceRange[1], newPrice));
                handlePriceDrag(clampedPrice);
              }}
            >
              <motion.div
                className="h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 shadow-lg relative"
                style={{ width: '100%' }}
                animate={{
                  boxShadow: [
                    '0 0 10px rgba(59, 130, 246, 0.5)',
                    '0 0 20px rgba(59, 130, 246, 0.8)',
                    '0 0 10px rgba(59, 130, 246, 0.5)'
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <motion.div
                  className="w-6 h-6 bg-blue-500 rounded-full border-4 border-white dark:border-gray-800 shadow-xl absolute -top-2.5 left-0"
                  animate={{
                    scale: [1, 1.1, 1],
                    boxShadow: [
                      '0 4px 15px rgba(59, 130, 246, 0.3)',
                      '0 8px 25px rgba(59, 130, 246, 0.6)',
                      '0 4px 15px rgba(59, 130, 246, 0.3)'
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute -top-12 left-8 bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-bold shadow-xl"
                  style={{
                    clipPath: 'polygon(0 0, 100% 0, 100% 75%, 10% 75%, 5% 100%, 0 75%)'
                  }}
                >
                  ${currentPrice.toFixed(4)}
                  {draggedPrice && (
                    <motion.span
                      className="block text-xs opacity-75"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      Drag to explore
                    </motion.span>
                  )}
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Floating Trade Notifications */}
            <AnimatePresence>
              {tradeHistory.slice(-3).map((trade, index) => (
                <motion.div
                  key={`${trade.time.getTime()}-${index}`}
                  initial={{ opacity: 0, scale: 0, x: 50 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                  className={`absolute right-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl border-l-4 p-3 ${
                    trade.type === 'buy'
                      ? 'border-green-500'
                      : 'border-red-500'
                  }`}
                  style={{ top: `${20 + index * 70}px` }}
                >
                  <div className={`text-sm font-bold ${
                    trade.type === 'buy' 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {trade.type.toUpperCase()} ORDER FILLED
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    ${trade.price.toFixed(4)} • +${trade.profit.toFixed(4)}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Enhanced Trade History */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center space-x-2">
            <span>Trade History</span>
            <motion.span
              key={tradeHistory.length}
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded-full text-xs font-bold"
            >
              {tradeHistory.length}
            </motion.span>
          </h4>
          
          {showAdvancedControls && (
            <button className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <AdjustmentsHorizontalIcon className="h-4 w-4" />
              <span>Advanced</span>
            </button>
          )}
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <AnimatePresence mode="popLayout">
            {tradeHistory.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-gray-500 dark:text-gray-400 text-center py-8 flex flex-col items-center space-y-2"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full"
                />
                <span>Start the simulation to see grid trading in action!</span>
              </motion.div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-2">
                {tradeHistory.slice(-8).reverse().map((trade, index) => (
                  <motion.div
                    key={`${trade.time.getTime()}-${index}`}
                    initial={{ opacity: 0, x: -20, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center justify-between p-2 rounded-lg border ${
                      trade.type === 'buy'
                        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
                        : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <motion.div
                        className={`w-3 h-3 rounded-full ${
                          trade.type === 'buy' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.5 }}
                      />
                      <div>
                        <span className={`text-sm font-bold ${
                          trade.type === 'buy' 
                            ? 'text-green-700 dark:text-green-300' 
                            : 'text-red-700 dark:text-red-300'
                        }`}>
                          {trade.type.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                          @ ${trade.price.toFixed(4)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <motion.div
                        className={`text-sm font-bold ${
                          trade.profit >= 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                      >
                        +${trade.profit.toFixed(4)}
                      </motion.div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {trade.time.toLocaleTimeString()}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Educational Tooltips */}
      <AnimatePresence>
        {hoveredLevel && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700"
          >
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Grid Trading Tip:</strong> {
                gridLevels.find(l => l.id === hoveredLevel)?.type === 'buy'
                  ? "Buy orders are placed below the current price to catch dips and accumulate assets at lower prices."
                  : "Sell orders are placed above the current price to take profits when the price rises."
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
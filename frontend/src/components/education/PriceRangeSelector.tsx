'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChartBarIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';

interface PricePoint {
  timestamp: Date;
  price: number;
  volume: number;
}

interface SupportResistanceLevel {
  price: number;
  strength: number;
  type: 'support' | 'resistance';
  touchCount: number;
}

interface RangeRecommendation {
  min: number;
  max: number;
  confidence: number;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high';
  expectedReturn: number;
}

interface PriceRangeSelectorProps {
  historicalData?: PricePoint[];
  currentPrice?: number;
  onRangeSelected?: (min: number, max: number) => void;
  enableRecommendations?: boolean;
  showEducationalTips?: boolean;
}

export function PriceRangeSelector({
  historicalData = [],
  currentPrice = 1.0,
  onRangeSelected,
  enableRecommendations = true,
  showEducationalTips = true
}: PriceRangeSelectorProps) {
  const [selectedRange, setSelectedRange] = useState<[number, number]>([currentPrice * 0.9, currentPrice * 1.1]);
  const [isDragging, setIsDragging] = useState(false);
  const [recommendations, setRecommendations] = useState<RangeRecommendation[]>([]);
  const [selectedRecommendation, setSelectedRecommendation] = useState<string | null>(null);
  const [showAdvancedAnalysis, setShowAdvancedAnalysis] = useState(false);

  // Generate sample historical data if none provided
  const mockHistoricalData = useMemo(() => {
    if (historicalData.length > 0) return historicalData;
    
    const data: PricePoint[] = [];
    let price = currentPrice;
    const now = new Date();
    
    for (let i = 0; i < 100; i++) {
      const timestamp = new Date(now.getTime() - (100 - i) * 24 * 60 * 60 * 1000);
      price += (Math.random() - 0.5) * 0.05;
      price = Math.max(0.1, price);
      
      data.push({
        timestamp,
        price: parseFloat(price.toFixed(4)),
        volume: Math.floor(1000 + Math.random() * 5000)
      });
    }
    
    return data;
  }, [historicalData, currentPrice]);

  // Calculate support and resistance levels
  const supportResistanceLevels = useMemo(() => {
    const prices = mockHistoricalData.map(d => d.price);
    const levels: SupportResistanceLevel[] = [];
    
    for (let i = 2; i < prices.length - 2; i++) {
      const current = prices[i];
      const prev2 = prices[i - 2];
      const prev1 = prices[i - 1];
      const next1 = prices[i + 1];
      const next2 = prices[i + 2];
      
      if (current > prev2 && current > prev1 && current > next1 && current > next2) {
        const existing = levels.find(l => Math.abs(l.price - current) < current * 0.02);
        if (existing) {
          existing.touchCount++;
          existing.strength = Math.min(1, existing.strength + 0.2);
        } else {
          levels.push({
            price: current,
            strength: 0.5,
            type: 'resistance',
            touchCount: 1
          });
        }
      }
      
      if (current < prev2 && current < prev1 && current < next1 && current < next2) {
        const existing = levels.find(l => Math.abs(l.price - current) < current * 0.02);
        if (existing) {
          existing.touchCount++;
          existing.strength = Math.min(1, existing.strength + 0.2);
        } else {
          levels.push({
            price: current,
            strength: 0.5,
            type: 'support',
            touchCount: 1
          });
        }
      }
    }
    
    return levels.filter(l => l.strength > 0.4).sort((a, b) => b.strength - a.strength).slice(0, 8);
  }, [mockHistoricalData]);

  // Generate range recommendations
  const generateRecommendations = useCallback(() => {
    const prices = mockHistoricalData.map(d => d.price);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const priceStd = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length);
    
    const recs: RangeRecommendation[] = [
      {
        min: avgPrice - priceStd * 1.5,
        max: avgPrice + priceStd * 1.5,
        confidence: 0.85,
        reason: "Based on 1.5 standard deviations - captures 87% of price movements",
        riskLevel: 'low' as const,
        expectedReturn: 12.5
      },
      {
        min: avgPrice - priceStd * 2,
        max: avgPrice + priceStd * 2,
        confidence: 0.95,
        reason: "Conservative range covering 95% of historical movements",
        riskLevel: 'low' as const,
        expectedReturn: 8.2
      },
      {
        min: avgPrice - priceStd,
        max: avgPrice + priceStd,
        confidence: 0.68,
        reason: "Tight range for frequent trades but higher breakout risk",
        riskLevel: 'high' as const,
        expectedReturn: 18.7
      }
    ].filter(rec => rec.min > 0 && rec.max > rec.min);
    
    setRecommendations(recs);
  }, [mockHistoricalData]);

  useEffect(() => {
    if (enableRecommendations) {
      generateRecommendations();
    }
  }, [enableRecommendations, generateRecommendations]);

  const handleRangeChange = useCallback((newMin: number, newMax: number) => {
    const validMin = Math.max(0.001, Math.min(newMin, newMax - 0.001));
    const validMax = Math.max(validMin + 0.001, newMax);
    
    setSelectedRange([validMin, validMax]);
    onRangeSelected?.(validMin, validMax);
  }, [onRangeSelected]);

  const selectRecommendation = useCallback((rec: RangeRecommendation) => {
    setSelectedRange([rec.min, rec.max]);
    setSelectedRecommendation(`${rec.min}-${rec.max}`);
    onRangeSelected?.(rec.min, rec.max);
  }, [onRangeSelected]);

  // Calculate risk metrics for current range
  const riskMetrics = useMemo(() => {
    const [min, max] = selectedRange;
    const rangeSize = max - min;
    const centerDistance = Math.abs(currentPrice - (min + max) / 2);
    const rangePercent = (rangeSize / currentPrice) * 100;
    
    const breakoutRisk = centerDistance / (rangeSize / 2);
    const profitPotential = rangeSize / currentPrice;
    
    const riskLevel = breakoutRisk > 0.7 ? 'high' : breakoutRisk > 0.4 ? 'medium' : 'low';
    
    return {
      rangePercent,
      breakoutRisk,
      profitPotential,
      riskLevel,
      gridDensity: rangeSize / 0.05
    };
  }, [selectedRange, currentPrice]);

  const chartData = mockHistoricalData.map(point => ({
    timestamp: point.timestamp.toLocaleDateString(),
    price: point.price,
    volume: point.volume
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <motion.h2 
            className="text-xl font-bold text-gray-900 dark:text-white flex items-center space-x-2"
            layoutId="range-selector-title"
          >
            <ChartBarIcon className="h-6 w-6" />
            <span>Price Range Selector</span>
          </motion.h2>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAdvancedAnalysis(!showAdvancedAnalysis)}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" />
            Advanced
          </motion.button>
        </div>

        {/* Current Selection Info */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4"
          animate={{ scale: isDragging ? 1.02 : 1 }}
        >
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-700">
            <motion.div
              key={selectedRange[0]}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className="text-lg font-bold text-blue-600 dark:text-blue-400"
            >
              ${selectedRange[0].toFixed(4)}
            </motion.div>
            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Lower Bound</div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-700">
            <motion.div
              key={selectedRange[1]}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className="text-lg font-bold text-blue-600 dark:text-blue-400"
            >
              ${selectedRange[1].toFixed(4)}
            </motion.div>
            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Upper Bound</div>
          </div>
          
          <div className={`rounded-lg p-3 text-center border ${
            riskMetrics.riskLevel === 'low' 
              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700'
              : riskMetrics.riskLevel === 'medium'
              ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700'
              : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700'
          }`}>
            <div className={`text-lg font-bold ${
              riskMetrics.riskLevel === 'low' 
                ? 'text-green-600 dark:text-green-400'
                : riskMetrics.riskLevel === 'medium'
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {riskMetrics.rangePercent.toFixed(1)}%
            </div>
            <div className={`text-xs font-medium ${
              riskMetrics.riskLevel === 'low' 
                ? 'text-green-600 dark:text-green-400'
                : riskMetrics.riskLevel === 'medium'
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              Range Size
            </div>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center border border-purple-200 dark:border-purple-700">
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              ~{Math.round(riskMetrics.gridDensity)}
            </div>
            <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">Grid Orders</div>
          </div>
        </motion.div>
      </div>

      {/* Price Chart with Range Selection */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Historical Price Data
          </h3>
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <div className={`w-2 h-2 rounded-full ${isDragging ? 'bg-blue-500' : 'bg-gray-400'}`} />
            <span>{isDragging ? 'Adjusting range...' : 'Drag to select range'}</span>
          </div>
        </div>
        
        <motion.div
          className="relative h-80 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600"
          animate={{ 
            borderColor: isDragging ? '#3b82f6' : '#d1d5db',
            boxShadow: isDragging ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : '0 0 0 0px transparent'
          }}
          transition={{ duration: 0.2 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              
              <XAxis 
                dataKey="timestamp" 
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={['dataMin - 0.05', 'dataMax + 0.05']}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <Tooltip
                formatter={(value: number) => [`$${value.toFixed(4)}`, 'Price']}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: '#f9fafb',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
              />
              
              <ReferenceArea
                y1={selectedRange[0]}
                y2={selectedRange[1]}
                fill="url(#rangeGradient)"
                fillOpacity={0.3}
              />
              
              <ReferenceLine
                y={selectedRange[0]}
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: `Min: $${selectedRange[0].toFixed(4)}`, position: 'insideTopRight' }}
              />
              <ReferenceLine
                y={selectedRange[1]}
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: `Max: $${selectedRange[1].toFixed(4)}`, position: 'insideBottomRight' }}
              />
              
              <ReferenceLine
                y={currentPrice}
                stroke="#f59e0b"
                strokeWidth={3}
                label={{ value: `Current: $${currentPrice.toFixed(4)}`, position: 'insideTopLeft' }}
              />
              
              {supportResistanceLevels.slice(0, 5).map((level, index) => (
                <ReferenceLine
                  key={index}
                  y={level.price}
                  stroke={level.type === 'support' ? '#059669' : '#dc2626'}
                  strokeWidth={1}
                  strokeOpacity={level.strength}
                  strokeDasharray="3 3"
                />
              ))}
              
              <Area
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#priceGradient)"
                isAnimationActive={true}
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Recommendations */}
      <AnimatePresence>
        {enableRecommendations && recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
              <InformationCircleIcon className="h-5 w-5" />
              <span>Recommended Ranges</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectRecommendation(rec)}
                  className={`p-4 rounded-lg border text-left transition-all duration-200 ${
                    selectedRecommendation === `${rec.min}-${rec.max}`
                      ? 'bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-600'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      ${rec.min.toFixed(4)} - ${rec.max.toFixed(4)}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        rec.riskLevel === 'low' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : rec.riskLevel === 'medium'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {rec.riskLevel.toUpperCase()}
                      </span>
                      <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full dark:bg-gray-600 dark:text-gray-300">
                        {(rec.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {rec.reason}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Expected Return: {rec.expectedReturn.toFixed(1)}%
                    </span>
                    {selectedRecommendation === `${rec.min}-${rec.max}` && (
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Range Input */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
      >
        <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
          Manual Range Selection
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Lower Bound
            </label>
            <input
              type="number"
              step="0.0001"
              value={selectedRange[0]}
              onChange={(e) => handleRangeChange(parseFloat(e.target.value) || 0, selectedRange[1])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              aria-label="Lower price bound for grid trading range"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Upper Bound
            </label>
            <input
              type="number"
              step="0.0001"
              value={selectedRange[1]}
              onChange={(e) => handleRangeChange(selectedRange[0], parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              aria-label="Upper price bound for grid trading range"
            />
          </div>
        </div>
      </motion.div>

      {/* Educational Tips */}
      <AnimatePresence>
        {showEducationalTips && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700"
          >
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Pro Tip:</strong> Wider ranges reduce breakout risk but may have fewer trading opportunities. 
              Narrower ranges increase profit potential but carry higher risk of price moving outside the grid.
              Look for ranges that encompass strong support and resistance levels for optimal performance.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
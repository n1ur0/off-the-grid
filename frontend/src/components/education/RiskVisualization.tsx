'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldExclamationIcon,
  ChartPieIcon,
  CalculatorIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, ReferenceLine } from 'recharts';

interface RiskProfile {
  conservative: number;
  moderate: number;
  aggressive: number;
}

interface ScenarioOutcome {
  scenario: string;
  probability: number;
  pnl: number;
  description: string;
  color: string;
}

interface PortfolioAllocation {
  asset: string;
  percentage: number;
  value: number;
  risk: 'low' | 'medium' | 'high';
  color: string;
}

interface RiskVisualizationProps {
  portfolioValue?: number;
  gridAllocation?: number;
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  onRiskParametersChange?: (params: any) => void;
  enableInteractiveScenarios?: boolean;
}

const RISK_SCENARIOS: ScenarioOutcome[] = [
  {
    scenario: 'Best Case',
    probability: 15,
    pnl: 25.5,
    description: 'Market stays within range with high volatility',
    color: '#10b981'
  },
  {
    scenario: 'Good Case',
    probability: 35,
    pnl: 12.8,
    description: 'Normal grid trading with occasional range breaks',
    color: '#3b82f6'
  },
  {
    scenario: 'Base Case',
    probability: 30,
    pnl: 5.2,
    description: 'Average market conditions with moderate volatility',
    color: '#6b7280'
  },
  {
    scenario: 'Poor Case',
    probability: 15,
    pnl: -8.3,
    description: 'Sustained trend outside grid range',
    color: '#f59e0b'
  },
  {
    scenario: 'Worst Case',
    probability: 5,
    pnl: -22.1,
    description: 'Major market crash or extreme volatility',
    color: '#ef4444'
  }
];

const RISK_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444'
};

export function RiskVisualization({
  portfolioValue = 10000,
  gridAllocation = 30,
  riskTolerance = 'moderate',
  onRiskParametersChange,
  enableInteractiveScenarios = true
}: RiskVisualizationProps) {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [riskSliders, setRiskSliders] = useState({
    gridAllocation: gridAllocation,
    positionSize: 50,
    volatilityTolerance: 60,
    maxDrawdown: 15
  });
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [simulationResults, setSimulationResults] = useState<any[]>([]);

  // Calculate portfolio allocation
  const portfolioAllocation = useMemo((): PortfolioAllocation[] => {
    const gridValue = (portfolioValue * riskSliders.gridAllocation) / 100;
    const cashValue = portfolioValue - gridValue;
    
    return [
      {
        asset: 'Grid Trading',
        percentage: riskSliders.gridAllocation,
        value: gridValue,
        risk: riskSliders.gridAllocation > 50 ? 'high' : riskSliders.gridAllocation > 25 ? 'medium' : 'low',
        color: '#3b82f6'
      },
      {
        asset: 'Cash/Stable',
        percentage: 100 - riskSliders.gridAllocation,
        value: cashValue,
        risk: 'low',
        color: '#10b981'
      }
    ];
  }, [portfolioValue, riskSliders.gridAllocation]);

  // Calculate risk score
  const riskScore = useMemo(() => {
    const allocationRisk = riskSliders.gridAllocation / 100;
    const positionRisk = riskSliders.positionSize / 100;
    const volatilityRisk = riskSliders.volatilityTolerance / 100;
    const drawdownRisk = (100 - riskSliders.maxDrawdown) / 100;
    
    const totalRisk = (allocationRisk * 0.4 + positionRisk * 0.3 + volatilityRisk * 0.2 + drawdownRisk * 0.1);
    return Math.round(totalRisk * 100);
  }, [riskSliders]);

  // Generate Monte Carlo simulation results
  const generateSimulationResults = useCallback(() => {
    const results = [];
    for (let i = 0; i < 1000; i++) {
      const randomFactor = Math.random();
      const volatility = (riskSliders.volatilityTolerance / 100) * 0.3;
      const positionMultiplier = riskSliders.positionSize / 100;
      
      const outcome = (Math.random() - 0.5) * volatility * positionMultiplier * 100;
      results.push({
        simulation: i,
        outcome: parseFloat(outcome.toFixed(2))
      });
    }
    
    setSimulationResults(results);
  }, [riskSliders]);

  useEffect(() => {
    generateSimulationResults();
  }, [generateSimulationResults]);

  // Calculate VaR (Value at Risk)
  const valueAtRisk = useMemo(() => {
    if (simulationResults.length === 0) return { var95: 0, var99: 0 };
    
    const sortedOutcomes = simulationResults.map(r => r.outcome).sort((a, b) => a - b);
    const var95 = sortedOutcomes[Math.floor(sortedOutcomes.length * 0.05)];
    const var99 = sortedOutcomes[Math.floor(sortedOutcomes.length * 0.01)];
    
    return { var95, var99 };
  }, [simulationResults]);

  const handleSliderChange = useCallback((key: keyof typeof riskSliders, value: number) => {
    const newSliders = { ...riskSliders, [key]: value };
    setRiskSliders(newSliders);
    onRiskParametersChange?.(newSliders);
  }, [riskSliders, onRiskParametersChange]);

  const getRiskLabel = (score: number) => {
    if (score < 30) return { label: 'Conservative', color: '#10b981' };
    if (score < 60) return { label: 'Moderate', color: '#f59e0b' };
    return { label: 'Aggressive', color: '#ef4444' };
  };

  const riskInfo = getRiskLabel(riskScore);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <motion.h2 
            className="text-xl font-bold text-gray-900 dark:text-white flex items-center space-x-2"
            layoutId="risk-viz-title"
          >
            <ShieldExclamationIcon className="h-6 w-6" />
            <span>Risk Assessment Dashboard</span>
          </motion.h2>
          
          <motion.div
            className="px-4 py-2 rounded-lg font-medium text-sm border-2"
            animate={{ 
              backgroundColor: riskInfo.color + '20',
              borderColor: riskInfo.color,
              color: riskInfo.color
            }}
          >
            Risk Level: {riskInfo.label} ({riskScore}%)
          </motion.div>
        </div>

        {/* Risk Score Gauge */}
        <motion.div
          className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-lg p-4 mb-6"
          whileHover={{ scale: 1.01 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white">
              Overall Risk Score
            </h3>
            <motion.span
              className="text-2xl font-bold"
              animate={{ color: riskInfo.color }}
            >
              {riskScore}/100
            </motion.span>
          </div>
          
          <div className="relative w-full h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            {/* Risk zones background */}
            <div className="absolute inset-0 flex">
              <div className="w-1/3 bg-green-300" />
              <div className="w-1/3 bg-yellow-300" />
              <div className="w-1/3 bg-red-300" />
            </div>
            
            {/* Current risk indicator */}
            <motion.div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg"
              initial={{ width: 0 }}
              animate={{ width: `${riskScore}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
            
            {/* Risk indicator dot */}
            <motion.div
              className="absolute top-1/2 w-6 h-6 bg-white border-3 border-blue-500 rounded-full shadow-lg transform -translate-y-1/2"
              initial={{ left: 0 }}
              animate={{ left: `${riskScore}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ marginLeft: '-12px' }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-2">
            <span>Conservative</span>
            <span>Moderate</span>
            <span>Aggressive</span>
          </div>
        </motion.div>
      </div>

      {/* Portfolio Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <ChartPieIcon className="h-5 w-5" />
            <span>Portfolio Allocation</span>
          </h3>
          
          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={portfolioAllocation}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="percentage"
                  animationBegin={0}
                  animationDuration={800}
                >
                  {portfolioAllocation.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)}%`,
                    name
                  ]}
                  contentStyle={{
                    backgroundColor: '#f9fafb',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${portfolioValue.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total Portfolio
                </div>
              </div>
            </div>
          </div>
          
          {/* Allocation Details */}
          <div className="space-y-2 mt-4">
            {portfolioAllocation.map((allocation, index) => (
              <motion.div
                key={allocation.asset}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: allocation.color }}
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {allocation.asset}
                    </span>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        allocation.risk === 'low' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : allocation.risk === 'medium'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {allocation.risk.toUpperCase()} RISK
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-bold text-gray-900 dark:text-white">
                    {allocation.percentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    ${allocation.value.toLocaleString()}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Scenario Analysis */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <CalculatorIcon className="h-5 w-5" />
            <span>Scenario Analysis</span>
          </h3>
          
          <div className="h-64 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={RISK_SCENARIOS} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="scenario" 
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value > 0 ? '+' : ''}${value.toFixed(1)}%`,
                    'P&L'
                  ]}
                  labelFormatter={(label: string) => {
                    const scenario = RISK_SCENARIOS.find(s => s.scenario === label);
                    return scenario ? `${label} (${scenario.probability}% chance)` : label;
                  }}
                  contentStyle={{
                    backgroundColor: '#f9fafb',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="pnl" 
                  radius={[4, 4, 0, 0]}
                  animationDuration={1000}
                >
                  {RISK_SCENARIOS.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Scenario Details */}
          <div className="space-y-2">
            {RISK_SCENARIOS.map((scenario, index) => (
              <motion.div
                key={scenario.scenario}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedScenario(
                  selectedScenario === scenario.scenario ? null : scenario.scenario
                )}
                className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                  selectedScenario === scenario.scenario
                    ? 'bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-600'
                    : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: scenario.color }}
                    />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {scenario.scenario}
                    </span>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full dark:bg-gray-600 dark:text-gray-300">
                      {scenario.probability}%
                    </span>
                  </div>
                  
                  <span className={`font-bold ${
                    scenario.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {scenario.pnl > 0 ? '+' : ''}{scenario.pnl.toFixed(1)}%
                  </span>
                </div>
                
                <AnimatePresence>
                  {selectedScenario === scenario.scenario && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600"
                    >
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {scenario.description}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Risk Parameter Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Risk Parameters
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - Sliders */}
          <div className="space-y-4">
            {/* Grid Allocation */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Grid Trading Allocation
                </label>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {riskSliders.gridAllocation}%
                </span>
              </div>
              <motion.input
                type="range"
                min="0"
                max="100"
                value={riskSliders.gridAllocation}
                onChange={(e) => handleSliderChange('gridAllocation', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                whileFocus={{ scale: 1.02 }}
                aria-label="Grid trading allocation percentage"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>Conservative</span>
                <span>Aggressive</span>
              </div>
            </div>
            
            {/* Position Size */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Position Size per Order
                </label>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {riskSliders.positionSize}%
                </span>
              </div>
              <motion.input
                type="range"
                min="10"
                max="100"
                value={riskSliders.positionSize}
                onChange={(e) => handleSliderChange('positionSize', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                whileFocus={{ scale: 1.02 }}
                aria-label="Position size per order percentage"
              />
            </div>
            
            {/* Volatility Tolerance */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Volatility Tolerance
                </label>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {riskSliders.volatilityTolerance}%
                </span>
              </div>
              <motion.input
                type="range"
                min="10"
                max="100"
                value={riskSliders.volatilityTolerance}
                onChange={(e) => handleSliderChange('volatilityTolerance', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                whileFocus={{ scale: 1.02 }}
                aria-label="Volatility tolerance percentage"
              />
            </div>
            
            {/* Max Drawdown */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Max Acceptable Drawdown
                </label>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {riskSliders.maxDrawdown}%
                </span>
              </div>
              <motion.input
                type="range"
                min="5"
                max="50"
                value={riskSliders.maxDrawdown}
                onChange={(e) => handleSliderChange('maxDrawdown', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                whileFocus={{ scale: 1.02 }}
                aria-label="Maximum acceptable drawdown percentage"
              />
            </div>
          </div>
          
          {/* Right Column - Risk Metrics */}
          <div className="space-y-4">
            {/* Value at Risk */}
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
              whileHover={{ scale: 1.02 }}
            >
              <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                <span>Value at Risk (VaR)</span>
              </h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">95% Confidence</span>
                  <motion.span
                    className="font-bold text-red-600 dark:text-red-400"
                    key={valueAtRisk.var95}
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                  >
                    {valueAtRisk.var95.toFixed(1)}%
                  </motion.span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">99% Confidence</span>
                  <motion.span
                    className="font-bold text-red-700 dark:text-red-300"
                    key={valueAtRisk.var99}
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                  >
                    {valueAtRisk.var99.toFixed(1)}%
                  </motion.span>
                </div>
              </div>
            </motion.div>
            
            {/* Risk Recommendations */}
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
              whileHover={{ scale: 1.02 }}
            >
              <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                <span>Recommendations</span>
              </h4>
              
              <div className="space-y-2">
                {riskSliders.gridAllocation > 70 && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start space-x-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700"
                  >
                    <ExclamationTriangleIcon className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-800 dark:text-red-300">
                      <strong>High allocation risk:</strong> Consider reducing grid allocation below 50% of portfolio.
                    </div>
                  </motion.div>
                )}
                
                {riskSliders.positionSize > 80 && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start space-x-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-700"
                  >
                    <InformationCircleIcon className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-yellow-800 dark:text-yellow-300">
                      <strong>Large positions:</strong> Consider smaller position sizes to reduce concentration risk.
                    </div>
                  </motion.div>
                )}
                
                {riskScore < 40 && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start space-x-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700"
                  >
                    <CheckCircleIcon className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-green-800 dark:text-green-300">
                      <strong>Well balanced:</strong> Your risk profile appears conservative and well-managed.
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Monte Carlo Results */}
      {enableInteractiveScenarios && simulationResults.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Monte Carlo Simulation (1000 runs)
            </h3>
            <button
              onClick={() => setShowHeatMap(!showHeatMap)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {showHeatMap ? 'Hide' : 'Show'} Heat Map
            </button>
          </div>
          
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={simulationResults.slice(0, 100).map((result, index) => ({ 
                run: index, 
                outcome: result.outcome 
              }))}>
                <defs>
                  <linearGradient id="simulationGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                
                <XAxis 
                  dataKey="run" 
                  tick={{ fontSize: 11 }}
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  formatter={(value: number) => [`${value > 0 ? '+' : ''}${value.toFixed(1)}%`, 'Outcome']}
                  contentStyle={{
                    backgroundColor: '#f9fafb',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px'
                  }}
                />
                
                <Area
                  type="monotone"
                  dataKey="outcome"
                  stroke="#8b5cf6"
                  strokeWidth={1}
                  fill="url(#simulationGradient)"
                  isAnimationActive={true}
                  animationDuration={1500}
                />
                
                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {simulationResults.filter(r => r.outcome > 0).length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Profitable Scenarios</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {(simulationResults.reduce((sum, r) => sum + r.outcome, 0) / simulationResults.length).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Average Outcome</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-red-600 dark:text-red-400">
                {Math.min(...simulationResults.map(r => r.outcome)).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Worst Case</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Risk Summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700"
      >
        <div className="flex items-start space-x-3">
          <InformationCircleIcon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Risk Summary:</strong> Your current configuration has a <strong>{riskInfo.label.toLowerCase()}</strong> risk profile 
            with an estimated {Math.abs(valueAtRisk.var95).toFixed(1)}% maximum loss in 95% of scenarios. 
            Grid trading works best in sideways markets with regular price oscillations within your selected range.
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
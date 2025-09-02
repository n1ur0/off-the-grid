'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  TreeMap,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Area,
  Line
} from 'recharts';
import { 
  PieChart as PieChartIcon, 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Target,
  AlertTriangle,
  Shield,
  Activity,
  Zap,
  RefreshCw,
  Settings,
  Eye,
  Filter,
  Download
} from 'lucide-react';
import { useGridsStore } from '@/lib/stores/grids';
import { motion } from 'framer-motion';

interface PortfolioMetrics {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  totalInvestment: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  activeGrids: number;
  totalGrids: number;
  avgROI: number;
  totalVolume: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

interface AssetAllocation {
  pair: string;
  value: number;
  percentage: number;
  pnl: number;
  pnlPercent: number;
  status: 'active' | 'paused' | 'stopped';
  riskLevel: 'low' | 'medium' | 'high';
}

interface RiskAnalysis {
  concentrationRisk: number;
  correlationRisk: number;
  liquidityRisk: number;
  volatilityRisk: number;
  overallRisk: number;
  riskLevel: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
}

interface RebalanceRecommendation {
  action: 'reduce' | 'increase' | 'maintain';
  pair: string;
  currentPercent: number;
  targetPercent: number;
  reason: string;
  priority: 'low' | 'medium' | 'high';
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#14B8A6'];

const RISK_COLORS = {
  conservative: '#10B981',
  moderate: '#F59E0B', 
  aggressive: '#EF4444',
  very_aggressive: '#7C2D12'
};

export function PortfolioOverview() {
  const { grids, fetchGrids } = useGridsStore();
  const [viewMode, setViewMode] = useState<'overview' | 'allocation' | 'risk' | 'rebalance'>('overview');
  const [timeframe, setTimeframe] = useState<'1d' | '7d' | '30d' | '3m'>('7d');
  const [showInactive, setShowInactive] = useState(false);

  // Calculate portfolio metrics
  const portfolioMetrics: PortfolioMetrics = useMemo(() => {
    const activeGrids = grids.filter(grid => grid.status === 'active');
    const totalInvestment = grids.reduce((sum, grid) => sum + grid.totalInvestment, 0);
    const totalPnL = grids.reduce((sum, grid) => sum + grid.unrealizedPnL + grid.realizedPnL, 0);
    const totalValue = totalInvestment + totalPnL;
    
    // Mock daily P&L (would come from historical data)
    const dailyPnL = totalPnL * 0.1; // Simulate daily change
    
    // Mock volume calculation
    const totalVolume = grids.reduce((sum, grid) => sum + (grid.totalInvestment * 0.3), 0);
    
    // Mock risk metrics
    const avgROI = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;
    const sharpeRatio = Math.max(-2, Math.min(3, avgROI * 0.05 + Math.random() * 0.5));
    const maxDrawdown = Math.max(0, Math.abs(totalPnL) * 0.2 + Math.random() * 5);

    return {
      totalValue,
      totalPnL,
      totalPnLPercent: totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0,
      totalInvestment,
      dailyPnL,
      dailyPnLPercent: totalInvestment > 0 ? (dailyPnL / totalInvestment) * 100 : 0,
      activeGrids: activeGrids.length,
      totalGrids: grids.length,
      avgROI,
      totalVolume,
      sharpeRatio,
      maxDrawdown,
    };
  }, [grids]);

  // Calculate asset allocation
  const assetAllocation: AssetAllocation[] = useMemo(() => {
    const totalInvestment = portfolioMetrics.totalInvestment;
    
    return grids
      .filter(grid => showInactive || grid.status === 'active')
      .map(grid => {
        const pnl = grid.unrealizedPnL + grid.realizedPnL;
        const value = grid.totalInvestment + pnl;
        
        return {
          pair: grid.pair,
          value,
          percentage: totalInvestment > 0 ? (grid.totalInvestment / totalInvestment) * 100 : 0,
          pnl,
          pnlPercent: grid.totalInvestment > 0 ? (pnl / grid.totalInvestment) * 100 : 0,
          status: grid.status,
          riskLevel: grid.totalInvestment > 5000 ? 'high' : 
                    grid.totalInvestment > 1000 ? 'medium' : 'low'
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [grids, portfolioMetrics.totalInvestment, showInactive]);

  // Risk analysis
  const riskAnalysis: RiskAnalysis = useMemo(() => {
    const allocations = assetAllocation.filter(a => a.status === 'active');
    
    // Concentration risk - based on largest allocation
    const maxAllocation = Math.max(...allocations.map(a => a.percentage));
    const concentrationRisk = Math.min(100, maxAllocation * 2); // 50%+ allocation = high risk
    
    // Correlation risk - mock calculation based on similar pairs
    const pairs = allocations.map(a => a.pair);
    const correlationRisk = pairs.length > 1 ? 30 + Math.random() * 40 : 0;
    
    // Liquidity risk - based on number of active grids
    const liquidityRisk = Math.max(0, 100 - (allocations.length * 10));
    
    // Volatility risk - based on P&L variance
    const pnlVariance = allocations.reduce((sum, a) => sum + Math.abs(a.pnlPercent), 0) / allocations.length;
    const volatilityRisk = Math.min(100, pnlVariance * 2);
    
    const overallRisk = (concentrationRisk + correlationRisk + liquidityRisk + volatilityRisk) / 4;
    
    const riskLevel = overallRisk > 75 ? 'very_aggressive' :
                     overallRisk > 50 ? 'aggressive' :
                     overallRisk > 25 ? 'moderate' : 'conservative';

    return {
      concentrationRisk,
      correlationRisk,
      liquidityRisk,
      volatilityRisk,
      overallRisk,
      riskLevel,
    };
  }, [assetAllocation]);

  // Rebalance recommendations
  const rebalanceRecommendations: RebalanceRecommendation[] = useMemo(() => {
    const recommendations: RebalanceRecommendation[] = [];
    
    assetAllocation.forEach(allocation => {
      const targetPercent = 100 / Math.max(1, assetAllocation.length); // Equal weight target
      const deviation = Math.abs(allocation.percentage - targetPercent);
      
      if (deviation > 15) { // Significant deviation
        recommendations.push({
          action: allocation.percentage > targetPercent ? 'reduce' : 'increase',
          pair: allocation.pair,
          currentPercent: allocation.percentage,
          targetPercent,
          reason: allocation.percentage > targetPercent ? 
            'Over-concentrated position' : 'Under-allocated position',
          priority: deviation > 25 ? 'high' : 'medium'
        });
      }
    });

    return recommendations.sort((a, b) => 
      (b.priority === 'high' ? 2 : 1) - (a.priority === 'high' ? 2 : 1)
    );
  }, [assetAllocation]);

  const formatCurrency = (value: number) => `$${Math.abs(value).toFixed(2)}`;
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Portfolio Value Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Portfolio Performance
        </h3>
        
        {/* Mock performance data */}
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={(() => {
            const data = [];
            for (let i = 0; i < 30; i++) {
              const value = portfolioMetrics.totalInvestment + 
                           (portfolioMetrics.totalPnL * (i / 30)) +
                           (Math.random() - 0.5) * 1000;
              data.push({
                date: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
                value,
                pnl: value - portfolioMetrics.totalInvestment
              });
            }
            return data;
          })()}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" className="text-xs" />
            <YAxis tickFormatter={formatCurrency} className="text-xs" />
            <Tooltip formatter={(value, name) => [formatCurrency(Number(value)), name === 'value' ? 'Portfolio Value' : 'P&L']} />
            <Area
              type="monotone"
              dataKey="value"
              fill="#3B82F6"
              stroke="#3B82F6"
              fillOpacity={0.1}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="pnl"
              stroke="#10B981"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Key Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Key Metrics
        </h3>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Total Value</span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(portfolioMetrics.totalValue)}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Total P&L</span>
            <span className={`text-xl font-bold ${
              portfolioMetrics.totalPnL >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {portfolioMetrics.totalPnL >= 0 ? '+' : ''}{formatCurrency(portfolioMetrics.totalPnL)}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">ROI</span>
            <span className={`text-lg font-semibold ${
              portfolioMetrics.totalPnLPercent >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {portfolioMetrics.totalPnLPercent >= 0 ? '+' : ''}{formatPercent(portfolioMetrics.totalPnLPercent)}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Active Grids</span>
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              {portfolioMetrics.activeGrids} / {portfolioMetrics.totalGrids}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Sharpe Ratio</span>
            <span className={`text-lg font-semibold ${
              portfolioMetrics.sharpeRatio >= 1 
                ? 'text-green-600 dark:text-green-400' 
                : portfolioMetrics.sharpeRatio >= 0
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
            }`}>
              {portfolioMetrics.sharpeRatio.toFixed(2)}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Max Drawdown</span>
            <span className="text-lg font-semibold text-red-600 dark:text-red-400">
              {formatPercent(portfolioMetrics.maxDrawdown)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAllocation = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pie Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Asset Allocation
        </h3>
        
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={assetAllocation}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ pair, percentage }) => `${pair} ${percentage.toFixed(1)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="percentage"
            >
              {assetAllocation.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Allocation']} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Allocation Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Allocation Details
          </h3>
          <button
            onClick={() => setShowInactive(!showInactive)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              showInactive 
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            {showInactive ? 'Hide Inactive' : 'Show Inactive'}
          </button>
        </div>
        
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {assetAllocation.map((allocation, index) => (
            <div 
              key={allocation.pair}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white flex items-center space-x-2">
                    <span>{allocation.pair}</span>
                    <span className={`w-2 h-2 rounded-full ${
                      allocation.status === 'active' ? 'bg-green-500' : 
                      allocation.status === 'paused' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {formatCurrency(allocation.value)} • {allocation.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className={`font-semibold ${
                  allocation.pnl >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {allocation.pnl >= 0 ? '+' : ''}{formatCurrency(allocation.pnl)}
                </div>
                <div className={`text-sm ${
                  allocation.pnlPercent >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {allocation.pnlPercent >= 0 ? '+' : ''}{formatPercent(allocation.pnlPercent)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderRisk = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Risk Radar Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Risk Analysis
        </h3>
        
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={[
            { metric: 'Concentration', value: riskAnalysis.concentrationRisk },
            { metric: 'Correlation', value: riskAnalysis.correlationRisk },
            { metric: 'Liquidity', value: riskAnalysis.liquidityRisk },
            { metric: 'Volatility', value: riskAnalysis.volatilityRisk },
          ]}>
            <PolarGrid />
            <PolarAngleAxis dataKey="metric" className="text-xs" />
            <PolarRadiusAxis angle={0} domain={[0, 100]} className="text-xs" />
            <Radar
              name="Risk Level"
              dataKey="value"
              stroke={RISK_COLORS[riskAnalysis.riskLevel]}
              fill={RISK_COLORS[riskAnalysis.riskLevel]}
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}`, 'Risk Level']} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Risk Assessment */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Risk Assessment
        </h3>
        
        <div className="space-y-4">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold mb-2" style={{ color: RISK_COLORS[riskAnalysis.riskLevel] }}>
              {riskAnalysis.overallRisk.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Overall Risk Score</div>
            <div className={`text-sm font-medium mt-1 capitalize`} style={{ color: RISK_COLORS[riskAnalysis.riskLevel] }}>
              {riskAnalysis.riskLevel.replace('_', ' ')}
            </div>
          </div>
          
          <div className="space-y-3">
            {[
              { name: 'Concentration Risk', value: riskAnalysis.concentrationRisk, desc: 'Over-allocation to single asset' },
              { name: 'Correlation Risk', value: riskAnalysis.correlationRisk, desc: 'Similar asset movements' },
              { name: 'Liquidity Risk', value: riskAnalysis.liquidityRisk, desc: 'Difficulty exiting positions' },
              { name: 'Volatility Risk', value: riskAnalysis.volatilityRisk, desc: 'Price movement sensitivity' },
            ].map((risk) => (
              <div key={risk.name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {risk.name}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {risk.value.toFixed(1)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      risk.value > 75 ? 'bg-red-500' :
                      risk.value > 50 ? 'bg-yellow-500' :
                      risk.value > 25 ? 'bg-blue-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${risk.value}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {risk.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderRebalance = () => (
    <div className="space-y-6">
      {/* Rebalance Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Rebalancing Recommendations
        </h3>
        
        {rebalanceRecommendations.length > 0 ? (
          <div className="space-y-4">
            {rebalanceRecommendations.map((rec, index) => (
              <div 
                key={index}
                className={`p-4 rounded-lg border ${
                  rec.priority === 'high' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' :
                  rec.priority === 'medium' ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20' :
                  'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {rec.action === 'reduce' ? '↓' : '↑'} {rec.pair}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      rec.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                      {rec.priority}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {rec.currentPercent.toFixed(1)}% → {rec.targetPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {rec.reason}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Shield className="mx-auto h-12 w-12 text-green-500" />
            <h4 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              Portfolio Well Balanced
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              No rebalancing recommendations at this time
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Portfolio Overview
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Multi-grid portfolio analysis and management
          </p>
        </div>
        
        <div className="flex items-center space-x-4 mt-4 sm:mt-0">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { value: 'overview', label: 'Overview', icon: Activity },
              { value: 'allocation', label: 'Allocation', icon: PieChartIcon },
              { value: 'risk', label: 'Risk', icon: AlertTriangle },
              { value: 'rebalance', label: 'Rebalance', icon: Target },
            ].map((view) => (
              <button
                key={view.value}
                onClick={() => setViewMode(view.value as any)}
                className={`flex items-center space-x-2 px-3 py-1 rounded text-sm transition-colors ${
                  viewMode === view.value
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <view.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{view.label}</span>
              </button>
            ))}
          </div>
          
          {/* Refresh Button */}
          <button
            onClick={() => fetchGrids()}
            className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Value</div>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-2">
            {formatCurrency(portfolioMetrics.totalValue)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Total P&L</div>
          </div>
          <div className={`text-xl font-bold mt-2 ${
            portfolioMetrics.totalPnL >= 0 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {portfolioMetrics.totalPnL >= 0 ? '+' : ''}{formatCurrency(portfolioMetrics.totalPnL)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-purple-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">ROI</div>
          </div>
          <div className={`text-xl font-bold mt-2 ${
            portfolioMetrics.totalPnLPercent >= 0 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {portfolioMetrics.totalPnLPercent >= 0 ? '+' : ''}{formatPercent(portfolioMetrics.totalPnLPercent)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-orange-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Active Grids</div>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-2">
            {portfolioMetrics.activeGrids}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Sharpe Ratio</div>
          </div>
          <div className={`text-xl font-bold mt-2 ${
            portfolioMetrics.sharpeRatio >= 1 
              ? 'text-green-600 dark:text-green-400' 
              : portfolioMetrics.sharpeRatio >= 0
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400'
          }`}>
            {portfolioMetrics.sharpeRatio.toFixed(2)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Risk Level</div>
          </div>
          <div className="text-sm font-bold mt-2 capitalize" style={{ color: RISK_COLORS[riskAnalysis.riskLevel] }}>
            {riskAnalysis.riskLevel.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <motion.div
        key={viewMode}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {viewMode === 'overview' && renderOverview()}
        {viewMode === 'allocation' && renderAllocation()}
        {viewMode === 'risk' && renderRisk()}
        {viewMode === 'rebalance' && renderRebalance()}
      </motion.div>
    </div>
  );
}
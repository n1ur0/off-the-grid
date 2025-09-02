'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  ComposedChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Target,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  Calculator,
  AlertTriangle,
  Award,
  Zap
} from 'lucide-react';
import { useGridsStore } from '@/lib/stores/grids';

interface PerformanceData {
  timestamp: string;
  pnl: number;
  cumulativePnl: number;
  volume: number;
  fills: number;
  drawdown: number;
  sharpe: number;
  volatility: number;
}

interface RiskMetrics {
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  recoveryFactor: number;
}

interface GridPerformance {
  gridId: string;
  pair: string;
  pnl: number;
  pnlPercent: number;
  volume: number;
  fills: number;
  roi: number;
  sharpe: number;
  maxDrawdown: number;
  efficiency: number;
  isActive: boolean;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export function PerformanceAnalytics() {
  const { grids } = useGridsStore();
  const [timeframe, setTimeframe] = useState<'1h' | '1d' | '7d' | '30d' | '3m' | '1y'>('7d');
  const [chartType, setChartType] = useState<'pnl' | 'drawdown' | 'sharpe' | 'volume'>('pnl');
  const [selectedMetric, setSelectedMetric] = useState<'overview' | 'risk' | 'distribution'>('overview');

  // Generate performance data based on timeframe
  const performanceData: PerformanceData[] = useMemo(() => {
    const days = {
      '1h': 1/24,
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '3m': 90,
      '1y': 365
    }[timeframe];

    const points = timeframe === '1h' ? 60 : Math.min(days * 24, 100);
    const data: PerformanceData[] = [];
    
    let cumulativePnl = 0;
    let maxPnl = 0;
    let currentDrawdown = 0;
    const returns: number[] = [];

    for (let i = 0; i < points; i++) {
      const timestamp = new Date(Date.now() - (points - i) * (days * 24 * 60 * 60 * 1000) / points);
      
      // Simulate realistic trading performance
      const pnl = (Math.random() - 0.42) * 10 * Math.sqrt(days); // Slight positive bias
      cumulativePnl += pnl;
      
      // Track drawdown
      if (cumulativePnl > maxPnl) {
        maxPnl = cumulativePnl;
        currentDrawdown = 0;
      } else {
        currentDrawdown = ((maxPnl - cumulativePnl) / Math.max(maxPnl, 1)) * 100;
      }
      
      returns.push(pnl);
      
      // Calculate rolling Sharpe ratio (simplified)
      const recentReturns = returns.slice(-20);
      const avgReturn = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;
      const stdDev = Math.sqrt(recentReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / recentReturns.length);
      const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

      data.push({
        timestamp: timestamp.toISOString(),
        pnl,
        cumulativePnl,
        volume: Math.abs(pnl) * 20 + Math.random() * 500,
        fills: Math.floor(Math.random() * 3) + (pnl !== 0 ? 1 : 0),
        drawdown: currentDrawdown,
        sharpe: Math.max(-3, Math.min(3, sharpe)), // Cap between -3 and 3
        volatility: stdDev * Math.sqrt(252) * 100, // Annualized volatility %
      });
    }

    return data;
  }, [timeframe]);

  // Calculate risk metrics
  const riskMetrics: RiskMetrics = useMemo(() => {
    if (performanceData.length === 0) {
      return {
        sharpeRatio: 0,
        maxDrawdown: 0,
        volatility: 0,
        winRate: 0,
        profitFactor: 0,
        averageWin: 0,
        averageLoss: 0,
        recoveryFactor: 0
      };
    }

    const returns = performanceData.map(d => d.pnl);
    const wins = returns.filter(r => r > 0);
    const losses = returns.filter(r => r < 0);
    
    const totalReturn = performanceData[performanceData.length - 1].cumulativePnl;
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const maxDrawdown = Math.max(...performanceData.map(d => d.drawdown));
    
    return {
      sharpeRatio: stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0,
      maxDrawdown,
      volatility: stdDev * Math.sqrt(252) * 100,
      winRate: (wins.length / returns.length) * 100,
      profitFactor: losses.length > 0 ? 
        (wins.reduce((sum, w) => sum + w, 0) / Math.abs(losses.reduce((sum, l) => sum + l, 0))) : 0,
      averageWin: wins.length > 0 ? wins.reduce((sum, w) => sum + w, 0) / wins.length : 0,
      averageLoss: losses.length > 0 ? Math.abs(losses.reduce((sum, l) => sum + l, 0)) / losses.length : 0,
      recoveryFactor: maxDrawdown > 0 ? totalReturn / maxDrawdown : 0
    };
  }, [performanceData]);

  // Calculate individual grid performance
  const gridPerformances: GridPerformance[] = useMemo(() => {
    return grids.map(grid => {
      const pnl = grid.unrealizedPnL + grid.realizedPnL;
      const roi = ((pnl / grid.totalInvestment) * 100);
      
      return {
        gridId: grid.id,
        pair: grid.pair,
        pnl,
        pnlPercent: roi,
        volume: grid.totalInvestment * 0.5, // Mock volume
        fills: grid.filledOrders,
        roi,
        sharpe: Math.random() * 2 - 0.5, // Mock Sharpe
        maxDrawdown: Math.random() * 15, // Mock drawdown
        efficiency: 85 + Math.random() * 15, // Mock efficiency
        isActive: grid.status === 'active'
      };
    });
  }, [grids]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (timeframe === '1h') return date.toLocaleTimeString();
    if (timeframe === '1d') return date.toLocaleTimeString();
    return date.toLocaleDateString();
  };

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  const renderChart = () => {
    switch (chartType) {
      case 'pnl':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatTimestamp}
                className="text-xs"
              />
              <YAxis yAxisId="pnl" tickFormatter={formatCurrency} className="text-xs" />
              <YAxis yAxisId="volume" orientation="right" tickFormatter={formatCurrency} className="text-xs" />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'volume') return [formatCurrency(Number(value)), 'Volume'];
                  return [formatCurrency(Number(value)), name === 'cumulativePnl' ? 'Cumulative P&L' : 'P&L'];
                }}
                labelFormatter={formatTimestamp}
              />
              <Legend />
              <Area
                yAxisId="pnl"
                type="monotone"
                dataKey="cumulativePnl"
                fill="#3B82F6"
                stroke="#3B82F6"
                fillOpacity={0.1}
                strokeWidth={2}
                name="Cumulative P&L"
              />
              <Bar
                yAxisId="volume"
                dataKey="volume"
                fill="#10B981"
                fillOpacity={0.3}
                name="Volume"
              />
            </ComposedChart>
          </ResponsiveContainer>
        );

      case 'drawdown':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} className="text-xs" />
              <YAxis tickFormatter={(value) => `${value}%`} className="text-xs" />
              <Tooltip 
                formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Drawdown']}
                labelFormatter={formatTimestamp}
              />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#EF4444"
                fill="#EF4444"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'sharpe':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} className="text-xs" />
              <YAxis domain={[-3, 3]} className="text-xs" />
              <Tooltip 
                formatter={(value) => [Number(value).toFixed(2), 'Sharpe Ratio']}
                labelFormatter={formatTimestamp}
              />
              <Line
                type="monotone"
                dataKey="sharpe"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'volume':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} className="text-xs" />
              <YAxis tickFormatter={formatCurrency} className="text-xs" />
              <Tooltip 
                formatter={(value) => [formatCurrency(Number(value)), 'Volume']}
                labelFormatter={formatTimestamp}
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke="#F59E0B"
                fill="#F59E0B"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  const renderDistributionChart = () => {
    const pnlDistribution = gridPerformances.map((grid, index) => ({
      name: grid.pair,
      value: Math.abs(grid.pnl),
      pnl: grid.pnl,
      fill: COLORS[index % COLORS.length]
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={pnlDistribution}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {pnlDistribution.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name, props) => [
            formatCurrency(props.payload.pnl), 
            'P&L'
          ]} />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const latestData = performanceData[performanceData.length - 1];
  const totalPnL = latestData?.cumulativePnl || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Performance Analytics
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Advanced P&L tracking and risk analysis
          </p>
        </div>
        
        <div className="flex items-center space-x-4 mt-4 sm:mt-0">
          {/* Metric Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { value: 'overview', label: 'Overview', icon: BarChart3 },
              { value: 'risk', label: 'Risk', icon: AlertTriangle },
              { value: 'distribution', label: 'Distribution', icon: PieChartIcon },
            ].map((metric) => (
              <button
                key={metric.value}
                onClick={() => setSelectedMetric(metric.value as any)}
                className={`flex items-center space-x-2 px-3 py-1 rounded text-sm transition-colors ${
                  selectedMetric === metric.value
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <metric.icon className="h-4 w-4" />
                <span>{metric.label}</span>
              </button>
            ))}
          </div>

          {/* Timeframe Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { value: '1h', label: '1H' },
              { value: '1d', label: '1D' },
              { value: '7d', label: '7D' },
              { value: '30d', label: '30D' },
              { value: '3m', label: '3M' },
              { value: '1y', label: '1Y' },
            ].map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value as any)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  timeframe === tf.value
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Total P&L</div>
          </div>
          <div className={`text-xl font-bold mt-2 ${
            totalPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {formatCurrency(totalPnL)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Award className="h-5 w-5 text-blue-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Sharpe Ratio</div>
          </div>
          <div className={`text-xl font-bold mt-2 ${
            riskMetrics.sharpeRatio >= 1 
              ? 'text-green-600 dark:text-green-400' 
              : riskMetrics.sharpeRatio >= 0 
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400'
          }`}>
            {riskMetrics.sharpeRatio.toFixed(2)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Max Drawdown</div>
          </div>
          <div className="text-xl font-bold text-red-600 dark:text-red-400 mt-2">
            {formatPercent(riskMetrics.maxDrawdown)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-purple-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Volatility</div>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-2">
            {formatPercent(riskMetrics.volatility)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-orange-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Win Rate</div>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-2">
            {formatPercent(riskMetrics.winRate)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Calculator className="h-5 w-5 text-indigo-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Profit Factor</div>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white mt-2">
            {riskMetrics.profitFactor.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {selectedMetric === 'overview' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Performance Overview
            </h3>
            
            {/* Chart Type Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mt-4 sm:mt-0">
              {[
                { value: 'pnl', label: 'P&L', icon: TrendingUp },
                { value: 'drawdown', label: 'Drawdown', icon: TrendingDown },
                { value: 'sharpe', label: 'Sharpe', icon: Award },
                { value: 'volume', label: 'Volume', icon: BarChart3 },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setChartType(type.value as any)}
                  className={`flex items-center space-x-2 px-3 py-1 rounded text-sm transition-colors ${
                    chartType === type.value
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <type.icon className="h-4 w-4" />
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          {renderChart()}
        </div>
      )}

      {selectedMetric === 'risk' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk Metrics Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Risk Analysis
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-gray-600 dark:text-gray-400">Average Win</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {formatCurrency(riskMetrics.averageWin)}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-gray-600 dark:text-gray-400">Average Loss</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {formatCurrency(riskMetrics.averageLoss)}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-gray-600 dark:text-gray-400">Recovery Factor</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {riskMetrics.recoveryFactor.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-gray-600 dark:text-gray-400">Profit Factor</span>
                <span className={`font-semibold ${
                  riskMetrics.profitFactor > 1.5 
                    ? 'text-green-600 dark:text-green-400'
                    : riskMetrics.profitFactor > 1
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                }`}>
                  {riskMetrics.profitFactor.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Risk Assessment
            </h3>
            
            <div className="space-y-4">
              {/* Sharpe Ratio Assessment */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Sharpe Ratio Quality
                  </span>
                  <span className={`text-sm font-semibold ${
                    riskMetrics.sharpeRatio >= 2 ? 'text-green-600 dark:text-green-400' :
                    riskMetrics.sharpeRatio >= 1 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {riskMetrics.sharpeRatio >= 2 ? 'Excellent' :
                     riskMetrics.sharpeRatio >= 1 ? 'Good' :
                     riskMetrics.sharpeRatio >= 0 ? 'Fair' : 'Poor'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      riskMetrics.sharpeRatio >= 2 ? 'bg-green-500' :
                      riskMetrics.sharpeRatio >= 1 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ 
                      width: `${Math.min(100, Math.max(0, (riskMetrics.sharpeRatio + 1) * 25))}%` 
                    }}
                  />
                </div>
              </div>

              {/* Drawdown Assessment */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Drawdown Risk
                  </span>
                  <span className={`text-sm font-semibold ${
                    riskMetrics.maxDrawdown <= 5 ? 'text-green-600 dark:text-green-400' :
                    riskMetrics.maxDrawdown <= 15 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {riskMetrics.maxDrawdown <= 5 ? 'Low' :
                     riskMetrics.maxDrawdown <= 15 ? 'Moderate' : 'High'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      riskMetrics.maxDrawdown <= 5 ? 'bg-green-500' :
                      riskMetrics.maxDrawdown <= 15 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, riskMetrics.maxDrawdown * 2)}%` }}
                  />
                </div>
              </div>

              {/* Win Rate Assessment */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Win Rate
                  </span>
                  <span className={`text-sm font-semibold ${
                    riskMetrics.winRate >= 60 ? 'text-green-600 dark:text-green-400' :
                    riskMetrics.winRate >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {formatPercent(riskMetrics.winRate)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      riskMetrics.winRate >= 60 ? 'bg-green-500' :
                      riskMetrics.winRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${riskMetrics.winRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedMetric === 'distribution' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* P&L Distribution Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              P&L Distribution by Grid
            </h3>
            
            {renderDistributionChart()}
          </div>

          {/* Grid Performance Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Individual Grid Performance
            </h3>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {gridPerformances.map((grid) => (
                <div 
                  key={grid.gridId}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      grid.isActive ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {grid.pair}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {grid.fills} fills
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`font-semibold ${
                      grid.pnl >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(grid.pnl)}
                    </div>
                    <div className={`text-sm ${
                      grid.roi >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatPercent(grid.roi)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface PerformanceData {
  timestamp: string;
  pnl: number;
  cumulativePnl: number;
  volume: number;
  fills: number;
}

interface PerformanceChartProps {
  data?: PerformanceData[];
  timeframe?: '1h' | '1d' | '7d' | '30d';
  onTimeframeChange?: (timeframe: string) => void;
}

// Mock performance data
const generateMockData = (days: number): PerformanceData[] => {
  const data: PerformanceData[] = [];
  let cumulativePnl = 0;
  
  for (let i = 0; i < days * 24; i++) {
    const timestamp = new Date(Date.now() - (days * 24 - i) * 60 * 60 * 1000);
    const pnl = (Math.random() - 0.4) * 5; // Slight positive bias
    cumulativePnl += pnl;
    
    data.push({
      timestamp: timestamp.toISOString(),
      pnl,
      cumulativePnl,
      volume: Math.random() * 1000 + 500,
      fills: Math.floor(Math.random() * 5),
    });
  }
  
  return data;
};

const timeframes = [
  { value: '1h', label: '1H', days: 0.04 },
  { value: '1d', label: '1D', days: 1 },
  { value: '7d', label: '7D', days: 7 },
  { value: '30d', label: '30D', days: 30 },
];

export function PerformanceChart({ 
  data,
  timeframe = '7d',
  onTimeframeChange 
}: PerformanceChartProps) {
  const [chartType, setChartType] = useState<'pnl' | 'volume' | 'fills'>('pnl');
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);

  const currentTimeframe = timeframes.find(t => t.value === selectedTimeframe) || timeframes[2];
  const chartData = data || generateMockData(currentTimeframe.days);

  const handleTimeframeChange = (newTimeframe: string) => {
    setSelectedTimeframe(newTimeframe as '1h' | '1d' | '7d' | '30d');
    onTimeframeChange?.(newTimeframe);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (selectedTimeframe === '1h') return date.toLocaleTimeString();
    if (selectedTimeframe === '1d') return date.toLocaleTimeString();
    return date.toLocaleDateString();
  };

  const formatTooltipValue = (value: number, name: string) => {
    if (name === 'pnl' || name === 'cumulativePnl') {
      return [`$${value.toFixed(2)}`, name === 'pnl' ? 'P&L' : 'Cumulative P&L'];
    }
    if (name === 'volume') {
      return [`$${value.toFixed(0)}`, 'Volume'];
    }
    if (name === 'fills') {
      return [value.toString(), 'Fills'];
    }
    return [value, name];
  };

  const renderChart = () => {
    switch (chartType) {
      case 'pnl':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatTimestamp}
                className="text-xs"
              />
              <YAxis 
                tickFormatter={(value) => `$${value}`}
                className="text-xs"
              />
              <Tooltip 
                formatter={formatTooltipValue}
                labelFormatter={formatTimestamp}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulativePnl"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'volume':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatTimestamp}
                className="text-xs"
              />
              <YAxis 
                tickFormatter={(value) => `$${value}`}
                className="text-xs"
              />
              <Tooltip 
                formatter={formatTooltipValue}
                labelFormatter={formatTimestamp}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'fills':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatTimestamp}
                className="text-xs"
              />
              <YAxis className="text-xs" />
              <Tooltip 
                formatter={formatTooltipValue}
                labelFormatter={formatTimestamp}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="fills"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  const latestData = chartData[chartData.length - 1];
  const totalPnL = latestData?.cumulativePnl || 0;
  const totalVolume = chartData.reduce((sum, d) => sum + d.volume, 0);
  const totalFills = chartData.reduce((sum, d) => sum + d.fills, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Performance Analytics
        </h3>
        
        <div className="flex items-center space-x-4">
          {/* Chart Type Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { value: 'pnl', label: 'P&L' },
              { value: 'volume', label: 'Volume' },
              { value: 'fills', label: 'Fills' },
            ].map((type) => (
              <button
                key={type.value}
                onClick={() => setChartType(type.value as any)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  chartType === type.value
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* Timeframe Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => handleTimeframeChange(tf.value)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  selectedTimeframe === tf.value
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className={`text-xl font-bold ${totalPnL >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
            ${totalPnL.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total P&L</div>
        </div>
        
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            ${totalVolume.toFixed(0)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Volume</div>
        </div>
        
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {totalFills}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Fills</div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        {renderChart()}
      </div>

      {/* Chart Legend */}
      <div className="mt-4 flex justify-center">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {chartType === 'pnl' && 'Cumulative profit and loss over time'}
          {chartType === 'volume' && 'Trading volume over time'}
          {chartType === 'fills' && 'Number of order fills over time'}
        </div>
      </div>
    </div>
  );
}
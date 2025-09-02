'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Scatter,
  ComposedChart,
} from 'recharts';
import { format } from 'date-fns';
import {
  TrendingUp,
  Activity,
  Volume2,
} from 'lucide-react';

import { PriceData } from '../../types/trading';
import { SimulatedGrid } from '../../lib/simulation/GridSimulator';

interface PriceChartProps {
  priceHistory: PriceData[];
  gridOrders?: SimulatedGrid[];
  height?: number;
}

interface ChartDataPoint {
  timestamp: string;
  price: number;
  volume: number;
  formattedTime: string;
  ma20?: number;
  ma50?: number;
}

export const PriceChart: React.FC<PriceChartProps> = ({
  priceHistory,
  gridOrders = [],
  height = 400,
}) => {
  const chartData = useMemo(() => {
    if (priceHistory.length === 0) return [];

    // Calculate moving averages
    const data: ChartDataPoint[] = priceHistory.map((point, index) => {
      const timestamp = new Date(point.timestamp);
      
      // Simple moving averages
      let ma20 = undefined;
      let ma50 = undefined;
      
      if (index >= 19) {
        ma20 = priceHistory
          .slice(index - 19, index + 1)
          .reduce((sum, p) => sum + p.price, 0) / 20;
      }
      
      if (index >= 49) {
        ma50 = priceHistory
          .slice(index - 49, index + 1)
          .reduce((sum, p) => sum + p.price, 0) / 50;
      }

      return {
        timestamp: point.timestamp,
        price: point.price,
        volume: point.volume,
        formattedTime: format(timestamp, 'HH:mm:ss'),
        ma20,
        ma50,
      };
    });

    return data;
  }, [priceHistory]);

  const priceStats = useMemo(() => {
    if (priceHistory.length < 2) return null;

    const prices = priceHistory.map(p => p.price);
    const first = prices[0];
    const last = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const change = last - first;
    const changePercent = (change / first) * 100;

    return {
      current: last,
      high,
      low,
      change,
      changePercent,
      volatility: calculateVolatility(prices),
    };
  }, [priceHistory]);

  const gridLevels = useMemo(() => {
    const levels: Array<{ price: number; type: 'buy' | 'sell'; count: number }> = [];
    
    for (const grid of gridOrders) {
      if (grid.status !== 'active') continue;
      
      for (const order of grid.orders) {
        if (order.status === 'pending') {
          const existingLevel = levels.find(l => Math.abs(l.price - order.price) < 0.0001);
          if (existingLevel) {
            existingLevel.count++;
          } else {
            levels.push({
              price: order.price,
              type: order.type,
              count: 1,
            });
          }
        }
      }
    }
    
    return levels;
  }, [gridOrders]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-medium">{format(new Date(data.timestamp), 'PPp')}</p>
          <div className="space-y-1 mt-2">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Price:</span>
              <span className="font-mono">{data.price.toFixed(6)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Volume:</span>
              <span className="font-mono">{data.volume.toFixed(0)}</span>
            </div>
            {data.ma20 && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">MA20:</span>
                <span className="font-mono">{data.ma20.toFixed(6)}</span>
              </div>
            )}
            {data.ma50 && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">MA50:</span>
                <span className="font-mono">{data.ma50.toFixed(6)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Price Chart
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No price data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Price Chart
          </CardTitle>
          
          {priceStats && (
            <div className="flex gap-4 text-sm">
              <div className="text-right">
                <p className="text-muted-foreground">Current</p>
                <p className="font-mono font-medium">{priceStats.current.toFixed(6)}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Change</p>
                <p className={`font-mono font-medium ${priceStats.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {priceStats.change >= 0 ? '+' : ''}{priceStats.changePercent.toFixed(2)}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">H/L</p>
                <p className="font-mono font-medium text-xs">
                  {priceStats.high.toFixed(6)} / {priceStats.low.toFixed(6)}
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Grid order indicators */}
        {gridLevels.length > 0 && (
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className="text-green-600 border-green-200">
              {gridLevels.filter(l => l.type === 'buy').length} Buy Levels
            </Badge>
            <Badge variant="outline" className="text-red-600 border-red-200">
              {gridLevels.filter(l => l.type === 'sell').length} Sell Levels
            </Badge>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="formattedTime"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={['dataMin - 0.01', 'dataMax + 0.01']}
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => value.toFixed(4)}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Moving averages */}
              <Line
                type="monotone"
                dataKey="ma20"
                stroke="#3b82f6"
                strokeWidth={1}
                dot={false}
                connectNulls={false}
                name="MA20"
              />
              <Line
                type="monotone"
                dataKey="ma50"
                stroke="#f59e0b"
                strokeWidth={1}
                dot={false}
                connectNulls={false}
                name="MA50"
              />
              
              {/* Price line */}
              <Line
                type="monotone"
                dataKey="price"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Price"
              />
              
              {/* Grid levels */}
              {gridLevels.map((level, index) => (
                <ReferenceLine
                  key={index}
                  y={level.price}
                  stroke={level.type === 'buy' ? '#10b981' : '#ef4444'}
                  strokeDasharray="5 5"
                  strokeWidth={1}
                  opacity={0.6}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Chart legend */}
        <div className="flex justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-green-500" />
            <span>Price</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-blue-500" />
            <span>MA20</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-yellow-500" />
            <span>MA50</span>
          </div>
          {gridLevels.length > 0 && (
            <>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-green-500 opacity-60" style={{ borderTop: '1px dashed' }} />
                <span>Buy Orders</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-red-500 opacity-60" style={{ borderTop: '1px dashed' }} />
                <span>Sell Orders</span>
              </div>
            </>
          )}
        </div>
        
        {/* Volume chart (mini) */}
        {chartData.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4" />
              <span className="text-sm font-medium">Volume</span>
            </div>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <Line
                    type="monotone"
                    dataKey="volume"
                    stroke="#6b7280"
                    strokeWidth={1}
                    dot={false}
                    fill="#6b7280"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  
  return Math.sqrt(variance * 252); // Annualized
}
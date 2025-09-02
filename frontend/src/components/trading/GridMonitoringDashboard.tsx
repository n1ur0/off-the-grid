'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useGridsStore } from '@/lib/stores/grids';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Pause, 
  Play, 
  Square,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  BarChart3,
  Target,
  Zap
} from 'lucide-react';

interface GridStatus {
  id: string;
  pair: string;
  status: 'active' | 'paused' | 'stopped' | 'completed';
  currentPrice: number;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  pnl: number;
  pnlPercent: number;
  volume24h: number;
  fills24h: number;
  lastActivity: Date;
  activeOrders: number;
  filledOrders: number;
  nextBuyPrice: number;
  nextSellPrice: number;
  gridRange: [number, number];
  efficiency: number;
}

interface DashboardStats {
  totalGrids: number;
  activeGrids: number;
  totalPnL: number;
  totalVolume: number;
  totalFills: number;
  averageEfficiency: number;
}

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';

export function GridMonitoringDashboard() {
  const { grids, fetchGrids } = useGridsStore();
  const [selectedGrid, setSelectedGrid] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // WebSocket connection for real-time updates
  const { connectionState, lastMessage, subscribe, unsubscribe } = useWebSocket({
    url: WEBSOCKET_URL,
    onMessage: (message) => {
      if (message.type === 'grid_update' && message.data) {
        // Update grid store with real-time data
        const gridData = message.data;
        useGridsStore.getState().updateGridPrice(gridData.id, gridData.currentPrice);
      }
    },
    onOpen: () => {
      console.log('WebSocket connected');
    },
    onClose: () => {
      console.log('WebSocket disconnected');
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    }
  });

  // Subscribe to grid updates on mount
  useEffect(() => {
    if (connectionState === 'connected') {
      subscribe('grid_updates');
      subscribe('price_updates');
      subscribe('order_fills');
    }
    
    return () => {
      unsubscribe('grid_updates');
      unsubscribe('price_updates');
      unsubscribe('order_fills');
    };
  }, [connectionState, subscribe, unsubscribe]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchGrids();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchGrids]);

  // Transform grids data for monitoring
  const gridStatuses: GridStatus[] = useMemo(() => {
    return grids.map(grid => ({
      id: grid.id,
      pair: grid.pair,
      status: grid.status,
      currentPrice: grid.currentPrice,
      lastPrice: grid.currentPrice * 0.995, // Mock previous price
      priceChange: grid.currentPrice * 0.005,
      priceChangePercent: 0.5,
      pnl: grid.unrealizedPnL + grid.realizedPnL,
      pnlPercent: ((grid.unrealizedPnL + grid.realizedPnL) / grid.totalInvestment) * 100,
      volume24h: grid.totalInvestment * 0.1, // Mock volume
      fills24h: grid.filledOrders,
      lastActivity: grid.lastActivity,
      activeOrders: grid.gridCount - grid.filledOrders,
      filledOrders: grid.filledOrders,
      nextBuyPrice: grid.lowerPrice,
      nextSellPrice: grid.upperPrice,
      gridRange: [grid.lowerPrice, grid.upperPrice],
      efficiency: Math.random() * 20 + 80, // Mock efficiency 80-100%
    }));
  }, [grids]);

  // Calculate dashboard statistics
  const stats: DashboardStats = useMemo(() => {
    return {
      totalGrids: gridStatuses.length,
      activeGrids: gridStatuses.filter(g => g.status === 'active').length,
      totalPnL: gridStatuses.reduce((sum, g) => sum + g.pnl, 0),
      totalVolume: gridStatuses.reduce((sum, g) => sum + g.volume24h, 0),
      totalFills: gridStatuses.reduce((sum, g) => sum + g.fills24h, 0),
      averageEfficiency: gridStatuses.reduce((sum, g) => sum + g.efficiency, 0) / Math.max(gridStatuses.length, 1),
    };
  }, [gridStatuses]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'stopped':
        return <Square className="h-4 w-4 text-red-500" />;
      case 'completed':
        return <Target className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConnectionIcon = () => {
    switch (connectionState) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'connecting':
        return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />;
      default:
        return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };

  const formatPrice = (price: number) => `$${price.toFixed(4)}`;
  const formatPnL = (pnl: number) => {
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}$${pnl.toFixed(2)}`;
  };
  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Grid Monitoring Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time monitoring of all active grid trading orders
          </p>
        </div>
        
        <div className="flex items-center space-x-4 mt-4 sm:mt-0">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {getConnectionIcon()}
            <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
              {connectionState}
            </span>
          </div>
          
          {/* Auto Refresh Toggle */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded-lg transition-colors ${
                autoRefresh 
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              <Activity className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Auto-refresh
            </span>
          </div>
          
          {/* Manual Refresh */}
          <button
            onClick={() => fetchGrids()}
            className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Dashboard Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Grids</div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {stats.totalGrids}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-green-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Active</div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {stats.activeGrids}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-yellow-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Total P&L</div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${
            stats.totalPnL >= 0 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {formatPnL(stats.totalPnL)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Volume 24h</div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            ${stats.totalVolume.toFixed(0)}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-indigo-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Fills 24h</div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {stats.totalFills}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-orange-500" />
            <div className="text-sm text-gray-600 dark:text-gray-400">Efficiency</div>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {stats.averageEfficiency.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Grid Status Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Active Grid Orders
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Grid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  P&L
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Next Levels
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Efficiency
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {gridStatuses.map((grid) => (
                <tr 
                  key={grid.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                    selectedGrid === grid.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                  onClick={() => setSelectedGrid(grid.id === selectedGrid ? null : grid.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(grid.status)}
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {grid.pair}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {grid.id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatPrice(grid.currentPrice)}
                    </div>
                    <div className={`text-sm flex items-center space-x-1 ${
                      grid.priceChange >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {grid.priceChange >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span>{formatPercent(grid.priceChangePercent)}</span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${
                      grid.pnl >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatPnL(grid.pnl)}
                    </div>
                    <div className={`text-sm ${
                      grid.pnlPercent >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatPercent(grid.pnlPercent)}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {grid.fills24h} fills
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(grid.lastActivity).toLocaleTimeString()}</span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {grid.activeOrders} active
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {grid.filledOrders} filled
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-green-600 dark:text-green-400">
                      Buy: {formatPrice(grid.nextBuyPrice)}
                    </div>
                    <div className="text-sm text-red-600 dark:text-red-400">
                      Sell: {formatPrice(grid.nextSellPrice)}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${grid.efficiency}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400 w-12">
                        {grid.efficiency.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {gridStatuses.length === 0 && (
          <div className="text-center py-12">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No grids</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating your first grid trading order.
            </p>
          </div>
        )}
      </div>

      {/* Selected Grid Details */}
      {selectedGrid && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          {(() => {
            const grid = gridStatuses.find(g => g.id === selectedGrid);
            if (!grid) return null;
            
            return (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Grid Details: {grid.pair}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Current Price</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatPrice(grid.currentPrice)}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Grid Range</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      {formatPrice(grid.gridRange[0])} - {formatPrice(grid.gridRange[1])}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">24h Volume</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">
                      ${grid.volume24h.toFixed(0)}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
                    <div className="flex items-center space-x-2 mt-1">
                      {getStatusIcon(grid.status)}
                      <span className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                        {grid.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
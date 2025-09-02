'use client';

import { useState } from 'react';
import { EyeIcon, StopIcon, Cog6ToothIcon, ChartBarIcon } from '@heroicons/react/24/outline';

interface GridOrder {
  id: string;
  pair: string;
  status: 'active' | 'paused' | 'stopped';
  lowerPrice: number;
  upperPrice: number;
  currentPrice: number;
  gridCount: number;
  totalInvestment: number;
  filledOrders: number;
  unrealizedPnL: number;
  realizedPnL: number;
  createdAt: Date;
  lastActivity: Date;
  strategy: 'arithmetic' | 'geometric' | 'adaptive';
}

interface ActiveGridsProps {
  grids?: GridOrder[];
  onViewDetails?: (gridId: string) => void;
  onStopGrid?: (gridId: string) => void;
  onPauseGrid?: (gridId: string) => void;
  onConfigureGrid?: (gridId: string) => void;
}

// Mock data for demonstration
const mockGrids: GridOrder[] = [
  {
    id: 'grid-1',
    pair: 'ERG/USDT',
    status: 'active',
    lowerPrice: 0.5,
    upperPrice: 2.0,
    currentPrice: 1.23,
    gridCount: 12,
    totalInvestment: 100,
    filledOrders: 8,
    unrealizedPnL: 12.45,
    realizedPnL: 8.67,
    createdAt: new Date('2024-01-15'),
    lastActivity: new Date(),
    strategy: 'arithmetic',
  },
  {
    id: 'grid-2',
    pair: 'ERG/BTC',
    status: 'active',
    lowerPrice: 0.00001,
    upperPrice: 0.00005,
    currentPrice: 0.000032,
    gridCount: 15,
    totalInvestment: 200,
    filledOrders: 10,
    unrealizedPnL: -5.23,
    realizedPnL: 15.89,
    createdAt: new Date('2024-01-10'),
    lastActivity: new Date(Date.now() - 5 * 60 * 1000),
    strategy: 'geometric',
  },
  {
    id: 'grid-3',
    pair: 'SigUSD/ERG',
    status: 'paused',
    lowerPrice: 0.3,
    upperPrice: 0.8,
    currentPrice: 0.65,
    gridCount: 10,
    totalInvestment: 150,
    filledOrders: 6,
    unrealizedPnL: 3.21,
    realizedPnL: 4.56,
    createdAt: new Date('2024-01-20'),
    lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
    strategy: 'adaptive',
  },
];

export function ActiveGrids({ 
  grids = mockGrids,
  onViewDetails,
  onStopGrid,
  onPauseGrid,
  onConfigureGrid 
}: ActiveGridsProps) {
  const [sortBy, setSortBy] = useState<'pnl' | 'created' | 'activity'>('pnl');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'paused'>('all');

  const filteredGrids = grids
    .filter(grid => filterStatus === 'all' || grid.status === filterStatus)
    .sort((a, b) => {
      switch (sortBy) {
        case 'pnl':
          return (b.unrealizedPnL + b.realizedPnL) - (a.unrealizedPnL + a.realizedPnL);
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'activity':
          return b.lastActivity.getTime() - a.lastActivity.getTime();
        default:
          return 0;
      }
    });

  const getStatusColor = (status: GridOrder['status']) => {
    switch (status) {
      case 'active':
        return 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-300';
      case 'paused':
        return 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-300';
      case 'stopped':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return 'text-success-600 dark:text-success-400';
    if (pnl < 0) return 'text-danger-600 dark:text-danger-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Active Grid Orders
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {filteredGrids.length} grid{filteredGrids.length !== 1 ? 's' : ''} 
            {filterStatus !== 'all' && ` (${filterStatus})`}
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="pnl">Sort by P&L</option>
            <option value="created">Sort by Created</option>
            <option value="activity">Sort by Activity</option>
          </select>
        </div>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredGrids.map((grid) => {
          const totalPnL = grid.unrealizedPnL + grid.realizedPnL;
          const fillRate = (grid.filledOrders / grid.gridCount) * 100;
          const pnlPercent = (totalPnL / grid.totalInvestment) * 100;

          return (
            <div
              key={grid.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {grid.pair}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {grid.strategy} • {grid.gridCount} levels
                  </p>
                </div>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(grid.status)}`}>
                  {grid.status}
                </span>
              </div>

              {/* Key Metrics */}
              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Current Price</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ${grid.currentPrice.toFixed(4)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Range</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    ${grid.lowerPrice} - ${grid.upperPrice}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Fill Rate</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {grid.filledOrders}/{grid.gridCount}
                    </span>
                    <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div 
                        className="bg-primary-500 h-2 rounded-full" 
                        style={{ width: `${fillRate}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total P&L</span>
                  <div className="text-right">
                    <div className={`font-bold ${getPnLColor(totalPnL)}`}>
                      ${totalPnL.toFixed(2)}
                    </div>
                    <div className={`text-xs ${getPnLColor(pnlPercent)}`}>
                      ({pnlPercent > 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <span>Price Position</span>
                  <span>{((grid.currentPrice - grid.lowerPrice) / (grid.upperPrice - grid.lowerPrice) * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div 
                    className="bg-primary-500 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${((grid.currentPrice - grid.lowerPrice) / (grid.upperPrice - grid.lowerPrice)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Last Activity */}
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Last activity: {formatTimeAgo(grid.lastActivity)}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => onViewDetails?.(grid.id)}
                  className="flex items-center space-x-1 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium transition-colors"
                >
                  <EyeIcon className="h-4 w-4" />
                  <span>Details</span>
                </button>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onConfigureGrid?.(grid.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Configure"
                  >
                    <Cog6ToothIcon className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => onStopGrid?.(grid.id)}
                    className="p-2 text-danger-400 hover:text-danger-600 dark:hover:text-danger-300 transition-colors"
                    title="Stop Grid"
                  >
                    <StopIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredGrids.length === 0 && (
        <div className="text-center py-12">
          <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No active grids
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {filterStatus === 'all' 
              ? "You haven't created any grid trading strategies yet."
              : `No grids with status "${filterStatus}".`
            }
          </p>
          <button className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">
            Create Your First Grid
          </button>
        </div>
      )}

      {/* Summary Stats */}
      {filteredGrids.length > 0 && (
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Portfolio Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {grids.filter(g => g.status === 'active').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Grids</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {grids.reduce((sum, g) => sum + g.totalInvestment, 0).toFixed(0)} ERG
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Invested</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getPnLColor(grids.reduce((sum, g) => sum + g.unrealizedPnL + g.realizedPnL, 0))}`}>
                ${grids.reduce((sum, g) => sum + g.unrealizedPnL + g.realizedPnL, 0).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total P&L</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {grids.reduce((sum, g) => sum + g.filledOrders, 0)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Fills</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
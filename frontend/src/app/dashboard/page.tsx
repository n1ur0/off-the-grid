import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard - Off the Grid',
  description: 'Monitor your grid trading performance and portfolio',
};

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Trading Dashboard
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Monitor your active grids and portfolio performance
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Active Grids', value: '3', change: '+1', trend: 'up' },
          { label: 'Total Volume', value: '₿ 2.45', change: '+0.34', trend: 'up' },
          { label: 'Total PnL', value: '+$1,234', change: '+$456', trend: 'up' },
          { label: 'Success Rate', value: '87%', change: '+2%', trend: 'up' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stat.value}
                </p>
              </div>
              <div className={`flex items-center text-sm font-medium ${
                stat.trend === 'up' 
                  ? 'text-success-600 dark:text-success-400' 
                  : 'text-danger-600 dark:text-danger-400'
              }`}>
                {stat.trend === 'up' ? '↗' : '↘'} {stat.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Active Grid Orders
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[
                { pair: 'ERG/USDT', range: '$0.50 - $2.00', orders: 12, filled: 8 },
                { pair: 'ERG/BTC', range: '0.00001 - 0.00005', orders: 15, filled: 10 },
                { pair: 'SigUSD/ERG', range: '0.3 - 0.8', orders: 10, filled: 6 },
              ].map((grid, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{grid.pair}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Range: {grid.range}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {grid.filled}/{grid.orders} filled
                    </p>
                    <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-1">
                      <div 
                        className="bg-primary-500 h-2 rounded-full" 
                        style={{ width: `${(grid.filled / grid.orders) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <button className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2 px-4 rounded-lg font-medium transition-colors">
                View All Grids
              </button>
            </div>
          </div>
        </div>

        {/* Performance Chart Placeholder */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Performance Overview
            </h2>
          </div>
          <div className="p-6">
            <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <p className="text-gray-600 dark:text-gray-400">Performance chart</p>
                <p className="text-sm text-gray-500 dark:text-gray-500">Coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button className="flex items-center p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors">
          <span className="text-2xl mr-3">⚡</span>
          <div className="text-left">
            <p className="font-medium text-primary-700 dark:text-primary-300">Create New Grid</p>
            <p className="text-sm text-primary-600 dark:text-primary-400">Set up a new trading grid</p>
          </div>
        </button>
        
        <button className="flex items-center p-4 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg hover:bg-success-100 dark:hover:bg-success-900/30 transition-colors">
          <span className="text-2xl mr-3">📚</span>
          <div className="text-left">
            <p className="font-medium text-success-700 dark:text-success-300">Learn More</p>
            <p className="text-sm text-success-600 dark:text-success-400">Educational modules</p>
          </div>
        </button>
        
        <button className="flex items-center p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg hover:bg-warning-100 dark:hover:bg-warning-900/30 transition-colors">
          <span className="text-2xl mr-3">⚙️</span>
          <div className="text-left">
            <p className="font-medium text-warning-700 dark:text-warning-300">Settings</p>
            <p className="text-sm text-warning-600 dark:text-warning-400">Configure preferences</p>
          </div>
        </button>
      </div>
    </div>
  );
}
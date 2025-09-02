import { Metadata } from 'next';
import CompetencyGuard from '@/components/validation/CompetencyGuard';

export const metadata: Metadata = {
  title: 'Create Grid - Off the Grid',
  description: 'Configure and deploy automated grid trading strategies',
};

export default function TradePage() {
  return (
    <CompetencyGuard 
      requiredLevel="basic"
      requiredFeatures={['live_trading', 'grid_creation']}
      showProgress={true}
      redirectOnFail="/certification"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Create Grid Trading Strategy
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure your automated grid trading parameters and deploy to the Ergo blockchain
          </p>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                {['Basic', 'Advanced', 'Review'].map((tab, index) => (
                  <button
                    key={tab}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      index === 0
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            {/* Form Content */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Trading Pair */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Trading Pair
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white">
                    <option>ERG/USDT</option>
                    <option>ERG/BTC</option>
                    <option>SigUSD/ERG</option>
                    <option>Custom Pair</option>
                  </select>
                </div>

                {/* Price Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Lower Price ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.50"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Upper Price ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="2.00"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* Grid Parameters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Number of Grids
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="50"
                      placeholder="10"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Investment Amount (ERG)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="100.0"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* Strategy Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Grid Strategy
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { name: 'Arithmetic', desc: 'Equal price intervals' },
                      { name: 'Geometric', desc: 'Equal percentage intervals' },
                      { name: 'Adaptive', desc: 'Dynamic based on volatility' },
                    ].map((strategy) => (
                      <div key={strategy.name} className="relative">
                        <input
                          type="radio"
                          name="strategy"
                          value={strategy.name}
                          className="sr-only"
                          defaultChecked={strategy.name === 'Arithmetic'}
                        />
                        <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {strategy.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {strategy.desc}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          {/* Grid Visualization */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Grid Preview
            </h3>
            <div className="h-64 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl mb-2">📊</div>
                <p className="text-gray-600 dark:text-gray-400">Grid visualization</p>
                <p className="text-sm text-gray-500 dark:text-gray-500">Configure parameters to see preview</p>
              </div>
            </div>
          </div>

          {/* Estimated Returns */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Estimated Performance
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Daily Volume</span>
                <span className="font-medium text-gray-900 dark:text-white">~$2,340</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Est. APY</span>
                <span className="font-medium text-success-600 dark:text-success-400">12.5%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Max Drawdown</span>
                <span className="font-medium text-danger-600 dark:text-danger-400">-15.2%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Risk Score</span>
                <span className="font-medium text-warning-600 dark:text-warning-400">Medium</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                * Estimates based on historical data and current market conditions
              </div>
            </div>
          </div>

          {/* Risk Warning */}
          <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-warning-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-warning-800 dark:text-warning-200">
                  Risk Disclosure
                </h3>
                <div className="mt-2 text-sm text-warning-700 dark:text-warning-300">
                  <p>
                    Grid trading involves financial risk. Past performance doesn't guarantee future results. 
                    Only invest what you can afford to lose.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Deploy Button */}
          <button className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Deploy Grid Strategy
          </button>
        </div>
      </div>
      </div>
    </CompetencyGuard>
  );
}
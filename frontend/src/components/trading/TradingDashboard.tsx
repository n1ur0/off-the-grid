'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  GridMonitoringDashboard, 
  PerformanceAnalytics, 
  AlertSystem, 
  PortfolioOverview 
} from './index';
import { 
  BarChart3, 
  Activity, 
  Bell, 
  PieChart,
  Grid3x3,
  TrendingUp,
  Settings,
  Menu,
  X
} from 'lucide-react';

type DashboardView = 'overview' | 'monitoring' | 'analytics' | 'alerts' | 'portfolio';

interface DashboardTab {
  id: DashboardView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const DASHBOARD_TABS: DashboardTab[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: BarChart3,
    description: 'Portfolio summary and key metrics'
  },
  {
    id: 'monitoring',
    label: 'Grid Monitor',
    icon: Grid3x3,
    description: 'Real-time grid order monitoring'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: TrendingUp,
    description: 'Performance analytics and P&L tracking'
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: Bell,
    description: 'Real-time notifications and alert management'
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: PieChart,
    description: 'Portfolio management and risk analysis'
  }
];

export function TradingDashboard() {
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const renderContent = () => {
    switch (activeView) {
      case 'overview':
        return <PortfolioOverview />;
      case 'monitoring':
        return <GridMonitoringDashboard />;
      case 'analytics':
        return <PerformanceAnalytics />;
      case 'alerts':
        return <AlertSystem />;
      case 'portfolio':
        return <PortfolioOverview />;
      default:
        return <PortfolioOverview />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Loading Trading Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Initializing real-time monitoring systems...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity lg:hidden z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.div 
        initial={false}
        animate={{ x: sidebarOpen ? 0 : -100 }}
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Off the Grid
          </h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-8 px-4">
          <div className="space-y-2">
            {DASHBOARD_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveView(tab.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeView === tab.id
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                <tab.icon className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div>{tab.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {tab.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <div className="text-sm">
              <div className="font-medium text-gray-900 dark:text-white">Live Mode</div>
              <div className="text-gray-500 dark:text-gray-400">Real-time trading</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <Menu className="h-5 w-5" />
              </button>
              
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {DASHBOARD_TABS.find(tab => tab.id === activeView)?.label}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {DASHBOARD_TABS.find(tab => tab.id === activeView)?.description}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Connected</span>
              </div>
              
              {/* Settings Button */}
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-7xl mx-auto"
          >
            {renderContent()}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
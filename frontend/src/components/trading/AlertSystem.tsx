'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useGridsStore } from '@/lib/stores/grids';
import { 
  Bell, 
  BellRing, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  X,
  Settings,
  Volume2,
  VolumeX,
  Trash2,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Alert {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  gridId?: string;
  timestamp: Date;
  read: boolean;
  dismissed: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'grid' | 'price' | 'order' | 'system' | 'performance';
  soundEnabled: boolean;
  data?: any;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  category: 'price' | 'pnl' | 'volume' | 'grid_status' | 'performance';
  condition: 'above' | 'below' | 'equals' | 'change_percent';
  value: number;
  comparison_period?: '1m' | '5m' | '15m' | '1h' | '1d';
  notification_sound: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  gridIds?: string[]; // If empty, applies to all grids
}

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';

const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'price-surge-10',
    name: 'Price Surge +10%',
    enabled: true,
    category: 'price',
    condition: 'change_percent',
    value: 10,
    comparison_period: '15m',
    notification_sound: true,
    priority: 'high',
  },
  {
    id: 'price-drop-10',
    name: 'Price Drop -10%',
    enabled: true,
    category: 'price',
    condition: 'change_percent',
    value: -10,
    comparison_period: '15m',
    notification_sound: true,
    priority: 'high',
  },
  {
    id: 'pnl-profit-100',
    name: 'Profit Exceeds $100',
    enabled: true,
    category: 'pnl',
    condition: 'above',
    value: 100,
    notification_sound: false,
    priority: 'medium',
  },
  {
    id: 'pnl-loss-50',
    name: 'Loss Exceeds $50',
    enabled: true,
    category: 'pnl',
    condition: 'below',
    value: -50,
    notification_sound: true,
    priority: 'high',
  },
  {
    id: 'grid-stopped',
    name: 'Grid Stopped',
    enabled: true,
    category: 'grid_status',
    condition: 'equals',
    value: 0, // Custom handling for status changes
    notification_sound: true,
    priority: 'critical',
  },
];

export function AlertSystem() {
  const { grids } = useGridsStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>(DEFAULT_ALERT_RULES);
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const previousGridData = useRef<Map<string, any>>(new Map());

  // WebSocket connection for real-time alerts
  const { connectionState, lastMessage } = useWebSocket({
    url: WEBSOCKET_URL,
    onMessage: (message) => {
      if (message.type === 'alert' && message.data) {
        const alertData = message.data;
        addAlert({
          type: alertData.severity || 'info',
          title: alertData.title,
          message: alertData.message,
          gridId: alertData.grid_id,
          priority: alertData.priority || 'medium',
          category: alertData.category || 'system',
          soundEnabled: alertData.sound_enabled !== false,
          data: alertData,
        });
      }
    }
  });

  const addAlert = useCallback((alertData: Partial<Alert>) => {
    const newAlert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'info',
      title: 'Alert',
      message: '',
      timestamp: new Date(),
      read: false,
      dismissed: false,
      priority: 'medium',
      category: 'system',
      soundEnabled: false,
      ...alertData,
    };

    setAlerts(prev => [newAlert, ...prev.slice(0, 99)]); // Keep last 100 alerts

    // Play sound if enabled
    if (soundEnabled && newAlert.soundEnabled && audioRef.current) {
      audioRef.current.play().catch(console.warn);
    }

    // Auto-dismiss low priority alerts after 5 seconds
    if (newAlert.priority === 'low') {
      setTimeout(() => {
        setAlerts(prev => prev.map(alert => 
          alert.id === newAlert.id ? { ...alert, dismissed: true } : alert
        ));
      }, 5000);
    }
  }, [soundEnabled]);

  // Check alert rules against current grid data
  const checkAlertRules = useCallback(() => {
    grids.forEach(grid => {
      const previousData = previousGridData.current.get(grid.id);
      
      alertRules.forEach(rule => {
        if (!rule.enabled) return;
        if (rule.gridIds && rule.gridIds.length > 0 && !rule.gridIds.includes(grid.id)) return;

        let shouldTrigger = false;
        let alertMessage = '';
        let alertTitle = '';

        switch (rule.category) {
          case 'price':
            if (rule.condition === 'change_percent' && previousData) {
              const priceChange = ((grid.currentPrice - previousData.currentPrice) / previousData.currentPrice) * 100;
              if ((rule.value > 0 && priceChange >= rule.value) || 
                  (rule.value < 0 && priceChange <= rule.value)) {
                shouldTrigger = true;
                alertTitle = `${grid.pair} Price ${priceChange > 0 ? 'Surge' : 'Drop'}`;
                alertMessage = `Price changed by ${priceChange.toFixed(2)}% to $${grid.currentPrice.toFixed(4)}`;
              }
            }
            break;

          case 'pnl':
            const totalPnL = grid.unrealizedPnL + grid.realizedPnL;
            if ((rule.condition === 'above' && totalPnL >= rule.value) ||
                (rule.condition === 'below' && totalPnL <= rule.value)) {
              shouldTrigger = true;
              alertTitle = `${grid.pair} P&L ${totalPnL > 0 ? 'Profit' : 'Loss'}`;
              alertMessage = `P&L reached $${totalPnL.toFixed(2)}`;
            }
            break;

          case 'grid_status':
            if (previousData && previousData.status !== grid.status) {
              shouldTrigger = true;
              alertTitle = `${grid.pair} Status Changed`;
              alertMessage = `Grid status changed from ${previousData.status} to ${grid.status}`;
            }
            break;

          case 'performance':
            // Custom performance checks could go here
            break;
        }

        if (shouldTrigger) {
          addAlert({
            type: rule.priority === 'critical' ? 'error' : 
                  rule.priority === 'high' ? 'warning' :
                  rule.priority === 'medium' ? 'info' : 'info',
            title: alertTitle,
            message: alertMessage,
            gridId: grid.id,
            priority: rule.priority,
            category: 'grid',
            soundEnabled: rule.notification_sound,
          });
        }
      });

      // Store current data for next comparison
      previousGridData.current.set(grid.id, {
        currentPrice: grid.currentPrice,
        status: grid.status,
        unrealizedPnL: grid.unrealizedPnL,
        realizedPnL: grid.realizedPnL,
      });
    });
  }, [grids, alertRules, addAlert]);

  // Run alert checks periodically
  useEffect(() => {
    const interval = setInterval(checkAlertRules, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkAlertRules]);

  // Filter alerts based on preferences
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (alert.dismissed) return false;
      if (showUnreadOnly && alert.read) return false;
      return true;
    });
  }, [alerts, showUnreadOnly]);

  const unreadCount = alerts.filter(alert => !alert.read && !alert.dismissed).length;

  const getAlertIcon = (type: Alert['type'], priority: Alert['priority']) => {
    if (priority === 'critical') {
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }
    
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getAlertBgColor = (type: Alert['type'], priority: Alert['priority']) => {
    if (priority === 'critical') {
      return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    }
    
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  const markAsRead = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    ));
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, dismissed: true } : alert
    ));
  };

  const markAllAsRead = () => {
    setAlerts(prev => prev.map(alert => ({ ...alert, read: true })));
  };

  const clearAllAlerts = () => {
    setAlerts(prev => prev.map(alert => ({ ...alert, dismissed: true })));
  };

  const updateAlertRule = (ruleId: string, updates: Partial<AlertRule>) => {
    setAlertRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, ...updates } : rule
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            {unreadCount > 0 ? (
              <BellRing className="h-6 w-6 text-yellow-500" />
            ) : (
              <Bell className="h-6 w-6 text-gray-400" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Alert System
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Real-time notifications for significant events
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4 mt-4 sm:mt-0">
          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg transition-colors ${
              soundEnabled 
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
            title="Toggle sound notifications"
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={`p-2 rounded-lg transition-colors ${
              showUnreadOnly 
                ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
            title="Show unread only"
          >
            {showUnreadOnly ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </button>
          
          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Settings className="h-5 w-5" />
          </button>
          
          {/* Actions */}
          <div className="flex space-x-2">
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Mark All Read
            </button>
            <button
              onClick={clearAllAlerts}
              className="px-3 py-1 text-sm bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Alert Rules Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Alert Rules Configuration
            </h3>
            
            <div className="space-y-4">
              {alertRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => updateAlertRule(rule.id, { enabled: !rule.enabled })}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        rule.enabled
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {rule.enabled && <CheckCircle className="h-3 w-3" />}
                    </button>
                    
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {rule.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {rule.category} • Priority: {rule.priority}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateAlertRule(rule.id, { notification_sound: !rule.notification_sound })}
                      className={`p-1 rounded transition-colors ${
                        rule.notification_sound 
                          ? 'text-blue-500' 
                          : 'text-gray-400'
                      }`}
                    >
                      {rule.notification_sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    </button>
                    
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      rule.priority === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      rule.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                      rule.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {rule.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alerts List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredAlerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className={`p-4 rounded-lg border transition-all duration-200 ${getAlertBgColor(alert.type, alert.priority)} ${
                !alert.read ? 'shadow-md' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getAlertIcon(alert.type, alert.priority)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className={`font-medium ${!alert.read ? 'font-semibold' : ''} text-gray-900 dark:text-white`}>
                          {alert.title}
                        </h4>
                        {!alert.read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          alert.priority === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          alert.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                          alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}>
                          {alert.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {alert.message}
                      </p>
                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>{alert.timestamp.toLocaleTimeString()}</span>
                        <span className="capitalize">{alert.category}</span>
                        {alert.gridId && (
                          <span>Grid: {alert.gridId.slice(0, 8)}...</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      {!alert.read && (
                        <button
                          onClick={() => markAsRead(alert.id)}
                          className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                          title="Mark as read"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Dismiss"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {filteredAlerts.length === 0 && (
          <div className="text-center py-12">
            <Bell className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              {showUnreadOnly ? 'No unread alerts' : 'No alerts'}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {showUnreadOnly 
                ? 'All alerts have been read'
                : 'Alert notifications will appear here when triggered'
              }
            </p>
          </div>
        )}
      </div>

      {/* Hidden audio element for notifications */}
      <audio
        ref={audioRef}
        preload="auto"
        className="hidden"
      >
        <source src="/sounds/notification.mp3" type="audio/mpeg" />
        <source src="/sounds/notification.wav" type="audio/wav" />
        {/* Fallback to system notification sound */}
      </audio>
    </div>
  );
}
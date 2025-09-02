'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Settings,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Target,
  AlertTriangle,
} from 'lucide-react';

import { GridSimulator, SimulationConfig, SimulationSession } from '../../lib/simulation/GridSimulator';
import { PriceGenerator, MarketScenario } from '../../lib/simulation/PriceGenerator';
import { PerformanceTracker, PerformanceReport } from '../../lib/simulation/PerformanceTracker';
import { GridConfig, TokenInfo, PriceData } from '../../types/trading';
import { PracticePortfolio } from '../../types/education';

import { SimulationControls } from './SimulationControls';
import { PerformanceDashboard } from './PerformanceDashboard';
import { GridConfigurationPanel } from './GridConfigurationPanel';
import { PriceChart } from './PriceChart';
import { OrderBookSimulator } from './OrderBookSimulator';

interface PracticeTradingSimulatorProps {
  tokenInfo: TokenInfo;
  initialPrice: number;
  onSessionComplete: (session: SimulationSession, report: PerformanceReport) => void;
  onProgressUpdate: (progress: {
    sessionTime: number;
    tradesExecuted: number;
    profitLoss: number;
  }) => void;
}

const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  duration: 60, // 1 hour
  timeAcceleration: 10, // 10x speed
  volatility: 0.2, // 20% annual volatility
  trend: 0.05, // 5% annual trend
  marketCondition: 'sideways',
  slippage: 0.001, // 0.1% slippage
  fees: 0.003, // 0.3% fees
};

const DEFAULT_PORTFOLIO: PracticePortfolio = {
  erg: 10000, // 10,000 ERG
  tokens: {},
  totalValue: 10000,
};

export const PracticeTradingSimulator: React.FC<PracticeTradingSimulatorProps> = ({
  tokenInfo,
  initialPrice,
  onSessionComplete,
  onProgressUpdate,
}) => {
  // Core simulation state
  const [simulator] = useState(() => new GridSimulator(tokenInfo, initialPrice));
  const [priceGenerator] = useState(() => new PriceGenerator(initialPrice));
  const [performanceTracker] = useState(() => new PerformanceTracker());
  
  // UI state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSession, setCurrentSession] = useState<SimulationSession | null>(null);
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig>(DEFAULT_SIMULATION_CONFIG);
  const [portfolio, setPortfolio] = useState<PracticePortfolio>(DEFAULT_PORTFOLIO);
  
  // Grid trading state
  const [activeGrids, setActiveGrids] = useState<Map<string, any>>(new Map());
  const [gridConfigs, setGridConfigs] = useState<GridConfig[]>([]);
  
  // Performance and analytics
  const [performanceReport, setPerformanceReport] = useState<PerformanceReport | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceData[]>([]);
  const [currentPrice, setCurrentPrice] = useState(initialPrice);
  
  // UI state
  const [activeTab, setActiveTab] = useState('trading');
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
    timestamp: Date;
  }>>([]);

  // Refs for intervals
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Initialize price history
  useEffect(() => {
    const initialHistory = priceGenerator.generateHistoricalData(1, simulationConfig);
    setPriceHistory(initialHistory);
    setCurrentPrice(initialHistory[initialHistory.length - 1].price);
  }, [priceGenerator, simulationConfig]);

  // Start simulation
  const startSimulation = useCallback(() => {
    try {
      const session = simulator.startSimulation(simulationConfig, portfolio);
      setCurrentSession(session);
      setIsRunning(true);
      setIsPaused(false);
      
      addNotification('info', 'Practice trading session started!');
      
      // Start update loop
      updateIntervalRef.current = setInterval(() => {
        updateSimulationState();
      }, 100); // Update UI every 100ms
      
    } catch (error) {
      addNotification('error', `Failed to start simulation: ${error}`);
    }
  }, [simulator, simulationConfig, portfolio]);

  // Pause simulation
  const pauseSimulation = useCallback(() => {
    if (!currentSession) return;
    
    simulator.pauseSimulation();
    setIsPaused(true);
    
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    
    addNotification('info', 'Simulation paused');
  }, [simulator, currentSession]);

  // Resume simulation
  const resumeSimulation = useCallback(() => {
    if (!currentSession) return;
    
    simulator.resumeSimulation();
    setIsPaused(false);
    
    updateIntervalRef.current = setInterval(() => {
      updateSimulationState();
    }, 100);
    
    addNotification('info', 'Simulation resumed');
  }, [simulator, currentSession]);

  // Stop simulation
  const stopSimulation = useCallback(() => {
    if (!currentSession) return;
    
    const finalSession = simulator.stopSimulation();
    setIsRunning(false);
    setIsPaused(false);
    
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    
    // Generate final performance report
    const report = performanceTracker.generateComprehensiveReport(
      finalSession.initialPortfolio.totalValue,
      finalSession.currentPortfolio.totalValue,
      finalSession.orderExecutions,
      finalSession.priceHistory,
      finalSession.startTime
    );
    
    setPerformanceReport(report);
    onSessionComplete(finalSession, report);
    
    addNotification('success', `Session completed! Total return: ${(report.summary.totalReturn * 100).toFixed(2)}%`);
  }, [simulator, currentSession, performanceTracker, onSessionComplete]);

  // Reset simulation
  const resetSimulation = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    
    setIsRunning(false);
    setIsPaused(false);
    setCurrentSession(null);
    setActiveGrids(new Map());
    setPortfolio(DEFAULT_PORTFOLIO);
    setPriceHistory([]);
    setPerformanceReport(null);
    setNotifications([]);
    
    // Reinitialize price history
    const initialHistory = priceGenerator.generateHistoricalData(1, simulationConfig);
    setPriceHistory(initialHistory);
    setCurrentPrice(initialHistory[initialHistory.length - 1].price);
    
    addNotification('info', 'Simulation reset');
  }, [priceGenerator, simulationConfig]);

  // Update simulation state
  const updateSimulationState = useCallback(() => {
    const session = simulator.getSession();
    if (!session) return;
    
    setCurrentSession({ ...session });
    setPortfolio({ ...session.currentPortfolio });
    setActiveGrids(new Map(session.grids));
    
    // Update price history and current price
    if (session.priceHistory.length > 0) {
      setPriceHistory([...session.priceHistory]);
      setCurrentPrice(simulator.getCurrentPrice());
    }
    
    // Update performance metrics
    const currentTime = Date.now();
    const sessionTime = Math.floor((currentTime - session.startTime.getTime()) / 1000);
    
    onProgressUpdate({
      sessionTime,
      tradesExecuted: session.orderExecutions.length,
      profitLoss: session.currentPortfolio.totalValue - session.initialPortfolio.totalValue,
    });
    
    // Check for order executions and show notifications
    const recentExecutions = session.orderExecutions.filter(
      e => Date.now() - e.timestamp.getTime() < 1000
    );
    
    for (const execution of recentExecutions) {
      if (execution.successful) {
        addNotification(
          'success',
          `${execution.type.toUpperCase()} order executed at ${execution.price.toFixed(4)} ERG`
        );
      }
    }
    
  }, [simulator, onProgressUpdate]);

  // Create grid order
  const createGrid = useCallback((config: GridConfig) => {
    if (!currentSession || !isRunning) {
      addNotification('warning', 'Start a simulation session first');
      return;
    }
    
    try {
      const gridId = simulator.createGrid(config);
      setGridConfigs(prev => [...prev, { ...config, gridIdentity: gridId }]);
      addNotification('success', `Grid order created with ${config.orderCount} levels`);
    } catch (error) {
      addNotification('error', `Failed to create grid: ${error}`);
    }
  }, [simulator, currentSession, isRunning]);

  // Cancel grid order
  const cancelGrid = useCallback((gridId: string) => {
    try {
      simulator.cancelGrid(gridId);
      setGridConfigs(prev => prev.filter(g => g.gridIdentity !== gridId));
      addNotification('info', 'Grid order cancelled');
    } catch (error) {
      addNotification('error', `Failed to cancel grid: ${error}`);
    }
  }, [simulator]);

  // Add notification
  const addNotification = useCallback((
    type: 'success' | 'warning' | 'error' | 'info',
    message: string
  ) => {
    const id = Math.random().toString(36).substring(7);
    const notification = { id, type, message, timestamp: new Date() };
    
    setNotifications(prev => [notification, ...prev.slice(0, 4)]); // Keep only 5 recent
    
    // Auto-remove after 5 seconds
    notificationTimeoutRef.current[id] = setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
      delete notificationTimeoutRef.current[id];
    }, 5000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      Object.values(notificationTimeoutRef.current).forEach(clearTimeout);
    };
  }, []);

  // Format currency
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }, []);

  // Calculate session progress
  const sessionProgress = currentSession ? 
    Math.min(((Date.now() - currentSession.startTime.getTime()) / 1000) / (simulationConfig.duration * 60) * 100, 100) : 0;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
      {/* Header with controls */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">Practice Trading Simulator</CardTitle>
              <p className="text-muted-foreground mt-1">
                Learn grid trading with realistic market simulation
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={startSimulation}
                disabled={isRunning}
                className="bg-green-600 hover:bg-green-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Start
              </Button>
              
              {isRunning && (
                <>
                  <Button
                    onClick={isPaused ? resumeSimulation : pauseSimulation}
                    variant="outline"
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </Button>
                  
                  <Button
                    onClick={stopSimulation}
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Square className="w-4 h-4" />
                  </Button>
                </>
              )}
              
              <Button
                onClick={resetSimulation}
                variant="outline"
                disabled={isRunning && !isPaused}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              
              <Button
                onClick={() => setShowSettings(!showSettings)}
                variant="outline"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Session status */}
          {currentSession && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Session Progress</span>
                <span className="text-sm text-muted-foreground">
                  {Math.floor(sessionProgress)}% Complete
                </span>
              </div>
              <Progress value={sessionProgress} className="h-2" />
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Portfolio Value</span>
              </div>
              <p className="text-lg font-bold mt-1">
                {formatCurrency(portfolio.totalValue)} ERG
              </p>
              {currentSession && (
                <p className="text-sm text-muted-foreground">
                  {portfolio.totalValue >= currentSession.initialPortfolio.totalValue ? '+' : ''}
                  {formatCurrency(portfolio.totalValue - currentSession.initialPortfolio.totalValue)}
                </p>
              )}
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">Current Price</span>
              </div>
              <p className="text-lg font-bold mt-1">
                {currentPrice.toFixed(4)} ERG
              </p>
              <p className="text-sm text-muted-foreground">
                {tokenInfo.symbol}
              </p>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium">Active Grids</span>
              </div>
              <p className="text-lg font-bold mt-1">
                {activeGrids.size}
              </p>
              <p className="text-sm text-muted-foreground">
                {gridConfigs.reduce((sum, g) => sum + g.orderCount, 0)} orders
              </p>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium">Trades</span>
              </div>
              <p className="text-lg font-bold mt-1">
                {currentSession?.orderExecutions.length || 0}
              </p>
              <p className="text-sm text-muted-foreground">
                Executed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
          {notifications.map((notification) => (
            <Alert
              key={notification.id}
              variant={notification.type === 'error' ? 'destructive' : 'default'}
              className={`transition-all duration-300 ${
                notification.type === 'success' ? 'border-green-200 bg-green-50' :
                notification.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                notification.type === 'info' ? 'border-blue-200 bg-blue-50' : ''
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{notification.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Main content tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="chart">Price Chart</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="orders">Order Book</TabsTrigger>
        </TabsList>

        <TabsContent value="trading" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <GridConfigurationPanel
                tokenInfo={tokenInfo}
                currentPrice={currentPrice}
                portfolio={portfolio}
                onCreateGrid={createGrid}
                disabled={!isRunning || isPaused}
              />
            </div>
            
            <div>
              <SimulationControls
                config={simulationConfig}
                onConfigChange={setSimulationConfig}
                isRunning={isRunning}
                show={showSettings}
                onToggle={() => setShowSettings(!showSettings)}
              />
            </div>
          </div>
          
          {/* Active grids list */}
          {activeGrids.size > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Grid Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from(activeGrids.entries()).map(([gridId, grid]) => (
                    <div key={gridId} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant={grid.status === 'active' ? 'default' : 'secondary'}>
                          {grid.status}
                        </Badge>
                        <div>
                          <p className="font-medium">Grid #{gridId.slice(0, 8)}</p>
                          <p className="text-sm text-muted-foreground">
                            {grid.orders.length} orders • {grid.filledOrders.length} filled
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className={`font-medium ${grid.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {grid.profitLoss >= 0 ? '+' : ''}{formatCurrency(grid.profitLoss)}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelGrid(gridId)}
                          disabled={grid.status !== 'active'}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="chart">
          <PriceChart
            priceHistory={priceHistory}
            gridOrders={Array.from(activeGrids.values())}
            height={500}
          />
        </TabsContent>

        <TabsContent value="performance">
          {currentSession && (
            <PerformanceDashboard
              session={currentSession}
              report={performanceReport}
            />
          )}
        </TabsContent>

        <TabsContent value="orders">
          <OrderBookSimulator
            currentPrice={currentPrice}
            activeGrids={Array.from(activeGrids.values())}
            recentExecutions={currentSession?.orderExecutions.slice(-20) || []}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlayIcon, 
  PauseIcon, 
  ArrowPathIcon, 
  ChartBarIcon,
  CogIcon,
  BoltIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface CandlestickData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface GridOrder {
  id: string;
  price: number;
  type: 'buy' | 'sell';
  amount: number;
  filled: boolean;
  fillTime?: Date;
  profit?: number;
}

interface MarketScenario {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  volatility: number;
  trend: 'bullish' | 'bearish' | 'sideways';
  duration: number; // in simulation steps
}

interface GridSimulatorProps {
  initialCapital?: number;
  defaultGridSpacing?: number;
  enableAdvancedFeatures?: boolean;
}

const MARKET_SCENARIOS: MarketScenario[] = [
  {
    id: 'sideways',
    name: 'Sideways Market',
    description: 'Ideal for grid trading - price oscillates within a range',
    icon: ArrowTrendingUpIcon,
    volatility: 0.02,
    trend: 'sideways',
    duration: 100
  },
  {
    id: 'bullish',
    name: 'Bull Market',
    description: 'Rising trend - grid orders gradually fill upward',
    icon: ArrowTrendingUpIcon,
    volatility: 0.015,
    trend: 'bullish',
    duration: 80
  },
  {
    id: 'bearish',
    name: 'Bear Market',
    description: 'Falling trend - buy orders accumulate position',
    icon: ArrowTrendingDownIcon,
    volatility: 0.018,
    trend: 'bearish',
    duration: 80
  },
  {
    id: 'volatile',
    name: 'High Volatility',
    description: 'Rapid price swings - frequent grid executions',
    icon: BoltIcon,
    volatility: 0.04,
    trend: 'sideways',
    duration: 120
  }
];

export function GridSimulator({
  initialCapital = 10000,
  defaultGridSpacing = 0.05,
  enableAdvancedFeatures = true
}: GridSimulatorProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<MarketScenario>(MARKET_SCENARIOS[0]);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [priceData, setPriceData] = useState<CandlestickData[]>([]);
  const [gridOrders, setGridOrders] = useState<GridOrder[]>([]);
  const [portfolio, setPortfolio] = useState({
    cash: initialCapital,
    position: 0,
    realizedPnL: 0,
    unrealizedPnL: 0
  });
  
  // Grid configuration
  const [gridConfig, setGridConfig] = useState({
    centerPrice: 1.0,
    priceRange: [0.8, 1.2] as [number, number],
    gridSpacing: defaultGridSpacing,
    orderAmount: 100
  });

  const [currentStep, setCurrentStep] = useState(0);

  // Initialize simulation data
  const initializeSimulation = useCallback(() => {
    const initialPrice = gridConfig.centerPrice;
    const initialCandle: CandlestickData = {
      timestamp: new Date(),
      open: initialPrice,
      high: initialPrice,
      low: initialPrice,
      close: initialPrice,
      volume: 1000
    };
    
    setPriceData([initialCandle]);
    setCurrentStep(0);
    setPortfolio({
      cash: initialCapital,
      position: 0,
      realizedPnL: 0,
      unrealizedPnL: 0
    });

    // Generate grid orders
    const orders: GridOrder[] = [];
    const [minPrice, maxPrice] = gridConfig.priceRange;
    const numOrders = Math.floor((maxPrice - minPrice) / gridConfig.gridSpacing);
    
    for (let i = 0; i <= numOrders; i++) {
      const price = parseFloat((minPrice + i * gridConfig.gridSpacing).toFixed(4));
      if (price >= minPrice && price <= maxPrice && price !== initialPrice) {
        orders.push({
          id: `order-${i}`,
          price,
          type: price < initialPrice ? 'buy' : 'sell',
          amount: gridConfig.orderAmount,
          filled: false
        });
      }
    }
    
    setGridOrders(orders);
  }, [gridConfig, initialCapital]);

  // Generate realistic price movement based on scenario
  const generateNextCandle = useCallback((prevCandle: CandlestickData, scenario: MarketScenario, step: number): CandlestickData => {
    const { volatility, trend } = scenario;
    
    // Base trend component
    let trendComponent = 0;
    if (trend === 'bullish') {
      trendComponent = 0.001 + (step / 1000) * 0.0005;
    } else if (trend === 'bearish') {
      trendComponent = -0.001 - (step / 1000) * 0.0005;
    }
    
    // Random volatility
    const randomChange = (Math.random() - 0.5) * volatility;
    
    // Mean reversion for sideways markets
    const meanReversionStrength = trend === 'sideways' ? 0.1 : 0.05;
    const centerPrice = (gridConfig.priceRange[0] + gridConfig.priceRange[1]) / 2;
    const meanReversion = (centerPrice - prevCandle.close) * meanReversionStrength * 0.01;
    
    const totalChange = trendComponent + randomChange + meanReversion;
    
    // Generate OHLC
    const open = prevCandle.close;
    const priceMove = open * totalChange;
    const high = open + Math.abs(priceMove) + (Math.random() * open * volatility * 0.5);
    const low = open - Math.abs(priceMove) - (Math.random() * open * volatility * 0.5);
    const close = Math.max(low, Math.min(high, open + priceMove));
    
    return {
      timestamp: new Date(prevCandle.timestamp.getTime() + 60000), // 1 minute intervals
      open: parseFloat(open.toFixed(4)),
      high: parseFloat(high.toFixed(4)),
      low: parseFloat(low.toFixed(4)),
      close: parseFloat(close.toFixed(4)),
      volume: Math.floor(800 + Math.random() * 400)
    };
  }, [gridConfig]);

  // Process order fills
  const processOrderFills = useCallback((newPrice: number) => {
    setGridOrders(prevOrders => {
      const updatedOrders = [...prevOrders];
      let newRealizedPnL = 0;
      
      prevOrders.forEach((order, index) => {
        if (order.filled) return;
        
        const shouldFill = order.type === 'buy' 
          ? newPrice <= order.price 
          : newPrice >= order.price;
          
        if (shouldFill) {
          const profit = order.type === 'buy'
            ? (newPrice - order.price) * order.amount
            : (order.price - newPrice) * order.amount;
            
          updatedOrders[index] = {
            ...order,
            filled: true,
            fillTime: new Date(),
            profit
          };
          
          newRealizedPnL += profit;
          
          // Update portfolio
          setPortfolio(prev => ({
            ...prev,
            cash: prev.cash - (order.type === 'buy' ? order.price * order.amount : -order.price * order.amount),
            position: prev.position + (order.type === 'buy' ? order.amount : -order.amount),
            realizedPnL: prev.realizedPnL + newRealizedPnL
          }));
        }
      });
      
      return updatedOrders;
    });
  }, []);

  // Main simulation loop
  useEffect(() => {
    if (!isRunning || currentStep >= currentScenario.duration) return;

    const interval = setInterval(() => {
      setPriceData(prevData => {
        if (prevData.length === 0) return prevData;
        
        const lastCandle = prevData[prevData.length - 1];
        const newCandle = generateNextCandle(lastCandle, currentScenario, currentStep);
        
        // Process order fills
        processOrderFills(newCandle.close);
        
        const newData = [...prevData, newCandle].slice(-100); // Keep last 100 candles
        return newData;
      });
      
      setCurrentStep(prev => prev + 1);
    }, 1000 / simulationSpeed);

    return () => clearInterval(interval);
  }, [isRunning, currentScenario, currentStep, simulationSpeed, generateNextCandle, processOrderFills]);

  // Calculate unrealized PnL
  const currentPrice = priceData[priceData.length - 1]?.close || gridConfig.centerPrice;
  const unrealizedPnL = useMemo(() => {
    return portfolio.position * currentPrice - (portfolio.position * gridConfig.centerPrice);
  }, [portfolio.position, currentPrice, gridConfig.centerPrice]);

  const resetSimulation = useCallback(() => {
    setIsRunning(false);
    initializeSimulation();
  }, [initializeSimulation]);

  const toggleSimulation = () => {
    if (currentStep >= currentScenario.duration) {
      resetSimulation();
    } else {
      setIsRunning(!isRunning);
    }
  };

  // Initialize on mount and config changes
  useEffect(() => {
    initializeSimulation();
  }, [initializeSimulation]);

  const filledOrders = gridOrders.filter(order => order.filled);
  const buyOrders = gridOrders.filter(order => order.type === 'buy');
  const sellOrders = gridOrders.filter(order => order.type === 'sell');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-6"
    >
      {/* Header with Scenario Selection */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <motion.h2 
            className="text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-0"
            layoutId="simulator-title"
          >
            Grid Trading Simulator
          </motion.h2>
          
          <div className="flex items-center space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleSimulation}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isRunning
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                  : currentStep >= currentScenario.duration
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                  : 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
              }`}
            >
              {isRunning ? (
                <PauseIcon className="h-4 w-4" />
              ) : currentStep >= currentScenario.duration ? (
                <ArrowPathIcon className="h-4 w-4" />
              ) : (
                <PlayIcon className="h-4 w-4" />
              )}
              {isRunning ? 'Pause' : currentStep >= currentScenario.duration ? 'Restart' : 'Start'}
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={resetSimulation}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Reset
            </motion.button>
          </div>
        </div>

        {/* Market Scenario Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Market Scenario
          </label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {MARKET_SCENARIOS.map((scenario) => (
              <motion.button
                key={scenario.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentScenario(scenario)}
                className={`p-3 rounded-lg border text-left transition-all duration-200 ${
                  currentScenario.id === scenario.id
                    ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <scenario.icon className="h-4 w-4" />
                  <span className="font-medium text-sm">{scenario.name}</span>
                </div>
                <p className="text-xs opacity-75">{scenario.description}</p>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Portfolio Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 text-center border border-green-200 dark:border-green-700"
          >
            <motion.div
              animate={{ color: portfolio.cash >= initialCapital ? '#059669' : '#dc2626' }}
              className="text-lg font-bold"
            >
              ${portfolio.cash.toFixed(2)}
            </motion.div>
            <div className="text-xs text-green-600 dark:text-green-400 font-medium">Available Cash</div>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 text-center border border-blue-200 dark:border-blue-700"
          >
            <motion.div
              key={currentPrice}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className="text-lg font-bold text-gray-900 dark:text-white"
            >
              ${currentPrice.toFixed(4)}
            </motion.div>
            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Current Price</div>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 text-center border border-purple-200 dark:border-purple-700"
          >
            <motion.div
              className="text-lg font-bold text-gray-900 dark:text-white"
            >
              {portfolio.position.toFixed(2)}
            </motion.div>
            <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">Position Size</div>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            className={`rounded-lg p-4 text-center border ${
              portfolio.realizedPnL >= 0
                ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700'
                : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700'
            }`}
          >
            <motion.div
              key={portfolio.realizedPnL}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className={`text-lg font-bold ${
                portfolio.realizedPnL >= 0 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              ${portfolio.realizedPnL.toFixed(2)}
            </motion.div>
            <div className={`text-xs font-medium ${
              portfolio.realizedPnL >= 0 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              Realized P&L
            </div>
          </motion.div>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            className={`rounded-lg p-4 text-center border ${
              unrealizedPnL >= 0
                ? 'bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 border-cyan-200 dark:border-cyan-700'
                : 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700'
            }`}
          >
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                color: unrealizedPnL >= 0 ? '#0891b2' : '#ea580c'
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-lg font-bold"
            >
              ${unrealizedPnL.toFixed(2)}
            </motion.div>
            <div className={`text-xs font-medium ${
              unrealizedPnL >= 0 
                ? 'text-cyan-600 dark:text-cyan-400' 
                : 'text-orange-600 dark:text-orange-400'
            }`}>
              Unrealized P&L
            </div>
          </motion.div>
        </div>
      </div>

      {/* Advanced Controls */}
      <AnimatePresence>
        {enableAdvancedFeatures && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Simulation Speed: {simulationSpeed}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={simulationSpeed}
                  onChange={(e) => setSimulationSpeed(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Grid Spacing: {(gridConfig.gridSpacing * 100).toFixed(1)}%
                </label>
                <input
                  type="range"
                  min="0.01"
                  max="0.1"
                  step="0.005"
                  value={gridConfig.gridSpacing}
                  onChange={(e) => setGridConfig(prev => ({ ...prev, gridSpacing: parseFloat(e.target.value) }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Order Amount: ${gridConfig.orderAmount}
                </label>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="25"
                  value={gridConfig.orderAmount}
                  onChange={(e) => setGridConfig(prev => ({ ...prev, orderAmount: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Price Chart */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
            <ChartBarIcon className="h-5 w-5" />
            <span>Price Chart</span>
          </h3>
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <motion.div
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-gray-400'}`}
            />
            <span>Step {currentStep}/{currentScenario.duration}</span>
          </div>
        </div>
        
        <motion.div
          className="h-64 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
          animate={{ borderColor: isRunning ? '#3b82f6' : '#d1d5db' }}
          transition={{ duration: 0.3 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={priceData.map(candle => ({ 
              time: candle.timestamp.toLocaleTimeString(), 
              price: candle.close 
            }))}>
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                domain={['dataMin - 0.01', 'dataMax + 0.01']}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value.toFixed(3)}`}
              />
              <Tooltip
                formatter={(value: number) => [`$${value.toFixed(4)}`, 'Price']}
                labelStyle={{ color: '#374151' }}
                contentStyle={{
                  backgroundColor: '#f9fafb',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px'
                }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
                animationDuration={300}
              />
              {/* Grid level reference lines */}
              {gridOrders.slice(0, 5).map(order => (
                <ReferenceLine
                  key={order.id}
                  y={order.price}
                  stroke={order.type === 'buy' ? '#22c55e' : '#ef4444'}
                  strokeDasharray="5 5"
                  strokeOpacity={0.6}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Grid Orders Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Orders */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
        >
          <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center justify-between">
            <span>Active Grid Orders</span>
            <span className="text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded-full">
              {gridOrders.filter(o => !o.filled).length} active
            </span>
          </h4>
          
          <div className="max-h-48 overflow-y-auto space-y-2">
            <AnimatePresence>
              {gridOrders.filter(o => !o.filled).slice(0, 8).map((order, index) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    order.type === 'buy'
                      ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-700'
                      : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      order.type === 'buy' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium">
                      {order.type.toUpperCase()} ${order.amount}
                    </span>
                  </div>
                  <span className="text-sm font-mono">${order.price.toFixed(4)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Filled Orders */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
        >
          <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center justify-between">
            <span>Executed Trades</span>
            <span className="text-sm bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-full">
              {filledOrders.length} filled
            </span>
          </h4>
          
          <div className="max-h-48 overflow-y-auto space-y-2">
            <AnimatePresence>
              {filledOrders.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-sm text-gray-500 dark:text-gray-400"
                >
                  <ChartBarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No trades executed yet</p>
                  <p className="text-xs mt-1">Start simulation to see trades</p>
                </motion.div>
              ) : (
                filledOrders.slice(-8).reverse().map((order, index) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center justify-between p-2 rounded-lg border ${
                      order.type === 'buy'
                        ? 'bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-600'
                        : 'bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-600'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <motion.div
                        className={`w-3 h-3 rounded-full ${
                          order.type === 'buy' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.5 }}
                      />
                      <div>
                        <span className={`text-sm font-bold ${
                          order.type === 'buy' 
                            ? 'text-green-700 dark:text-green-300' 
                            : 'text-red-700 dark:text-red-300'
                        }`}>
                          {order.type.toUpperCase()} ${order.amount}
                        </span>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          @ ${order.price.toFixed(4)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <motion.div
                        className={`text-sm font-bold ${
                          (order.profit ?? 0) >= 0 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}
                        initial={{ scale: 1.2 }}
                        animate={{ scale: 1 }}
                      >
                        ${(order.profit ?? 0).toFixed(2)}
                      </motion.div>
                      {order.fillTime && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {order.fillTime.toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Progress Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-6"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Simulation Progress
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {Math.round((currentStep / currentScenario.duration) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(currentStep / currentScenario.duration) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        
        {currentStep >= currentScenario.duration && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700"
          >
            <div className="text-sm text-blue-800 dark:text-blue-300 text-center">
              <strong>Simulation Complete!</strong> Final P&L: ${(portfolio.realizedPnL + unrealizedPnL).toFixed(2)}
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
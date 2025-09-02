'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useTouchDrag } from '@/hooks/useTouchDrag';
import {
  GridBuilderConfig,
  GridLevel,
  PriceRange,
  SmartDefaults,
  ProfitabilityMetrics,
  RiskAssessment,
  MarketConditions,
  GridValidation,
  DragDropState,
  TokenInfo
} from '@/types/trading';
import {
  calculateSmartDefaults,
  generateGridLevels,
  priceToPosition,
  positionToPrice,
  calculateProfitabilityMetrics,
  assessRisk,
  validateGridConfig,
  updateGridLevelPosition
} from '@/lib/gridCalculations';

interface GridBuilderProps {
  tokenInfo: TokenInfo;
  availableBalance: number;
  currentPrice: number;
  marketConditions: MarketConditions;
  onConfigChange: (config: GridBuilderConfig) => void;
  onCreateGrid: (config: GridBuilderConfig) => Promise<void>;
  className?: string;
}

export function GridBuilder({
  tokenInfo,
  availableBalance,
  currentPrice,
  marketConditions,
  onConfigChange,
  onCreateGrid,
  className
}: GridBuilderProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartHeight] = useState(400);
  
  // Grid configuration state
  const [config, setConfig] = useState<GridBuilderConfig>({
    tokenId: tokenInfo.id,
    baseAmount: 0,
    orderCount: 10,
    priceRange: { min: currentPrice * 0.8, max: currentPrice * 1.2 },
    strategy: 'arithmetic',
    mode: 'practice',
    riskLevel: 'moderate'
  });

  // Smart defaults and calculations
  const [smartDefaults, setSmartDefaults] = useState<SmartDefaults | null>(null);
  const [gridLevels, setGridLevels] = useState<GridLevel[]>([]);
  const [profitabilityMetrics, setProfitabilityMetrics] = useState<ProfitabilityMetrics | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [validation, setValidation] = useState<GridValidation | null>(null);
  
  // Drag and drop state
  const [dragState, setDragState] = useState<DragDropState>({
    isDragging: false,
    draggedLevel: null,
    dragOffset: { x: 0, y: 0 },
    previewPrice: null
  });

  // UI state
  const [useSmartDefaults, setUseSmartDefaults] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Calculate smart defaults on mount and when conditions change
  useEffect(() => {
    const defaults = calculateSmartDefaults(
      currentPrice,
      availableBalance,
      marketConditions,
      tokenInfo.symbol
    );
    setSmartDefaults(defaults);
    
    if (useSmartDefaults) {
      setConfig(prev => ({
        ...prev,
        priceRange: defaults.priceRange,
        orderCount: defaults.optimalOrderCount,
        baseAmount: defaults.recommendedInvestment,
        riskLevel: defaults.riskLevel
      }));
    }
  }, [currentPrice, availableBalance, marketConditions, tokenInfo.symbol, useSmartDefaults]);

  // Recalculate grid levels and metrics when config changes
  useEffect(() => {
    const levels = generateGridLevels(config, currentPrice);
    setGridLevels(levels);
    
    const metrics = calculateProfitabilityMetrics(config, levels, currentPrice, marketConditions);
    setProfitabilityMetrics(metrics);
    
    const risk = assessRisk(config, availableBalance, marketConditions);
    setRiskAssessment(risk);
    
    const validationResult = validateGridConfig(config, currentPrice, availableBalance);
    setValidation(validationResult);
    
    onConfigChange(config);
  }, [config, currentPrice, marketConditions, availableBalance, onConfigChange]);

  // Handle price range drag with touch support
  const createRangeDragHandler = useCallback((type: 'min' | 'max') => {
    const { dragHandlers } = useTouchDrag({
      onDragStart: (event) => {
        const rect = chartRef.current?.getBoundingClientRect();
        if (!rect) return;
        // Touch/mouse start handled by the hook
      },
      onDragMove: (event) => {
        const rect = chartRef.current?.getBoundingClientRect();
        if (!rect) return;

        const position = 'touches' in event 
          ? event.touches[0] || event.changedTouches[0]
          : event as MouseEvent;
        
        const currentY = position.clientY - rect.top;
        const newPrice = positionToPrice(currentY, config.priceRange, chartHeight);
        
        setConfig(prev => ({
          ...prev,
          priceRange: {
            ...prev.priceRange,
            [type]: Math.max(0.01, newPrice)
          }
        }));
      },
      onDragEnd: () => {
        // Cleanup handled by the hook
      }
    });
    
    return dragHandlers;
  }, [config.priceRange, chartHeight]);

  const maxRangeDragHandlers = createRangeDragHandler('max');
  const minRangeDragHandlers = createRangeDragHandler('min');

  // Handle grid level drag with touch support
  const createLevelDragHandler = useCallback((level: GridLevel) => {
    const { dragHandlers } = useTouchDrag({
      onDragStart: (event) => {
        const rect = chartRef.current?.getBoundingClientRect();
        if (!rect) return;

        const position = 'touches' in event 
          ? event.touches[0] || event.changedTouches[0]
          : event as MouseEvent;

        setDragState({
          isDragging: true,
          draggedLevel: level,
          dragOffset: { x: position.clientX - rect.left, y: position.clientY - rect.top },
          previewPrice: level.price
        });
      },
      onDragMove: (event) => {
        const rect = chartRef.current?.getBoundingClientRect();
        if (!rect) return;

        const position = 'touches' in event 
          ? event.touches[0] || event.changedTouches[0]
          : event as MouseEvent;
        
        const currentY = position.clientY - rect.top;
        const newPrice = positionToPrice(currentY, config.priceRange, chartHeight);
        
        setDragState(prev => ({
          ...prev,
          previewPrice: newPrice
        }));
      },
      onDragEnd: (event) => {
        const rect = chartRef.current?.getBoundingClientRect();
        if (!rect) return;

        const position = 'touches' in event 
          ? event.changedTouches[0]
          : event as MouseEvent;
        
        const currentY = position.clientY - rect.top;
        
        // Update the grid level position
        setGridLevels(prev => 
          updateGridLevelPosition(prev, level.id, currentY, config.priceRange, chartHeight)
        );
        
        setDragState({
          isDragging: false,
          draggedLevel: null,
          dragOffset: { x: 0, y: 0 },
          previewPrice: null
        });
      }
    });
    
    return dragHandlers;
  }, [config.priceRange, chartHeight]);

  // Handle configuration changes
  const handleConfigChange = useCallback((updates: Partial<GridBuilderConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    setUseSmartDefaults(false);
  }, []);

  // Apply smart defaults
  const handleApplySmartDefaults = useCallback(() => {
    if (smartDefaults) {
      setConfig(prev => ({
        ...prev,
        priceRange: smartDefaults.priceRange,
        orderCount: smartDefaults.optimalOrderCount,
        baseAmount: smartDefaults.recommendedInvestment,
        riskLevel: smartDefaults.riskLevel
      }));
      setUseSmartDefaults(true);
    }
  }, [smartDefaults]);

  // Create grid
  const handleCreateGrid = useCallback(async () => {
    if (!validation?.isValid) return;
    
    setIsCreating(true);
    try {
      await onCreateGrid(config);
    } finally {
      setIsCreating(false);
    }
  }, [config, validation, onCreateGrid]);

  // Render price chart with draggable elements
  const renderPriceChart = () => {
    const currentPricePosition = priceToPosition(currentPrice, config.priceRange, chartHeight);
    
    return (
      <div 
        ref={chartRef}
        className="relative w-full bg-gray-50 dark:bg-gray-900 rounded-lg border"
        style={{ height: chartHeight }}
      >
        {/* Price scale */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gray-100 dark:bg-gray-800 border-r">
          <div className="relative h-full">
            {Array.from({ length: 6 }, (_, i) => {
              const pricePercent = i / 5;
              const price = config.priceRange.max - pricePercent * (config.priceRange.max - config.priceRange.min);
              const position = pricePercent * chartHeight;
              
              return (
                <div
                  key={i}
                  className="absolute text-xs text-gray-600 dark:text-gray-400 -translate-y-2"
                  style={{ top: position, left: 4 }}
                >
                  {price.toFixed(4)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart area */}
        <div className="absolute left-16 right-0 top-0 bottom-0">
          {/* Grid background lines */}
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 h-px bg-gray-200 dark:bg-gray-700"
              style={{ top: (i / 5) * chartHeight }}
            />
          ))}

          {/* Current price line */}
          <div
            className="absolute left-0 right-0 h-0.5 bg-blue-500 z-10"
            style={{ top: currentPricePosition }}
          >
            <div className="absolute right-2 -top-3 text-xs font-medium text-blue-600 bg-white dark:bg-gray-800 px-2 py-1 rounded">
              Current: {currentPrice.toFixed(4)}
            </div>
          </div>

          {/* Price range selectors */}
          <div
            className="absolute left-0 right-0 h-1 bg-green-400 cursor-ns-resize hover:bg-green-500 z-20 touch-none select-none"
            style={{ top: priceToPosition(config.priceRange.max, config.priceRange, chartHeight) }}
            {...maxRangeDragHandlers}
          >
            <div className="absolute right-2 -top-3 text-xs font-medium text-green-600 bg-white dark:bg-gray-800 px-2 py-1 rounded pointer-events-none">
              Max: {config.priceRange.max.toFixed(4)}
            </div>
          </div>

          <div
            className="absolute left-0 right-0 h-1 bg-red-400 cursor-ns-resize hover:bg-red-500 z-20 touch-none select-none"
            style={{ top: priceToPosition(config.priceRange.min, config.priceRange, chartHeight) }}
            {...minRangeDragHandlers}
          >
            <div className="absolute right-2 -top-3 text-xs font-medium text-red-600 bg-white dark:bg-gray-800 px-2 py-1 rounded pointer-events-none">
              Min: {config.priceRange.min.toFixed(4)}
            </div>
          </div>

          {/* Grid levels */}
          {gridLevels.map((level) => {
            const levelDragHandlers = createLevelDragHandler(level);
            return (
              <div
                key={level.id}
                className={cn(
                  'absolute left-4 right-4 h-2 rounded cursor-grab active:cursor-grabbing z-30 transition-all touch-none select-none',
                  level.type === 'buy' 
                    ? 'bg-green-200 dark:bg-green-800 hover:bg-green-300 active:bg-green-400' 
                    : 'bg-red-200 dark:bg-red-800 hover:bg-red-300 active:bg-red-400',
                  dragState.draggedLevel?.id === level.id && 'opacity-50 scale-105'
                )}
                style={{ 
                  top: level.position - 4 // Center the level indicator
                }}
                {...levelDragHandlers}
              >
                <div className="absolute left-2 -top-1 text-xs font-medium pointer-events-none">
                  {level.type.toUpperCase()}
                </div>
                <div className="absolute right-2 -top-1 text-xs pointer-events-none">
                  {level.price.toFixed(4)}
                </div>
              </div>
            );
          })}

          {/* Drag preview */}
          {dragState.isDragging && dragState.previewPrice && (
            <div className="absolute left-4 right-4 h-2 bg-blue-300 dark:bg-blue-600 rounded opacity-75 z-40">
              <div className="absolute right-2 -top-3 text-xs font-medium text-blue-600 bg-white dark:bg-gray-800 px-1 rounded">
                {dragState.previewPrice.toFixed(4)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader
          title="Grid Configuration"
          description={`Configure your ${tokenInfo.symbol}/ERG trading grid`}
          action={
            <div className="flex items-center space-x-2">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.mode === 'practice'}
                  onChange={(e) => handleConfigChange({ 
                    mode: e.target.checked ? 'practice' : 'live' 
                  })}
                  className="rounded"
                />
                <span>Practice Mode</span>
              </label>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleApplySmartDefaults}
                disabled={!smartDefaults}
              >
                Use Smart Defaults
              </Button>
            </div>
          }
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price Chart */}
        <Card>
          <CardHeader title="Price Chart & Grid Levels" />
          <CardContent>
            {renderPriceChart()}
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              <p>Drag the colored bars to adjust price ranges and grid levels.</p>
              <div className="flex items-center space-x-4 mt-2">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-200 rounded"></div>
                  <span>Buy Orders</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-red-200 rounded"></div>
                  <span>Sell Orders</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-1 bg-blue-500 rounded"></div>
                  <span>Current Price</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Panel */}
        <div className="space-y-4">
          {/* Basic Settings */}
          <Card>
            <CardHeader title="Grid Settings" />
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Investment Amount (ERG)</label>
                <input
                  type="number"
                  value={config.baseAmount}
                  onChange={(e) => handleConfigChange({ baseAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                  min="0"
                  max={availableBalance}
                  step="0.1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Available: {availableBalance.toFixed(2)} ERG
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Order Count: {config.orderCount}
                </label>
                <Slider
                  value={[config.orderCount]}
                  onValueChange={([value]) => handleConfigChange({ orderCount: value })}
                  min={2}
                  max={50}
                  step={1}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Strategy</label>
                <select
                  value={config.strategy}
                  onChange={(e) => handleConfigChange({ 
                    strategy: e.target.value as 'arithmetic' | 'geometric' | 'adaptive' 
                  })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                >
                  <option value="arithmetic">Arithmetic (Equal spacing)</option>
                  <option value="geometric">Geometric (More orders near current price)</option>
                  <option value="adaptive">Adaptive (Dynamic spacing)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Risk Level</label>
                <select
                  value={config.riskLevel}
                  onChange={(e) => handleConfigChange({ 
                    riskLevel: e.target.value as 'conservative' | 'moderate' | 'aggressive' 
                  })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                >
                  <option value="conservative">Conservative</option>
                  <option value="moderate">Moderate</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Smart Defaults */}
          {smartDefaults && (
            <Card>
              <CardHeader title="Smart Recommendations" />
              <CardContent>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {smartDefaults.reasoning}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Optimal Orders:</span>
                    <span className="ml-2">{smartDefaults.optimalOrderCount}</span>
                  </div>
                  <div>
                    <span className="font-medium">Recommended Investment:</span>
                    <span className="ml-2">{smartDefaults.recommendedInvestment.toFixed(2)} ERG</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Metrics and Risk Assessment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profitability Metrics */}
        {profitabilityMetrics && (
          <Card>
            <CardHeader title="Profitability Analysis" />
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Estimated Annual Profit:</span>
                  <span className="font-medium text-green-600">
                    {profitabilityMetrics.estimatedProfit.toFixed(2)} ERG
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ROI:</span>
                  <span className="font-medium">
                    {profitabilityMetrics.roiPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Break-even Price:</span>
                  <span>{profitabilityMetrics.breakEvenPrice.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Drawdown:</span>
                  <span className="text-red-600">
                    {profitabilityMetrics.maxDrawdown.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Fee Impact:</span>
                  <span>{profitabilityMetrics.feeImpact.toFixed(2)} ERG</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Risk Assessment */}
        {riskAssessment && (
          <Card>
            <CardHeader title="Risk Assessment" />
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Risk Score:</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-gray-200 rounded">
                      <div 
                        className={cn(
                          'h-2 rounded transition-all',
                          riskAssessment.riskScore < 30 ? 'bg-green-500' :
                          riskAssessment.riskScore < 70 ? 'bg-yellow-500' : 'bg-red-500'
                        )}
                        style={{ width: `${riskAssessment.riskScore}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {riskAssessment.riskScore.toFixed(0)}/100
                    </span>
                  </div>
                </div>
                
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Recommended Size:</span>
                    <span className="font-medium">
                      {riskAssessment.positionSizeRecommendation.toFixed(2)} ERG
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Maximum Loss:</span>
                    <span className="text-red-600">
                      {riskAssessment.maxLoss.toFixed(2)} ERG
                    </span>
                  </div>
                </div>

                {riskAssessment.riskWarnings.length > 0 && (
                  <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                    <div className="text-xs font-medium text-yellow-800 dark:text-yellow-400 mb-1">
                      Risk Warnings:
                    </div>
                    {riskAssessment.riskWarnings.map((warning, index) => (
                      <div key={index} className="text-xs text-yellow-700 dark:text-yellow-300">
                        • {warning}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Validation and Actions */}
      {validation && (
        <Card>
          <CardContent>
            {validation.errors.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="font-medium text-red-800 dark:text-red-400 mb-1">Errors:</div>
                {validation.errors.map((error, index) => (
                  <div key={index} className="text-red-700 dark:text-red-300 text-sm">
                    • {error}
                  </div>
                ))}
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="font-medium text-yellow-800 dark:text-yellow-400 mb-1">Warnings:</div>
                {validation.warnings.map((warning, index) => (
                  <div key={index} className="text-yellow-700 dark:text-yellow-300 text-sm">
                    • {warning}
                  </div>
                ))}
              </div>
            )}

            {validation.suggestions.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="font-medium text-blue-800 dark:text-blue-400 mb-1">Suggestions:</div>
                {validation.suggestions.map((suggestion, index) => (
                  <div key={index} className="text-blue-700 dark:text-blue-300 text-sm">
                    • {suggestion}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => handleConfigChange({ mode: config.mode === 'practice' ? 'live' : 'practice' })}
              >
                Switch to {config.mode === 'practice' ? 'Live' : 'Practice'} Mode
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateGrid}
                disabled={!validation.isValid || isCreating}
                loading={isCreating}
              >
                Create {config.mode === 'practice' ? 'Practice' : ''} Grid
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
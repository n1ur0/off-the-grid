'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Target,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Calculator,
  Info,
} from 'lucide-react';

import { GridConfig, TokenInfo } from '../../types/trading';
import { PracticePortfolio } from '../../types/education';

interface GridConfigurationPanelProps {
  tokenInfo: TokenInfo;
  currentPrice: number;
  portfolio: PracticePortfolio;
  onCreateGrid: (config: GridConfig) => void;
  disabled: boolean;
}

export const GridConfigurationPanel: React.FC<GridConfigurationPanelProps> = ({
  tokenInfo,
  currentPrice,
  portfolio,
  onCreateGrid,
  disabled,
}) => {
  const [config, setConfig] = useState<Partial<GridConfig>>({
    baseAmount: 1000,
    orderCount: 10,
    priceRange: {
      min: currentPrice * 0.9,
      max: currentPrice * 1.1,
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateConfig = (updates: Partial<GridConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    
    // Clear related errors
    const newErrors = { ...errors };
    Object.keys(updates).forEach(key => {
      delete newErrors[key];
    });
    setErrors(newErrors);
  };

  const validateConfig = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!config.baseAmount || config.baseAmount <= 0) {
      newErrors.baseAmount = 'Investment amount must be positive';
    } else if (config.baseAmount > portfolio.erg) {
      newErrors.baseAmount = 'Insufficient ERG balance';
    } else if (config.baseAmount < 100) {
      newErrors.baseAmount = 'Minimum investment is 100 ERG';
    }
    
    if (!config.orderCount || config.orderCount < 2) {
      newErrors.orderCount = 'Minimum 2 orders required';
    } else if (config.orderCount > 50) {
      newErrors.orderCount = 'Maximum 50 orders allowed';
    }
    
    if (!config.priceRange || config.priceRange.min >= config.priceRange.max) {
      newErrors.priceRange = 'Invalid price range';
    } else if (config.priceRange.min <= 0) {
      newErrors.priceRange = 'Price range must be positive';
    } else if (config.priceRange.max < currentPrice * 0.8 || config.priceRange.min > currentPrice * 1.2) {
      newErrors.priceRange = 'Price range too far from current price';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateConfig()) return;
    
    const gridConfig: GridConfig = {
      tokenId: tokenInfo.id,
      baseAmount: config.baseAmount!,
      orderCount: config.orderCount!,
      priceRange: config.priceRange!,
      gridIdentity: Math.random().toString(36).substring(7),
    };
    
    onCreateGrid(gridConfig);
    
    // Reset form
    setConfig({
      baseAmount: 1000,
      orderCount: 10,
      priceRange: {
        min: currentPrice * 0.9,
        max: currentPrice * 1.1,
      },
    });
  };

  const calculateMetrics = () => {
    if (!config.baseAmount || !config.orderCount || !config.priceRange) {
      return null;
    }
    
    const range = config.priceRange.max - config.priceRange.min;
    const priceStep = range / config.orderCount;
    const orderSize = config.baseAmount / config.orderCount;
    const potentialProfit = (config.priceRange.max - config.priceRange.min) / currentPrice * 100;
    
    return {
      priceStep,
      orderSize,
      potentialProfit,
      coverageAbove: ((config.priceRange.max - currentPrice) / currentPrice) * 100,
      coverageBelow: ((currentPrice - config.priceRange.min) / currentPrice) * 100,
    };
  };

  const metrics = calculateMetrics();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          Create Grid Order
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure your grid trading parameters
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Investment Amount */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="baseAmount">Investment Amount</Label>
            <Badge variant="outline">
              Available: {portfolio.erg.toFixed(2)} ERG
            </Badge>
          </div>
          <div className="relative">
            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="baseAmount"
              type="number"
              placeholder="1000"
              value={config.baseAmount || ''}
              onChange={(e) => updateConfig({ baseAmount: parseFloat(e.target.value) })}
              className="pl-10"
              disabled={disabled}
            />
          </div>
          {errors.baseAmount && (
            <p className="text-sm text-red-600">{errors.baseAmount}</p>
          )}
          
          {/* Quick amount buttons */}
          <div className="flex gap-2">
            {[25, 50, 75, 100].map(percentage => (
              <Button
                key={percentage}
                size="sm"
                variant="outline"
                onClick={() => updateConfig({ baseAmount: portfolio.erg * (percentage / 100) })}
                disabled={disabled}
                className="text-xs"
              >
                {percentage}%
              </Button>
            ))}
          </div>
        </div>

        {/* Number of Orders */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>Number of Orders</Label>
            <Badge variant="outline">{config.orderCount} orders</Badge>
          </div>
          <Slider
            value={[config.orderCount || 10]}
            onValueChange={([value]) => updateConfig({ orderCount: value })}
            min={2}
            max={50}
            step={1}
            disabled={disabled}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>2 (wide spacing)</span>
            <span>50 (tight spacing)</span>
          </div>
          {errors.orderCount && (
            <p className="text-sm text-red-600">{errors.orderCount}</p>
          )}
        </div>

        {/* Price Range */}
        <div className="space-y-4">
          <Label>Price Range</Label>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="minPrice" className="text-sm">Lower Bound</Label>
              <div className="relative">
                <TrendingDown className="absolute left-3 top-3 h-4 w-4 text-red-500" />
                <Input
                  id="minPrice"
                  type="number"
                  step="0.0001"
                  value={config.priceRange?.min || ''}
                  onChange={(e) => updateConfig({
                    priceRange: {
                      ...config.priceRange!,
                      min: parseFloat(e.target.value)
                    }
                  })}
                  className="pl-10"
                  disabled={disabled}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="maxPrice" className="text-sm">Upper Bound</Label>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-3 h-4 w-4 text-green-500" />
                <Input
                  id="maxPrice"
                  type="number"
                  step="0.0001"
                  value={config.priceRange?.max || ''}
                  onChange={(e) => updateConfig({
                    priceRange: {
                      ...config.priceRange!,
                      max: parseFloat(e.target.value)
                    }
                  })}
                  className="pl-10"
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
          
          {errors.priceRange && (
            <p className="text-sm text-red-600">{errors.priceRange}</p>
          )}
          
          {/* Current price indicator */}
          <div className="relative h-2 bg-muted rounded">
            {config.priceRange && config.priceRange.min < currentPrice && currentPrice < config.priceRange.max && (
              <div
                className="absolute top-0 w-0.5 h-2 bg-blue-500"
                style={{
                  left: `${((currentPrice - config.priceRange.min) / (config.priceRange.max - config.priceRange.min)) * 100}%`
                }}
              />
            )}
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Lower: {config.priceRange?.min?.toFixed(4) || '0'}</span>
            <Badge variant="outline" className="text-xs">
              Current: {currentPrice.toFixed(4)}
            </Badge>
            <span>Upper: {config.priceRange?.max?.toFixed(4) || '0'}</span>
          </div>
          
          {/* Range adjustment buttons */}
          <div className="flex gap-2 justify-center">
            {[5, 10, 20, 30].map(percentage => (
              <Button
                key={percentage}
                size="sm"
                variant="outline"
                onClick={() => updateConfig({
                  priceRange: {
                    min: currentPrice * (1 - percentage / 100),
                    max: currentPrice * (1 + percentage / 100),
                  }
                })}
                disabled={disabled}
                className="text-xs"
              >
                ±{percentage}%
              </Button>
            ))}
          </div>
        </div>

        {/* Calculated Metrics */}
        {metrics && (
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-4 h-4" />
              <span className="font-medium text-sm">Grid Metrics</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Order Size:</span>
                <span className="font-mono ml-2">{metrics.orderSize.toFixed(2)} ERG</span>
              </div>
              <div>
                <span className="text-muted-foreground">Price Step:</span>
                <span className="font-mono ml-2">{metrics.priceStep.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Coverage Above:</span>
                <span className={`font-mono ml-2 ${metrics.coverageAbove > 0 ? 'text-green-600' : ''}`}>
                  +{metrics.coverageAbove.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Coverage Below:</span>
                <span className={`font-mono ml-2 ${metrics.coverageBelow > 0 ? 'text-red-600' : ''}`}>
                  -{metrics.coverageBelow.toFixed(1)}%
                </span>
              </div>
            </div>
            
            <div className="pt-2 border-t">
              <div className="text-sm">
                <span className="text-muted-foreground">Potential Profit Range:</span>
                <span className="font-mono ml-2 text-blue-600">
                  ±{metrics.potentialProfit.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Warnings and Tips */}
        <div className="space-y-2">
          {config.orderCount && config.orderCount > 20 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Many orders will increase trading frequency and fees. Consider if the additional granularity is worth the cost.
              </AlertDescription>
            </Alert>
          )}
          
          {config.priceRange && Math.abs(config.priceRange.max - config.priceRange.min) / currentPrice > 0.5 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Very wide price range detected. This may tie up capital for extended periods.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Create Button */}
        <Button
          onClick={handleSubmit}
          disabled={disabled || !config.baseAmount || !config.orderCount || !config.priceRange}
          className="w-full"
        >
          Create Grid Order
        </Button>
      </CardContent>
    </Card>
  );
};
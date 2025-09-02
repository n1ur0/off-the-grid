'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import {
  Settings,
  Clock,
  TrendingUp,
  Activity,
  DollarSign,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Play,
  RotateCcw,
  Info,
} from 'lucide-react';

import { SimulationConfig } from '../../lib/simulation/GridSimulator';
import { MarketScenario } from '../../lib/simulation/PriceGenerator';

interface SimulationControlsProps {
  config: SimulationConfig;
  onConfigChange: (config: SimulationConfig) => void;
  isRunning: boolean;
  show: boolean;
  onToggle: () => void;
}

const PRESET_SCENARIOS = {
  beginner: {
    name: 'Beginner Friendly',
    description: 'Low volatility with gentle price movements',
    config: {
      duration: 30,
      timeAcceleration: 5,
      volatility: 0.1,
      trend: 0.02,
      marketCondition: 'sideways' as const,
      slippage: 0.0005,
      fees: 0.002,
    }
  },
  intermediate: {
    name: 'Intermediate Challenge',
    description: 'Moderate volatility with trend changes',
    config: {
      duration: 60,
      timeAcceleration: 10,
      volatility: 0.2,
      trend: 0.05,
      marketCondition: 'bull' as const,
      slippage: 0.001,
      fees: 0.003,
    }
  },
  advanced: {
    name: 'Advanced Trading',
    description: 'High volatility with complex market conditions',
    config: {
      duration: 120,
      timeAcceleration: 15,
      volatility: 0.3,
      trend: -0.03,
      marketCondition: 'volatile' as const,
      slippage: 0.0015,
      fees: 0.004,
    }
  },
  expert: {
    name: 'Expert Challenge',
    description: 'Extreme conditions with high risk/reward',
    config: {
      duration: 180,
      timeAcceleration: 20,
      volatility: 0.4,
      trend: 0.0,
      marketCondition: 'bear' as const,
      slippage: 0.002,
      fees: 0.005,
    }
  },
};

const MARKET_SCENARIOS = {
  bull: {
    name: 'Bull Market',
    description: 'Strong upward trend with moderate volatility',
    icon: '📈',
    color: 'text-green-600',
  },
  bear: {
    name: 'Bear Market', 
    description: 'Downward trend with high volatility',
    icon: '📉',
    color: 'text-red-600',
  },
  sideways: {
    name: 'Sideways Market',
    description: 'Range-bound trading with mean reversion',
    icon: '🔄',
    color: 'text-blue-600',
  },
  volatile: {
    name: 'High Volatility',
    description: 'Extreme price swings and frequent reversals',
    icon: '⚡',
    color: 'text-orange-600',
  },
};

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  config,
  onConfigChange,
  isRunning,
  show,
  onToggle,
}) => {
  const [expandedSections, setExpandedSections] = useState({
    presets: true,
    timing: false,
    market: false,
    costs: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const applyPreset = (presetKey: string) => {
    const preset = PRESET_SCENARIOS[presetKey as keyof typeof PRESET_SCENARIOS];
    if (preset) {
      onConfigChange(preset.config);
    }
  };

  const updateConfig = (updates: Partial<SimulationConfig>) => {
    onConfigChange({ ...config, ...updates });
  };

  const resetToDefaults = () => {
    onConfigChange(PRESET_SCENARIOS.intermediate.config);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const calculateRealTime = (simulatedMinutes: number, acceleration: number) => {
    const realSeconds = (simulatedMinutes * 60) / acceleration;
    if (realSeconds < 60) return `${Math.round(realSeconds)}s`;
    const realMinutes = Math.floor(realSeconds / 60);
    const remainingSeconds = Math.round(realSeconds % 60);
    return remainingSeconds > 0 ? `${realMinutes}m ${remainingSeconds}s` : `${realMinutes}m`;
  };

  if (!show) {
    return (
      <Button
        onClick={onToggle}
        variant="outline"
        className="w-full"
      >
        <Settings className="w-4 h-4 mr-2" />
        Configure Simulation
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Simulation Settings</CardTitle>
          <Button
            onClick={onToggle}
            variant="ghost"
            size="sm"
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Preset Scenarios */}
        <Collapsible
          open={expandedSections.presets}
          onOpenChange={() => toggleSection('presets')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                <span className="font-medium">Quick Presets</span>
              </div>
              {expandedSections.presets ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-3 space-y-2">
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(PRESET_SCENARIOS).map(([key, preset]) => (
                <Button
                  key={key}
                  onClick={() => applyPreset(key)}
                  variant="outline"
                  disabled={isRunning}
                  className="justify-start h-auto p-3"
                >
                  <div className="text-left">
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {preset.description}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
            
            <Button
              onClick={resetToDefaults}
              variant="outline"
              size="sm"
              disabled={isRunning}
              className="w-full mt-2"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Defaults
            </Button>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Timing Controls */}
        <Collapsible
          open={expandedSections.timing}
          onOpenChange={() => toggleSection('timing')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="font-medium">Timing & Speed</span>
              </div>
              {expandedSections.timing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-3 space-y-4">
            {/* Duration */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Simulation Duration</Label>
                <Badge variant="outline">{formatDuration(config.duration)}</Badge>
              </div>
              <Slider
                value={[config.duration]}
                onValueChange={([value]) => updateConfig({ duration: value })}
                min={15}
                max={240}
                step={15}
                disabled={isRunning}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>15m</span>
                <span>4h</span>
              </div>
            </div>

            {/* Time Acceleration */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Time Acceleration</Label>
                <Badge variant="outline">{config.timeAcceleration}x</Badge>
              </div>
              <Slider
                value={[config.timeAcceleration]}
                onValueChange={([value]) => updateConfig({ timeAcceleration: value })}
                min={1}
                max={50}
                step={1}
                disabled={isRunning}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1x (real-time)</span>
                <span>50x (ultra-fast)</span>
              </div>
              
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                <Info className="w-3 h-3 inline mr-1" />
                Real time needed: {calculateRealTime(config.duration, config.timeAcceleration)}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Market Conditions */}
        <Collapsible
          open={expandedSections.market}
          onOpenChange={() => toggleSection('market')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">Market Conditions</span>
              </div>
              {expandedSections.market ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-3 space-y-4">
            {/* Market Scenario */}
            <div className="space-y-2">
              <Label>Market Type</Label>
              <Select
                value={config.marketCondition}
                onValueChange={(value) => updateConfig({ 
                  marketCondition: value as SimulationConfig['marketCondition'] 
                })}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MARKET_SCENARIOS).map(([key, scenario]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <span>{scenario.icon}</span>
                        <div>
                          <div className="font-medium">{scenario.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {scenario.description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Volatility */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Volatility</Label>
                <Badge variant="outline">{(config.volatility * 100).toFixed(0)}%</Badge>
              </div>
              <Slider
                value={[config.volatility]}
                onValueChange={([value]) => updateConfig({ volatility: value })}
                min={0.05}
                max={0.5}
                step={0.01}
                disabled={isRunning}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5% (very low)</span>
                <span>50% (extreme)</span>
              </div>
            </div>

            {/* Trend */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Price Trend</Label>
                <Badge 
                  variant="outline"
                  className={config.trend > 0 ? 'text-green-600' : config.trend < 0 ? 'text-red-600' : ''}
                >
                  {config.trend > 0 ? '+' : ''}{(config.trend * 100).toFixed(1)}%
                </Badge>
              </div>
              <Slider
                value={[config.trend]}
                onValueChange={([value]) => updateConfig({ trend: value })}
                min={-0.15}
                max={0.15}
                step={0.01}
                disabled={isRunning}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>-15% (bearish)</span>
                <span>+15% (bullish)</span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Trading Costs */}
        <Collapsible
          open={expandedSections.costs}
          onOpenChange={() => toggleSection('costs')}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span className="font-medium">Trading Costs</span>
              </div>
              {expandedSections.costs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-3 space-y-4">
            {/* Slippage */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Slippage</Label>
                <Badge variant="outline">{(config.slippage * 100).toFixed(2)}%</Badge>
              </div>
              <Slider
                value={[config.slippage]}
                onValueChange={([value]) => updateConfig({ slippage: value })}
                min={0.0001}
                max={0.005}
                step={0.0001}
                disabled={isRunning}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.01% (ideal)</span>
                <span>0.5% (high)</span>
              </div>
            </div>

            {/* Fees */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Trading Fees</Label>
                <Badge variant="outline">{(config.fees * 100).toFixed(2)}%</Badge>
              </div>
              <Slider
                value={[config.fees]}
                onValueChange={([value]) => updateConfig({ fees: value })}
                min={0.001}
                max={0.01}
                step={0.0001}
                disabled={isRunning}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.1% (low)</span>
                <span>1.0% (high)</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 p-2 rounded">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              Higher costs make profitable trading more challenging but more realistic
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Current Configuration Summary */}
        <div className="bg-muted/50 p-3 rounded-lg space-y-2">
          <div className="text-sm font-medium">Current Configuration:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Duration: <span className="font-mono">{formatDuration(config.duration)}</span></div>
            <div>Speed: <span className="font-mono">{config.timeAcceleration}x</span></div>
            <div>Market: <span className="font-mono">{MARKET_SCENARIOS[config.marketCondition].name}</span></div>
            <div>Volatility: <span className="font-mono">{(config.volatility * 100).toFixed(0)}%</span></div>
            <div>Fees: <span className="font-mono">{(config.fees * 100).toFixed(2)}%</span></div>
            <div>Slippage: <span className="font-mono">{(config.slippage * 100).toFixed(2)}%</span></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
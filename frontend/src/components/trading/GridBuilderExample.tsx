'use client';

import React, { useState, useCallback } from 'react';
import { GridBuilder } from './GridBuilder';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { 
  GridBuilderConfig, 
  TokenInfo, 
  MarketConditions 
} from '@/types/trading';
import { useGridsStore } from '@/lib/stores/grids';

// Example market data - in a real app, this would come from your API
const EXAMPLE_TOKEN: TokenInfo = {
  id: '0000000000000000000000000000000000000000000000000000000000000000',
  name: 'Ergo',
  symbol: 'ERG',
  decimals: 9,
  price: 1.25
};

const EXAMPLE_MARKET_CONDITIONS: MarketConditions = {
  volatility: 0.25, // 25% volatility
  trend: 'sideways',
  volume: 1000000,
  liquidityScore: 0.8,
  marketSentiment: 'neutral'
};

export function GridBuilderExample() {
  const [availableBalance] = useState(100); // 100 ERG example balance
  const [currentPrice] = useState(1.25); // Current ERG price
  const { createGrid, loading } = useGridsStore();

  const handleConfigChange = useCallback((config: GridBuilderConfig) => {
    console.log('Grid configuration changed:', config);
    // You can update parent state or trigger analytics here
  }, []);

  const handleCreateGrid = useCallback(async (config: GridBuilderConfig) => {
    try {
      console.log('Creating grid with config:', config);
      
      // Convert to the format expected by the API
      const gridConfig = {
        token_id: config.tokenId,
        pair: `${EXAMPLE_TOKEN.symbol}/ERG`,
        lowerPrice: config.priceRange.min,
        upperPrice: config.priceRange.max,
        gridCount: config.orderCount,
        investment: config.baseAmount,
        strategy: config.strategy
      };

      const gridId = await createGrid(gridConfig);
      
      if (gridId) {
        console.log('Grid created successfully:', gridId);
        // You could show a success message or navigate to the grid details
      } else {
        throw new Error('Failed to create grid');
      }
    } catch (error) {
      console.error('Error creating grid:', error);
      // Handle error - show toast, etc.
    }
  }, [createGrid]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader
          title="Advanced Grid Trading Builder"
          description="Create sophisticated grid trading strategies with drag-and-drop configuration, smart defaults, and real-time risk assessment."
        />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-medium mb-2">Current Market</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Price:</span>
                  <span className="font-medium">${currentPrice.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Volatility:</span>
                  <span>{(EXAMPLE_MARKET_CONDITIONS.volatility * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Trend:</span>
                  <span className="capitalize">{EXAMPLE_MARKET_CONDITIONS.trend}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Your Account</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Available Balance:</span>
                  <span className="font-medium">{availableBalance} ERG</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Grids:</span>
                  <span>0</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Features</h4>
              <ul className="space-y-1 text-xs">
                <li>• Drag-and-drop price range selection</li>
                <li>• Smart default recommendations</li>
                <li>• Real-time profitability analysis</li>
                <li>• Risk assessment and warnings</li>
                <li>• Mobile touch support</li>
                <li>• Practice mode for learning</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid Builder */}
      <GridBuilder
        tokenInfo={EXAMPLE_TOKEN}
        availableBalance={availableBalance}
        currentPrice={currentPrice}
        marketConditions={EXAMPLE_MARKET_CONDITIONS}
        onConfigChange={handleConfigChange}
        onCreateGrid={handleCreateGrid}
      />

      {/* Usage Instructions */}
      <Card>
        <CardHeader title="How to Use" />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium mb-2">Interactive Chart</h4>
              <ul className="space-y-1">
                <li>• <strong>Drag green bar:</strong> Adjust maximum price</li>
                <li>• <strong>Drag red bar:</strong> Adjust minimum price</li>
                <li>• <strong>Drag grid levels:</strong> Fine-tune individual order prices</li>
                <li>• <strong>Blue line:</strong> Current market price</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Configuration</h4>
              <ul className="space-y-1">
                <li>• <strong>Smart Defaults:</strong> AI-powered optimal settings</li>
                <li>• <strong>Order Count:</strong> Number of buy/sell orders</li>
                <li>• <strong>Strategy:</strong> How orders are spaced</li>
                <li>• <strong>Practice Mode:</strong> Test without real funds</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Risk Management</h4>
              <ul className="space-y-1">
                <li>• <strong>Risk Score:</strong> Overall strategy risk level</li>
                <li>• <strong>Position Sizing:</strong> Recommended investment amount</li>
                <li>• <strong>Max Loss:</strong> Worst-case scenario calculation</li>
                <li>• <strong>Validation:</strong> Real-time error checking</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Profitability</h4>
              <ul className="space-y-1">
                <li>• <strong>ROI:</strong> Expected return on investment</li>
                <li>• <strong>Break-even:</strong> Price where strategy profits</li>
                <li>• <strong>Fee Impact:</strong> Trading costs estimation</li>
                <li>• <strong>Drawdown:</strong> Maximum expected loss</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default GridBuilderExample;
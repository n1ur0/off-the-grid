'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  DollarSign,
} from 'lucide-react';
import { format } from 'date-fns';

import { SimulatedGrid, OrderExecution } from '../../lib/simulation/GridSimulator';

interface OrderBookSimulatorProps {
  currentPrice: number;
  activeGrids: SimulatedGrid[];
  recentExecutions: OrderExecution[];
}

interface OrderLevel {
  price: number;
  amount: number;
  count: number;
  type: 'buy' | 'sell';
}

export const OrderBookSimulator: React.FC<OrderBookSimulatorProps> = ({
  currentPrice,
  activeGrids,
  recentExecutions,
}) => {
  const orderBook = useMemo(() => {
    const buyOrders: OrderLevel[] = [];
    const sellOrders: OrderLevel[] = [];
    
    // Aggregate orders from all active grids
    for (const grid of activeGrids) {
      if (grid.status !== 'active') continue;
      
      for (const order of grid.orders) {
        if (order.status !== 'pending') continue;
        
        const orders = order.type === 'buy' ? buyOrders : sellOrders;
        const existingLevel = orders.find(level => Math.abs(level.price - order.price) < 0.0001);
        
        if (existingLevel) {
          existingLevel.amount += order.amount;
          existingLevel.count++;
        } else {
          orders.push({
            price: order.price,
            amount: order.amount,
            count: 1,
            type: order.type,
          });
        }
      }
    }
    
    // Sort orders
    buyOrders.sort((a, b) => b.price - a.price); // Highest first for buys
    sellOrders.sort((a, b) => a.price - b.price); // Lowest first for sells
    
    return { buyOrders, sellOrders };
  }, [activeGrids]);

  const spread = useMemo(() => {
    if (orderBook.buyOrders.length === 0 || orderBook.sellOrders.length === 0) {
      return null;
    }
    
    const bestBid = orderBook.buyOrders[0].price;
    const bestAsk = orderBook.sellOrders[0].price;
    const spreadAmount = bestAsk - bestBid;
    const spreadPercent = (spreadAmount / currentPrice) * 100;
    
    return { bestBid, bestAsk, spreadAmount, spreadPercent };
  }, [orderBook, currentPrice]);

  const formatAmount = (amount: number) => {
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toFixed(2);
  };

  const formatPrice = (price: number) => price.toFixed(6);

  const getSpreadFromCurrent = (price: number) => {
    return ((price - currentPrice) / currentPrice) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Order Book */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Order Book
            </CardTitle>
            
            {spread && (
              <div className="text-right text-sm">
                <div className="text-muted-foreground">Spread</div>
                <div className="font-mono">
                  {formatPrice(spread.spreadAmount)} ({spread.spreadPercent.toFixed(2)}%)
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sell Orders */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-red-500" />
                <span className="font-medium text-red-600">Sell Orders</span>
                <Badge variant="outline" className="text-red-600 border-red-200">
                  {orderBook.sellOrders.length} levels
                </Badge>
              </div>
              
              <div className="space-y-1 text-sm">
                <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground border-b pb-1">
                  <div>Price</div>
                  <div>Amount</div>
                  <div>Orders</div>
                </div>
                
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {orderBook.sellOrders.slice(0, 20).map((level, index) => (
                      <div 
                        key={index}
                        className="grid grid-cols-3 gap-2 py-1 px-2 rounded hover:bg-red-50 text-xs font-mono"
                      >
                        <div className="text-red-600 font-medium">
                          {formatPrice(level.price)}
                          <div className="text-xs text-muted-foreground font-normal">
                            +{getSpreadFromCurrent(level.price).toFixed(1)}%
                          </div>
                        </div>
                        <div>{formatAmount(level.amount)}</div>
                        <div>{level.count}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                {orderBook.sellOrders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No sell orders
                  </div>
                )}
              </div>
            </div>

            {/* Buy Orders */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-green-500" />
                <span className="font-medium text-green-600">Buy Orders</span>
                <Badge variant="outline" className="text-green-600 border-green-200">
                  {orderBook.buyOrders.length} levels
                </Badge>
              </div>
              
              <div className="space-y-1 text-sm">
                <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground border-b pb-1">
                  <div>Price</div>
                  <div>Amount</div>
                  <div>Orders</div>
                </div>
                
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {orderBook.buyOrders.slice(0, 20).map((level, index) => (
                      <div 
                        key={index}
                        className="grid grid-cols-3 gap-2 py-1 px-2 rounded hover:bg-green-50 text-xs font-mono"
                      >
                        <div className="text-green-600 font-medium">
                          {formatPrice(level.price)}
                          <div className="text-xs text-muted-foreground font-normal">
                            {getSpreadFromCurrent(level.price).toFixed(1)}%
                          </div>
                        </div>
                        <div>{formatAmount(level.amount)}</div>
                        <div>{level.count}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                {orderBook.buyOrders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No buy orders
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Current Price Indicator */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex justify-center items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Current Market Price</span>
              <span className="font-mono font-bold text-lg text-blue-900">
                {formatPrice(currentPrice)}
              </span>
            </div>
          </div>

          {/* Order Book Statistics */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center p-2 bg-muted/50 rounded">
              <div className="text-muted-foreground">Total Buy Orders</div>
              <div className="font-mono font-medium">
                {orderBook.buyOrders.reduce((sum, level) => sum + level.count, 0)}
              </div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded">
              <div className="text-muted-foreground">Total Sell Orders</div>
              <div className="font-mono font-medium">
                {orderBook.sellOrders.reduce((sum, level) => sum + level.count, 0)}
              </div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded">
              <div className="text-muted-foreground">Buy Volume</div>
              <div className="font-mono font-medium">
                {formatAmount(orderBook.buyOrders.reduce((sum, level) => sum + level.amount, 0))}
              </div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded">
              <div className="text-muted-foreground">Sell Volume</div>
              <div className="font-mono font-medium">
                {formatAmount(orderBook.sellOrders.reduce((sum, level) => sum + level.amount, 0))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Executions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Order Executions
            <Badge variant="outline">{recentExecutions.length} trades</Badge>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          {recentExecutions.length > 0 ? (
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {recentExecutions.map((execution) => (
                  <div 
                    key={execution.id}
                    className="flex justify-between items-center p-2 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={execution.type === 'buy' ? 'default' : 'secondary'}
                        className={
                          execution.type === 'buy' 
                            ? 'bg-green-100 text-green-800 border-green-200' 
                            : 'bg-red-100 text-red-800 border-red-200'
                        }
                      >
                        {execution.type.toUpperCase()}
                      </Badge>
                      
                      <div className="text-sm">
                        <div className="font-mono font-medium">
                          {formatAmount(execution.amount)} @ {formatPrice(execution.price)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(execution.timestamp, 'HH:mm:ss')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="w-3 h-3" />
                        <span className="font-mono text-xs">
                          Fee: {execution.fees.toFixed(4)}
                        </span>
                      </div>
                      {execution.slippage > 0 && (
                        <div className="text-xs text-orange-600">
                          Slippage: {(execution.slippage * 100).toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No recent executions</p>
              <p className="text-sm">Orders will appear here when executed</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
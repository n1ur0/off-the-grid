'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Shield,
  Award,
  AlertTriangle,
  Info,
  DollarSign,
  BarChart3,
  PieChart,
  LineChart,
  Calendar,
  Clock,
} from 'lucide-react';

import { SimulationSession } from '../../lib/simulation/GridSimulator';
import { PerformanceReport } from '../../lib/simulation/PerformanceTracker';

interface PerformanceDashboardProps {
  session: SimulationSession;
  report: PerformanceReport | null;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  format?: 'currency' | 'percentage' | 'number';
  precision?: number;
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  format = 'number',
  precision = 2,
  className = '',
}) => {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'decimal',
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        }).format(val);
      case 'percentage':
        return `${(val * 100).toFixed(precision)}%`;
      default:
        return val.toFixed(precision);
    }
  };

  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';
  const trendIcon = trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null;

  return (
    <Card className={`${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-medium text-muted-foreground">{title}</span>
          </div>
          {trendIcon && (
            <div className={`${trendColor}`}>
              {trendIcon}
            </div>
          )}
        </div>
        <div className="mt-2">
          <div className={`text-2xl font-bold ${trendColor}`}>
            {formatValue(value)}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  session,
  report,
}) => {
  const currentMetrics = useMemo(() => {
    const profitLoss = session.currentPortfolio.totalValue - session.initialPortfolio.totalValue;
    const returnPct = profitLoss / session.initialPortfolio.totalValue;
    const elapsedMinutes = (Date.now() - session.startTime.getTime()) / (1000 * 60);
    
    return {
      totalReturn: returnPct,
      profitLoss,
      elapsedTime: elapsedMinutes,
      totalTrades: session.orderExecutions.length,
      successfulTrades: session.orderExecutions.filter(e => e.successful).length,
      activeGrids: Array.from(session.grids.values()).filter(g => g.status === 'active').length,
    };
  }, [session]);

  const riskMetrics = useMemo(() => {
    if (!report) return null;
    
    return {
      maxDrawdown: report.risk.maximumDrawdown,
      sharpeRatio: report.summary.sharpeRatio,
      winRate: report.summary.winRate,
      profitFactor: report.summary.profitFactor,
    };
  }, [report]);

  const getPerformanceGrade = (returnPct: number, sharpeRatio: number, maxDrawdown: number) => {
    let score = 0;
    
    // Return component (40%)
    if (returnPct > 0.1) score += 40;
    else if (returnPct > 0.05) score += 30;
    else if (returnPct > 0) score += 20;
    else if (returnPct > -0.05) score += 10;
    
    // Sharpe ratio component (35%)
    if (sharpeRatio > 2) score += 35;
    else if (sharpeRatio > 1.5) score += 30;
    else if (sharpeRatio > 1) score += 25;
    else if (sharpeRatio > 0.5) score += 15;
    else if (sharpeRatio > 0) score += 10;
    
    // Max drawdown component (25%)
    if (maxDrawdown < 0.05) score += 25;
    else if (maxDrawdown < 0.1) score += 20;
    else if (maxDrawdown < 0.15) score += 15;
    else if (maxDrawdown < 0.25) score += 10;
    else if (maxDrawdown < 0.35) score += 5;
    
    if (score >= 85) return { grade: 'A', color: 'text-green-600', description: 'Excellent' };
    if (score >= 70) return { grade: 'B', color: 'text-blue-600', description: 'Good' };
    if (score >= 55) return { grade: 'C', color: 'text-yellow-600', description: 'Fair' };
    if (score >= 40) return { grade: 'D', color: 'text-orange-600', description: 'Poor' };
    return { grade: 'F', color: 'text-red-600', description: 'Failing' };
  };

  const performanceGrade = report ? getPerformanceGrade(
    report.summary.totalReturn,
    report.summary.sharpeRatio,
    report.risk.maximumDrawdown
  ) : null;

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="space-y-6">
      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Total Return"
              value={currentMetrics.totalReturn}
              subtitle={`${currentMetrics.profitLoss >= 0 ? '+' : ''}${currentMetrics.profitLoss.toFixed(2)} ERG`}
              icon={<DollarSign className="w-4 h-4" />}
              trend={currentMetrics.totalReturn > 0 ? 'up' : currentMetrics.totalReturn < 0 ? 'down' : 'neutral'}
              format="percentage"
            />
            
            <MetricCard
              title="Session Time"
              value={formatDuration(currentMetrics.elapsedTime)}
              subtitle={session.isRunning ? 'Running' : session.isPaused ? 'Paused' : 'Completed'}
              icon={<Clock className="w-4 h-4" />}
              format="number"
            />
            
            <MetricCard
              title="Total Trades"
              value={currentMetrics.totalTrades}
              subtitle={`${currentMetrics.successfulTrades} successful`}
              icon={<Activity className="w-4 h-4" />}
              format="number"
              precision={0}
            />
            
            <MetricCard
              title="Active Grids"
              value={currentMetrics.activeGrids}
              subtitle={`${session.grids.size} total created`}
              icon={<Target className="w-4 h-4" />}
              format="number"
              precision={0}
            />
          </div>

          {/* Performance Grade */}
          {performanceGrade && (
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Award className="w-6 h-6" />
                  <div>
                    <h3 className="font-medium">Performance Grade</h3>
                    <p className="text-sm text-muted-foreground">Based on return, risk, and consistency</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${performanceGrade.color}`}>
                    {performanceGrade.grade}
                  </div>
                  <p className={`text-sm ${performanceGrade.color}`}>
                    {performanceGrade.description}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Analytics */}
      {report && (
        <Tabs defaultValue="risk" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
            <TabsTrigger value="trades">Trade Analysis</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="risk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Risk Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <MetricCard
                    title="Max Drawdown"
                    value={report.risk.maximumDrawdown}
                    subtitle="Peak to trough decline"
                    icon={<TrendingDown className="w-4 h-4" />}
                    format="percentage"
                    trend={report.risk.maximumDrawdown < 0.1 ? 'up' : 'down'}
                  />
                  
                  <MetricCard
                    title="Sharpe Ratio"
                    value={report.summary.sharpeRatio}
                    subtitle="Risk-adjusted return"
                    icon={<LineChart className="w-4 h-4" />}
                    trend={report.summary.sharpeRatio > 1 ? 'up' : report.summary.sharpeRatio > 0 ? 'neutral' : 'down'}
                  />
                  
                  <MetricCard
                    title="Value at Risk (95%)"
                    value={report.risk.valueAtRisk95}
                    subtitle="95% confidence level"
                    icon={<AlertTriangle className="w-4 h-4" />}
                    format="percentage"
                  />
                  
                  <MetricCard
                    title="Sortino Ratio"
                    value={report.risk.sortinoRatio}
                    subtitle="Downside risk adjusted"
                    icon={<Shield className="w-4 h-4" />}
                    trend={report.risk.sortinoRatio > 1 ? 'up' : 'neutral'}
                  />
                  
                  <MetricCard
                    title="Calmar Ratio"
                    value={report.summary.calmarRatio}
                    subtitle="Return / Max Drawdown"
                    icon={<BarChart3 className="w-4 h-4" />}
                    trend={report.summary.calmarRatio > 1 ? 'up' : 'neutral'}
                  />
                  
                  <MetricCard
                    title="Volatility"
                    value={report.summary.volatility}
                    subtitle="Annualized"
                    icon={<Activity className="w-4 h-4" />}
                    format="percentage"
                  />
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Drawdown Periods</h4>
                    {report.drawdowns.slice(0, 3).map((dd, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div>
                          <span className="text-sm font-medium">
                            Drawdown #{index + 1}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {dd.duration} periods
                          </span>
                        </div>
                        <Badge 
                          variant="outline"
                          className={dd.drawdown > 0.15 ? 'border-red-200 text-red-600' : 'border-yellow-200 text-yellow-600'}
                        >
                          -{(dd.drawdown * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trades" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Trading Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <MetricCard
                    title="Win Rate"
                    value={report.trades.winRate}
                    subtitle={`${report.trades.winningTrades}/${report.trades.totalTrades}`}
                    icon={<Target className="w-4 h-4" />}
                    format="percentage"
                    trend={report.trades.winRate > 0.5 ? 'up' : 'down'}
                  />
                  
                  <MetricCard
                    title="Profit Factor"
                    value={report.trades.profitFactor}
                    subtitle="Gross profit / Gross loss"
                    icon={<TrendingUp className="w-4 h-4" />}
                    trend={report.trades.profitFactor > 1 ? 'up' : 'down'}
                  />
                  
                  <MetricCard
                    title="Average Win"
                    value={report.trades.averageWin}
                    subtitle="Per winning trade"
                    icon={<DollarSign className="w-4 h-4" />}
                    format="percentage"
                  />
                  
                  <MetricCard
                    title="Average Loss"
                    value={Math.abs(report.trades.averageLoss)}
                    subtitle="Per losing trade"
                    icon={<TrendingDown className="w-4 h-4" />}
                    format="percentage"
                  />
                  
                  <MetricCard
                    title="Largest Win"
                    value={report.trades.largestWin}
                    subtitle="Best single trade"
                    icon={<Award className="w-4 h-4" />}
                    format="percentage"
                  />
                  
                  <MetricCard
                    title="Largest Loss"
                    value={Math.abs(report.trades.largestLoss)}
                    subtitle="Worst single trade"
                    icon={<AlertTriangle className="w-4 h-4" />}
                    format="percentage"
                  />
                </div>

                <div className="mt-6">
                  <h4 className="font-medium mb-2">Trading Consistency</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Max Consecutive Wins</span>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          {report.trades.maxConsecutiveWins}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Current Consecutive Wins</span>
                        <Badge variant="outline">
                          {report.trades.consecutiveWins}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Max Consecutive Losses</span>
                        <Badge variant="outline" className="text-red-600 border-red-200">
                          {report.trades.maxConsecutiveLosses}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Current Consecutive Losses</span>
                        <Badge variant="outline">
                          {report.trades.consecutiveLosses}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="w-5 h-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <MetricCard
                    title="Total Return"
                    value={report.summary.totalReturn}
                    subtitle="Since inception"
                    icon={<DollarSign className="w-4 h-4" />}
                    format="percentage"
                    trend={report.summary.totalReturn > 0 ? 'up' : 'down'}
                  />
                  
                  <MetricCard
                    title="Annualized Return"
                    value={report.summary.annualizedReturn}
                    subtitle="Projected yearly"
                    icon={<Calendar className="w-4 h-4" />}
                    format="percentage"
                  />
                  
                  <MetricCard
                    title="Total Fees Paid"
                    value={report.summary.totalFees}
                    subtitle="Trading costs"
                    icon={<DollarSign className="w-4 h-4" />}
                    format="currency"
                  />
                  
                  <MetricCard
                    title="Total Slippage"
                    value={report.summary.totalSlippage}
                    subtitle="Market impact"
                    icon={<Activity className="w-4 h-4" />}
                    format="currency"
                  />
                  
                  <MetricCard
                    title="Recovery Factor"
                    value={report.trades.recoveryFactor}
                    subtitle="Return / Max Loss"
                    icon={<Shield className="w-4 h-4" />}
                    trend={report.trades.recoveryFactor > 2 ? 'up' : 'neutral'}
                  />
                  
                  <MetricCard
                    title="Expectancy"
                    value={report.trades.expectancy}
                    subtitle="Expected return per trade"
                    icon={<Target className="w-4 h-4" />}
                    format="percentage"
                    trend={report.trades.expectancy > 0 ? 'up' : 'down'}
                  />
                </div>

                {/* Monthly Returns (if available) */}
                {Object.keys(report.monthlyReturns).length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium mb-2">Monthly Performance</h4>
                    <div className="overflow-x-auto">
                      <div className="min-w-full space-y-1">
                        {Object.entries(report.monthlyReturns).map(([year, months]) => (
                          <div key={year} className="flex items-center gap-2">
                            <span className="w-12 text-xs font-medium">{year}</span>
                            {Object.entries(months).map(([month, return_]) => (
                              <Badge
                                key={month}
                                variant="outline"
                                className={`text-xs ${
                                  return_ > 0 ? 'border-green-200 text-green-600' :
                                  return_ < 0 ? 'border-red-200 text-red-600' :
                                  'border-gray-200'
                                }`}
                              >
                                {(return_ * 100).toFixed(1)}%
                              </Badge>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Performance Insights & Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Performance Analysis */}
                <div className="space-y-3">
                  <h4 className="font-medium">Strategy Analysis</h4>
                  
                  {report.summary.totalReturn > 0.05 && (
                    <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-800">Strong Performance</p>
                        <p className="text-xs text-green-700 mt-1">
                          Your grid trading strategy generated a {(report.summary.totalReturn * 100).toFixed(1)}% return. 
                          This indicates good market timing and grid configuration.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {report.trades.winRate < 0.4 && (
                    <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Low Win Rate</p>
                        <p className="text-xs text-yellow-700 mt-1">
                          Win rate of {(report.trades.winRate * 100).toFixed(1)}% is below optimal. 
                          Consider tighter grid spacing or different market conditions.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {report.risk.maximumDrawdown > 0.15 && (
                    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <TrendingDown className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">High Drawdown Risk</p>
                        <p className="text-xs text-red-700 mt-1">
                          Maximum drawdown of {(report.risk.maximumDrawdown * 100).toFixed(1)}% indicates high risk. 
                          Consider position sizing and stop-loss mechanisms.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {report.summary.sharpeRatio > 1.5 && (
                    <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Award className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Excellent Risk-Adjusted Returns</p>
                        <p className="text-xs text-blue-700 mt-1">
                          Sharpe ratio of {report.summary.sharpeRatio.toFixed(2)} shows excellent risk-adjusted performance. 
                          Your strategy efficiently converts risk into returns.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Recommendations</h4>
                  
                  <div className="space-y-2 text-sm">
                    {report.trades.profitFactor > 2 && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span>Continue with current grid configuration - profit factor is strong</span>
                      </div>
                    )}
                    
                    {report.trades.profitFactor < 1.2 && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                        <span>Review grid spacing and market selection - profit factor needs improvement</span>
                      </div>
                    )}
                    
                    {report.summary.totalFees / Math.abs(report.summary.totalReturn) > 0.1 && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full" />
                        <span>High fee ratio - consider wider grid spacing to reduce trading frequency</span>
                      </div>
                    )}
                    
                    {report.trades.maxConsecutiveLosses > 5 && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                        <span>Implement position size reduction after consecutive losses</span>
                      </div>
                    )}
                    
                    {report.risk.maximumDrawdown < 0.05 && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span>Excellent risk control - consider increasing position size for higher returns</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Learning Points */}
                <div className="space-y-3">
                  <h4 className="font-medium">Key Learning Points</h4>
                  <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                    <p>• Grid trading works best in ranging/sideways markets</p>
                    <p>• Wider grids reduce fees but may miss smaller price movements</p>
                    <p>• Risk management is crucial for long-term profitability</p>
                    <p>• Consistent small profits often outperform occasional large gains</p>
                    <p>• Market selection is as important as grid configuration</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Live Session Status */}
      {session.isRunning && !report && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Live Session in Progress</span>
              </div>
              <Badge variant="outline">
                {formatDuration((Date.now() - session.startTime.getTime()) / (1000 * 60))} elapsed
              </Badge>
            </div>
            <div className="mt-2">
              <Progress 
                value={((Date.now() - session.startTime.getTime()) / (1000 * 60)) / session.config.duration * 100} 
                className="h-1"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
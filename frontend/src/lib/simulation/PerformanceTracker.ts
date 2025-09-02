import { OrderExecution, PerformanceMetrics } from './GridSimulator';
import { PriceData } from '../../types/trading';

export interface RiskMetrics {
  valueAtRisk95: number;
  valueAtRisk99: number;
  conditionalValueAtRisk: number;
  maximumDrawdown: number;
  drawdownDuration: number;
  downsidevVolatility: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxLeverage: number;
  correlationWithMarket: number;
}

export interface TradeAnalysis {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  averageWin: number;
  averageLoss: number;
  averageTradeReturn: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  expectancy: number;
  recoveryFactor: number;
}

export interface PortfolioMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  informationRatio: number;
  treynorRatio: number;
  alpha: number;
  beta: number;
  rSquared: number;
  trackingError: number;
  upCaptureRatio: number;
  downCaptureRatio: number;
}

export interface DrawdownPeriod {
  start: Date;
  end?: Date;
  peak: number;
  trough: number;
  drawdown: number;
  duration: number;
  recovery?: Date;
}

export interface MonthlyReturns {
  [year: number]: {
    [month: number]: number;
  };
}

export interface PerformanceReport {
  summary: PerformanceMetrics;
  risk: RiskMetrics;
  trades: TradeAnalysis;
  portfolio: PortfolioMetrics;
  drawdowns: DrawdownPeriod[];
  monthlyReturns: MonthlyReturns;
  rollingMetrics: {
    period: number; // days
    returns: number[];
    sharpeRatios: number[];
    volatilities: number[];
    maxDrawdowns: number[];
  };
}

export class PerformanceTracker {
  private readonly riskFreeRate: number = 0.02; // 2% annual risk-free rate
  private readonly tradingDaysPerYear: number = 252;
  
  calculate(
    initialValue: number,
    currentValue: number,
    orderExecutions: OrderExecution[],
    priceHistory: PriceData[],
    startTime: Date
  ): PerformanceMetrics {
    if (initialValue <= 0 || orderExecutions.length === 0) {
      return this.getEmptyMetrics();
    }

    const portfolioValues = this.calculatePortfolioValues(
      initialValue,
      orderExecutions,
      priceHistory
    );

    const returns = this.calculateReturns(portfolioValues);
    const tradeReturns = this.calculateTradeReturns(orderExecutions);

    return {
      totalReturn: (currentValue - initialValue) / initialValue,
      annualizedReturn: this.calculateAnnualizedReturn(initialValue, currentValue, startTime),
      sharpeRatio: this.calculateSharpeRatio(returns),
      maxDrawdown: this.calculateMaxDrawdown(portfolioValues),
      maxDrawdownDuration: this.calculateMaxDrawdownDuration(portfolioValues),
      winRate: this.calculateWinRate(tradeReturns),
      profitFactor: this.calculateProfitFactor(tradeReturns),
      averageTradeReturn: this.calculateAverageReturn(tradeReturns),
      volatility: this.calculateVolatility(returns),
      calmarRatio: this.calculateCalmarRatio(returns, portfolioValues),
      totalTrades: orderExecutions.length,
      profitableTrades: tradeReturns.filter(r => r > 0).length,
      largestWin: Math.max(...tradeReturns, 0),
      largestLoss: Math.min(...tradeReturns, 0),
      averageWin: this.calculateAverageWin(tradeReturns),
      averageLoss: this.calculateAverageLoss(tradeReturns),
      consecutiveWins: this.calculateCurrentConsecutiveWins(tradeReturns),
      consecutiveLosses: this.calculateCurrentConsecutiveLosses(tradeReturns),
      totalFees: orderExecutions.reduce((sum, e) => sum + e.fees, 0),
      totalSlippage: orderExecutions.reduce((sum, e) => sum + e.slippage, 0),
    };
  }

  generateComprehensiveReport(
    initialValue: number,
    currentValue: number,
    orderExecutions: OrderExecution[],
    priceHistory: PriceData[],
    startTime: Date,
    marketPrices?: PriceData[]
  ): PerformanceReport {
    const portfolioValues = this.calculatePortfolioValues(initialValue, orderExecutions, priceHistory);
    const returns = this.calculateReturns(portfolioValues);
    const tradeReturns = this.calculateTradeReturns(orderExecutions);

    return {
      summary: this.calculate(initialValue, currentValue, orderExecutions, priceHistory, startTime),
      risk: this.calculateRiskMetrics(returns, portfolioValues, marketPrices),
      trades: this.calculateTradeAnalysis(orderExecutions, tradeReturns),
      portfolio: this.calculatePortfolioMetrics(returns, marketPrices),
      drawdowns: this.calculateDrawdownPeriods(portfolioValues, priceHistory),
      monthlyReturns: this.calculateMonthlyReturns(returns, priceHistory),
      rollingMetrics: this.calculateRollingMetrics(returns, portfolioValues),
    };
  }

  private calculatePortfolioValues(
    initialValue: number,
    orderExecutions: OrderExecution[],
    priceHistory: PriceData[]
  ): number[] {
    const values: number[] = [initialValue];
    let currentValue = initialValue;

    // Simulate portfolio value changes based on order executions and price movements
    for (let i = 1; i < priceHistory.length; i++) {
      const timestamp = new Date(priceHistory[i].timestamp);
      
      // Apply order executions that occurred at this time
      const relevantExecutions = orderExecutions.filter(e => 
        e.timestamp.getTime() <= timestamp.getTime() && 
        e.timestamp.getTime() > new Date(priceHistory[i - 1].timestamp).getTime()
      );

      for (const execution of relevantExecutions) {
        if (execution.successful) {
          // Simplified P&L calculation
          const tradeProfit = execution.type === 'sell' 
            ? execution.amount * execution.price - execution.fees
            : -execution.amount * execution.price - execution.fees;
          currentValue += tradeProfit;
        }
      }

      values.push(Math.max(currentValue, 0));
    }

    return values;
  }

  private calculateReturns(portfolioValues: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < portfolioValues.length; i++) {
      if (portfolioValues[i - 1] > 0) {
        returns.push((portfolioValues[i] - portfolioValues[i - 1]) / portfolioValues[i - 1]);
      }
    }
    return returns;
  }

  private calculateTradeReturns(orderExecutions: OrderExecution[]): number[] {
    return orderExecutions
      .filter(e => e.successful)
      .map(e => {
        const grossReturn = e.type === 'sell' ? 
          (e.price - e.amount) / e.amount : 
          (e.amount - e.price) / e.price;
        return grossReturn - (e.fees + e.slippage) / e.amount;
      });
  }

  private calculateAnnualizedReturn(
    initialValue: number,
    currentValue: number,
    startTime: Date
  ): number {
    const totalReturn = (currentValue - initialValue) / initialValue;
    const elapsedDays = (Date.now() - startTime.getTime()) / (1000 * 60 * 60 * 24);
    
    if (elapsedDays <= 0) return 0;
    
    return Math.pow(1 + totalReturn, 365 / elapsedDays) - 1;
  }

  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const averageReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    const excessReturn = averageReturn - this.riskFreeRate / this.tradingDaysPerYear;
    
    return volatility > 0 ? excessReturn / volatility : 0;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length <= 1) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    
    return Math.sqrt(variance * this.tradingDaysPerYear);
  }

  private calculateMaxDrawdown(portfolioValues: number[]): number {
    let maxDrawdown = 0;
    let peak = portfolioValues[0];
    
    for (const value of portfolioValues) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return maxDrawdown;
  }

  private calculateMaxDrawdownDuration(portfolioValues: number[]): number {
    let maxDuration = 0;
    let currentDuration = 0;
    let peak = portfolioValues[0];
    let inDrawdown = false;
    
    for (const value of portfolioValues) {
      if (value > peak) {
        peak = value;
        if (inDrawdown) {
          inDrawdown = false;
          currentDuration = 0;
        }
      } else if (value < peak) {
        if (!inDrawdown) {
          inDrawdown = true;
          currentDuration = 1;
        } else {
          currentDuration++;
        }
        maxDuration = Math.max(maxDuration, currentDuration);
      }
    }
    
    return maxDuration;
  }

  private calculateWinRate(tradeReturns: number[]): number {
    if (tradeReturns.length === 0) return 0;
    const winningTrades = tradeReturns.filter(r => r > 0).length;
    return winningTrades / tradeReturns.length;
  }

  private calculateProfitFactor(tradeReturns: number[]): number {
    const profits = tradeReturns.filter(r => r > 0).reduce((sum, r) => sum + r, 0);
    const losses = Math.abs(tradeReturns.filter(r => r < 0).reduce((sum, r) => sum + r, 0));
    
    return losses > 0 ? profits / losses : profits > 0 ? Infinity : 0;
  }

  private calculateAverageReturn(returns: number[]): number {
    if (returns.length === 0) return 0;
    return returns.reduce((sum, r) => sum + r, 0) / returns.length;
  }

  private calculateAverageWin(tradeReturns: number[]): number {
    const wins = tradeReturns.filter(r => r > 0);
    return wins.length > 0 ? wins.reduce((sum, r) => sum + r, 0) / wins.length : 0;
  }

  private calculateAverageLoss(tradeReturns: number[]): number {
    const losses = tradeReturns.filter(r => r < 0);
    return losses.length > 0 ? losses.reduce((sum, r) => sum + r, 0) / losses.length : 0;
  }

  private calculateCurrentConsecutiveWins(tradeReturns: number[]): number {
    let consecutive = 0;
    for (let i = tradeReturns.length - 1; i >= 0; i--) {
      if (tradeReturns[i] > 0) {
        consecutive++;
      } else {
        break;
      }
    }
    return consecutive;
  }

  private calculateCurrentConsecutiveLosses(tradeReturns: number[]): number {
    let consecutive = 0;
    for (let i = tradeReturns.length - 1; i >= 0; i--) {
      if (tradeReturns[i] < 0) {
        consecutive++;
      } else {
        break;
      }
    }
    return consecutive;
  }

  private calculateCalmarRatio(returns: number[], portfolioValues: number[]): number {
    const annualizedReturn = this.calculateAverageReturn(returns) * this.tradingDaysPerYear;
    const maxDrawdown = this.calculateMaxDrawdown(portfolioValues);
    
    return maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
  }

  private calculateRiskMetrics(
    returns: number[],
    portfolioValues: number[],
    marketPrices?: PriceData[]
  ): RiskMetrics {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    
    return {
      valueAtRisk95: this.calculateVaR(sortedReturns, 0.05),
      valueAtRisk99: this.calculateVaR(sortedReturns, 0.01),
      conditionalValueAtRisk: this.calculateCVaR(sortedReturns, 0.05),
      maximumDrawdown: this.calculateMaxDrawdown(portfolioValues),
      drawdownDuration: this.calculateMaxDrawdownDuration(portfolioValues),
      downsidevVolatility: this.calculateDownsideVolatility(returns),
      sortinoRatio: this.calculateSortinoRatio(returns),
      calmarRatio: this.calculateCalmarRatio(returns, portfolioValues),
      maxLeverage: 1.0, // Assuming no leverage in grid trading
      correlationWithMarket: marketPrices ? this.calculateCorrelation(returns, marketPrices) : 0,
    };
  }

  private calculateVaR(sortedReturns: number[], alpha: number): number {
    const index = Math.floor(alpha * sortedReturns.length);
    return index < sortedReturns.length ? Math.abs(sortedReturns[index]) : 0;
  }

  private calculateCVaR(sortedReturns: number[], alpha: number): number {
    const cutoffIndex = Math.floor(alpha * sortedReturns.length);
    const tailReturns = sortedReturns.slice(0, cutoffIndex);
    
    if (tailReturns.length === 0) return 0;
    
    return Math.abs(tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length);
  }

  private calculateDownsideVolatility(returns: number[]): number {
    const target = this.riskFreeRate / this.tradingDaysPerYear;
    const downsideReturns = returns.filter(r => r < target);
    
    if (downsideReturns.length <= 1) return 0;
    
    const mean = downsideReturns.reduce((sum, r) => sum + r, 0) / downsideReturns.length;
    const variance = downsideReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (downsideReturns.length - 1);
    
    return Math.sqrt(variance * this.tradingDaysPerYear);
  }

  private calculateSortinoRatio(returns: number[]): number {
    const averageReturn = this.calculateAverageReturn(returns);
    const downsideVolatility = this.calculateDownsideVolatility(returns);
    const excessReturn = averageReturn - this.riskFreeRate / this.tradingDaysPerYear;
    
    return downsideVolatility > 0 ? excessReturn / downsideVolatility : 0;
  }

  private calculateTradeAnalysis(
    orderExecutions: OrderExecution[],
    tradeReturns: number[]
  ): TradeAnalysis {
    const winningTrades = tradeReturns.filter(r => r > 0);
    const losingTrades = tradeReturns.filter(r => r < 0);
    
    return {
      totalTrades: orderExecutions.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: this.calculateWinRate(tradeReturns),
      profitFactor: this.calculateProfitFactor(tradeReturns),
      largestWin: Math.max(...tradeReturns, 0),
      largestLoss: Math.min(...tradeReturns, 0),
      averageWin: this.calculateAverageWin(tradeReturns),
      averageLoss: this.calculateAverageLoss(tradeReturns),
      averageTradeReturn: this.calculateAverageReturn(tradeReturns),
      consecutiveWins: this.calculateCurrentConsecutiveWins(tradeReturns),
      consecutiveLosses: this.calculateCurrentConsecutiveLosses(tradeReturns),
      maxConsecutiveWins: this.calculateMaxConsecutive(tradeReturns, true),
      maxConsecutiveLosses: this.calculateMaxConsecutive(tradeReturns, false),
      expectancy: this.calculateExpectancy(tradeReturns),
      recoveryFactor: this.calculateRecoveryFactor(tradeReturns),
    };
  }

  private calculatePortfolioMetrics(
    returns: number[],
    marketPrices?: PriceData[]
  ): PortfolioMetrics {
    const annualizedReturn = this.calculateAverageReturn(returns) * this.tradingDaysPerYear;
    const volatility = this.calculateVolatility(returns);
    
    return {
      totalReturn: returns.reduce((prod, r) => prod * (1 + r), 1) - 1,
      annualizedReturn,
      volatility,
      sharpeRatio: this.calculateSharpeRatio(returns),
      informationRatio: 0, // Would need benchmark
      treynorRatio: 0, // Would need beta
      alpha: 0, // Would need benchmark
      beta: 1, // Default for no market data
      rSquared: 0, // Would need benchmark
      trackingError: 0, // Would need benchmark
      upCaptureRatio: 0, // Would need benchmark
      downCaptureRatio: 0, // Would need benchmark
    };
  }

  private calculateDrawdownPeriods(
    portfolioValues: number[],
    priceHistory: PriceData[]
  ): DrawdownPeriod[] {
    const drawdowns: DrawdownPeriod[] = [];
    let peak = portfolioValues[0];
    let peakIndex = 0;
    let inDrawdown = false;
    let drawdownStart: DrawdownPeriod | null = null;
    
    for (let i = 1; i < portfolioValues.length; i++) {
      if (portfolioValues[i] > peak) {
        // New peak
        if (inDrawdown && drawdownStart) {
          drawdownStart.end = new Date(priceHistory[i - 1].timestamp);
          drawdownStart.duration = i - peakIndex;
          drawdownStart.recovery = new Date(priceHistory[i].timestamp);
          drawdowns.push(drawdownStart);
          inDrawdown = false;
        }
        peak = portfolioValues[i];
        peakIndex = i;
      } else if (portfolioValues[i] < peak && !inDrawdown) {
        // Start of new drawdown
        inDrawdown = true;
        drawdownStart = {
          start: new Date(priceHistory[peakIndex].timestamp),
          peak,
          trough: portfolioValues[i],
          drawdown: (peak - portfolioValues[i]) / peak,
          duration: 0,
        };
      } else if (inDrawdown && drawdownStart && portfolioValues[i] < drawdownStart.trough) {
        // Deeper drawdown
        drawdownStart.trough = portfolioValues[i];
        drawdownStart.drawdown = (peak - portfolioValues[i]) / peak;
      }
    }
    
    // Handle ongoing drawdown
    if (inDrawdown && drawdownStart) {
      drawdownStart.duration = portfolioValues.length - peakIndex;
      drawdowns.push(drawdownStart);
    }
    
    return drawdowns.sort((a, b) => b.drawdown - a.drawdown);
  }

  private calculateMonthlyReturns(
    returns: number[],
    priceHistory: PriceData[]
  ): MonthlyReturns {
    const monthlyReturns: MonthlyReturns = {};
    
    for (let i = 0; i < returns.length && i < priceHistory.length - 1; i++) {
      const date = new Date(priceHistory[i + 1].timestamp);
      const year = date.getFullYear();
      const month = date.getMonth();
      
      if (!monthlyReturns[year]) monthlyReturns[year] = {};
      if (!monthlyReturns[year][month]) monthlyReturns[year][month] = 0;
      
      monthlyReturns[year][month] = (1 + monthlyReturns[year][month]) * (1 + returns[i]) - 1;
    }
    
    return monthlyReturns;
  }

  private calculateRollingMetrics(
    returns: number[],
    portfolioValues: number[],
    windowSize: number = 30
  ) {
    const rollingReturns: number[] = [];
    const rollingSharpeRatios: number[] = [];
    const rollingVolatilities: number[] = [];
    const rollingMaxDrawdowns: number[] = [];
    
    for (let i = windowSize; i < returns.length; i++) {
      const windowReturns = returns.slice(i - windowSize, i);
      const windowValues = portfolioValues.slice(i - windowSize, i + 1);
      
      const periodReturn = windowReturns.reduce((prod, r) => prod * (1 + r), 1) - 1;
      rollingReturns.push(periodReturn);
      
      rollingSharpeRatios.push(this.calculateSharpeRatio(windowReturns));
      rollingVolatilities.push(this.calculateVolatility(windowReturns));
      rollingMaxDrawdowns.push(this.calculateMaxDrawdown(windowValues));
    }
    
    return {
      period: windowSize,
      returns: rollingReturns,
      sharpeRatios: rollingSharpeRatios,
      volatilities: rollingVolatilities,
      maxDrawdowns: rollingMaxDrawdowns,
    };
  }

  private calculateMaxConsecutive(tradeReturns: number[], wins: boolean): number {
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    
    for (const return_ of tradeReturns) {
      if ((wins && return_ > 0) || (!wins && return_ < 0)) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }
    
    return maxConsecutive;
  }

  private calculateExpectancy(tradeReturns: number[]): number {
    const winRate = this.calculateWinRate(tradeReturns);
    const avgWin = this.calculateAverageWin(tradeReturns);
    const avgLoss = Math.abs(this.calculateAverageLoss(tradeReturns));
    
    return winRate * avgWin - (1 - winRate) * avgLoss;
  }

  private calculateRecoveryFactor(tradeReturns: number[]): number {
    const totalReturn = tradeReturns.reduce((sum, r) => sum + r, 0);
    const maxLoss = Math.abs(Math.min(...tradeReturns, 0));
    
    return maxLoss > 0 ? totalReturn / maxLoss : 0;
  }

  private calculateCorrelation(
    returns: number[],
    marketPrices: PriceData[]
  ): number {
    if (returns.length < 2 || marketPrices.length < 2) return 0;
    
    const marketReturns = [];
    for (let i = 1; i < Math.min(marketPrices.length, returns.length + 1); i++) {
      marketReturns.push(
        (marketPrices[i].price - marketPrices[i - 1].price) / marketPrices[i - 1].price
      );
    }
    
    if (marketReturns.length !== returns.length) return 0;
    
    const portfolioMean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const marketMean = marketReturns.reduce((sum, r) => sum + r, 0) / marketReturns.length;
    
    let numerator = 0;
    let portfolioSumSq = 0;
    let marketSumSq = 0;
    
    for (let i = 0; i < returns.length; i++) {
      const portfolioDiff = returns[i] - portfolioMean;
      const marketDiff = marketReturns[i] - marketMean;
      
      numerator += portfolioDiff * marketDiff;
      portfolioSumSq += portfolioDiff * portfolioDiff;
      marketSumSq += marketDiff * marketDiff;
    }
    
    const denominator = Math.sqrt(portfolioSumSq * marketSumSq);
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  private getEmptyMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      winRate: 0,
      profitFactor: 0,
      averageTradeReturn: 0,
      volatility: 0,
      calmarRatio: 0,
      totalTrades: 0,
      profitableTrades: 0,
      largestWin: 0,
      largestLoss: 0,
      averageWin: 0,
      averageLoss: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      totalFees: 0,
      totalSlippage: 0,
    };
  }
}
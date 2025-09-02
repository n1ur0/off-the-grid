import { SimulationConfig } from './GridSimulator';
import { PriceData } from '../../types/trading';

export interface MarketScenario {
  name: string;
  description: string;
  volatility: number;
  trend: number;
  meanReversion: number;
  jumpProbability: number;
  jumpMagnitude: number;
  correlationDecay: number;
}

export interface GARCHParameters {
  alpha: number; // ARCH parameter
  beta: number;  // GARCH parameter
  omega: number; // Long-term variance
}

export interface VolatilityClustering {
  enabled: boolean;
  persistence: number;
  shockDecay: number;
}

export class PriceGenerator {
  private previousReturns: number[] = [];
  private volatilityHistory: number[] = [];
  private lastVolatility: number = 0.02; // 2% daily volatility
  private trendMomentum: number = 0;
  private meanReversionLevel: number;
  private garchParams: GARCHParameters = {
    alpha: 0.1,
    beta: 0.8,
    omega: 0.0001,
  };

  private marketScenarios: Record<string, MarketScenario> = {
    bull: {
      name: 'Bull Market',
      description: 'Strong upward trend with moderate volatility',
      volatility: 0.15,
      trend: 0.08,
      meanReversion: 0.1,
      jumpProbability: 0.02,
      jumpMagnitude: 0.03,
      correlationDecay: 0.95,
    },
    bear: {
      name: 'Bear Market',
      description: 'Downward trend with high volatility',
      volatility: 0.25,
      trend: -0.12,
      meanReversion: 0.15,
      jumpProbability: 0.05,
      jumpMagnitude: -0.05,
      correlationDecay: 0.9,
    },
    sideways: {
      name: 'Sideways Market',
      description: 'Range-bound with strong mean reversion',
      volatility: 0.12,
      trend: 0.02,
      meanReversion: 0.3,
      jumpProbability: 0.01,
      jumpMagnitude: 0.02,
      correlationDecay: 0.98,
    },
    volatile: {
      name: 'High Volatility',
      description: 'Extreme price movements with frequent jumps',
      volatility: 0.35,
      trend: 0.0,
      meanReversion: 0.05,
      jumpProbability: 0.08,
      jumpMagnitude: 0.06,
      correlationDecay: 0.85,
    },
  };

  constructor(
    private initialPrice: number,
    private timeStepMinutes: number = 1
  ) {
    this.meanReversionLevel = initialPrice;
    this.lastVolatility = 0.02; // Initial 2% daily volatility
  }

  generateNextPrice(currentPrice: number, config: SimulationConfig): number {
    const scenario = this.marketScenarios[config.marketCondition];
    const timeStep = this.timeStepMinutes / (24 * 60); // Convert to daily fraction
    
    // Update volatility using GARCH model
    this.updateVolatility(config, scenario, timeStep);
    
    // Generate the base return using geometric Brownian motion with adjustments
    let return_ = this.generateBaseReturn(currentPrice, config, scenario, timeStep);
    
    // Add mean reversion component
    return_ += this.calculateMeanReversion(currentPrice, scenario, timeStep);
    
    // Add momentum component
    return_ += this.calculateMomentum(scenario, timeStep);
    
    // Add jump component (fat tail events)
    return_ += this.calculateJumps(scenario);
    
    // Apply volatility clustering
    return_ *= Math.sqrt(this.lastVolatility);
    
    // Calculate new price
    const newPrice = currentPrice * Math.exp(return_);
    
    // Update historical data
    this.updateHistory(return_);
    
    // Ensure price doesn't go negative or extremely high
    return Math.max(newPrice, currentPrice * 0.01);
  }

  generatePriceSequence(
    startPrice: number,
    steps: number,
    config: SimulationConfig
  ): PriceData[] {
    const prices: PriceData[] = [];
    let currentPrice = startPrice;
    const startTime = Date.now();
    
    for (let i = 0; i < steps; i++) {
      const timestamp = new Date(startTime + i * this.timeStepMinutes * 60000);
      
      if (i > 0) {
        currentPrice = this.generateNextPrice(currentPrice, config);
      }
      
      prices.push({
        timestamp: timestamp.toISOString(),
        price: currentPrice,
        volume: this.generateVolume(currentPrice, config),
      });
    }
    
    return prices;
  }

  generateHistoricalData(
    days: number,
    config: SimulationConfig
  ): PriceData[] {
    const stepsPerDay = 24 * 60 / this.timeStepMinutes;
    const totalSteps = Math.floor(days * stepsPerDay);
    
    return this.generatePriceSequence(this.initialPrice, totalSteps, config);
  }

  getMarketScenarios(): Record<string, MarketScenario> {
    return this.marketScenarios;
  }

  addCustomScenario(name: string, scenario: MarketScenario): void {
    this.marketScenarios[name] = scenario;
  }

  private generateBaseReturn(
    currentPrice: number,
    config: SimulationConfig,
    scenario: MarketScenario,
    timeStep: number
  ): number {
    // Base drift adjusted for time step
    const drift = scenario.trend * timeStep;
    
    // Random walk component
    const randomComponent = this.generateNormal() * Math.sqrt(timeStep);
    
    return drift + randomComponent * config.volatility;
  }

  private updateVolatility(
    config: SimulationConfig,
    scenario: MarketScenario,
    timeStep: number
  ): void {
    const lastReturn = this.previousReturns[this.previousReturns.length - 1] || 0;
    
    // GARCH(1,1) volatility model
    const variance = this.garchParams.omega + 
                    this.garchParams.alpha * Math.pow(lastReturn, 2) + 
                    this.garchParams.beta * Math.pow(this.lastVolatility, 2);
    
    this.lastVolatility = Math.sqrt(variance);
    
    // Apply scenario-specific volatility adjustments
    this.lastVolatility *= (1 + scenario.volatility * config.volatility);
    
    this.volatilityHistory.push(this.lastVolatility);
    
    // Keep history limited
    if (this.volatilityHistory.length > 100) {
      this.volatilityHistory.shift();
    }
  }

  private calculateMeanReversion(
    currentPrice: number,
    scenario: MarketScenario,
    timeStep: number
  ): number {
    const priceDeviation = Math.log(currentPrice / this.meanReversionLevel);
    return -scenario.meanReversion * priceDeviation * timeStep;
  }

  private calculateMomentum(scenario: MarketScenario, timeStep: number): number {
    // Update momentum based on recent returns
    if (this.previousReturns.length > 0) {
      const recentReturn = this.previousReturns[this.previousReturns.length - 1];
      this.trendMomentum = this.trendMomentum * scenario.correlationDecay + 
                           recentReturn * (1 - scenario.correlationDecay);
    }
    
    return this.trendMomentum * timeStep * 0.3; // Momentum contribution
  }

  private calculateJumps(scenario: MarketScenario): number {
    if (Math.random() < scenario.jumpProbability) {
      // Generate jump with scenario-specific magnitude and direction
      const jumpDirection = Math.random() > 0.5 ? 1 : -1;
      const jumpSize = scenario.jumpMagnitude * (0.5 + Math.random() * 1.5);
      return jumpDirection * jumpSize;
    }
    return 0;
  }

  private generateVolume(price: number, config: SimulationConfig): number {
    // Generate realistic volume that correlates with price movements and volatility
    const baseVolume = 1000;
    const volatilityMultiplier = 1 + this.lastVolatility * 10;
    const randomMultiplier = 0.5 + Math.random() * 1.5;
    
    return baseVolume * volatilityMultiplier * randomMultiplier;
  }

  private updateHistory(return_: number): void {
    this.previousReturns.push(return_);
    
    // Keep history limited for performance
    if (this.previousReturns.length > 100) {
      this.previousReturns.shift();
    }
  }

  private generateNormal(): number {
    // Box-Muller transformation for normal distribution
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();
    
    const normal = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return normal;
  }

  // Advanced methods for educational purposes

  calculateImpliedVolatility(priceHistory: PriceData[]): number {
    if (priceHistory.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < priceHistory.length; i++) {
      const return_ = Math.log(priceHistory[i].price / priceHistory[i - 1].price);
      returns.push(return_);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    
    // Annualize volatility
    const periodsPerYear = (365 * 24 * 60) / this.timeStepMinutes;
    return Math.sqrt(variance * periodsPerYear);
  }

  calculateBeta(marketPrices: PriceData[], assetPrices: PriceData[]): number {
    if (marketPrices.length !== assetPrices.length || marketPrices.length < 2) {
      return 1; // Default beta
    }

    const marketReturns = [];
    const assetReturns = [];
    
    for (let i = 1; i < marketPrices.length; i++) {
      marketReturns.push(Math.log(marketPrices[i].price / marketPrices[i - 1].price));
      assetReturns.push(Math.log(assetPrices[i].price / assetPrices[i - 1].price));
    }
    
    const marketMean = marketReturns.reduce((sum, r) => sum + r, 0) / marketReturns.length;
    const assetMean = assetReturns.reduce((sum, r) => sum + r, 0) / assetReturns.length;
    
    let covariance = 0;
    let marketVariance = 0;
    
    for (let i = 0; i < marketReturns.length; i++) {
      const marketDiff = marketReturns[i] - marketMean;
      const assetDiff = assetReturns[i] - assetMean;
      covariance += marketDiff * assetDiff;
      marketVariance += marketDiff * marketDiff;
    }
    
    return marketVariance !== 0 ? covariance / marketVariance : 1;
  }

  generateCorrelatedAssets(
    numAssets: number,
    correlationMatrix: number[][],
    config: SimulationConfig,
    steps: number
  ): PriceData[][] {
    // Generate multiple correlated price series for portfolio simulation
    if (correlationMatrix.length !== numAssets || 
        correlationMatrix[0].length !== numAssets) {
      throw new Error('Invalid correlation matrix dimensions');
    }
    
    const allPrices: PriceData[][] = [];
    
    // Use Cholesky decomposition for correlation
    const cholesky = this.choleskyDecomposition(correlationMatrix);
    const independentSeries: number[][] = [];
    
    // Generate independent normal series
    for (let asset = 0; asset < numAssets; asset++) {
      independentSeries[asset] = [];
      for (let step = 0; step < steps; step++) {
        independentSeries[asset].push(this.generateNormal());
      }
    }
    
    // Apply correlation
    for (let asset = 0; asset < numAssets; asset++) {
      const correlatedSeries: number[] = [];
      for (let step = 0; step < steps; step++) {
        let value = 0;
        for (let i = 0; i <= asset; i++) {
          value += cholesky[asset][i] * independentSeries[i][step];
        }
        correlatedSeries.push(value);
      }
      
      // Convert to prices
      allPrices[asset] = this.convertReturnsToPrice(
        this.initialPrice,
        correlatedSeries,
        config
      );
    }
    
    return allPrices;
  }

  private choleskyDecomposition(matrix: number[][]): number[][] {
    const n = matrix.length;
    const L: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        if (i === j) {
          let sum = 0;
          for (let k = 0; k < j; k++) {
            sum += L[j][k] * L[j][k];
          }
          L[i][j] = Math.sqrt(matrix[i][i] - sum);
        } else {
          let sum = 0;
          for (let k = 0; k < j; k++) {
            sum += L[i][k] * L[j][k];
          }
          L[i][j] = (matrix[i][j] - sum) / L[j][j];
        }
      }
    }
    
    return L;
  }

  private convertReturnsToPrice(
    startPrice: number,
    returns: number[],
    config: SimulationConfig
  ): PriceData[] {
    const prices: PriceData[] = [];
    let currentPrice = startPrice;
    const startTime = Date.now();
    
    for (let i = 0; i < returns.length; i++) {
      const timestamp = new Date(startTime + i * this.timeStepMinutes * 60000);
      
      if (i > 0) {
        const timeStep = this.timeStepMinutes / (24 * 60);
        const scaledReturn = returns[i] * Math.sqrt(timeStep) * config.volatility;
        currentPrice = currentPrice * Math.exp(scaledReturn);
      }
      
      prices.push({
        timestamp: timestamp.toISOString(),
        price: currentPrice,
        volume: this.generateVolume(currentPrice, config),
      });
    }
    
    return prices;
  }
}
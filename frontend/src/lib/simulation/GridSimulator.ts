import { GridConfig, TokenInfo, PriceData } from '../../types/trading';
import { PracticeGrid, PracticePortfolio, PracticeTrade } from '../../types/education';

export interface SimulationConfig {
  duration: number; // Duration in minutes
  timeAcceleration: number; // 1x = real time, 10x = 10 times faster
  volatility: number; // 0.1 = 10% daily volatility
  trend: number; // -0.1 to 0.1, positive = upward trend
  marketCondition: 'bull' | 'bear' | 'sideways' | 'volatile';
  slippage: number; // 0.001 = 0.1% slippage
  fees: number; // 0.003 = 0.3% fees
}

export interface OrderExecution {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: Date;
  gridId: string;
  successful: boolean;
  slippage: number;
  fees: number;
}

export interface SimulationSession {
  id: string;
  config: SimulationConfig;
  startTime: Date;
  currentTime: Date;
  initialPortfolio: PracticePortfolio;
  currentPortfolio: PracticePortfolio;
  grids: Map<string, SimulatedGrid>;
  priceHistory: PriceData[];
  orderExecutions: OrderExecution[];
  performance: PerformanceMetrics;
  isRunning: boolean;
  isPaused: boolean;
}

export interface SimulatedGrid {
  id: string;
  config: GridConfig;
  orders: GridOrder[];
  filledOrders: GridOrder[];
  currentValue: number;
  profitLoss: number;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  metrics: GridMetrics;
}

export interface GridOrder {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled';
  createdAt: Date;
  filledAt?: Date;
  actualPrice?: number;
  slippage?: number;
  fees?: number;
}

export interface GridMetrics {
  totalTrades: number;
  successfulTrades: number;
  totalFees: number;
  averageSlippage: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  averageTradeProfit: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  winRate: number;
  profitFactor: number;
  averageTradeReturn: number;
  volatility: number;
  calmarRatio: number;
  totalTrades: number;
  profitableTrades: number;
  largestWin: number;
  largestLoss: number;
  averageWin: number;
  averageLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  totalFees: number;
  totalSlippage: number;
}

export class GridSimulator {
  private session: SimulationSession | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private priceGenerator: PriceGenerator;
  private orderExecutor: OrderExecutor;
  private performanceCalculator: PerformanceCalculator;

  constructor(
    private tokenInfo: TokenInfo,
    private initialPrice: number
  ) {
    this.priceGenerator = new PriceGenerator(initialPrice);
    this.orderExecutor = new OrderExecutor();
    this.performanceCalculator = new PerformanceCalculator();
  }

  startSimulation(
    config: SimulationConfig,
    initialPortfolio: PracticePortfolio
  ): SimulationSession {
    if (this.session && this.session.isRunning) {
      throw new Error('Simulation already running');
    }

    this.session = {
      id: this.generateId(),
      config,
      startTime: new Date(),
      currentTime: new Date(),
      initialPortfolio: { ...initialPortfolio },
      currentPortfolio: { ...initialPortfolio },
      grids: new Map(),
      priceHistory: [],
      orderExecutions: [],
      performance: this.getEmptyPerformanceMetrics(),
      isRunning: true,
      isPaused: false,
    };

    // Initialize price history with current price
    this.session.priceHistory.push({
      timestamp: new Date().toISOString(),
      price: this.initialPrice,
      volume: 0,
    });

    this.startSimulationLoop();
    return this.session;
  }

  pauseSimulation(): void {
    if (!this.session) throw new Error('No simulation running');
    this.session.isPaused = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resumeSimulation(): void {
    if (!this.session) throw new Error('No simulation running');
    this.session.isPaused = false;
    this.startSimulationLoop();
  }

  stopSimulation(): SimulationSession {
    if (!this.session) throw new Error('No simulation running');
    
    this.session.isRunning = false;
    this.session.isPaused = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Final performance calculation
    this.updatePerformanceMetrics();
    
    const finalSession = this.session;
    this.session = null;
    
    return finalSession;
  }

  createGrid(gridConfig: GridConfig): string {
    if (!this.session || !this.session.isRunning) {
      throw new Error('No active simulation session');
    }

    const gridId = this.generateId();
    const currentPrice = this.getCurrentPrice();
    
    // Generate grid orders
    const orders = this.generateGridOrders(gridConfig, currentPrice);
    
    const grid: SimulatedGrid = {
      id: gridId,
      config: gridConfig,
      orders: orders,
      filledOrders: [],
      currentValue: gridConfig.baseAmount,
      profitLoss: 0,
      status: 'active',
      createdAt: new Date(),
      metrics: this.getEmptyGridMetrics(),
    };

    this.session.grids.set(gridId, grid);
    
    // Deduct initial investment from portfolio
    this.session.currentPortfolio.erg -= gridConfig.baseAmount;
    
    return gridId;
  }

  cancelGrid(gridId: string): void {
    if (!this.session) throw new Error('No simulation running');
    
    const grid = this.session.grids.get(gridId);
    if (!grid) throw new Error('Grid not found');
    
    grid.status = 'cancelled';
    
    // Return remaining value to portfolio
    this.session.currentPortfolio.erg += grid.currentValue;
    this.session.currentPortfolio.tokens[grid.config.tokenId] = 
      (this.session.currentPortfolio.tokens[grid.config.tokenId] || 0);
  }

  getSession(): SimulationSession | null {
    return this.session;
  }

  getCurrentPrice(): number {
    if (!this.session || this.session.priceHistory.length === 0) {
      return this.initialPrice;
    }
    return this.session.priceHistory[this.session.priceHistory.length - 1].price;
  }

  private startSimulationLoop(): void {
    if (this.intervalId) return;

    const updateInterval = Math.max(50, 1000 / this.session!.config.timeAcceleration);
    
    this.intervalId = setInterval(() => {
      if (!this.session || !this.session.isRunning || this.session.isPaused) {
        return;
      }

      this.updateSimulation();
      
      // Check if simulation should end
      const elapsedMinutes = (Date.now() - this.session.startTime.getTime()) / (1000 * 60);
      if (elapsedMinutes >= this.session.config.duration) {
        this.stopSimulation();
      }
    }, updateInterval);
  }

  private updateSimulation(): void {
    if (!this.session) return;

    // Update current time based on acceleration
    const timeStep = (1000 * this.session.config.timeAcceleration) / 60; // 1 minute per step at 1x
    this.session.currentTime = new Date(this.session.currentTime.getTime() + timeStep);

    // Generate new price
    const newPrice = this.priceGenerator.generateNextPrice(
      this.getCurrentPrice(),
      this.session.config
    );

    this.session.priceHistory.push({
      timestamp: this.session.currentTime.toISOString(),
      price: newPrice,
      volume: Math.random() * 1000 + 100, // Simulated volume
    });

    // Process grid orders
    this.processGridOrders(newPrice);

    // Update portfolio values
    this.updatePortfolioValues();

    // Update performance metrics
    this.updatePerformanceMetrics();
  }

  private processGridOrders(currentPrice: number): void {
    if (!this.session) return;

    for (const [gridId, grid] of this.session.grids.entries()) {
      if (grid.status !== 'active') continue;

      // Check for order executions
      const executions = this.orderExecutor.checkExecutions(
        grid.orders.filter(o => o.status === 'pending'),
        currentPrice,
        this.session.config
      );

      for (const execution of executions) {
        const order = grid.orders.find(o => o.id === execution.orderId);
        if (!order) continue;

        order.status = 'filled';
        order.filledAt = new Date();
        order.actualPrice = execution.actualPrice;
        order.slippage = execution.slippage;
        order.fees = execution.fees;

        grid.filledOrders.push(order);

        // Update portfolio
        if (order.type === 'buy') {
          const tokenAmount = order.amount / execution.actualPrice;
          this.session.currentPortfolio.tokens[grid.config.tokenId] = 
            (this.session.currentPortfolio.tokens[grid.config.tokenId] || 0) + tokenAmount;
          this.session.currentPortfolio.erg -= (order.amount + execution.fees);
        } else {
          const tokenAmount = order.amount;
          this.session.currentPortfolio.tokens[grid.config.tokenId] -= tokenAmount;
          this.session.currentPortfolio.erg += (tokenAmount * execution.actualPrice - execution.fees);
        }

        // Record execution
        const orderExecution: OrderExecution = {
          id: this.generateId(),
          type: order.type,
          amount: order.amount,
          price: execution.actualPrice,
          timestamp: new Date(),
          gridId,
          successful: true,
          slippage: execution.slippage,
          fees: execution.fees,
        };

        this.session.orderExecutions.push(orderExecution);
        this.updateGridMetrics(grid);
      }
    }
  }

  private generateGridOrders(config: GridConfig, currentPrice: number): GridOrder[] {
    const orders: GridOrder[] = [];
    const priceStep = (config.priceRange.max - config.priceRange.min) / config.orderCount;
    const orderSize = config.baseAmount / config.orderCount;

    for (let i = 0; i < config.orderCount; i++) {
      const price = config.priceRange.min + (i * priceStep);
      
      // Create buy orders below current price and sell orders above
      if (price < currentPrice * 0.95) {
        orders.push({
          id: this.generateId(),
          type: 'buy',
          amount: orderSize,
          price,
          status: 'pending',
          createdAt: new Date(),
        });
      } else if (price > currentPrice * 1.05) {
        orders.push({
          id: this.generateId(),
          type: 'sell',
          amount: orderSize / price, // Amount in tokens
          price,
          status: 'pending',
          createdAt: new Date(),
        });
      }
    }

    return orders;
  }

  private updatePortfolioValues(): void {
    if (!this.session) return;

    const currentPrice = this.getCurrentPrice();
    let totalValue = this.session.currentPortfolio.erg;

    // Add token values
    for (const [tokenId, amount] of Object.entries(this.session.currentPortfolio.tokens)) {
      if (tokenId === this.tokenInfo.id) {
        totalValue += amount * currentPrice;
      }
    }

    this.session.currentPortfolio.totalValue = totalValue;
  }

  private updatePerformanceMetrics(): void {
    if (!this.session) return;

    this.session.performance = this.performanceCalculator.calculate(
      this.session.initialPortfolio.totalValue,
      this.session.currentPortfolio.totalValue,
      this.session.orderExecutions,
      this.session.priceHistory,
      this.session.startTime
    );
  }

  private updateGridMetrics(grid: SimulatedGrid): void {
    const filledOrders = grid.filledOrders;
    
    grid.metrics.totalTrades = filledOrders.length;
    grid.metrics.successfulTrades = filledOrders.filter(o => o.actualPrice).length;
    grid.metrics.totalFees = filledOrders.reduce((sum, o) => sum + (o.fees || 0), 0);
    grid.metrics.averageSlippage = filledOrders.reduce((sum, o) => sum + (o.slippage || 0), 0) / filledOrders.length || 0;
    
    // Calculate P&L
    let totalBuyValue = 0;
    let totalSellValue = 0;
    let totalBuyFees = 0;
    let totalSellFees = 0;

    for (const order of filledOrders) {
      if (order.type === 'buy') {
        totalBuyValue += order.amount;
        totalBuyFees += order.fees || 0;
      } else {
        totalSellValue += (order.amount * (order.actualPrice || order.price));
        totalSellFees += order.fees || 0;
      }
    }

    grid.profitLoss = totalSellValue - totalBuyValue - totalBuyFees - totalSellFees;
    grid.currentValue = grid.config.baseAmount + grid.profitLoss;
    
    grid.metrics.winRate = filledOrders.length > 0 
      ? filledOrders.filter(o => (o.actualPrice || 0) > o.price).length / filledOrders.length 
      : 0;
  }

  private getEmptyPerformanceMetrics(): PerformanceMetrics {
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

  private getEmptyGridMetrics(): GridMetrics {
    return {
      totalTrades: 0,
      successfulTrades: 0,
      totalFees: 0,
      averageSlippage: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      averageTradeProfit: 0,
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

// Helper classes that will be implemented in separate files
class PriceGenerator {
  constructor(private initialPrice: number) {}

  generateNextPrice(currentPrice: number, config: SimulationConfig): number {
    // This will be implemented in PriceGenerator.ts
    return currentPrice * (1 + (Math.random() - 0.5) * config.volatility * 0.1);
  }
}

class OrderExecutor {
  checkExecutions(orders: GridOrder[], currentPrice: number, config: SimulationConfig): Array<{
    orderId: string;
    actualPrice: number;
    slippage: number;
    fees: number;
  }> {
    // This will be implemented in a separate file
    const executions: Array<{
      orderId: string;
      actualPrice: number;
      slippage: number;
      fees: number;
    }> = [];

    for (const order of orders) {
      let shouldExecute = false;
      
      if (order.type === 'buy' && currentPrice <= order.price) {
        shouldExecute = true;
      } else if (order.type === 'sell' && currentPrice >= order.price) {
        shouldExecute = true;
      }

      if (shouldExecute) {
        const slippage = config.slippage * Math.random();
        const actualPrice = order.type === 'buy' 
          ? currentPrice * (1 + slippage)
          : currentPrice * (1 - slippage);
        
        executions.push({
          orderId: order.id,
          actualPrice,
          slippage,
          fees: order.amount * config.fees,
        });
      }
    }

    return executions;
  }
}

class PerformanceCalculator {
  calculate(
    initialValue: number,
    currentValue: number,
    orderExecutions: OrderExecution[],
    priceHistory: PriceData[],
    startTime: Date
  ): PerformanceMetrics {
    // This will be implemented in PerformanceTracker.ts
    const totalReturn = (currentValue - initialValue) / initialValue;
    const elapsedDays = (Date.now() - startTime.getTime()) / (1000 * 60 * 60 * 24);
    const annualizedReturn = elapsedDays > 0 ? Math.pow(1 + totalReturn, 365 / elapsedDays) - 1 : 0;

    return {
      totalReturn,
      annualizedReturn,
      sharpeRatio: 0, // Will be calculated properly
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      winRate: 0,
      profitFactor: 0,
      averageTradeReturn: 0,
      volatility: 0,
      calmarRatio: 0,
      totalTrades: orderExecutions.length,
      profitableTrades: orderExecutions.filter(e => e.price > 0).length,
      largestWin: 0,
      largestLoss: 0,
      averageWin: 0,
      averageLoss: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      totalFees: orderExecutions.reduce((sum, e) => sum + e.fees, 0),
      totalSlippage: orderExecutions.reduce((sum, e) => sum + e.slippage, 0),
    };
  }
}
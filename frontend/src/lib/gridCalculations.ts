import { 
  GridBuilderConfig, 
  GridLevel, 
  PriceRange, 
  SmartDefaults, 
  ProfitabilityMetrics, 
  RiskAssessment, 
  MarketConditions,
  GridValidation 
} from '@/types/trading';

// Market analysis and smart defaults
export function calculateSmartDefaults(
  currentPrice: number,
  availableBalance: number,
  marketConditions: MarketConditions,
  tokenSymbol: string
): SmartDefaults {
  const volatilityMultiplier = Math.max(0.1, Math.min(0.5, marketConditions.volatility));
  
  // Calculate price range based on volatility and market conditions
  const baseRange = currentPrice * volatilityMultiplier;
  const trendAdjustment = marketConditions.trend === 'bullish' ? 0.1 : 
                         marketConditions.trend === 'bearish' ? -0.1 : 0;
  
  const priceRange: PriceRange = {
    min: currentPrice * (1 - volatilityMultiplier + trendAdjustment * 0.5),
    max: currentPrice * (1 + volatilityMultiplier - trendAdjustment * 0.5),
    current: currentPrice,
    support: currentPrice * 0.85,
    resistance: currentPrice * 1.15
  };

  // Calculate optimal order count based on price range and volatility
  const priceSpread = priceRange.max - priceRange.min;
  const optimalSpacing = priceSpread * 0.02; // 2% spacing minimum
  const optimalOrderCount = Math.max(5, Math.min(50, Math.floor(priceSpread / optimalSpacing)));

  // Calculate recommended investment based on balance and risk profile
  const riskLevel = marketConditions.volatility > 0.3 ? 'aggressive' : 
                   marketConditions.volatility > 0.15 ? 'moderate' : 'conservative';
  
  const riskMultiplier = riskLevel === 'conservative' ? 0.1 : 
                        riskLevel === 'moderate' ? 0.25 : 0.4;
  
  const recommendedInvestment = availableBalance * riskMultiplier;

  const reasoning = `Based on ${(marketConditions.volatility * 100).toFixed(1)}% volatility and ${marketConditions.trend} market trend, ` +
                   `recommend ${optimalOrderCount} orders across ${((priceRange.max - priceRange.min) / currentPrice * 100).toFixed(1)}% price range`;

  return {
    priceRange,
    optimalOrderCount,
    recommendedInvestment,
    suggestedSpacing: optimalSpacing,
    riskLevel,
    reasoning
  };
}

// Grid level generation with different strategies
export function generateGridLevels(
  config: GridBuilderConfig,
  currentPrice: number
): GridLevel[] {
  const { priceRange, orderCount, strategy, baseAmount } = config;
  const levels: GridLevel[] = [];
  
  const buyOrders = Math.floor(orderCount / 2);
  const sellOrders = orderCount - buyOrders;
  
  // Generate buy levels (below current price)
  const buyPrices = generatePriceSequence(
    priceRange.min,
    currentPrice,
    buyOrders,
    strategy
  );
  
  buyPrices.forEach((price, index) => {
    levels.push({
      id: `buy-${index}`,
      price,
      type: 'buy',
      amount: baseAmount / buyOrders,
      position: priceToPosition(price, priceRange, 400) // 400px chart height
    });
  });

  // Generate sell levels (above current price)
  const sellPrices = generatePriceSequence(
    currentPrice,
    priceRange.max,
    sellOrders,
    strategy
  );
  
  sellPrices.forEach((price, index) => {
    levels.push({
      id: `sell-${index}`,
      price,
      type: 'sell',
      amount: baseAmount / sellOrders,
      position: priceToPosition(price, priceRange, 400)
    });
  });

  return levels.sort((a, b) => b.price - a.price); // Sort by price descending
}

// Generate price sequence based on strategy
function generatePriceSequence(
  minPrice: number,
  maxPrice: number,
  count: number,
  strategy: 'arithmetic' | 'geometric' | 'adaptive'
): number[] {
  const prices: number[] = [];
  
  if (count <= 0) return prices;
  if (count === 1) return [(minPrice + maxPrice) / 2];
  
  for (let i = 0; i < count; i++) {
    let price: number;
    
    switch (strategy) {
      case 'geometric':
        // Logarithmic spacing - more orders near current price
        const ratio = Math.pow(maxPrice / minPrice, 1 / (count - 1));
        price = minPrice * Math.pow(ratio, i);
        break;
        
      case 'adaptive':
        // Adaptive spacing based on volatility zones
        const progress = i / (count - 1);
        const adaptiveProgress = Math.pow(progress, 0.8); // Slight curve
        price = minPrice + (maxPrice - minPrice) * adaptiveProgress;
        break;
        
      default: // arithmetic
        // Linear spacing
        price = minPrice + (maxPrice - minPrice) * (i / (count - 1));
        break;
    }
    
    prices.push(price);
  }
  
  return prices;
}

// Convert price to Y position on chart
export function priceToPosition(price: number, priceRange: PriceRange, chartHeight: number): number {
  const pricePercent = (priceRange.max - price) / (priceRange.max - priceRange.min);
  return pricePercent * chartHeight;
}

// Convert Y position to price
export function positionToPrice(position: number, priceRange: PriceRange, chartHeight: number): number {
  const pricePercent = position / chartHeight;
  return priceRange.max - pricePercent * (priceRange.max - priceRange.min);
}

// Calculate real-time profitability metrics
export function calculateProfitabilityMetrics(
  config: GridBuilderConfig,
  levels: GridLevel[],
  currentPrice: number,
  marketConditions: MarketConditions
): ProfitabilityMetrics {
  const { baseAmount } = config;
  
  // Estimate profit based on grid spacing and expected fills
  const avgSpacing = levels.length > 1 ? 
    (config.priceRange.max - config.priceRange.min) / (levels.length - 1) : 0;
  
  const profitPerFill = avgSpacing * baseAmount / levels.length;
  const expectedFillsPerDay = marketConditions.volatility * marketConditions.volume * 10; // Rough estimate
  const estimatedProfit = profitPerFill * expectedFillsPerDay * 365; // Annualized
  
  // Calculate break-even price (weighted average of all orders)
  const totalInvestment = baseAmount;
  const weightedPrice = levels.reduce((sum, level) => sum + level.price * level.amount, 0) / 
                       levels.reduce((sum, level) => sum + level.amount, 0);
  
  const breakEvenPrice = weightedPrice * 1.001; // Add small margin for fees
  
  // Calculate maximum drawdown
  const maxDrawdown = Math.max(
    currentPrice - config.priceRange.min,
    config.priceRange.max - currentPrice
  ) / currentPrice;
  
  const roiPercent = (estimatedProfit / totalInvestment) * 100;
  
  // Define profit zone (where grid is most effective)
  const profitZone = {
    min: config.priceRange.min * 1.1, // 10% above min
    max: config.priceRange.max * 0.9  // 10% below max
  };
  
  // Estimate fee impact (0.3% per trade assumption)
  const feeImpact = levels.length * 0.003 * baseAmount;
  
  return {
    estimatedProfit,
    breakEvenPrice,
    maxDrawdown: maxDrawdown * 100,
    roiPercent,
    profitZone,
    feeImpact,
    annualizedReturn: roiPercent
  };
}

// Assess risk and provide recommendations
export function assessRisk(
  config: GridBuilderConfig,
  availableBalance: number,
  marketConditions: MarketConditions
): RiskAssessment {
  const investmentRatio = config.baseAmount / availableBalance;
  const volatilityPenalty = marketConditions.volatility * 20;
  const liquidityBonus = marketConditions.liquidityScore * 5;
  
  // Calculate risk score (0-100, higher = more risky)
  let riskScore = investmentRatio * 50 + volatilityPenalty - liquidityBonus;
  riskScore = Math.max(0, Math.min(100, riskScore));
  
  // Calculate maximum potential loss
  const maxLoss = config.baseAmount * 0.5; // Assuming 50% worst-case scenario
  
  // Position sizing recommendations
  const conservative = availableBalance * 0.1;
  const recommended = availableBalance * 0.25;
  const maximum = availableBalance * 0.4;
  
  const positionSizeRecommendation = riskScore < 30 ? maximum :
                                   riskScore < 60 ? recommended : conservative;
  
  // Generate advice based on risk assessment
  const diversificationAdvice = [
    'Consider splitting investment across multiple grids',
    'Use different price ranges to reduce correlation',
    'Monitor market conditions for strategy adjustments'
  ];
  
  const riskWarnings: string[] = [];
  if (riskScore > 70) riskWarnings.push('High risk configuration - consider reducing position size');
  if (investmentRatio > 0.3) riskWarnings.push('Large portion of balance allocated - ensure sufficient reserves');
  if (marketConditions.volatility > 0.4) riskWarnings.push('High market volatility detected - increased risk of losses');
  
  return {
    riskScore,
    maxLoss,
    positionSizeRecommendation,
    diversificationAdvice,
    riskWarnings,
    capitalAllocation: {
      conservative,
      recommended,
      maximum
    }
  };
}

// Validate grid configuration
export function validateGridConfig(
  config: GridBuilderConfig,
  currentPrice: number,
  availableBalance: number
): GridValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  // Price range validation
  if (config.priceRange.min >= config.priceRange.max) {
    errors.push('Maximum price must be higher than minimum price');
  }
  
  if (config.priceRange.min > currentPrice || config.priceRange.max < currentPrice) {
    warnings.push('Current price is outside the selected range');
    suggestions.push('Consider adjusting price range to include current market price');
  }
  
  // Investment validation
  if (config.baseAmount <= 0) {
    errors.push('Investment amount must be positive');
  }
  
  if (config.baseAmount > availableBalance) {
    errors.push('Investment amount exceeds available balance');
  }
  
  if (config.baseAmount > availableBalance * 0.5) {
    warnings.push('Large portion of balance allocated');
    suggestions.push('Consider reducing investment amount for better risk management');
  }
  
  // Order count validation
  if (config.orderCount < 2) {
    errors.push('Minimum 2 orders required for grid trading');
  }
  
  if (config.orderCount > 100) {
    warnings.push('Very high number of orders may impact performance');
    suggestions.push('Consider reducing order count for better execution');
  }
  
  // Price range spread validation
  const priceSpread = (config.priceRange.max - config.priceRange.min) / currentPrice;
  if (priceSpread < 0.05) {
    warnings.push('Very narrow price range may limit profitability');
    suggestions.push('Consider widening price range for better profit potential');
  }
  
  if (priceSpread > 1.0) {
    warnings.push('Very wide price range increases risk');
    suggestions.push('Consider narrowing price range to reduce risk');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

// Calculate optimal grid spacing
export function calculateOptimalSpacing(
  currentPrice: number,
  volatility: number,
  orderCount: number
): number {
  // Base spacing on volatility and order density
  const baseSpacing = currentPrice * (volatility / 10);
  const densityMultiplier = Math.sqrt(orderCount / 10);
  return baseSpacing / densityMultiplier;
}

// Update grid levels when dragged
export function updateGridLevelPosition(
  levels: GridLevel[],
  levelId: string,
  newPosition: number,
  priceRange: PriceRange,
  chartHeight: number
): GridLevel[] {
  return levels.map(level => {
    if (level.id === levelId) {
      const newPrice = positionToPrice(newPosition, priceRange, chartHeight);
      return {
        ...level,
        price: newPrice,
        position: newPosition
      };
    }
    return level;
  });
}
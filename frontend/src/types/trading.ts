export interface GridSummary {
  grid_identity: string;
  token_id: string;
  sell_orders: number;
  buy_orders: number;
  bid_price: string;
  ask_price: string;
  profit_erg: number;
  profit_token: string;
  total_erg: number;
  total_tokens: string;
}

export interface GridOrderDetail {
  order_type: 'Buy' | 'Sell';
  amount: string;
  price: string;
}

export interface GridConfig {
  tokenId: string;
  baseAmount: number;
  orderCount: number;
  priceRange: {
    min: number;
    max: number;
  };
  gridIdentity: string;
}

export interface Grid {
  id: string;
  identity: string;
  tokenId: string;
  status: 'active' | 'completed' | 'cancelled';
  totalValue: number;
  totalTokens: number;
  profitErg: number;
  profitToken: number;
  sellOrders: number;
  buyOrders: number;
  bidPrice: string;
  askPrice: string;
  createdAt: string;
  lastUpdated: string;
}

export interface TokenInfo {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  price?: number;
}

export interface TradingStats {
  totalGrids: number;
  activeGrids: number;
  totalProfit: number;
  totalVolume: number;
  successRate: number;
  bestPerformer: {
    gridId: string;
    profit: number;
  };
}

export interface PriceData {
  timestamp: string;
  price: number;
  volume: number;
}

export interface GridPerformance {
  gridId: string;
  priceHistory: PriceData[];
  profitHistory: { timestamp: string; profit: number }[];
  orderFills: {
    timestamp: string;
    type: 'buy' | 'sell';
    amount: number;
    price: number;
  }[];
}

export interface AuthenticationRequest {
  wallet_address: string;
  message: string;
  signature: string;
}

// Enhanced grid builder types
export interface GridBuilderConfig {
  tokenId: string;
  baseAmount: number;
  orderCount: number;
  priceRange: {
    min: number;
    max: number;
  };
  strategy: 'arithmetic' | 'geometric' | 'adaptive';
  mode: 'practice' | 'live';
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
}

export interface GridLevel {
  id: string;
  price: number;
  type: 'buy' | 'sell';
  amount: number;
  position: number; // Y position in pixels for drag-drop
  isDragging?: boolean;
}

export interface PriceRange {
  min: number;
  max: number;
  current: number;
  support: number;
  resistance: number;
}

export interface SmartDefaults {
  priceRange: PriceRange;
  optimalOrderCount: number;
  recommendedInvestment: number;
  suggestedSpacing: number;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  reasoning: string;
}

export interface ProfitabilityMetrics {
  estimatedProfit: number;
  breakEvenPrice: number;
  maxDrawdown: number;
  roiPercent: number;
  profitZone: {
    min: number;
    max: number;
  };
  feeImpact: number;
  annualizedReturn: number;
}

export interface RiskAssessment {
  riskScore: number; // 0-100
  maxLoss: number;
  positionSizeRecommendation: number;
  diversificationAdvice: string[];
  riskWarnings: string[];
  capitalAllocation: {
    recommended: number;
    maximum: number;
    conservative: number;
  };
}

export interface MarketConditions {
  volatility: number;
  trend: 'bullish' | 'bearish' | 'sideways';
  volume: number;
  liquidityScore: number;
  marketSentiment: 'positive' | 'negative' | 'neutral';
}

export interface GridValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface DragDropState {
  isDragging: boolean;
  draggedLevel: GridLevel | null;
  dragOffset: { x: number; y: number };
  previewPrice: number | null;
}
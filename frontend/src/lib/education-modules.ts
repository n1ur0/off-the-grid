import { LearningModule, ModuleContent, Quiz } from '../types/education';

// Educational content for Grid Trading Fundamentals
const gridTradingFundamentalsContent: ModuleContent[] = [
  {
    type: 'text',
    title: 'What is Grid Trading?',
    content: {
      text: `Grid trading is an automated investment strategy that places a series of buy and sell orders at predefined intervals around a set price. Think of it as casting a "net" or "grid" across different price levels to catch profits from market volatility.

Key characteristics of grid trading:
• **Automated execution**: Orders are placed automatically based on predetermined rules
• **Symmetric strategy**: Buy orders below current price, sell orders above
• **Profit from volatility**: Benefits from price movements in both directions
• **Range-bound focus**: Most effective in sideways or ranging markets

The basic principle is simple: as the market price moves up and down through your grid levels, orders are triggered automatically, allowing you to profit from the natural ebb and flow of market prices.`,
      highlightBoxes: [
        {
          type: 'info',
          title: 'Key Insight',
          content: 'Grid trading doesn\'t try to predict market direction. Instead, it profits from market volatility regardless of whether prices go up or down.'
        }
      ],
      interactiveElements: [
        {
          type: 'expandable',
          title: 'Real-world Example',
          content: 'Imagine ERG is trading at $1.00. You might place buy orders at $0.95, $0.90, $0.85, and sell orders at $1.05, $1.10, $1.15. As the price moves, these orders get filled automatically, generating profits.'
        }
      ]
    }
  },
  {
    type: 'interactive',
    title: 'Grid Trading Mechanics',
    content: {
      component: 'InteractiveGrid',
      props: {
        initialPrice: 1.0,
        priceRange: [0.8, 1.2],
        gridCount: 8,
        scenario: {
          id: 'demo-volatility',
          name: 'Market Volatility Demo',
          description: 'See how grid trading captures profits from price movements',
          pricePattern: 'sideways',
          volatility: 0.6,
          duration: 30000
        },
        educationMode: true,
        enableDragInteraction: true
      },
      guidance: 'Drag the price line or start the simulation to see how grid orders are executed as the market moves. Notice how profits accumulate from both upward and downward price movements.',
      learningObjectives: [
        'Understand how buy and sell orders are placed around current price',
        'Observe automatic order execution as price moves through grid levels',
        'See how profits accumulate from market volatility',
        'Learn about unrealized vs realized profits'
      ]
    }
  },
  {
    type: 'text',
    title: 'Grid Spacing and Configuration',
    content: {
      text: `Proper grid configuration is crucial for successful grid trading. The key parameters you need to understand:

**Grid Spacing**: The distance between each grid level
• Tight spacing (1-2%): More frequent trades, smaller individual profits
• Wide spacing (3-5%): Fewer trades, larger individual profits
• Market volatility should guide your spacing decision

**Number of Grid Levels**: How many buy/sell orders to place
• More levels: Better coverage but requires more capital
• Fewer levels: Less capital required but might miss opportunities

**Price Range**: The bounds of your grid
• Should encompass expected price movement
• Consider support and resistance levels
• Account for market volatility and trends`,
      highlightBoxes: [
        {
          type: 'warning',
          title: 'Risk Consideration',
          content: 'If price moves strongly in one direction and exits your grid range, you might face losses or miss profit opportunities. Always consider market conditions.'
        }
      ]
    }
  },
  {
    type: 'simulation',
    title: 'Grid Configuration Practice',
    content: {
      component: 'GridConfigurationTutorial',
      props: {
        scenarios: [
          {
            id: 'volatile-market',
            name: 'Volatile Market',
            description: 'High volatility requires different grid spacing',
            marketConditions: { volatility: 'high', trend: 'sideways' },
            expectedOutcome: 'frequent_trades'
          },
          {
            id: 'stable-market',
            name: 'Stable Market',
            description: 'Low volatility needs tighter grids for action',
            marketConditions: { volatility: 'low', trend: 'sideways' },
            expectedOutcome: 'fewer_trades'
          }
        ]
      },
      challengeText: 'Configure grids for different market conditions and see how your choices affect profitability.'
    }
  }
];

const gridTradingFundamentalsQuiz: Quiz = {
  questions: [
    {
      id: 'gt-basics-1',
      question: 'What is the primary goal of grid trading?',
      options: [
        'To predict market direction accurately',
        'To profit from market volatility regardless of direction',
        'To eliminate all trading risks',
        'To guarantee profits in all market conditions'
      ],
      correct: 1,
      explanation: 'Grid trading doesn\'t try to predict direction. Instead, it systematically captures profits from price volatility by placing orders at multiple levels.'
    },
    {
      id: 'gt-basics-2',
      question: 'In a grid trading setup, where are buy orders typically placed?',
      options: [
        'Above the current market price',
        'At the current market price',
        'Below the current market price',
        'At random price levels'
      ],
      correct: 2,
      explanation: 'Buy orders are placed below the current price to purchase assets when prices dip, while sell orders are placed above to capture profits when prices rise.'
    },
    {
      id: 'gt-basics-3',
      question: 'What type of market conditions are most favorable for grid trading?',
      options: [
        'Strong trending upward markets',
        'Strong trending downward markets',
        'Sideways or ranging markets with volatility',
        'Completely stable markets with no movement'
      ],
      correct: 2,
      explanation: 'Grid trading thrives in sideways or ranging markets with regular volatility, as this creates the price movements needed to trigger grid orders.'
    },
    {
      id: 'gt-basics-4',
      question: 'What happens to your grid strategy if the price breaks strongly above your highest sell order?',
      options: [
        'You continue profiting indefinitely',
        'All positions are automatically closed',
        'You may miss out on further profits and hold mostly cash',
        'The grid automatically adjusts upward'
      ],
      correct: 2,
      explanation: 'If price breaks above your grid range, you\'ll have sold your assets but miss further upward profits. This is why proper range selection is important.'
    }
  ]
};

// Educational content for Risk Management
const riskManagementContent: ModuleContent[] = [
  {
    type: 'text',
    title: 'Understanding Grid Trading Risks',
    content: {
      text: `While grid trading can be profitable, it's essential to understand the inherent risks:

**Trending Market Risk**: The biggest risk to grid trading
• If price trends strongly in one direction, you may face significant losses
• In uptrend: You sell too early and miss gains
• In downtrend: You keep buying as price falls, accumulating losses

**Capital Requirements**: Grid trading requires substantial capital
• You need funds for multiple simultaneous positions
• Deeper grids require more capital to maintain effectiveness
• Consider opportunity cost of tied-up capital

**Concentration Risk**: Putting too much capital in one grid
• Diversification across different assets reduces risk
• Don't risk more than you can afford to lose on any single grid
• Consider correlation between different trading pairs`,
      highlightBoxes: [
        {
          type: 'error',
          title: 'Critical Risk Alert',
          content: 'Never use more than 5-10% of your total portfolio on a single grid trading strategy. The risk of trending markets can cause significant losses.'
        }
      ]
    }
  },
  {
    type: 'interactive',
    title: 'Risk Scenario Analysis',
    content: {
      component: 'RiskVisualization',
      props: {
        scenarios: [
          {
            id: 'trending-up',
            name: 'Strong Uptrend',
            description: 'What happens when price trends strongly upward',
            pricePattern: 'trending-up',
            initialGrid: { range: [0.8, 1.2], current: 1.0 },
            riskLevel: 'medium'
          },
          {
            id: 'trending-down',
            name: 'Strong Downtrend', 
            description: 'What happens when price trends strongly downward',
            pricePattern: 'trending-down',
            initialGrid: { range: [0.8, 1.2], current: 1.0 },
            riskLevel: 'high'
          },
          {
            id: 'high-volatility',
            name: 'High Volatility',
            description: 'Extreme volatility can trigger many orders quickly',
            pricePattern: 'volatile',
            initialGrid: { range: [0.8, 1.2], current: 1.0 },
            riskLevel: 'medium'
          }
        ]
      },
      guidance: 'Explore different market scenarios to understand when grid trading faces challenges and how to mitigate risks.'
    }
  },
  {
    type: 'text',
    title: 'Position Sizing and Capital Management',
    content: {
      text: `Proper position sizing is crucial for sustainable grid trading:

**The 1-5% Rule**: 
• Never risk more than 1-5% of total portfolio on a single grid
• This protects against catastrophic losses from trending markets
• Allows you to survive multiple failed grids

**Grid Depth Considerations**:
• Deeper grids (more levels) require more capital but offer better coverage
• Shallow grids need less capital but may miss opportunities
• Balance capital requirements with risk tolerance

**Emergency Exit Planning**:
• Set clear conditions for closing a grid (e.g., 15% portfolio loss)
• Have stop-loss levels defined before starting
• Don't get emotionally attached to positions`,
      calculatorBoxes: [
        {
          type: 'calculator',
          title: 'Position Size Calculator',
          inputs: [
            { label: 'Total Portfolio Value', type: 'number', id: 'portfolio' },
            { label: 'Risk Percentage (1-5%)', type: 'number', id: 'risk', max: 5 },
            { label: 'Number of Grid Levels', type: 'number', id: 'levels' }
          ],
          calculation: 'maxPosition = (portfolio * risk/100) / levels',
          result: 'Maximum position size per grid level'
        }
      ]
    }
  }
];

const riskManagementQuiz: Quiz = {
  questions: [
    {
      id: 'risk-1',
      question: 'What is the biggest risk in grid trading?',
      options: [
        'High transaction fees',
        'Strong trending markets',
        'Low market volatility',
        'Technical system failures'
      ],
      correct: 1,
      explanation: 'Strong trending markets are the biggest threat to grid trading, as they can cause continuous losses in the direction opposite to the trend.'
    },
    {
      id: 'risk-2',
      question: 'What percentage of your total portfolio should you risk on a single grid?',
      options: [
        '10-20%',
        '20-30%',
        '1-5%',
        '50% or more'
      ],
      correct: 2,
      explanation: 'Never risk more than 1-5% of your total portfolio on a single grid to protect against catastrophic losses from trending markets.'
    },
    {
      id: 'risk-3',
      question: 'In a strong downtrend, what typically happens to a grid trading strategy?',
      options: [
        'It generates maximum profits',
        'It remains neutral',
        'It keeps buying assets at falling prices, accumulating losses',
        'It automatically reverses to profit from the trend'
      ],
      correct: 2,
      explanation: 'In a downtrend, grid trading continues executing buy orders at predetermined levels, meaning you keep purchasing assets as they decline in value.'
    }
  ]
};

// Educational content for Market Conditions
const marketConditionsContent: ModuleContent[] = [
  {
    type: 'text',
    title: 'Identifying Optimal Market Conditions',
    content: {
      text: `Success in grid trading heavily depends on choosing the right market conditions:

**Ideal Conditions - Ranging Markets**:
• Price oscillates within a defined range
• Regular volatility provides trading opportunities
• No strong directional bias over extended periods
• Support and resistance levels are clearly defined

**Favorable Conditions - Mean Reversion Markets**:
• Price tends to return to average after extremes
• Temporary price spikes are followed by corrections
• Market has established trading ranges

**Challenging Conditions - Trending Markets**:
• Strong sustained price movement in one direction
• Breaking through previous support/resistance levels
• News-driven or fundamental shifts in asset value`,
      chartExamples: [
        {
          type: 'price-chart',
          title: 'Ranging Market Example',
          description: 'Price moves between $0.90 and $1.10 repeatedly',
          data: 'ranging-pattern'
        },
        {
          type: 'price-chart', 
          title: 'Trending Market Example',
          description: 'Price moves consistently upward from $0.80 to $1.20',
          data: 'trending-pattern'
        }
      ]
    }
  },
  {
    type: 'interactive',
    title: 'Market Pattern Recognition',
    content: {
      component: 'MarketPatternQuiz',
      props: {
        patterns: [
          {
            id: 'ranging-1',
            name: 'Sideways Range',
            chartData: 'ranging-pattern-1',
            correctAnswer: 'excellent',
            explanation: 'This ranging pattern with regular oscillations is ideal for grid trading.'
          },
          {
            id: 'trending-1',
            name: 'Strong Uptrend',
            chartData: 'trending-up-pattern-1',
            correctAnswer: 'poor',
            explanation: 'Strong trends are challenging for grid trading as you sell positions too early.'
          },
          {
            id: 'volatile-1',
            name: 'High Volatility Range',
            chartData: 'volatile-ranging-1',
            correctAnswer: 'good',
            explanation: 'High volatility within a range provides many trading opportunities.'
          }
        ]
      },
      guidance: 'Look at each price chart and determine whether it represents good, fair, or poor conditions for grid trading.'
    }
  },
  {
    type: 'text',
    title: 'Technical Indicators for Grid Trading',
    content: {
      text: `Use technical analysis to identify favorable conditions:

**Bollinger Bands**:
• Price oscillating between upper and lower bands indicates ranging
• Tight bands suggest low volatility (may expand soon)
• Wide bands with price touching edges indicate good grid conditions

**RSI (Relative Strength Index)**:
• RSI oscillating between 30-70 suggests ranging market
• Extreme readings (>80 or <20) may indicate trend exhaustion
• Look for RSI divergences that suggest trend reversals

**Moving Averages**:
• Price oscillating around moving average indicates ranging
• Multiple timeframe MA analysis helps identify trend strength
• MA convergence suggests potential ranging periods

**Volume Analysis**:
• Consistent volume in ranges suggests sustainable patterns
• Volume spikes during breakouts may signal trend changes
• Low volume ranges may not provide enough trading opportunities`,
      indicatorExamples: [
        {
          name: 'Bollinger Bands',
          goodCondition: 'Price bouncing between bands repeatedly',
          badCondition: 'Price breaking bands and continuing in one direction'
        },
        {
          name: 'RSI',
          goodCondition: 'RSI oscillating between 30-70 regularly',
          badCondition: 'RSI staying above 70 or below 30 consistently'
        }
      ]
    }
  }
];

const marketConditionsQuiz: Quiz = {
  questions: [
    {
      id: 'market-1',
      question: 'What type of market condition is most favorable for grid trading?',
      options: [
        'Strong upward trending markets',
        'Strong downward trending markets', 
        'Ranging or sideways markets with volatility',
        'Completely stable markets with no price movement'
      ],
      correct: 2,
      explanation: 'Ranging markets with regular volatility provide the price oscillations that grid trading needs to generate profits from both buy and sell orders.'
    },
    {
      id: 'market-2',
      question: 'When using Bollinger Bands to assess grid trading conditions, what pattern suggests favorable conditions?',
      options: [
        'Price consistently above the upper band',
        'Price consistently below the lower band',
        'Price oscillating between the upper and lower bands',
        'Bands converging to a very tight range'
      ],
      correct: 2,
      explanation: 'Price oscillating between Bollinger Bands indicates a ranging market with regular volatility - ideal conditions for grid trading.'
    },
    {
      id: 'market-3',
      question: 'What RSI pattern suggests good conditions for grid trading?',
      options: [
        'RSI consistently above 80',
        'RSI consistently below 20',
        'RSI oscillating between 30-70',
        'RSI showing a strong upward trend'
      ],
      correct: 2,
      explanation: 'RSI oscillating between 30-70 indicates a ranging market without extreme overbought or oversold conditions - favorable for grid strategies.'
    }
  ]
};

// Educational content for Advanced Strategies
const advancedStrategiesContent: ModuleContent[] = [
  {
    type: 'text',
    title: 'Advanced Grid Configuration Techniques',
    content: {
      text: `Once you master basic grid trading, advanced techniques can improve performance:

**Dynamic Grid Spacing**:
• Adjust spacing based on volatility measurements
• Tighter grids during low volatility periods
• Wider grids during high volatility to avoid excessive trades

**Asymmetric Grids**:
• More buy orders if you expect slight downward bias
• More sell orders if you expect slight upward bias
• Different spacing above vs below current price

**Multiple Timeframe Grids**:
• Short-term grids for quick scalping (minutes/hours)
• Medium-term grids for daily/weekly cycles
• Long-term grids for monthly/seasonal patterns

**Adaptive Grid Levels**:
• Automatically adjust grid range based on price movement
• Shift entire grid if price establishes new range
• Scale position sizes based on distance from center`,
      advancedTechniques: [
        {
          name: 'Volatility-Based Spacing',
          description: 'Calculate grid spacing using Average True Range (ATR)',
          formula: 'Grid Spacing = ATR(14) × Multiplier (1.5-2.5)'
        },
        {
          name: 'Fibonacci Grid Levels',
          description: 'Place grid levels at Fibonacci retracement levels',
          levels: ['23.6%', '38.2%', '50%', '61.8%', '78.6%']
        }
      ]
    }
  },
  {
    type: 'simulation',
    title: 'Advanced Grid Configuration Workshop',
    content: {
      component: 'AdvancedGridWorkshop',
      props: {
        exercises: [
          {
            id: 'volatility-adaptive',
            name: 'Volatility-Adaptive Grid',
            description: 'Create a grid that adjusts spacing based on market volatility',
            challenge: 'Configure grid spacing that narrows during low volatility and widens during high volatility',
            successCriteria: ['Spacing adjusts to volatility', 'Maintains profitability', 'Reduces excessive trades']
          },
          {
            id: 'asymmetric-bias',
            name: 'Asymmetric Grid Setup',
            description: 'Set up a grid with directional bias based on market analysis',
            challenge: 'Create a grid with 60% buy orders and 40% sell orders for a slightly bearish market',
            successCriteria: ['Proper order distribution', 'Bias matches market conditions', 'Risk management maintained']
          }
        ]
      },
      guidance: 'Complete advanced grid configuration exercises to master sophisticated techniques.'
    }
  },
  {
    type: 'text',
    title: 'Multi-Asset Grid Strategies',
    content: {
      text: `Advanced traders can implement grids across multiple assets:

**Portfolio Diversification**:
• Run grids on uncorrelated assets (e.g., ERG/USDT, SigUSD/ERG)
• Spread risk across different market sectors
• Balance high and low volatility pairs

**Arbitrage Grid Opportunities**:
• Identify price differences between exchanges
• Use grids to capture arbitrage profits
• Consider transaction costs and execution timing

**Correlation-Based Strategies**:
• Pair trade with correlated assets
• Long/short grids on related pairs
• Hedge exposure across similar assets

**Cross-Chain Opportunities**:
• Grid trading across different blockchains
• Take advantage of DeFi yield opportunities
• Consider bridge costs and timing risks`,
      portfolioExamples: [
        {
          name: 'Conservative Portfolio',
          allocation: {
            'ERG/USDT': '40%',
            'SigUSD/ERG': '35%', 
            'Reserve Pool': '25%'
          },
          riskLevel: 'Low',
          expectedReturn: '8-15% annually'
        },
        {
          name: 'Aggressive Portfolio',
          allocation: {
            'ERG/USDT': '30%',
            'Small Cap/ERG': '25%',
            'Volatility Pairs': '30%',
            'Reserve Pool': '15%'
          },
          riskLevel: 'High', 
          expectedReturn: '20-40% annually (higher risk)'
        }
      ]
    }
  }
];

const advancedStrategiesQuiz: Quiz = {
  questions: [
    {
      id: 'advanced-1',
      question: 'What is the benefit of using volatility-based grid spacing?',
      options: [
        'It guarantees profits in all market conditions',
        'It adjusts spacing to match current market conditions',
        'It eliminates all trading risks',
        'It requires less capital to implement'
      ],
      correct: 1,
      explanation: 'Volatility-based spacing adapts to current market conditions, using tighter spacing in low volatility and wider spacing in high volatility periods.'
    },
    {
      id: 'advanced-2',
      question: 'In an asymmetric grid setup, why might you place more buy orders than sell orders?',
      options: [
        'Buy orders are always more profitable',
        'You expect a slight downward bias in price movement',
        'Sell orders are more risky',
        'It reduces the capital requirements'
      ],
      correct: 1,
      explanation: 'More buy orders would be placed when you expect slight downward bias, allowing you to accumulate more assets at lower prices.'
    },
    {
      id: 'advanced-3',
      question: 'What is a key consideration when running grids across multiple assets?',
      options: [
        'All assets must be perfectly correlated',
        'Diversification and correlation analysis',
        'Using identical grid parameters for all assets',
        'Focusing only on the highest volatility pairs'
      ],
      correct: 1,
      explanation: 'Diversification across uncorrelated or low-correlated assets reduces portfolio risk while correlation analysis helps optimize the overall strategy.'
    }
  ]
};

// Export all learning modules
export const learningModules: LearningModule[] = [
  {
    id: 'grid-trading-fundamentals',
    title: 'Grid Trading Fundamentals',
    description: 'Master the basic concepts and mechanics of grid trading strategy',
    content: gridTradingFundamentalsContent,
    quiz: gridTradingFundamentalsQuiz,
    requiredScore: 75,
    estimatedMinutes: 45,
    difficulty: 'beginner'
  },
  {
    id: 'risk-management', 
    title: 'Risk Management',
    description: 'Learn essential risk management techniques and position sizing for grid trading',
    content: riskManagementContent,
    quiz: riskManagementQuiz,
    requiredScore: 80,
    unlockRequirements: ['grid-trading-fundamentals'],
    estimatedMinutes: 35,
    difficulty: 'beginner'
  },
  {
    id: 'market-conditions',
    title: 'Market Analysis & Conditions',
    description: 'Identify optimal market conditions and use technical analysis for grid trading',
    content: marketConditionsContent,
    quiz: marketConditionsQuiz,
    requiredScore: 75,
    unlockRequirements: ['grid-trading-fundamentals'],
    estimatedMinutes: 40,
    difficulty: 'intermediate'
  },
  {
    id: 'advanced-strategies',
    title: 'Advanced Grid Strategies',
    description: 'Explore sophisticated grid configurations and multi-asset strategies',
    content: advancedStrategiesContent,
    quiz: advancedStrategiesQuiz,
    requiredScore: 80,
    unlockRequirements: ['risk-management', 'market-conditions'],
    estimatedMinutes: 55,
    difficulty: 'advanced'
  }
];

// Educational System Class for competency validation and progression
export class EducationSystem {
  private modules: LearningModule[];
  private userProgress: Record<string, any> = {};

  constructor(modules: LearningModule[]) {
    this.modules = modules;
  }

  // Check if user can access a module based on requirements
  canAccessModule(moduleId: string, completedModules: string[]): boolean {
    const module = this.modules.find(m => m.id === moduleId);
    if (!module) return false;

    if (!module.unlockRequirements) return true;
    
    return module.unlockRequirements.every(requirement => 
      completedModules.includes(requirement)
    );
  }

  // Validate quiz competency
  validateCompetency(moduleId: string, answers: number[]): {
    passed: boolean;
    score: number;
    incorrectQuestions: string[];
  } {
    const module = this.modules.find(m => m.id === moduleId);
    if (!module) throw new Error('Module not found');

    let correct = 0;
    const incorrectQuestions: string[] = [];

    module.quiz.questions.forEach((question, index) => {
      if (answers[index] === question.correct) {
        correct++;
      } else {
        incorrectQuestions.push(question.id);
      }
    });

    const score = Math.round((correct / module.quiz.questions.length) * 100);
    const passed = score >= module.requiredScore;

    return { passed, score, incorrectQuestions };
  }

  // Get recommended next module
  getNextRecommendedModule(completedModules: string[]): string | null {
    // Find modules user can access but hasn't completed
    const availableModules = this.modules.filter(module => 
      !completedModules.includes(module.id) && 
      this.canAccessModule(module.id, completedModules)
    );

    if (availableModules.length === 0) return null;

    // Sort by difficulty and return first
    availableModules.sort((a, b) => {
      const difficultyOrder = { 'beginner': 0, 'intermediate': 1, 'advanced': 2 };
      return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    });

    return availableModules[0].id;
  }

  // Check if user is ready for live trading
  isReadyForTrading(completedModules: string[], scores: Record<string, number>): boolean {
    const requiredModules = ['grid-trading-fundamentals', 'risk-management'];
    const hasRequiredModules = requiredModules.every(module => completedModules.includes(module));
    
    if (!hasRequiredModules) return false;

    // Check minimum scores for critical modules
    const minScores = {
      'grid-trading-fundamentals': 75,
      'risk-management': 80
    };

    return Object.entries(minScores).every(([moduleId, minScore]) => 
      scores[moduleId] && scores[moduleId] >= minScore
    );
  }

  // Get learning progress summary
  getProgressSummary(completedModules: string[], scores: Record<string, number>) {
    const totalModules = this.modules.length;
    const averageScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length || 0;
    
    return {
      modulesCompleted: completedModules.length,
      totalModules,
      progressPercentage: Math.round((completedModules.length / totalModules) * 100),
      averageScore: Math.round(averageScore),
      readyForTrading: this.isReadyForTrading(completedModules, scores),
      nextRecommendedModule: this.getNextRecommendedModule(completedModules)
    };
  }
}

// Export singleton instance
export const educationSystem = new EducationSystem(learningModules);
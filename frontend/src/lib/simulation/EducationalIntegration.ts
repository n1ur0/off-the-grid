import { SimulationSession, PerformanceMetrics } from './GridSimulator';
import { PerformanceReport } from './PerformanceTracker';
import { PracticeSession, Achievement, UserProgress } from '../../types/education';

export interface PracticeRequirements {
  minimumSessions: number;
  minimumTotalTime: number; // in milliseconds
  minimumTrades: number;
  minimumProfitableSessions: number;
  requiredAchievements: string[];
}

export interface CompetencyAssessment {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  readyForLive: boolean;
}

export interface LearningObjective {
  id: string;
  title: string;
  description: string;
  category: 'risk_management' | 'grid_strategy' | 'market_analysis' | 'execution' | 'psychology';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  targetMetric: string;
  targetValue: number;
  completed: boolean;
}

export interface SessionAnalysis {
  objectives: LearningObjective[];
  completedObjectives: string[];
  newSkillsLearned: string[];
  areasForImprovement: string[];
  nextSteps: string[];
}

export class EducationalIntegration {
  private static readonly DEFAULT_REQUIREMENTS: PracticeRequirements = {
    minimumSessions: 3,
    minimumTotalTime: 24 * 60 * 60 * 1000, // 24 hours
    minimumTrades: 10,
    minimumProfitableSessions: 2,
    requiredAchievements: ['first_profitable_session', 'risk_aware_trader'],
  };

  private static readonly LEARNING_OBJECTIVES: LearningObjective[] = [
    {
      id: 'basic_profitability',
      title: 'Achieve Basic Profitability',
      description: 'Generate positive returns in a practice session',
      category: 'grid_strategy',
      difficulty: 'beginner',
      targetMetric: 'totalReturn',
      targetValue: 0.01,
      completed: false,
    },
    {
      id: 'risk_control',
      title: 'Maintain Risk Control',
      description: 'Keep maximum drawdown below 10%',
      category: 'risk_management',
      difficulty: 'beginner',
      targetMetric: 'maxDrawdown',
      targetValue: 0.1,
      completed: false,
    },
    {
      id: 'high_win_rate',
      title: 'High Win Rate Achievement',
      description: 'Achieve a win rate above 60%',
      category: 'execution',
      difficulty: 'intermediate',
      targetMetric: 'winRate',
      targetValue: 0.6,
      completed: false,
    },
    {
      id: 'positive_sharpe',
      title: 'Risk-Adjusted Returns',
      description: 'Achieve a Sharpe ratio above 1.0',
      category: 'risk_management',
      difficulty: 'intermediate',
      targetMetric: 'sharpeRatio',
      targetValue: 1.0,
      completed: false,
    },
    {
      id: 'consistent_performance',
      title: 'Consistent Performance',
      description: 'Complete 3 profitable sessions in a row',
      category: 'psychology',
      difficulty: 'advanced',
      targetMetric: 'consecutiveProfitable',
      targetValue: 3,
      completed: false,
    },
    {
      id: 'advanced_returns',
      title: 'Advanced Returns',
      description: 'Achieve returns above 5% in a single session',
      category: 'grid_strategy',
      difficulty: 'advanced',
      targetMetric: 'totalReturn',
      targetValue: 0.05,
      completed: false,
    },
    {
      id: 'low_volatility',
      title: 'Stable Strategy',
      description: 'Keep portfolio volatility below 15%',
      category: 'risk_management',
      difficulty: 'advanced',
      targetMetric: 'volatility',
      targetValue: 0.15,
      completed: false,
    },
    {
      id: 'high_volume_trading',
      title: 'Active Trading',
      description: 'Execute more than 20 trades in a session',
      category: 'execution',
      difficulty: 'intermediate',
      targetMetric: 'totalTrades',
      targetValue: 20,
      completed: false,
    },
  ];

  static convertSessionToPractice(
    session: SimulationSession,
    report: PerformanceReport,
    userId: string
  ): PracticeSession {
    const endTime = new Date();
    const duration = (endTime.getTime() - session.startTime.getTime()) / (1000 * 60);

    return {
      id: this.generateId(),
      userId,
      sessionData: {
        portfolio: session.currentPortfolio,
        trades: session.orderExecutions.map(e => ({
          id: this.generateId(),
          timestamp: e.timestamp.toISOString(),
          type: e.type,
          tokenId: session.grids.values().next().value?.config.tokenId || 'unknown',
          amount: e.amount,
          price: e.price,
          successful: e.successful,
        })),
        gridOrders: Array.from(session.grids.values()).map(grid => ({
          id: grid.id,
          identity: grid.config.gridIdentity,
          tokenId: grid.config.tokenId,
          status: grid.status,
          initialValue: grid.config.baseAmount,
          currentValue: grid.currentValue,
          profitLoss: grid.profitLoss,
          buyOrders: grid.orders.filter(o => o.type === 'buy').length,
          sellOrders: grid.orders.filter(o => o.type === 'sell').length,
          filledOrders: grid.filledOrders.length,
          createdAt: grid.createdAt.toISOString(),
        })),
      },
      initialBalance: session.initialPortfolio.totalValue,
      finalBalance: session.currentPortfolio.totalValue,
      profitLoss: session.currentPortfolio.totalValue - session.initialPortfolio.totalValue,
      tradesCount: session.orderExecutions.length,
      successfulTrades: session.orderExecutions.filter(e => e.successful).length,
      gridOrdersCreated: session.grids.size,
      startedAt: session.startTime.toISOString(),
      endedAt: endTime.toISOString(),
      durationMinutes: duration,
    };
  }

  static assessCompetency(
    practiceHistory: PracticeSession[],
    requirements: PracticeRequirements = this.DEFAULT_REQUIREMENTS
  ): CompetencyAssessment {
    if (practiceHistory.length === 0) {
      return {
        score: 0,
        grade: 'F',
        strengths: [],
        weaknesses: ['No practice sessions completed'],
        recommendations: ['Complete your first practice trading session'],
        readyForLive: false,
      };
    }

    const assessment = this.calculateAssessmentScore(practiceHistory);
    const meetsRequirements = this.checkRequirements(practiceHistory, requirements);

    return {
      ...assessment,
      readyForLive: assessment.score >= 70 && meetsRequirements,
    };
  }

  static analyzeSession(
    session: SimulationSession,
    report: PerformanceReport
  ): SessionAnalysis {
    const objectives = [...this.LEARNING_OBJECTIVES];
    const completedObjectives: string[] = [];
    const newSkillsLearned: string[] = [];
    const areasForImprovement: string[] = [];
    const nextSteps: string[] = [];

    // Check completed objectives
    for (const objective of objectives) {
      const metricValue = this.extractMetricValue(report, objective.targetMetric);
      
      if (this.isObjectiveAchieved(objective, metricValue)) {
        objective.completed = true;
        completedObjectives.push(objective.id);
        
        // Add skill based on objective category
        switch (objective.category) {
          case 'risk_management':
            newSkillsLearned.push('Risk Management');
            break;
          case 'grid_strategy':
            newSkillsLearned.push('Grid Strategy Optimization');
            break;
          case 'execution':
            newSkillsLearned.push('Trade Execution');
            break;
          case 'market_analysis':
            newSkillsLearned.push('Market Analysis');
            break;
          case 'psychology':
            newSkillsLearned.push('Trading Psychology');
            break;
        }
      }
    }

    // Identify areas for improvement
    if (report.summary.totalReturn < 0) {
      areasForImprovement.push('Profitability - Focus on market timing and grid configuration');
    }
    
    if (report.risk.maximumDrawdown > 0.15) {
      areasForImprovement.push('Risk Control - Implement tighter stop-losses and position sizing');
    }
    
    if (report.trades.winRate < 0.5) {
      areasForImprovement.push('Win Rate - Consider adjusting grid spacing and market selection');
    }
    
    if (report.summary.sharpeRatio < 0.5) {
      areasForImprovement.push('Risk-Adjusted Returns - Balance risk and reward more effectively');
    }

    // Generate next steps
    if (completedObjectives.length === 0) {
      nextSteps.push('Focus on achieving basic profitability');
      nextSteps.push('Practice with lower volatility market conditions');
    } else if (completedObjectives.length < 3) {
      nextSteps.push('Work on risk management techniques');
      nextSteps.push('Experiment with different grid configurations');
    } else {
      nextSteps.push('Try more challenging market scenarios');
      nextSteps.push('Focus on optimizing risk-adjusted returns');
    }

    return {
      objectives,
      completedObjectives,
      newSkillsLearned: [...new Set(newSkillsLearned)],
      areasForImprovement,
      nextSteps,
    };
  }

  static generateAchievements(
    session: SimulationSession,
    report: PerformanceReport,
    practiceHistory: PracticeSession[]
  ): Achievement[] {
    const achievements: Achievement[] = [];
    const currentTime = new Date().toISOString();

    // First session achievement
    if (practiceHistory.length === 1) {
      achievements.push({
        id: 'first_session',
        type: 'first_trade',
        title: 'First Steps',
        description: 'Completed your first practice trading session',
        icon: '🎯',
        earnedAt: currentTime,
      });
    }

    // Profitable session achievement
    if (report.summary.totalReturn > 0) {
      achievements.push({
        id: 'first_profitable_session',
        type: 'profitable_week',
        title: 'Profitable Trader',
        description: 'Generated positive returns in a trading session',
        icon: '💰',
        earnedAt: currentTime,
      });
    }

    // Risk management achievement
    if (report.risk.maximumDrawdown < 0.05) {
      achievements.push({
        id: 'risk_master',
        type: 'risk_master',
        title: 'Risk Master',
        description: 'Kept maximum drawdown below 5%',
        icon: '🛡️',
        earnedAt: currentTime,
      });
    }

    // High performance achievement
    if (report.summary.sharpeRatio > 2) {
      achievements.push({
        id: 'excellent_returns',
        type: 'grid_expert',
        title: 'Excellent Returns',
        description: 'Achieved a Sharpe ratio above 2.0',
        icon: '⭐',
        earnedAt: currentTime,
      });
    }

    // Consistency achievement
    const recentProfitable = practiceHistory
      .slice(-3)
      .every(s => (s.finalBalance || 0) > s.initialBalance);
    
    if (recentProfitable && practiceHistory.length >= 3) {
      achievements.push({
        id: 'consistent_trader',
        type: 'grid_expert',
        title: 'Consistent Trader',
        description: 'Three profitable sessions in a row',
        icon: '🔥',
        earnedAt: currentTime,
      });
    }

    // Volume achievement
    if (report.summary.totalTrades >= 50) {
      achievements.push({
        id: 'active_trader',
        type: 'grid_expert',
        title: 'Active Trader',
        description: 'Executed 50 or more trades in a single session',
        icon: '⚡',
        earnedAt: currentTime,
      });
    }

    return achievements;
  }

  static updateUserProgress(
    currentProgress: UserProgress,
    session: SimulationSession,
    report: PerformanceReport
  ): Partial<UserProgress> {
    const practiceTime = session.currentTime.getTime() - session.startTime.getTime();
    
    return {
      lastAccessed: new Date().toISOString(),
      // These would be updated based on actual practice session tracking
      // progressPercentage: Math.min(100, currentProgress.progressPercentage + 10),
    };
  }

  private static calculateAssessmentScore(practiceHistory: PracticeSession[]): Omit<CompetencyAssessment, 'readyForLive'> {
    const totalSessions = practiceHistory.length;
    const profitableSessions = practiceHistory.filter(s => (s.profitLoss || 0) > 0).length;
    const totalTrades = practiceHistory.reduce((sum, s) => sum + s.tradesCount, 0);
    const successfulTrades = practiceHistory.reduce((sum, s) => sum + s.successfulTrades, 0);
    
    let score = 0;
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

    // Experience component (30%)
    const experienceScore = Math.min(30, (totalSessions / 5) * 30);
    score += experienceScore;
    
    if (totalSessions >= 5) {
      strengths.push('Extensive practice experience');
    } else if (totalSessions >= 3) {
      strengths.push('Good practice foundation');
    } else {
      weaknesses.push('Limited practice experience');
      recommendations.push('Complete more practice sessions');
    }

    // Profitability component (40%)
    const profitabilityRate = totalSessions > 0 ? profitableSessions / totalSessions : 0;
    const profitabilityScore = profitabilityRate * 40;
    score += profitabilityScore;

    if (profitabilityRate >= 0.6) {
      strengths.push('Consistently profitable');
    } else if (profitabilityRate >= 0.4) {
      strengths.push('Generally profitable');
    } else {
      weaknesses.push('Low profitability rate');
      recommendations.push('Focus on risk management and strategy refinement');
    }

    // Execution component (30%)
    const executionRate = totalTrades > 0 ? successfulTrades / totalTrades : 0;
    const executionScore = executionRate * 30;
    score += executionScore;

    if (executionRate >= 0.9) {
      strengths.push('Excellent trade execution');
    } else if (executionRate >= 0.7) {
      strengths.push('Good trade execution');
    } else {
      weaknesses.push('Poor trade execution');
      recommendations.push('Practice trade execution and timing');
    }

    // Determine grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 85) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 55) grade = 'C';
    else if (score >= 40) grade = 'D';
    else grade = 'F';

    return {
      score: Math.round(score),
      grade,
      strengths,
      weaknesses,
      recommendations,
    };
  }

  private static checkRequirements(
    practiceHistory: PracticeSession[],
    requirements: PracticeRequirements
  ): boolean {
    const totalTime = practiceHistory.reduce((sum, s) => sum + ((s.durationMinutes || 0) * 60 * 1000), 0);
    const totalTrades = practiceHistory.reduce((sum, s) => sum + s.tradesCount, 0);
    const profitableSessions = practiceHistory.filter(s => (s.profitLoss || 0) > 0).length;

    return (
      practiceHistory.length >= requirements.minimumSessions &&
      totalTime >= requirements.minimumTotalTime &&
      totalTrades >= requirements.minimumTrades &&
      profitableSessions >= requirements.minimumProfitableSessions
    );
  }

  private static extractMetricValue(report: PerformanceReport, metricName: string): number {
    switch (metricName) {
      case 'totalReturn': return report.summary.totalReturn;
      case 'maxDrawdown': return report.risk.maximumDrawdown;
      case 'winRate': return report.trades.winRate;
      case 'sharpeRatio': return report.summary.sharpeRatio;
      case 'totalTrades': return report.summary.totalTrades;
      case 'volatility': return report.summary.volatility;
      default: return 0;
    }
  }

  private static isObjectiveAchieved(objective: LearningObjective, value: number): boolean {
    switch (objective.targetMetric) {
      case 'maxDrawdown':
        return value <= objective.targetValue;
      case 'volatility':
        return value <= objective.targetValue;
      default:
        return value >= objective.targetValue;
    }
  }

  private static generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
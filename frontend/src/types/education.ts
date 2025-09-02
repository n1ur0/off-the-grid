export interface Quiz {
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface ModuleContent {
  type: 'text' | 'interactive' | 'simulation';
  title: string;
  content: any;
}

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  content: ModuleContent[];
  quiz: Quiz;
  requiredScore: number;
  unlockRequirements?: string[];
  estimatedMinutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface UserProgress {
  userId: string;
  moduleKey: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  progressPercentage: number;
  quizAttempts: number;
  bestScore: number;
  lastScore: number;
  quizAnswers?: number[];
  startedAt?: string;
  completedAt?: string;
  lastAccessed: string;
}

export interface EducationSummary {
  modulesStarted: number;
  modulesCompleted: number;
  averageScore: number;
  readyForTrading: boolean;
  completedModules: string[];
  nextRecommendedModule?: string;
}

export interface PracticeSession {
  id: string;
  userId: string;
  sessionData: {
    portfolio: PracticePortfolio;
    trades: PracticeTrade[];
    gridOrders: PracticeGrid[];
  };
  initialBalance: number;
  finalBalance?: number;
  profitLoss?: number;
  tradesCount: number;
  successfulTrades: number;
  gridOrdersCreated: number;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
}

export interface PracticePortfolio {
  erg: number;
  tokens: Record<string, number>;
  totalValue: number;
}

export interface PracticeTrade {
  id: string;
  timestamp: string;
  type: 'buy' | 'sell';
  tokenId: string;
  amount: number;
  price: number;
  successful: boolean;
}

export interface PracticeGrid {
  id: string;
  identity: string;
  tokenId: string;
  status: 'active' | 'completed' | 'cancelled';
  initialValue: number;
  currentValue?: number;
  profitLoss: number;
  buyOrders: number;
  sellOrders: number;
  filledOrders: number;
  createdAt: string;
}

export interface Achievement {
  id: string;
  type: 'education_complete' | 'first_trade' | 'profitable_week' | 'risk_master' | 'grid_expert';
  title: string;
  description: string;
  icon: string;
  earnedAt?: string;
  progress?: number;
  target?: number;
}

export interface EducationState {
  // Current state
  modules: LearningModule[];
  userProgress: Record<string, UserProgress>;
  currentModule: string | null;
  currentSection: number;
  
  // Practice mode
  practiceSession: PracticeSession | null;
  practiceHistory: PracticeSession[];
  
  // Achievements
  achievements: Achievement[];
  
  // UI state
  loading: boolean;
  error: string | null;
  
  // Actions
  loadModules: () => Promise<void>;
  loadUserProgress: () => Promise<void>;
  startModule: (moduleId: string) => void;
  updateProgress: (moduleId: string, sectionIndex: number) => Promise<void>;
  completeSection: (moduleId: string, sectionIndex: number) => Promise<void>;
  submitQuiz: (moduleId: string, answers: number[]) => Promise<boolean>;
  
  // Practice mode actions
  startPracticeSession: () => Promise<void>;
  endPracticeSession: () => Promise<void>;
  makePracticeTrade: (trade: Omit<PracticeTrade, 'id' | 'timestamp'>) => void;
  createPracticeGrid: (gridConfig: Omit<PracticeGrid, 'id' | 'createdAt'>) => void;
  
  // Achievements
  checkAchievements: () => Promise<void>;
  unlockAchievement: (achievementType: string) => void;
  
  // Validation
  isReadyForTrading: () => boolean;
  canAccessModule: (moduleId: string) => boolean;
  getNextModule: () => string | null;
}
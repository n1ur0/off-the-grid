import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LessonProgress {
  lessonId: string;
  moduleId: string;
  completed: boolean;
  completedAt?: Date;
  score?: number;
  timeSpent: number; // in seconds
}

export interface ModuleProgress {
  moduleId: string;
  title: string;
  completed: boolean;
  completedAt?: Date;
  lessonsCompleted: number;
  totalLessons: number;
  averageScore: number;
  totalTimeSpent: number;
}

export interface QuizResult {
  quizId: string;
  moduleId: string;
  score: number;
  passed: boolean;
  completedAt: Date;
  answers: { [questionId: string]: number };
  timeSpent: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: Date;
  category: 'learning' | 'trading' | 'milestone';
}

interface EducationState {
  // State
  moduleProgress: { [moduleId: string]: ModuleProgress };
  lessonProgress: { [lessonId: string]: LessonProgress };
  quizResults: QuizResult[];
  achievements: Achievement[];
  currentModule: string | null;
  currentLesson: string | null;
  
  // Stats
  totalTimeSpent: number;
  modulesCompleted: number;
  averageScore: number;
  
  // Actions
  startLesson: (moduleId: string, lessonId: string) => void;
  completeLesson: (moduleId: string, lessonId: string, timeSpent: number) => void;
  updateLessonProgress: (moduleId: string, lessonId: string, timeSpent: number) => void;
  completeQuiz: (moduleId: string, quizId: string, score: number, passed: boolean, answers: { [questionId: string]: number }, timeSpent: number) => void;
  completeModule: (moduleId: string) => void;
  unlockAchievement: (achievement: Achievement) => void;
  resetProgress: () => void;
  getModuleProgress: (moduleId: string) => ModuleProgress | null;
  getLessonProgress: (lessonId: string) => LessonProgress | null;
  calculateOverallProgress: () => number;
  checkForAchievements: () => void;
}

const defaultModules = [
  'basics',
  'strategy', 
  'risk-management',
  'ergo-blockchain',
  'smart-contracts',
  'portfolio-management'
];

export const useEducationStore = create<EducationState>()(
  persist(
    (set, get) => ({
      // Initial state
      moduleProgress: {},
      lessonProgress: {},
      quizResults: [],
      achievements: [],
      currentModule: null,
      currentLesson: null,
      totalTimeSpent: 0,
      modulesCompleted: 0,
      averageScore: 0,

      // Actions
      startLesson: (moduleId: string, lessonId: string) => {
        set({ 
          currentModule: moduleId, 
          currentLesson: lessonId 
        });
      },

      completeLesson: (moduleId: string, lessonId: string, timeSpent: number) => {
        const state = get();
        
        set((state) => {
          const newLessonProgress: { [key: string]: LessonProgress } = {
            ...state.lessonProgress,
            [lessonId]: {
              lessonId,
              moduleId,
              completed: true,
              completedAt: new Date(),
              timeSpent,
            }
          };

          // Update module progress
          const currentModuleId = newLessonProgress[lessonId].moduleId;
          const moduleLessons = Object.values(newLessonProgress).filter((l: LessonProgress) => l.moduleId === currentModuleId);
          const completedLessons = moduleLessons.filter((l: LessonProgress) => l.completed).length;
          
          // Assume each module has 6 lessons (this could be dynamic)
          const totalLessons = 6;
          const moduleCompleted = completedLessons >= totalLessons;
          
          const newModuleProgress: { [key: string]: ModuleProgress } = {
            ...state.moduleProgress,
            [currentModuleId]: {
              moduleId: currentModuleId,
              title: currentModuleId.charAt(0).toUpperCase() + currentModuleId.slice(1).replace('-', ' '),
              completed: moduleCompleted,
              completedAt: moduleCompleted ? new Date() : undefined,
              lessonsCompleted: completedLessons,
              totalLessons,
              averageScore: 0, // Will be updated by quiz completion
              totalTimeSpent: moduleLessons.reduce((sum: number, l: LessonProgress) => sum + l.timeSpent, 0),
            }
          };

          return {
            lessonProgress: newLessonProgress,
            moduleProgress: newModuleProgress,
            totalTimeSpent: state.totalTimeSpent + timeSpent,
            modulesCompleted: Object.values(newModuleProgress).filter((m: ModuleProgress) => m.completed).length,
          };
        });

        // Check for achievements
        get().checkForAchievements();
      },

      updateLessonProgress: (moduleId: string, lessonId: string, timeSpent: number) => {
        set((state) => ({
          lessonProgress: {
            ...state.lessonProgress,
            [lessonId]: {
              ...state.lessonProgress[lessonId],
              lessonId,
              moduleId,
              completed: false,
              timeSpent: (state.lessonProgress[lessonId]?.timeSpent || 0) + timeSpent,
            }
          },
          totalTimeSpent: state.totalTimeSpent + timeSpent,
        }));
      },

      completeQuiz: (moduleId: string, quizId: string, score: number, passed: boolean, answers: { [questionId: string]: number }, timeSpent: number) => {
        const quizResult: QuizResult = {
          quizId,
          moduleId,
          score,
          passed,
          completedAt: new Date(),
          answers,
          timeSpent,
        };

        set((state) => {
          const newQuizResults = [...state.quizResults, quizResult];
          
          // Update module average score
          const moduleQuizzes = newQuizResults.filter(q => q.moduleId === moduleId);
          const averageScore = moduleQuizzes.reduce((sum, q) => sum + q.score, 0) / moduleQuizzes.length;
          
          const newModuleProgress = {
            ...state.moduleProgress,
            [moduleId]: {
              ...state.moduleProgress[moduleId],
              averageScore,
            }
          };

          // Calculate overall average score
          const allScores = newQuizResults.map(q => q.score);
          const overallAverage = allScores.length > 0 
            ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length 
            : 0;

          return {
            quizResults: newQuizResults,
            moduleProgress: newModuleProgress,
            averageScore: overallAverage,
            totalTimeSpent: state.totalTimeSpent + timeSpent,
          };
        });

        // Check for achievements
        get().checkForAchievements();
      },

      completeModule: (moduleId: string) => {
        set((state) => ({
          moduleProgress: {
            ...state.moduleProgress,
            [moduleId]: {
              ...state.moduleProgress[moduleId],
              completed: true,
              completedAt: new Date(),
            }
          },
          modulesCompleted: state.modulesCompleted + 1,
        }));

        // Check for achievements
        get().checkForAchievements();
      },

      unlockAchievement: (achievement: Achievement) => {
        set((state) => ({
          achievements: [...state.achievements, achievement]
        }));
      },

      resetProgress: () => {
        set({
          moduleProgress: {},
          lessonProgress: {},
          quizResults: [],
          achievements: [],
          currentModule: null,
          currentLesson: null,
          totalTimeSpent: 0,
          modulesCompleted: 0,
          averageScore: 0,
        });
      },

      getModuleProgress: (moduleId: string) => {
        return get().moduleProgress[moduleId] || null;
      },

      getLessonProgress: (lessonId: string) => {
        return get().lessonProgress[lessonId] || null;
      },

      calculateOverallProgress: () => {
        const state = get();
        const totalModules = defaultModules.length;
        return totalModules > 0 ? (state.modulesCompleted / totalModules) * 100 : 0;
      },

      checkForAchievements: () => {
        const state = get();
        const existingAchievements = state.achievements.map(a => a.id);

        // First lesson achievement
        if (!existingAchievements.includes('first-lesson') && 
            Object.values(state.lessonProgress).some(l => l.completed)) {
          get().unlockAchievement({
            id: 'first-lesson',
            title: 'First Steps',
            description: 'Completed your first lesson',
            icon: '🎯',
            unlockedAt: new Date(),
            category: 'learning',
          });
        }

        // First module achievement
        if (!existingAchievements.includes('first-module') && state.modulesCompleted >= 1) {
          get().unlockAchievement({
            id: 'first-module',
            title: 'Module Master',
            description: 'Completed your first module',
            icon: '🏆',
            unlockedAt: new Date(),
            category: 'learning',
          });
        }

        // Quiz master achievement
        if (!existingAchievements.includes('quiz-master') && 
            state.quizResults.filter(q => q.passed && q.score >= 90).length >= 3) {
          get().unlockAchievement({
            id: 'quiz-master',
            title: 'Quiz Master',
            description: 'Scored 90%+ on 3 quizzes',
            icon: '🧠',
            unlockedAt: new Date(),
            category: 'learning',
          });
        }

        // Time dedication achievement
        if (!existingAchievements.includes('dedicated-learner') && state.totalTimeSpent >= 3600) { // 1 hour
          get().unlockAchievement({
            id: 'dedicated-learner',
            title: 'Dedicated Learner',
            description: 'Spent over 1 hour learning',
            icon: '⏰',
            unlockedAt: new Date(),
            category: 'milestone',
          });
        }

        // Course completion achievement
        if (!existingAchievements.includes('course-complete') && 
            state.modulesCompleted >= defaultModules.length) {
          get().unlockAchievement({
            id: 'course-complete',
            title: 'Course Graduate',
            description: 'Completed all learning modules',
            icon: '🎓',
            unlockedAt: new Date(),
            category: 'milestone',
          });
        }
      },
    }),
    {
      name: 'education-storage',
      version: 1,
    }
  )
);
'use client';

import { Metadata } from 'next';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircleIcon, 
  LockClosedIcon, 
  ClockIcon, 
  AcademicCapIcon,
  TrophyIcon,
  SparklesIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline';
import { learningModules, educationSystem } from '../../lib/education-modules';
import { useEducationStore } from '../../lib/stores/education';

// Note: metadata export removed for client component

const moduleIcons = {
  'grid-trading-fundamentals': '📚',
  'risk-management': '⚖️',
  'market-conditions': '📊', 
  'advanced-strategies': '🎯'
};

const difficultyColors = {
  beginner: 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-300',
  intermediate: 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-300',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
};

export default function LearnPage() {
  const [progressSummary, setProgressSummary] = useState<any>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const educationStore = useEducationStore();
  
  useEffect(() => {
    // Get completed modules from store
    const completedModules = Object.values(educationStore.moduleProgress)
      .filter(progress => progress.completed)
      .map(progress => progress.moduleId);
    
    // Get scores from quiz results
    const scores = educationStore.quizResults.reduce((acc, result) => {
      acc[result.moduleId] = result.score;
      return acc;
    }, {} as Record<string, number>);
    
    // Get progress summary
    const summary = educationSystem.getProgressSummary(completedModules, scores);
    setProgressSummary(summary);
    setAchievements(educationStore.achievements);
  }, [educationStore.moduleProgress, educationStore.quizResults, educationStore.achievements]);
  
  const canAccessModule = (moduleId: string) => {
    const completedModules = Object.values(educationStore.moduleProgress)
      .filter(progress => progress.completed)
      .map(progress => progress.moduleId);
    return educationSystem.canAccessModule(moduleId, completedModules);
  };
  
  const getModuleProgress = (moduleId: string) => {
    return educationStore.getModuleProgress(moduleId);
  };
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-center space-x-3">
          <AcademicCapIcon className="h-10 w-10 text-primary-500" />
          <span>Master Grid Trading</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-6">
          Learn grid trading from basics to advanced strategies with interactive lessons, 
          real examples, and hands-on practice on the Ergo blockchain.
        </p>
        
        {progressSummary?.readyForTrading && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-full px-6 py-3 text-green-800 dark:text-green-300"
          >
            <TrophyIcon className="h-5 w-5" />
            <span className="font-semibold">Ready for Live Trading!</span>
            <SparklesIcon className="h-5 w-5" />
          </motion.div>
        )}
      </motion.div>
      
      {/* Achievements Banner */}
      {achievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
        >
          <div className="flex items-center justify-center space-x-4">
            <TrophyIcon className="h-6 w-6 text-yellow-600" />
            <span className="font-semibold text-yellow-800 dark:text-yellow-300">
              🎉 {achievements.length} Achievement{achievements.length > 1 ? 's' : ''} Unlocked!
            </span>
            <div className="flex space-x-2">
              {achievements.slice(-3).map((achievement, index) => (
                <span key={index} className="text-lg" title={achievement.title}>
                  {achievement.icon}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Progress Overview */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
            <BookOpenIcon className="h-5 w-5 text-primary-500" />
            <span>Your Progress</span>
          </h2>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {progressSummary?.modulesCompleted || 0} of {learningModules.length} modules completed
          </span>
        </div>
        
        <div className="mb-4">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressSummary?.progressPercentage || 0}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full flex items-center justify-end pr-2"
            >
              {(progressSummary?.progressPercentage || 0) > 15 && (
                <span className="text-xs text-white font-medium">
                  {progressSummary?.progressPercentage || 0}%
                </span>
              )}
            </motion.div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {progressSummary?.modulesCompleted || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Modules Complete</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {progressSummary?.averageScore || 0}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Average Score</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {Math.floor((educationStore.totalTimeSpent || 0) / 60)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Hours Studied</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {achievements.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Achievements</div>
          </div>
        </div>
      </motion.div>

      {/* Learning Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {learningModules.map((module, index) => {
          const hasAccess = canAccessModule(module.id);
          const moduleProgress = getModuleProgress(module.id);
          const progressPercent = moduleProgress 
            ? Math.round((moduleProgress.lessonsCompleted / moduleProgress.totalLessons) * 100)
            : 0;
          
          const ModuleCard = hasAccess ? Link : 'div';
          const cardProps = hasAccess ? { href: `/learn/${module.id}` } : {};
          
          return (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="group"
            >
              <ModuleCard {...cardProps}>
                <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-all duration-200 ${
                  hasAccess 
                    ? 'hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 cursor-pointer' 
                    : 'opacity-75 cursor-not-allowed'
                }`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl">{moduleIcons[module.id as keyof typeof moduleIcons] || '📚'}</span>
                      {!hasAccess && <LockClosedIcon className="h-5 w-5 text-gray-400" />}
                    </div>
                    {moduleProgress?.completed && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-300"
                      >
                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                        Completed
                      </motion.span>
                    )}
                  </div>
                  
                  <h3 className={`text-lg font-semibold text-gray-900 dark:text-white mb-2 transition-colors ${
                    hasAccess ? 'group-hover:text-primary-600 dark:group-hover:text-primary-400' : ''
                  }`}>
                    {module.title}
                  </h3>
                  
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {module.description}
                  </p>
                  
                  {/* Progress Bar */}
                  {progressPercent > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Progress</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{progressPercent}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div 
                          className="bg-primary-500 h-1.5 rounded-full transition-all duration-300" 
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center space-x-1">
                        <BookOpenIcon className="h-3 w-3" />
                        <span>{module.content.length} sections</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <ClockIcon className="h-3 w-3" />
                        <span>{module.estimatedMinutes} min</span>
                      </span>
                    </div>
                    <span>🎯 {module.requiredScore}% to pass</span>
                  </div>
                  
                  {/* Prerequisites */}
                  {!hasAccess && module.unlockRequirements && (
                    <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-xs text-yellow-800 dark:text-yellow-300">
                        📚 Complete: {module.unlockRequirements.map(reqId => {
                          const reqModule = learningModules.find(m => m.id === reqId);
                          return reqModule?.title || reqId;
                        }).join(', ')}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${difficultyColors[module.difficulty]}`}>
                      {module.difficulty}
                    </span>
                    {hasAccess && (
                      <span className="text-primary-500 group-hover:text-primary-600 transition-colors font-medium">
                        {progressPercent > 0 ? 'Continue' : 'Start'} Learning →
                      </span>
                    )}
                    {!hasAccess && (
                      <span className="text-gray-400 dark:text-gray-500">
                        🔒 Locked
                      </span>
                    )}
                  </div>
                </div>
              </ModuleCard>
            </motion.div>
          );
        })}
      </div>

      {/* Learning Path & Next Steps */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-12 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg p-8 border border-primary-200 dark:border-primary-800"
      >
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            📚 Structured Learning Path
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
            Follow our comprehensive curriculum designed by trading experts. 
            Each module builds on the previous one with competency validation.
          </p>
          
          {progressSummary?.nextRecommendedModule && (
            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-primary-200 dark:border-primary-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center justify-center space-x-2">
                <SparklesIcon className="h-5 w-5 text-primary-500" />
                <span>Next Recommended:</span>
              </h3>
              <p className="text-primary-600 dark:text-primary-400 font-medium">
                {learningModules.find(m => m.id === progressSummary.nextRecommendedModule)?.title}
              </p>
            </div>
          )}
          
          <div className="flex flex-wrap justify-center items-center gap-4 text-sm">
            {learningModules.map((module, index) => {
              const hasAccess = canAccessModule(module.id);
              const moduleProgress = getModuleProgress(module.id);
              const isCompleted = moduleProgress?.completed;
              
              return (
                <div key={module.id} className="flex items-center">
                  <span className={`px-3 py-1 rounded-full font-medium transition-colors ${
                    isCompleted 
                      ? 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-300'
                      : hasAccess
                      ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {isCompleted ? '✅' : hasAccess ? '📖' : '🔒'} {index + 1}. {module.title.split(' ')[0]}
                  </span>
                  {index < learningModules.length - 1 && <span className="mx-2 text-gray-400">→</span>}
                </div>
              );
            })}
          </div>
          
          {progressSummary?.readyForTrading && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1, type: "spring" }}
              className="mt-6 p-4 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg"
            >
              <div className="flex items-center justify-center space-x-3">
                <TrophyIcon className="h-6 w-6 text-green-600" />
                <div>
                  <h3 className="font-bold text-green-800 dark:text-green-300">🎉 Congratulations!</h3>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    You've mastered the fundamentals and are ready for live trading!
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
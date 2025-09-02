'use client';

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { learningModules, educationSystem } from '../../../lib/education-modules';
import { ModuleContent } from '../../../components/education/ModuleContent';
import { useEducationStore } from '../../../lib/stores/education';

interface Props {
  params: {
    module: string;
  };
}

const moduleIcons = {
  'grid-trading-fundamentals': '📚',
  'risk-management': '⚖️',
  'market-conditions': '📊',
  'advanced-strategies': '🎯'
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const module = learningModules.find(m => m.id === params.module);
  
  if (!module) {
    return {
      title: 'Module Not Found - Off the Grid',
    };
  }

  return {
    title: `${module.title} - Learn Grid Trading`,
    description: module.description,
  };
}

export default function ModulePage({ params }: Props) {
  const [showContent, setShowContent] = useState(false);
  const [canAccess, setCanAccess] = useState(false);
  const educationStore = useEducationStore();
  
  const module = learningModules.find(m => m.id === params.module);

  if (!module) {
    notFound();
  }
  
  useEffect(() => {
    // Check if user can access this module
    const completedModules = Object.values(educationStore.moduleProgress)
      .filter(progress => progress.completed)
      .map(progress => progress.moduleId);
    
    const hasAccess = educationSystem.canAccessModule(module.id, completedModules);
    setCanAccess(hasAccess);
  }, [module.id, educationStore.moduleProgress]);
  
  const moduleProgress = educationStore.getModuleProgress(module.id);
  const progressPercent = moduleProgress 
    ? Math.round((moduleProgress.lessonsCompleted / moduleProgress.totalLessons) * 100)
    : 0;
    
  const handleSectionComplete = (sectionIndex: number) => {
    // Handle section completion
  };
  
  const handleModuleComplete = () => {
    // Handle module completion
    setShowContent(false);
  };
  
  if (!canAccess && module.unlockRequirements) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Module Locked
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Complete the following modules to unlock "{module.title}":
          </p>
          <div className="space-y-2 mb-8">
            {module.unlockRequirements.map(reqId => {
              const reqModule = learningModules.find(m => m.id === reqId);
              const reqProgress = educationStore.getModuleProgress(reqId);
              return (
                <div key={reqId} className={`p-3 rounded-lg border ${
                  reqProgress?.completed 
                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                    : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                }`}>
                  <span className={reqProgress?.completed ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}>
                    {reqProgress?.completed ? '✅' : '❌'} {reqModule?.title || reqId}
                  </span>
                </div>
              );
            })}
          </div>
          <Link
            href="/learn"
            className="inline-block bg-primary-500 hover:bg-primary-600 text-white py-3 px-6 rounded-lg font-medium transition-colors"
          >
            Return to Learning Path
          </Link>
        </div>
      </div>
    );
  }
  
  if (showContent) {
    return (
      <ModuleContent 
        moduleId={module.id}
        module={module}
        onSectionComplete={handleSectionComplete}
        onModuleComplete={handleModuleComplete}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <ol className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <li>
            <Link href="/learn" className="hover:text-primary-500 transition-colors">
              Learn
            </Link>
          </li>
          <li>/</li>
          <li className="text-gray-900 dark:text-white font-medium">{module.title}</li>
        </ol>
      </nav>

      {/* Module Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 mb-8">
        <div className="flex items-start space-x-4">
          <span className="text-5xl">{moduleIcons[module.id as keyof typeof moduleIcons] || '📚'}</span>
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {module.title}
              </h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                module.difficulty === 'beginner' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                module.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              }`}>
                {module.difficulty}
              </span>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
              {module.description}
            </p>
            <div className="flex flex-wrap items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center space-x-1">
                <span>📝</span>
                <span>{module.content.length} sections</span>
              </span>
              <span className="flex items-center space-x-1">
                <span>⏱️</span>
                <span>{module.estimatedMinutes} min total</span>
              </span>
              <span className="flex items-center space-x-1">
                <span>🎯</span>
                <span>{module.requiredScore}% passing score</span>
              </span>
              <span className="flex items-center space-x-1">
                <span>✅</span>
                <span>{progressPercent}% completed</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Module Progress
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{progressPercent}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-primary-500 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${progressPercent}%` }} 
          />
        </div>
      </div>

      {/* Content Overview */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Learning Content
        </h2>
        {module.content.map((section, index) => {
          const sectionProgress = educationStore.getLessonProgress(`${module.id}-${index}`);
          return (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center space-x-4">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  sectionProgress?.completed 
                    ? 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {sectionProgress?.completed ? '✓' : index + 1}
                </div>
                <span className="text-2xl">
                  {section.type === 'text' ? '📖' : 
                   section.type === 'interactive' ? '🎮' : 
                   section.type === 'simulation' ? '🧪' : '📚'}
                </span>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {section.title}
                  </h3>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full capitalize">
                      {section.type}
                    </span>
                    {sectionProgress?.completed && (
                      <span className="text-xs text-success-600 dark:text-success-400">
                        ✅ Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Quiz Section */}
        <div className="bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-lg border-2 border-dashed border-primary-200 dark:border-primary-800 p-6">
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center">
              <span className="text-primary-600 dark:text-primary-400 font-semibold text-sm">Q</span>
            </div>
            <span className="text-2xl">❓</span>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 dark:text-white">
                Final Assessment
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {module.quiz.questions.length} questions • {module.requiredScore}% required to pass
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <button 
          onClick={() => setShowContent(true)}
          className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-3 px-6 rounded-lg font-medium transition-colors shadow-lg hover:shadow-xl"
        >
          {moduleProgress?.completed ? 'Review Module' : progressPercent > 0 ? 'Continue Learning' : 'Start Module'}
        </button>
        <Link
          href="/learn"
          className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-3 px-6 rounded-lg font-medium transition-colors text-center"
        >
          Back to Modules
        </Link>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  CheckIcon,
  PlayIcon,
  PauseIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  CalculatorIcon,
  ChartBarIcon,
  BookOpenIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { InteractiveGrid } from './InteractiveGrid';
import { QuizComponent } from './QuizComponent';
import { useEducationStore } from '../../lib/stores/education';
import { ModuleContent as ModuleContentType, LearningModule } from '../../types/education';

interface HighlightBox {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  content: string;
}

interface InteractiveElement {
  type: 'expandable' | 'tooltip' | 'calculation';
  title: string;
  content: string;
}

interface CalculatorBox {
  type: 'calculator';
  title: string;
  inputs: Array<{
    label: string;
    type: 'number' | 'text';
    id: string;
    max?: number;
  }>;
  calculation: string;
  result: string;
}

interface TextContent {
  text: string;
  highlightBoxes?: HighlightBox[];
  interactiveElements?: InteractiveElement[];
  calculatorBoxes?: CalculatorBox[];
  chartExamples?: Array<{
    type: string;
    title: string;
    description: string;
    data: string;
  }>;
  indicatorExamples?: Array<{
    name: string;
    goodCondition: string;
    badCondition: string;
  }>;
  advancedTechniques?: Array<{
    name: string;
    description: string;
    formula?: string;
    levels?: string[];
  }>;
  portfolioExamples?: Array<{
    name: string;
    allocation: Record<string, string>;
    riskLevel: string;
    expectedReturn: string;
  }>;
}

interface ModuleContentProps {
  moduleId: string;
  module: LearningModule;
  onSectionComplete?: (sectionIndex: number) => void;
  onModuleComplete?: () => void;
}

export function ModuleContent({ 
  moduleId, 
  module,
  onSectionComplete, 
  onModuleComplete 
}: ModuleContentProps) {
  const [currentSection, setCurrentSection] = useState(0);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [expandedElements, setExpandedElements] = useState<Set<string>>(new Set());
  const [calculatorValues, setCalculatorValues] = useState<Record<string, Record<string, number>>>({});
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [timeSpent, setTimeSpent] = useState(0);
  
  const educationStore = useEducationStore();
  
  const section = module.content[currentSection];
  const isFirstSection = currentSection === 0;
  const isLastSection = currentSection === module.content.length - 1;
  const progressPercent = ((completedSections.size) / module.content.length) * 100;
  
  // Track time spent
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [currentSection]);

  const markSectionComplete = () => {
    const newCompleted = new Set(completedSections);
    newCompleted.add(currentSection);
    setCompletedSections(newCompleted);
    
    // Update education store
    educationStore.updateLessonProgress(moduleId, `${moduleId}-${currentSection}`, timeSpent);
    educationStore.completeLesson(moduleId, `${moduleId}-${currentSection}`, timeSpent);
    
    onSectionComplete?.(currentSection);
    
    // Check if all sections are complete to show quiz
    if (newCompleted.size === module.content.length && !quizCompleted) {
      setShowQuiz(true);
    }
  };
  
  const handleQuizComplete = (score: number, passed: boolean) => {
    setQuizCompleted(true);
    educationStore.completeQuiz(moduleId, `${moduleId}-quiz`, score, passed, {}, timeSpent);
    
    if (passed) {
      educationStore.completeModule(moduleId);
      onModuleComplete?.();
    }
  };

  const goToNext = () => {
    if (showQuiz) {
      return; // Quiz is shown, no next action
    }
    if (!isLastSection) {
      setCurrentSection(currentSection + 1);
      setTimeSpent(0);
    } else if (!showQuiz && completedSections.size === module.content.length) {
      setShowQuiz(true);
    }
  };

  const goToPrevious = () => {
    if (showQuiz) {
      setShowQuiz(false);
      return;
    }
    if (!isFirstSection) {
      setCurrentSection(currentSection - 1);
      setTimeSpent(0);
    }
  };
  
  const toggleExpandedElement = (elementId: string) => {
    const newExpanded = new Set(expandedElements);
    if (newExpanded.has(elementId)) {
      newExpanded.delete(elementId);
    } else {
      newExpanded.add(elementId);
    }
    setExpandedElements(newExpanded);
  };
  
  const updateCalculatorValue = (calculatorId: string, inputId: string, value: number) => {
    setCalculatorValues(prev => ({
      ...prev,
      [calculatorId]: {
        ...prev[calculatorId],
        [inputId]: value
      }
    }));
  };

  const renderHighlightBox = (box: HighlightBox, index: number) => {
    const colors = {
      info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
      warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300',
      error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300',
      success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
    };
    
    const icons = {
      info: <InformationCircleIcon className="h-5 w-5" />,
      warning: <ExclamationTriangleIcon className="h-5 w-5" />,
      error: <ExclamationTriangleIcon className="h-5 w-5" />,
      success: <CheckIcon className="h-5 w-5" />
    };
    
    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
        className={`p-4 rounded-lg border ${colors[box.type]} my-6`}
      >
        <div className="flex items-start space-x-3">
          {icons[box.type]}
          <div>
            <h4 className="font-semibold mb-2">{box.title}</h4>
            <p className="text-sm">{box.content}</p>
          </div>
        </div>
      </motion.div>
    );
  };
  
  const renderInteractiveElement = (element: InteractiveElement, index: number) => {
    const elementId = `${currentSection}-${index}`;
    const isExpanded = expandedElements.has(elementId);
    
    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="my-4 border border-gray-200 dark:border-gray-700 rounded-lg"
      >
        <button
          onClick={() => toggleExpandedElement(elementId)}
          className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <LightBulbIcon className="h-5 w-5 text-primary-500" />
            <span className="font-medium text-gray-900 dark:text-white">{element.title}</span>
          </div>
          <ChevronRightIcon className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/50"
            >
              <p className="text-sm text-gray-700 dark:text-gray-300">{element.content}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };
  
  const renderCalculatorBox = (calculator: CalculatorBox, index: number) => {
    const calculatorId = `calc-${index}`;
    const values = calculatorValues[calculatorId] || {};
    
    // Simple calculation evaluation (in real app, use a proper expression evaluator)
    const calculateResult = () => {
      try {
        let formula = calculator.calculation;
        calculator.inputs.forEach(input => {
          const value = values[input.id] || 0;
          formula = formula.replace(new RegExp(input.id, 'g'), value.toString());
        });
        // Basic math evaluation (be careful with eval in production!)
        const result = eval(formula.replace(/[^0-9+\-*/().\s]/g, ''));
        return isNaN(result) ? 0 : result;
      } catch {
        return 0;
      }
    };
    
    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="my-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
      >
        <div className="flex items-center space-x-3 mb-4">
          <CalculatorIcon className="h-6 w-6 text-blue-600" />
          <h4 className="font-semibold text-gray-900 dark:text-white">{calculator.title}</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {calculator.inputs.map((input, inputIndex) => (
            <div key={inputIndex}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {input.label}
              </label>
              <input
                type={input.type}
                max={input.max}
                value={values[input.id] || ''}
                onChange={(e) => updateCalculatorValue(calculatorId, input.id, parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter value"
              />
            </div>
          ))}
        </div>
        
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{calculator.result}:</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            ${calculateResult().toFixed(2)}
          </div>
        </div>
      </motion.div>
    );
  };
  
  const renderSectionContent = () => {
    switch (section.type) {
      case 'text':
        const textContent = section.content as TextContent;
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="prose dark:prose-invert max-w-none">
              <h3 className="flex items-center space-x-3">
                <BookOpenIcon className="h-6 w-6 text-primary-500" />
                <span>{section.title}</span>
              </h3>
              <div className="whitespace-pre-line text-gray-700 dark:text-gray-300">
                {textContent.text}
              </div>
            </div>
            
            {textContent.highlightBoxes?.map((box, index) => renderHighlightBox(box, index))}
            {textContent.interactiveElements?.map((element, index) => renderInteractiveElement(element, index))}
            {textContent.calculatorBoxes?.map((calculator, index) => renderCalculatorBox(calculator, index))}
            
            {textContent.advancedTechniques && (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                  <AcademicCapIcon className="h-5 w-5" />
                  <span>Advanced Techniques</span>
                </h4>
                {textContent.advancedTechniques.map((technique, index) => (
                  <div key={index} className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <h5 className="font-medium text-purple-800 dark:text-purple-300 mb-2">{technique.name}</h5>
                    <p className="text-sm text-purple-700 dark:text-purple-400 mb-2">{technique.description}</p>
                    {technique.formula && (
                      <code className="text-xs bg-purple-100 dark:bg-purple-800 px-2 py-1 rounded text-purple-800 dark:text-purple-300">
                        {technique.formula}
                      </code>
                    )}
                    {technique.levels && (
                      <div className="mt-2">
                        <span className="text-xs text-purple-600 dark:text-purple-400">Levels: </span>
                        {technique.levels.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {textContent.portfolioExamples && (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                  <ChartBarIcon className="h-5 w-5" />
                  <span>Portfolio Examples</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {textContent.portfolioExamples.map((portfolio, index) => (
                    <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                      <h5 className="font-medium text-gray-900 dark:text-white mb-2">{portfolio.name}</h5>
                      <div className="space-y-2 text-sm">
                        {Object.entries(portfolio.allocation).map(([asset, percentage]) => (
                          <div key={asset} className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">{asset}:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{percentage}</span>
                          </div>
                        ))}
                        <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-600">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Risk Level:</span>
                            <span className={`font-medium ${
                              portfolio.riskLevel === 'Low' ? 'text-green-600' :
                              portfolio.riskLevel === 'High' ? 'text-red-600' : 'text-yellow-600'
                            }`}>{portfolio.riskLevel}</span>
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-gray-600 dark:text-gray-400">Expected Return:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{portfolio.expectedReturn}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        );
        
      case 'interactive':
        const interactiveContent = section.content;
        if (interactiveContent.component === 'InteractiveGrid') {
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center justify-center space-x-3">
                  <PlayIcon className="h-6 w-6 text-primary-500" />
                  <span>{section.title}</span>
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {interactiveContent.guidance}
                </p>
                {interactiveContent.learningObjectives && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Learning Objectives:</h4>
                    <ul className="text-sm text-blue-700 dark:text-blue-400 list-disc list-inside space-y-1">
                      {interactiveContent.learningObjectives.map((objective: string, index: number) => (
                        <li key={index}>{objective}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <InteractiveGrid {...interactiveContent.props} />
            </motion.div>
          );
        }
        return (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Interactive component not implemented</p>
          </div>
        );
        
      case 'simulation':
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center justify-center space-x-3">
                <PlayIcon className="h-6 w-6 text-green-500" />
                <span>{section.title}</span>
              </h3>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border-2 border-dashed border-green-200 dark:border-green-800 rounded-lg p-8">
              <div className="text-center">
                <div className="text-4xl mb-4">🎯</div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Simulation Exercise
                </h4>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Practice advanced grid trading concepts in a risk-free environment
                </p>
                <button className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                  Launch Simulation
                </button>
              </div>
            </div>
          </motion.div>
        );
        
      default:
        return (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Content type not supported</p>
          </div>
        );
    }
  };
  
  // Show quiz if all sections completed and quiz not yet completed
  if (showQuiz && !quizCompleted) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center space-x-3">
            <AcademicCapIcon className="h-8 w-8 text-primary-500" />
            <span>{module.title} - Final Assessment</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Complete this quiz with a score of {module.requiredScore}% or higher to complete the module.
          </p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-primary-500 h-2 rounded-full" style={{ width: '100%' }} />
          </div>
        </div>
        
        <QuizComponent
          questions={module.quiz.questions.map(q => ({
            id: parseInt(q.id.split('-').pop() || '0'),
            question: q.question,
            options: q.options,
            correctAnswer: q.correct,
            explanation: q.explanation,
            category: module.title
          }))}
          title={`${module.title} Assessment`}
          passingScore={module.requiredScore}
          onComplete={handleQuizComplete}
        />
        
        <div className="mt-8 flex justify-start">
          <button
            onClick={goToPrevious}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeftIcon className="h-5 w-5" />
            <span>Back to Content</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {section.title}
            </h2>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              module.difficulty === 'beginner' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
              module.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
              'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {module.difficulty}
            </span>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {currentSection + 1} of {module.content.length}
            </span>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Time spent: {Math.floor(timeSpent / 60)}:{(timeSpent % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-primary-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Module Progress: {Math.round(progressPercent)}% • Estimated time: {module.estimatedMinutes} minutes
        </div>
      </div>

      {/* Section Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 md:p-8 mb-8">
        {renderSectionContent()}
      </div>

      {/* Navigation Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
        <button
          onClick={goToPrevious}
          disabled={isFirstSection && !showQuiz}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeftIcon className="h-5 w-5" />
          <span>Previous</span>
        </button>

        <div className="flex items-center space-x-4">
          {!completedSections.has(currentSection) && !showQuiz && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={markSectionComplete}
              className="flex items-center space-x-2 bg-success-500 hover:bg-success-600 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg"
            >
              <CheckIcon className="h-5 w-5" />
              <span>Mark Complete</span>
            </motion.button>
          )}

          {completedSections.has(currentSection) && (
            <span className="flex items-center space-x-2 text-success-600 dark:text-success-400 font-medium">
              <CheckIcon className="h-5 w-5" />
              <span>Completed</span>
            </span>
          )}
          
          {quizCompleted && (
            <span className="flex items-center space-x-2 text-primary-600 dark:text-primary-400 font-medium">
              <AcademicCapIcon className="h-5 w-5" />
              <span>Module Complete</span>
            </span>
          )}
        </div>

        <button
          onClick={goToNext}
          disabled={(isLastSection && completedSections.size < module.content.length) || showQuiz}
          className="flex items-center space-x-2 px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
        >
          <span>
            {isLastSection && completedSections.size === module.content.length && !showQuiz ? 'Take Quiz' : 'Next'}
          </span>
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
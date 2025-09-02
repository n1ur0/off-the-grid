'use client';

import { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon, LightBulbIcon, ClockIcon, AcademicCapIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: string;
}

interface QuizComponentProps {
  questions: QuizQuestion[];
  title?: string;
  passingScore?: number;
  onComplete?: (score: number, passed: boolean, answers: number[], timeSpent: number) => void;
  allowRetake?: boolean;
  showDetailedResults?: boolean;
}

export function QuizComponent({ 
  questions, 
  title = "Knowledge Check",
  passingScore = 70,
  onComplete,
  allowRetake = true,
  showDetailedResults = true
}: QuizComponentProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [showResults, setShowResults] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<Date>(new Date());
  
  // Track time spent
  useEffect(() => {
    if (!startTime) {
      setStartTime(new Date());
    }
  }, [startTime]);
  
  useEffect(() => {
    setQuestionStartTime(new Date());
  }, [currentQuestion]);

  const question = questions[currentQuestion];
  const isLastQuestion = currentQuestion === questions.length - 1;
  const hasAnswered = selectedAnswers[question.id] !== undefined;

  const selectAnswer = (optionIndex: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [question.id]: optionIndex
    }));
    setShowResults(true);
  };

  const nextQuestion = () => {
    if (isLastQuestion) {
      completeQuiz();
    } else {
      setCurrentQuestion(prev => prev + 1);
      setShowResults(false);
    }
  };

  const completeQuiz = () => {
    const correctAnswers = questions.filter(q => 
      selectedAnswers[q.id] === q.correctAnswer
    ).length;
    const score = Math.round((correctAnswers / questions.length) * 100);
    const passed = score >= passingScore;
    const totalTimeSpent = startTime ? Math.floor((new Date().getTime() - startTime.getTime()) / 1000) : 0;
    
    setTimeSpent(totalTimeSpent);
    setQuizCompleted(true);
    
    // Create answers array in order
    const answersArray = questions.map(q => selectedAnswers[q.id] ?? -1);
    
    onComplete?.(score, passed, answersArray, totalTimeSpent);
  };

  const restartQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswers({});
    setShowResults(false);
    setQuizCompleted(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-success-600 dark:text-success-400';
    if (score >= passingScore) return 'text-warning-600 dark:text-warning-400';
    return 'text-danger-600 dark:text-danger-400';
  };

  if (quizCompleted) {
    const correctAnswers = questions.filter(q => 
      selectedAnswers[q.id] === q.correctAnswer
    ).length;
    const score = Math.round((correctAnswers / questions.length) * 100);
    const passed = score >= passingScore;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="mb-6">
          {passed ? (
            <CheckCircleIcon className="h-16 w-16 text-success-500 mx-auto mb-4" />
          ) : (
            <XCircleIcon className="h-16 w-16 text-danger-500 mx-auto mb-4" />
          )}
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Quiz {passed ? 'Completed!' : 'Not Passed'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {passed 
              ? 'Congratulations! You have successfully completed this quiz.'
              : `You need ${passingScore}% to pass. Keep learning and try again!`
            }
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className={`text-3xl font-bold ${getScoreColor(score)}`}>
                {score}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Final Score</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {correctAnswers}/{questions.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Correct Answers</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {passingScore}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Passing Score</div>
            </div>
          </div>
        </div>

        {/* Detailed Results */}
        <div className="text-left mb-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Question Review</h4>
          <div className="space-y-4 max-h-64 overflow-y-auto">
            {questions.map((q, index) => {
              const userAnswer = selectedAnswers[q.id];
              const isCorrect = userAnswer === q.correctAnswer;
              return (
                <div key={q.id} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  {isCorrect ? (
                    <CheckCircleIcon className="h-5 w-5 text-success-500 mt-1 flex-shrink-0" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-danger-500 mt-1 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Question {index + 1}: {q.question}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Your answer: {q.options[userAnswer]}
                    </p>
                    {!isCorrect && (
                      <p className="text-sm text-success-600 dark:text-success-400 mt-1">
                        Correct answer: {q.options[q.correctAnswer]}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={restartQuiz}
            className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-2 px-4 rounded-lg font-medium transition-colors"
          >
            Retake Quiz
          </button>
          {passed && (
            <button className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-2 px-4 rounded-lg font-medium transition-colors">
              Continue Learning
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {title}
          </h3>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Question {currentQuestion + 1} of {questions.length}
          </span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-primary-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-8">
        <div className="flex items-start space-x-3 mb-6">
          <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center">
            <span className="text-primary-600 dark:text-primary-400 font-semibold text-sm">
              {currentQuestion + 1}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {question.question}
            </p>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {question.category}
            </span>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {question.options.map((option, index) => {
            const isSelected = selectedAnswers[question.id] === index;
            const isCorrect = index === question.correctAnswer;
            const showCorrectAnswer = showResults && isCorrect;
            const showIncorrectAnswer = showResults && isSelected && !isCorrect;

            return (
              <button
                key={index}
                onClick={() => !hasAnswered && selectAnswer(index)}
                disabled={hasAnswered}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  showCorrectAnswer
                    ? 'border-success-500 bg-success-50 dark:bg-success-900/20'
                    : showIncorrectAnswer
                    ? 'border-danger-500 bg-danger-50 dark:bg-danger-900/20'
                    : isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-700'
                } ${hasAnswered ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 dark:text-white">{option}</span>
                  {showCorrectAnswer && <CheckCircleIcon className="h-5 w-5 text-success-500" />}
                  {showIncorrectAnswer && <XCircleIcon className="h-5 w-5 text-danger-500" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showResults && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start space-x-3">
              <LightBulbIcon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-1">Explanation</h4>
                <p className="text-sm text-blue-800 dark:text-blue-300">{question.explanation}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-end">
        {hasAnswered && (
          <button
            onClick={nextQuestion}
            className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            {isLastQuestion ? 'Finish Quiz' : 'Next Question'}
          </button>
        )}
      </div>
    </div>
  );
}
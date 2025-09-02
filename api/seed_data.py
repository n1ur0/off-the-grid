"""
Seed data for Off the Grid educational platform.
Creates initial educational modules, quiz questions, and achievements.
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Dict, Any
import uuid

from sqlalchemy.orm import Session
from database import (
    get_db_session, EducationalModule, QuizQuestion, Achievement,
    create_tables
)

logger = logging.getLogger(__name__)

def create_educational_modules(db: Session) -> List[EducationalModule]:
    """Create initial educational modules."""
    
    modules_data = [
        {
            'module_code': 'grid-basics',
            'title': 'Grid Trading Fundamentals',
            'description': 'Learn the basics of grid trading strategy, how it works, and its advantages for cryptocurrency trading.',
            'difficulty_level': 'beginner',
            'estimated_duration_minutes': 45,
            'prerequisites': [],
            'learning_objectives': [
                'Understand what grid trading is and how it works',
                'Learn the key components of a grid trading strategy',
                'Identify market conditions suitable for grid trading',
                'Calculate potential profits and risks'
            ],
            'content_metadata': {
                'sections': [
                    'What is Grid Trading?',
                    'Grid Parameters: Price Range and Order Count',
                    'Profit Mechanism in Grid Trading',
                    'Suitable Market Conditions',
                    'Advantages and Disadvantages'
                ],
                'interactive_elements': ['price_calculator', 'grid_visualizer'],
                'videos': ['grid_intro.mp4', 'grid_mechanics.mp4']
            },
            'passing_score': 75,
            'sort_order': 1
        },
        {
            'module_code': 'risk-management',
            'title': 'Risk Management in Grid Trading',
            'description': 'Essential risk management principles for grid trading, including position sizing, stop losses, and portfolio management.',
            'difficulty_level': 'intermediate',
            'estimated_duration_minutes': 60,
            'prerequisites': ['grid-basics'],
            'learning_objectives': [
                'Understand key risk factors in grid trading',
                'Learn position sizing techniques',
                'Apply stop-loss strategies effectively',
                'Manage portfolio risk across multiple grids',
                'Calculate risk-reward ratios'
            ],
            'content_metadata': {
                'sections': [
                    'Understanding Grid Trading Risks',
                    'Position Sizing Strategies',
                    'Stop-Loss Implementation',
                    'Portfolio Diversification',
                    'Risk-Reward Analysis'
                ],
                'interactive_elements': ['risk_calculator', 'position_sizer'],
                'case_studies': ['bear_market_2022', 'volatile_altcoin_example']
            },
            'passing_score': 80,
            'sort_order': 2
        },
        {
            'module_code': 'market-conditions',
            'title': 'Market Analysis for Grid Trading',
            'description': 'Learn to analyze market conditions and choose optimal parameters for different trading environments.',
            'difficulty_level': 'intermediate',
            'estimated_duration_minutes': 50,
            'prerequisites': ['grid-basics'],
            'learning_objectives': [
                'Identify trending vs. sideways markets',
                'Adjust grid parameters for different volatility levels',
                'Recognize optimal entry and exit points',
                'Use technical analysis for grid optimization',
                'Adapt strategy to market cycles'
            ],
            'content_metadata': {
                'sections': [
                    'Market Regime Identification',
                    'Volatility Analysis',
                    'Technical Indicators for Grid Trading',
                    'Timing Grid Deployment',
                    'Market Cycle Considerations'
                ],
                'interactive_elements': ['market_analyzer', 'volatility_calculator'],
                'tools': ['tradingview_integration', 'market_scanner']
            },
            'passing_score': 75,
            'sort_order': 3
        },
        {
            'module_code': 'advanced-strategies',
            'title': 'Advanced Grid Trading Strategies',
            'description': 'Advanced techniques including dynamic grids, multi-pair strategies, and algorithmic optimizations.',
            'difficulty_level': 'advanced',
            'estimated_duration_minutes': 75,
            'prerequisites': ['grid-basics', 'risk-management', 'market-conditions'],
            'learning_objectives': [
                'Implement dynamic grid adjustment strategies',
                'Design multi-pair correlation strategies',
                'Optimize grid parameters algorithmically',
                'Use advanced risk management techniques',
                'Develop custom trading algorithms'
            ],
            'content_metadata': {
                'sections': [
                    'Dynamic Grid Strategies',
                    'Multi-Pair Grid Systems',
                    'Algorithmic Parameter Optimization',
                    'Advanced Risk Controls',
                    'Custom Strategy Development'
                ],
                'interactive_elements': ['strategy_builder', 'backtest_engine'],
                'programming': ['python_examples', 'api_integration']
            },
            'passing_score': 85,
            'sort_order': 4
        },
        {
            'module_code': 'platform-usage',
            'title': 'Off the Grid Platform Mastery',
            'description': 'Complete guide to using the Off the Grid platform, including advanced features and best practices.',
            'difficulty_level': 'beginner',
            'estimated_duration_minutes': 40,
            'prerequisites': [],
            'learning_objectives': [
                'Navigate the platform interface efficiently',
                'Create and manage grid orders',
                'Monitor performance and analytics',
                'Use platform tools and features',
                'Troubleshoot common issues'
            ],
            'content_metadata': {
                'sections': [
                    'Platform Overview',
                    'Creating Your First Grid',
                    'Monitoring and Management',
                    'Analytics and Reporting',
                    'Troubleshooting Guide'
                ],
                'interactive_elements': ['platform_tour', 'demo_mode'],
                'tutorials': ['first_grid_walkthrough', 'advanced_features']
            },
            'passing_score': 70,
            'sort_order': 5
        }
    ]
    
    modules = []
    for module_data in modules_data:
        # Check if module already exists
        existing = db.query(EducationalModule).filter(
            EducationalModule.module_code == module_data['module_code']
        ).first()
        
        if not existing:
            module = EducationalModule(**module_data)
            db.add(module)
            modules.append(module)
            logger.info(f"Created educational module: {module_data['module_code']}")
        else:
            modules.append(existing)
            logger.info(f"Educational module already exists: {module_data['module_code']}")
    
    db.commit()
    return modules


def create_quiz_questions(db: Session, modules: List[EducationalModule]) -> List[QuizQuestion]:
    """Create quiz questions for educational modules."""
    
    # Find modules by code for easier reference
    module_map = {module.module_code: module for module in modules}
    
    questions_data = [
        # Grid Basics Questions
        {
            'module_code': 'grid-basics',
            'question_text': 'What is the primary mechanism by which grid trading generates profit?',
            'question_type': 'multiple_choice',
            'options': [
                'Buying low and selling high through automated orders',
                'Holding positions for long-term appreciation',
                'Arbitrage between different exchanges',
                'Leverage amplification of small price movements'
            ],
            'correct_answers': [0],
            'explanation': 'Grid trading profits by placing multiple buy and sell orders at predetermined price levels, automatically buying low and selling high as the price moves within the grid range.',
            'difficulty': 1,
            'points': 1
        },
        {
            'module_code': 'grid-basics',
            'question_text': 'Which market condition is generally BEST suited for grid trading?',
            'question_type': 'multiple_choice',
            'options': [
                'Strong uptrend',
                'Strong downtrend',
                'Sideways/ranging market',
                'High volatility with clear direction'
            ],
            'correct_answers': [2],
            'explanation': 'Grid trading performs best in sideways or ranging markets where the price oscillates within a predictable range, triggering multiple buy/sell pairs.',
            'difficulty': 2,
            'points': 2
        },
        {
            'module_code': 'grid-basics',
            'question_text': 'True or False: Increasing the number of orders in a grid will always increase profitability.',
            'question_type': 'true_false',
            'options': ['True', 'False'],
            'correct_answers': [1],
            'explanation': 'False. While more orders can capture more price movements, they also increase fees and may reduce the profit per trade. There is an optimal balance.',
            'difficulty': 3,
            'points': 2
        },
        
        # Risk Management Questions
        {
            'module_code': 'risk-management',
            'question_text': 'What is the main risk when using grid trading in a strong trending market?',
            'question_type': 'multiple_choice',
            'options': [
                'Excessive fees from frequent trading',
                'Getting caught in a one-directional move',
                'Insufficient liquidity',
                'Platform technical issues'
            ],
            'correct_answers': [1],
            'explanation': 'The main risk is getting caught in a strong trend where the price moves outside the grid range and doesn\'t return, leaving you with an imbalanced position.',
            'difficulty': 2,
            'points': 2
        },
        {
            'module_code': 'risk-management',
            'question_text': 'What percentage of your total portfolio should typically be allocated to a single grid strategy?',
            'question_type': 'multiple_choice',
            'options': [
                '50-75%',
                '25-40%',
                '5-15%',
                '80-100%'
            ],
            'correct_answers': [2],
            'explanation': 'Conservative risk management suggests allocating 5-15% of your portfolio to any single grid strategy to maintain proper diversification.',
            'difficulty': 2,
            'points': 2
        },
        
        # Market Conditions Questions
        {
            'module_code': 'market-conditions',
            'question_text': 'Which technical indicator is most useful for identifying suitable grid trading opportunities?',
            'question_type': 'multiple_choice',
            'options': [
                'Moving Average Convergence Divergence (MACD)',
                'Relative Strength Index (RSI)',
                'Bollinger Bands',
                'Exponential Moving Average (EMA)'
            ],
            'correct_answers': [2],
            'explanation': 'Bollinger Bands are particularly useful for grid trading as they help identify price ranges and volatility levels, which are crucial for setting grid parameters.',
            'difficulty': 3,
            'points': 2
        },
        {
            'module_code': 'market-conditions',
            'question_text': 'What should you do when market volatility suddenly increases significantly?',
            'question_type': 'multiple_choice',
            'options': [
                'Increase the number of grid orders',
                'Widen the grid spacing',
                'Narrow the grid spacing',
                'Add more capital to the grid'
            ],
            'correct_answers': [1],
            'explanation': 'When volatility increases, widening grid spacing helps prevent the grid from being fully executed too quickly and reduces the risk of large losses.',
            'difficulty': 3,
            'points': 3
        }
    ]
    
    questions = []
    for question_data in questions_data:
        module_code = question_data.pop('module_code')
        module = module_map.get(module_code)
        
        if module:
            # Check if question already exists
            existing = db.query(QuizQuestion).filter(
                QuizQuestion.module_id == module.id,
                QuizQuestion.question_text == question_data['question_text']
            ).first()
            
            if not existing:
                question = QuizQuestion(
                    module_id=module.id,
                    **question_data
                )
                db.add(question)
                questions.append(question)
                logger.info(f"Created quiz question for {module_code}")
            else:
                questions.append(existing)
    
    db.commit()
    return questions


def create_achievements(db: Session) -> List[Achievement]:
    """Create achievement definitions."""
    
    achievements_data = [
        {
            'achievement_code': 'first_module_complete',
            'title': 'First Steps',
            'description': 'Complete your first educational module',
            'achievement_type': 'education',
            'criteria': {'modules_completed': 1},
            'reward_points': 100,
            'badge_icon': 'first-steps-badge.svg'
        },
        {
            'achievement_code': 'grid_basics_master',
            'title': 'Grid Basics Master',
            'description': 'Complete the Grid Trading Fundamentals module with 90% score',
            'achievement_type': 'education',
            'criteria': {
                'module_code': 'grid-basics',
                'min_score': 90
            },
            'reward_points': 200,
            'badge_icon': 'grid-master-badge.svg'
        },
        {
            'achievement_code': 'risk_aware',
            'title': 'Risk Aware Trader',
            'description': 'Complete the Risk Management module',
            'achievement_type': 'education',
            'criteria': {
                'module_code': 'risk-management',
                'completed': True
            },
            'reward_points': 250,
            'badge_icon': 'risk-management-badge.svg'
        },
        {
            'achievement_code': 'quiz_master',
            'title': 'Quiz Master',
            'description': 'Score 90% or higher on any quiz',
            'achievement_type': 'education',
            'criteria': {
                'quiz_score_min': 90
            },
            'reward_points': 150,
            'badge_icon': 'quiz-master-badge.svg'
        },
        {
            'achievement_code': 'perfect_score',
            'title': 'Perfect Score',
            'description': 'Score 100% on any quiz',
            'achievement_type': 'education',
            'criteria': {
                'quiz_score_exact': 100
            },
            'reward_points': 300,
            'badge_icon': 'perfect-score-badge.svg'
        },
        {
            'achievement_code': 'first_practice',
            'title': 'Practice Makes Perfect',
            'description': 'Complete your first practice trading session',
            'achievement_type': 'practice',
            'criteria': {
                'practice_sessions_completed': 1
            },
            'reward_points': 150,
            'badge_icon': 'first-practice-badge.svg'
        },
        {
            'achievement_code': 'profitable_trader',
            'title': 'Profitable Trader',
            'description': 'Achieve positive PnL in a practice trading session',
            'achievement_type': 'performance',
            'criteria': {
                'min_pnl_percentage': 0.1
            },
            'reward_points': 200,
            'badge_icon': 'profitable-trader-badge.svg'
        },
        {
            'achievement_code': 'high_performer',
            'title': 'High Performer',
            'description': 'Achieve 5% or higher profit in a practice session',
            'achievement_type': 'performance',
            'criteria': {
                'min_pnl_percentage': 5.0
            },
            'reward_points': 400,
            'badge_icon': 'high-performer-badge.svg'
        },
        {
            'achievement_code': 'dedicated_learner',
            'title': 'Dedicated Learner',
            'description': 'Spend 10+ hours in educational content',
            'achievement_type': 'milestone',
            'criteria': {
                'min_learning_hours': 10
            },
            'reward_points': 300,
            'badge_icon': 'dedicated-learner-badge.svg'
        },
        {
            'achievement_code': 'practice_expert',
            'title': 'Practice Expert',
            'description': 'Complete 10 practice trading sessions',
            'achievement_type': 'milestone',
            'criteria': {
                'practice_sessions_completed': 10
            },
            'reward_points': 500,
            'badge_icon': 'practice-expert-badge.svg'
        },
        {
            'achievement_code': 'ready_for_live',
            'title': 'Ready for Live Trading',
            'description': 'Meet all requirements for live trading certification',
            'achievement_type': 'milestone',
            'criteria': {
                'required_modules': ['grid-basics', 'risk-management', 'market-conditions'],
                'min_practice_sessions': 3,
                'min_practice_hours': 24
            },
            'reward_points': 1000,
            'badge_icon': 'live-trading-ready-badge.svg'
        },
        {
            'achievement_code': 'all_modules_complete',
            'title': 'Education Complete',
            'description': 'Complete all educational modules',
            'achievement_type': 'milestone',
            'criteria': {
                'all_modules_completed': True
            },
            'reward_points': 750,
            'badge_icon': 'education-complete-badge.svg'
        }
    ]
    
    achievements = []
    for achievement_data in achievements_data:
        # Check if achievement already exists
        existing = db.query(Achievement).filter(
            Achievement.achievement_code == achievement_data['achievement_code']
        ).first()
        
        if not existing:
            achievement = Achievement(**achievement_data)
            db.add(achievement)
            achievements.append(achievement)
            logger.info(f"Created achievement: {achievement_data['achievement_code']}")
        else:
            achievements.append(existing)
            logger.info(f"Achievement already exists: {achievement_data['achievement_code']}")
    
    db.commit()
    return achievements


def seed_database():
    """Seed the database with initial educational content."""
    logger.info("Starting database seeding process...")
    
    try:
        # Ensure tables exist
        create_tables()
        
        # Get database session
        db = get_db_session()
        
        try:
            # Create educational modules
            logger.info("Creating educational modules...")
            modules = create_educational_modules(db)
            logger.info(f"Created {len(modules)} educational modules")
            
            # Create quiz questions
            logger.info("Creating quiz questions...")
            questions = create_quiz_questions(db, modules)
            logger.info(f"Created {len(questions)} quiz questions")
            
            # Create achievements
            logger.info("Creating achievements...")
            achievements = create_achievements(db)
            logger.info(f"Created {len(achievements)} achievements")
            
            logger.info("Database seeding completed successfully!")
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        raise


if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    seed_database()
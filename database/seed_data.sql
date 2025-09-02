-- Seed data for Off the Grid trading platform development
-- This file populates the database with initial data for testing and development

BEGIN;

-- Insert educational modules
INSERT INTO educational_modules (id, module_code, title, description, difficulty_level, estimated_duration_minutes, prerequisites, learning_objectives, content_metadata, passing_score, sort_order) VALUES

-- Beginner Level Modules
(uuid_generate_v4(), 'GRID_BASICS_01', 'Introduction to Grid Trading', 'Learn the fundamental concepts of grid trading strategy and how it works in cryptocurrency markets.', 'beginner', 45, '[]', 
'["Understand what grid trading is", "Learn about price ranges and grid levels", "Identify suitable market conditions for grid trading"]', 
'{"sections": ["What is Grid Trading", "Grid Strategy Components", "Market Analysis"], "videos": 3, "exercises": 5}', 70, 1),

(uuid_generate_v4(), 'RISK_MGMT_01', 'Risk Management Fundamentals', 'Essential risk management principles for cryptocurrency trading and grid strategies.', 'beginner', 35, '["GRID_BASICS_01"]', 
'["Understand position sizing", "Learn about stop losses", "Calculate risk/reward ratios"]', 
'{"sections": ["Position Sizing", "Stop Loss Strategies", "Risk Assessment"], "videos": 2, "exercises": 4}', 75, 2),

(uuid_generate_v4(), 'ERGO_INTRO_01', 'Introduction to Ergo Blockchain', 'Learn about the Ergo blockchain ecosystem and how it enables decentralized grid trading.', 'beginner', 40, '[]', 
'["Understand Ergo blockchain basics", "Learn about UTXO model", "Explore Ergo DeFi ecosystem"]', 
'{"sections": ["Ergo Overview", "UTXO Model", "Smart Contracts"], "videos": 4, "exercises": 3}', 70, 3),

-- Intermediate Level Modules
(uuid_generate_v4(), 'GRID_ADVANCED_01', 'Advanced Grid Strategies', 'Explore sophisticated grid trading techniques and optimization methods.', 'intermediate', 60, '["GRID_BASICS_01", "RISK_MGMT_01"]', 
'["Master dynamic grid adjustment", "Learn market volatility analysis", "Optimize grid parameters"]', 
'{"sections": ["Dynamic Grids", "Volatility Analysis", "Parameter Optimization"], "videos": 5, "exercises": 7}', 80, 4),

(uuid_generate_v4(), 'SPECTRUM_DEX_01', 'Spectrum DEX Integration', 'Understanding how to integrate with Spectrum DEX for liquidity and arbitrage opportunities.', 'intermediate', 50, '["ERGO_INTRO_01"]', 
'["Understand AMM mechanics", "Learn about liquidity pools", "Execute arbitrage strategies"]', 
'{"sections": ["AMM Basics", "Liquidity Provision", "Arbitrage Opportunities"], "videos": 4, "exercises": 6}', 75, 5),

(uuid_generate_v4(), 'PORTFOLIO_MGMT_01', 'Portfolio Management', 'Learn to manage multiple grid strategies and balance your trading portfolio.', 'intermediate', 55, '["GRID_ADVANCED_01", "RISK_MGMT_01"]', 
'["Diversify grid strategies", "Balance risk across positions", "Monitor portfolio performance"]', 
'{"sections": ["Diversification", "Risk Balancing", "Performance Tracking"], "videos": 3, "exercises": 5}', 80, 6),

-- Advanced Level Modules
(uuid_generate_v4(), 'SMART_CONTRACTS_01', 'Grid Smart Contracts', 'Deep dive into the smart contracts powering decentralized grid trading on Ergo.', 'advanced', 75, '["ERGO_INTRO_01", "GRID_ADVANCED_01"]', 
'["Understand ErgoScript basics", "Analyze grid contract logic", "Security considerations"]', 
'{"sections": ["ErgoScript Introduction", "Contract Analysis", "Security Audits"], "videos": 6, "exercises": 8}', 85, 7),

(uuid_generate_v4(), 'MARKET_MAKING_01', 'Market Making Strategies', 'Advanced market making techniques using grid trading principles.', 'advanced', 80, '["SPECTRUM_DEX_01", "PORTFOLIO_MGMT_01"]', 
'["Understand market making", "Implement spread strategies", "Manage inventory risk"]', 
'{"sections": ["Market Making Basics", "Spread Management", "Inventory Control"], "videos": 5, "exercises": 9}', 85, 8);

-- Insert sample quiz questions for the first module
INSERT INTO quiz_questions (id, module_id, question_text, question_type, options, correct_answers, explanation, difficulty, points) VALUES

-- Questions for GRID_BASICS_01
(uuid_generate_v4(), 
 (SELECT id FROM educational_modules WHERE module_code = 'GRID_BASICS_01' LIMIT 1),
 'What is the primary goal of grid trading?',
 'multiple_choice',
 '["Profit from large price movements", "Profit from price oscillations within a range", "Minimize trading fees", "Maximize holding time"]',
 '[1]',
 'Grid trading aims to profit from price oscillations within a defined range by placing buy and sell orders at regular intervals.',
 2, 2),

(uuid_generate_v4(),
 (SELECT id FROM educational_modules WHERE module_code = 'GRID_BASICS_01' LIMIT 1),
 'Grid trading works best in which market condition?',
 'multiple_choice',
 '["Strong uptrend", "Strong downtrend", "Sideways/ranging market", "Highly volatile market"]',
 '[2]',
 'Grid trading is most effective in sideways or ranging markets where prices oscillate within predictable boundaries.',
 2, 2),

(uuid_generate_v4(),
 (SELECT id FROM educational_modules WHERE module_code = 'GRID_BASICS_01' LIMIT 1),
 'True or False: Grid trading requires constant manual intervention.',
 'true_false',
 '["True", "False"]',
 '[1]',
 'False. Grid trading is an automated strategy that executes trades based on predetermined price levels.',
 1, 1),

-- Questions for RISK_MGMT_01
(uuid_generate_v4(),
 (SELECT id FROM educational_modules WHERE module_code = 'RISK_MGMT_01' LIMIT 1),
 'What percentage of your portfolio should you typically risk on a single grid trading position?',
 'multiple_choice',
 '["50-70%", "20-30%", "5-10%", "1-2%"]',
 '[2]',
 'Generally, you should not risk more than 5-10% of your portfolio on any single trading position to maintain proper risk management.',
 3, 3),

(uuid_generate_v4(),
 (SELECT id FROM educational_modules WHERE module_code = 'RISK_MGMT_01' LIMIT 1),
 'What is the main purpose of a stop loss in grid trading?',
 'multiple_choice',
 '["Increase profits", "Limit potential losses", "Speed up trades", "Reduce fees"]',
 '[1]',
 'A stop loss is designed to limit potential losses by automatically closing positions when the market moves against you beyond a predetermined level.',
 2, 2);

-- Insert sample achievements
INSERT INTO achievements (id, achievement_code, title, description, achievement_type, criteria, reward_points, badge_icon) VALUES

(uuid_generate_v4(), 'FIRST_MODULE', 'First Steps', 'Complete your first educational module', 'education', 
'{"type": "module_completion", "count": 1}', 100, 'badge_first_steps.svg'),

(uuid_generate_v4(), 'QUIZ_MASTER', 'Quiz Master', 'Score 90% or higher on any module quiz', 'education', 
'{"type": "quiz_score", "min_score": 90}', 150, 'badge_quiz_master.svg'),

(uuid_generate_v4(), 'FIRST_PRACTICE', 'Practice Makes Perfect', 'Complete your first practice trading session', 'practice', 
'{"type": "practice_completion", "count": 1}', 200, 'badge_practice.svg'),

(uuid_generate_v4(), 'PROFIT_MAKER', 'Profit Maker', 'Achieve positive P&L in a practice session', 'performance', 
'{"type": "practice_pnl", "min_percentage": 0}', 250, 'badge_profit.svg'),

(uuid_generate_v4(), 'GRID_NOVICE', 'Grid Trading Novice', 'Complete all beginner level modules', 'milestone', 
'{"type": "difficulty_completion", "difficulty": "beginner"}', 500, 'badge_novice.svg'),

(uuid_generate_v4(), 'RISK_AWARE', 'Risk Aware Trader', 'Complete risk management module with 85% or higher', 'education', 
'{"type": "specific_module_score", "module_code": "RISK_MGMT_01", "min_score": 85}', 300, 'badge_risk_aware.svg'),

(uuid_generate_v4(), 'EARLY_ADOPTER', 'Early Adopter', 'Join the platform in its early stages', 'special', 
'{"type": "registration_date", "before": "2025-12-31"}', 1000, 'badge_early_adopter.svg'),

(uuid_generate_v4(), 'GRID_EXPERT', 'Grid Trading Expert', 'Complete all educational modules and achieve certification', 'milestone', 
'{"type": "full_certification", "required": true}', 1500, 'badge_expert.svg');

-- Insert sample test users (using realistic Ergo wallet addresses format)
INSERT INTO users (id, wallet_address, username, email, profile_data, trading_experience_level, created_at) VALUES

(uuid_generate_v4(), '9f7H8P9kNqF5j8mRt2wB7YvF8nKpD2qE3xA1bV6cL9gM4sN7rP', 'alice_trader', 'alice@example.com',
'{"bio": "New to crypto trading", "preferred_language": "en", "timezone": "UTC"}', 'beginner', NOW() - INTERVAL '7 days'),

(uuid_generate_v4(), '8mK4L7jN2pQ6h9fG8rE5tW3yB1nV9xD4cA7sM6qR2lP8nF5kJ', 'bob_crypto', 'bob@example.com',
'{"bio": "Experienced DeFi user", "preferred_language": "en", "timezone": "America/New_York"}', 'intermediate', NOW() - INTERVAL '14 days'),

(uuid_generate_v4(), '7lR8nM6kF2pN4jQ9hG5xB3wT1yV8cD7sA4mP6qE9rL2fN8kJ5', 'carol_grid', 'carol@example.com',
'{"bio": "Grid trading enthusiast", "preferred_language": "en", "timezone": "Europe/London"}', 'advanced', NOW() - INTERVAL '30 days'),

(uuid_generate_v4(), '6kQ7mL5jF9pN2hG8xB4wT3yV1cD6sA7rP9qE5lN8fM4kJ2pR', 'dave_degen', 'dave@example.com',
'{"bio": "High-risk trader", "preferred_language": "en", "timezone": "Asia/Tokyo"}', 'expert', NOW() - INTERVAL '45 days');

-- Insert sample educational progress for test users
INSERT INTO educational_progress (id, user_id, module_id, completion_status, progress_percentage, time_spent_minutes, best_score, completion_date, attempts_count) VALUES

-- Alice's progress (beginner)
(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'alice_trader' LIMIT 1),
 (SELECT id FROM educational_modules WHERE module_code = 'GRID_BASICS_01' LIMIT 1),
 'completed', 100, 50, 85, NOW() - INTERVAL '5 days', 2),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'alice_trader' LIMIT 1),
 (SELECT id FROM educational_modules WHERE module_code = 'RISK_MGMT_01' LIMIT 1),
 'in_progress', 60, 25, NULL, NULL, 1),

-- Bob's progress (intermediate)
(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'bob_crypto' LIMIT 1),
 (SELECT id FROM educational_modules WHERE module_code = 'GRID_BASICS_01' LIMIT 1),
 'completed', 100, 42, 92, NOW() - INTERVAL '12 days', 1),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'bob_crypto' LIMIT 1),
 (SELECT id FROM educational_modules WHERE module_code = 'RISK_MGMT_01' LIMIT 1),
 'completed', 100, 38, 88, NOW() - INTERVAL '10 days', 1),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'bob_crypto' LIMIT 1),
 (SELECT id FROM educational_modules WHERE module_code = 'ERGO_INTRO_01' LIMIT 1),
 'completed', 100, 45, 78, NOW() - INTERVAL '8 days', 2),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'bob_crypto' LIMIT 1),
 (SELECT id FROM educational_modules WHERE module_code = 'GRID_ADVANCED_01' LIMIT 1),
 'in_progress', 40, 30, NULL, NULL, 0);

-- Insert sample quiz attempts
INSERT INTO quiz_attempts (id, user_id, module_id, attempt_number, questions_answers, score, max_score, time_taken_minutes, completed, passed, attempt_date) VALUES

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'alice_trader' LIMIT 1),
 (SELECT id FROM educational_modules WHERE module_code = 'GRID_BASICS_01' LIMIT 1),
 1,
 '[{"question_id": "q1", "answer": [0], "correct": false}, {"question_id": "q2", "answer": [2], "correct": true}]',
 65, 100, 15, true, false, NOW() - INTERVAL '6 days'),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'alice_trader' LIMIT 1),
 (SELECT id FROM educational_modules WHERE module_code = 'GRID_BASICS_01' LIMIT 1),
 2,
 '[{"question_id": "q1", "answer": [1], "correct": true}, {"question_id": "q2", "answer": [2], "correct": true}]',
 85, 100, 12, true, true, NOW() - INTERVAL '5 days'),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'bob_crypto' LIMIT 1),
 (SELECT id FROM educational_modules WHERE module_code = 'GRID_BASICS_01' LIMIT 1),
 1,
 '[{"question_id": "q1", "answer": [1], "correct": true}, {"question_id": "q2", "answer": [2], "correct": true}]',
 92, 100, 10, true, true, NOW() - INTERVAL '12 days');

-- Insert sample practice trades
INSERT INTO practice_trades (id, user_id, session_name, trade_config, simulation_parameters, simulation_results, 
base_token, quote_token, initial_balance_base, initial_balance_quote, final_balance_base, final_balance_quote, 
total_pnl_percentage, trades_executed, duration_minutes, market_conditions, performance_rating, lessons_learned, completed, completed_at) VALUES

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'alice_trader' LIMIT 1),
 'My First Grid',
 '{"grid_type": "arithmetic", "upper_price": 1.2, "lower_price": 0.8, "grid_count": 10, "investment_amount": 1000}',
 '{"market_scenario": "sideways", "volatility": "medium", "duration_hours": 24}',
 '{"total_trades": 15, "profitable_trades": 9, "max_drawdown": -5.2, "sharpe_ratio": 1.23}',
 'ERG', 'SigUSD', 500.00000000, 500.00000000, 485.50000000, 528.30000000,
 2.76, 15, 1440, 'sideways', 'good', 
 '["Price action was more volatile than expected", "Grid spacing could be optimized", "Overall profitable experience"]',
 true, NOW() - INTERVAL '4 days'),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'bob_crypto' LIMIT 1),
 'Advanced Grid Strategy',
 '{"grid_type": "geometric", "upper_price": 2.0, "lower_price": 0.5, "grid_count": 20, "investment_amount": 2000}',
 '{"market_scenario": "trending_up", "volatility": "high", "duration_hours": 48}',
 '{"total_trades": 32, "profitable_trades": 22, "max_drawdown": -8.7, "sharpe_ratio": 1.85}',
 'ERG', 'SigUSD', 1000.00000000, 1000.00000000, 1050.20000000, 1125.80000000,
 8.80, 32, 2880, 'trending_up', 'excellent',
 '["Geometric grids work well in trending markets", "Higher volatility increased profit opportunities", "Risk management was crucial"]',
 true, NOW() - INTERVAL '9 days');

-- Insert sample user achievements
INSERT INTO user_achievements (id, user_id, achievement_id, earned_at, metadata) VALUES

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'alice_trader' LIMIT 1),
 (SELECT id FROM achievements WHERE achievement_code = 'FIRST_MODULE' LIMIT 1),
 NOW() - INTERVAL '5 days',
 '{"module_code": "GRID_BASICS_01", "score": 85}'),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'alice_trader' LIMIT 1),
 (SELECT id FROM achievements WHERE achievement_code = 'FIRST_PRACTICE' LIMIT 1),
 NOW() - INTERVAL '4 days',
 '{"session_name": "My First Grid", "pnl_percentage": 2.76}'),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'alice_trader' LIMIT 1),
 (SELECT id FROM achievements WHERE achievement_code = 'PROFIT_MAKER' LIMIT 1),
 NOW() - INTERVAL '4 days',
 '{"session_name": "My First Grid", "pnl_percentage": 2.76}'),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'bob_crypto' LIMIT 1),
 (SELECT id FROM achievements WHERE achievement_code = 'FIRST_MODULE' LIMIT 1),
 NOW() - INTERVAL '12 days',
 '{"module_code": "GRID_BASICS_01", "score": 92}'),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'bob_crypto' LIMIT 1),
 (SELECT id FROM achievements WHERE achievement_code = 'QUIZ_MASTER' LIMIT 1),
 NOW() - INTERVAL '12 days',
 '{"module_code": "GRID_BASICS_01", "score": 92}'),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'bob_crypto' LIMIT 1),
 (SELECT id FROM achievements WHERE achievement_code = 'RISK_AWARE' LIMIT 1),
 NOW() - INTERVAL '10 days',
 '{"module_code": "RISK_MGMT_01", "score": 88}');

-- Insert sample token information
INSERT INTO token_info (id, token_id, token_name, token_symbol, decimals, description, logo_url, is_verified, current_price_usd, last_updated) VALUES

(uuid_generate_v4(), 
 '0000000000000000000000000000000000000000000000000000000000000000', 
 'Ergo', 'ERG', 9, 'Native token of the Ergo blockchain platform', 
 'https://ergoplatform.org/images/ergo-logo.png', true, 1.25, NOW()),

(uuid_generate_v4(), 
 '03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04', 
 'SigmaUSD', 'SigUSD', 2, 'Algorithmic stablecoin on Ergo blockchain', 
 'https://sigmausd.io/logo.png', true, 1.00, NOW()),

(uuid_generate_v4(), 
 '1fd6e032e8476c4aa54c18c1a308dce83940e8f4a28f576440513ed7326ad489', 
 'Spectrum Finance Token', 'SPF', 4, 'Governance token for Spectrum Finance DEX', 
 'https://spectrum.fi/logo.png', true, 0.15, NOW()),

(uuid_generate_v4(), 
 'e7021bda9872a7eb2aa69dd704e6a997dae9d1200c1102d10b07dd71d9fa6e48', 
 'Ergo DEX Token', 'ErgoDEX', 8, 'Token for ErgoDEX decentralized exchange', 
 'https://ergodex.io/logo.png', false, 0.08, NOW());

-- Insert sample user activities
INSERT INTO user_activities (id, user_id, activity_type, activity_description, resource_type, metadata) VALUES

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'alice_trader' LIMIT 1),
 'login', 'User logged in to platform', NULL,
 '{"ip_address": "192.168.1.100", "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}'),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'alice_trader' LIMIT 1),
 'module_start', 'Started educational module', 'module',
 '{"module_code": "GRID_BASICS_01", "progress_percentage": 0}'),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'alice_trader' LIMIT 1),
 'quiz_attempt', 'Attempted module quiz', 'quiz',
 '{"module_code": "GRID_BASICS_01", "attempt_number": 1, "score": 65}'),

(uuid_generate_v4(),
 (SELECT id FROM users WHERE username = 'bob_crypto' LIMIT 1),
 'practice_complete', 'Completed practice trading session', 'practice_trade',
 '{"session_name": "Advanced Grid Strategy", "pnl_percentage": 8.80, "duration_minutes": 2880}');

-- Update user certification status for advanced users
UPDATE users 
SET is_certified = true, certification_date = NOW() - INTERVAL '25 days' 
WHERE username = 'carol_grid';

UPDATE users 
SET is_certified = true, certification_date = NOW() - INTERVAL '35 days' 
WHERE username = 'dave_degen';

COMMIT;

-- Display summary of inserted data
SELECT 'SEED DATA SUMMARY' as info;
SELECT 'Educational Modules' as category, COUNT(*) as count FROM educational_modules;
SELECT 'Quiz Questions' as category, COUNT(*) as count FROM quiz_questions;
SELECT 'Achievements' as category, COUNT(*) as count FROM achievements;
SELECT 'Test Users' as category, COUNT(*) as count FROM users;
SELECT 'Educational Progress' as category, COUNT(*) as count FROM educational_progress;
SELECT 'Quiz Attempts' as category, COUNT(*) as count FROM quiz_attempts;
SELECT 'Practice Trades' as category, COUNT(*) as count FROM practice_trades;
SELECT 'User Achievements' as category, COUNT(*) as count FROM user_achievements;
SELECT 'Token Info' as category, COUNT(*) as count FROM token_info;
SELECT 'User Activities' as category, COUNT(*) as count FROM user_activities;
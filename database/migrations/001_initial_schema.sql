-- Migration: 001_initial_schema.sql
-- Description: Create initial database schema for Off the Grid trading platform
-- Created: 2025-09-01
-- Author: System

-- This migration creates the complete initial schema
-- Run this migration with: psql -d off_the_grid -f 001_initial_schema.sql

BEGIN;

-- Check if migration has already been applied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
        IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '001') THEN
            RAISE EXCEPTION 'Migration 001 has already been applied';
        END IF;
    END IF;
END;
$$;

-- Create migrations tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(10) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT
);

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set timezone
SET timezone = 'UTC';

-- Create all tables as defined in schema.sql
-- (Including the complete schema here for migration purposes)

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(52) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(255) UNIQUE,
    profile_data JSONB DEFAULT '{}',
    trading_experience_level VARCHAR(20) DEFAULT 'beginner' CHECK (trading_experience_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    is_certified BOOLEAN DEFAULT FALSE,
    certification_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT valid_wallet_address CHECK (LENGTH(wallet_address) >= 50)
);

-- Educational modules
CREATE TABLE educational_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty_level VARCHAR(20) DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    estimated_duration_minutes INTEGER DEFAULT 30,
    prerequisites JSONB DEFAULT '[]',
    learning_objectives JSONB DEFAULT '[]',
    content_metadata JSONB DEFAULT '{}',
    passing_score INTEGER DEFAULT 70,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Educational progress
CREATE TABLE educational_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES educational_modules(id) ON DELETE CASCADE,
    completion_status VARCHAR(20) DEFAULT 'not_started' CHECK (completion_status IN ('not_started', 'in_progress', 'completed', 'failed')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    time_spent_minutes INTEGER DEFAULT 0,
    best_score INTEGER,
    completion_date TIMESTAMP WITH TIME ZONE,
    first_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    attempts_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    
    UNIQUE(user_id, module_id)
);

-- Quiz questions
CREATE TABLE quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES educational_modules(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'drag_drop', 'numeric')),
    options JSONB NOT NULL,
    correct_answers JSONB NOT NULL,
    explanation TEXT,
    difficulty INTEGER DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 5),
    points INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quiz attempts
CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES educational_modules(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    questions_answers JSONB NOT NULL,
    score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    time_taken_minutes INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    passed BOOLEAN DEFAULT FALSE,
    attempt_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, module_id, attempt_number)
);

-- Practice trades
CREATE TABLE practice_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(255),
    trade_config JSONB NOT NULL,
    simulation_parameters JSONB NOT NULL,
    simulation_results JSONB NOT NULL,
    base_token VARCHAR(10) NOT NULL,
    quote_token VARCHAR(10) NOT NULL,
    initial_balance_base DECIMAL(20, 8) NOT NULL,
    initial_balance_quote DECIMAL(20, 8) NOT NULL,
    final_balance_base DECIMAL(20, 8),
    final_balance_quote DECIMAL(20, 8),
    total_pnl_percentage DECIMAL(10, 4),
    trades_executed INTEGER DEFAULT 0,
    duration_minutes INTEGER,
    market_conditions VARCHAR(50),
    performance_rating VARCHAR(20),
    lessons_learned JSONB DEFAULT '[]',
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Achievements
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    achievement_code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    achievement_type VARCHAR(30) NOT NULL CHECK (achievement_type IN ('education', 'practice', 'performance', 'milestone', 'special')),
    criteria JSONB NOT NULL,
    reward_points INTEGER DEFAULT 0,
    badge_icon VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User achievements
CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    
    UNIQUE(user_id, achievement_id)
);

-- User sessions
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    refresh_expires_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User activities
CREATE TABLE user_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    activity_description TEXT,
    resource_type VARCHAR(50),
    resource_id UUID,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grid trading history
CREATE TABLE grid_trading_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grid_order_id VARCHAR(64) NOT NULL,
    base_token VARCHAR(10) NOT NULL,
    quote_token VARCHAR(10) NOT NULL,
    grid_config JSONB NOT NULL,
    initial_investment_erg DECIMAL(20, 8),
    initial_investment_usd DECIMAL(20, 2),
    current_value_erg DECIMAL(20, 8),
    current_value_usd DECIMAL(20, 2),
    realized_pnl_erg DECIMAL(20, 8) DEFAULT 0,
    unrealized_pnl_erg DECIMAL(20, 8) DEFAULT 0,
    total_fees_paid DECIMAL(20, 8) DEFAULT 0,
    trades_executed INTEGER DEFAULT 0,
    grid_status VARCHAR(20) DEFAULT 'active' CHECK (grid_status IN ('active', 'completed', 'cancelled', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Token info
CREATE TABLE token_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id VARCHAR(64) UNIQUE NOT NULL,
    token_name VARCHAR(100),
    token_symbol VARCHAR(10),
    decimals INTEGER DEFAULT 0,
    description TEXT,
    logo_url VARCHAR(500),
    website_url VARCHAR(500),
    is_verified BOOLEAN DEFAULT FALSE,
    market_cap_usd DECIMAL(20, 2),
    current_price_usd DECIMAL(20, 8),
    volume_24h_usd DECIMAL(20, 2),
    price_change_24h_percent DECIMAL(10, 4),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login_at);
CREATE INDEX idx_educational_progress_user_id ON educational_progress(user_id);
CREATE INDEX idx_educational_progress_module_id ON educational_progress(module_id);
CREATE INDEX idx_educational_progress_status ON educational_progress(completion_status);
CREATE INDEX idx_educational_progress_last_accessed ON educational_progress(last_accessed_at);
CREATE INDEX idx_quiz_attempts_user_module ON quiz_attempts(user_id, module_id);
CREATE INDEX idx_quiz_attempts_date ON quiz_attempts(attempt_date);
CREATE INDEX idx_practice_trades_user_id ON practice_trades(user_id);
CREATE INDEX idx_practice_trades_created_at ON practice_trades(created_at);
CREATE INDEX idx_practice_trades_performance ON practice_trades(performance_rating);
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_earned_at ON user_achievements(earned_at);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_type ON user_activities(activity_type);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at);
CREATE INDEX idx_grid_trading_user_id ON grid_trading_history(user_id);
CREATE INDEX idx_grid_trading_status ON grid_trading_history(grid_status);
CREATE INDEX idx_grid_trading_created_at ON grid_trading_history(created_at);
CREATE INDEX idx_token_info_symbol ON token_info(token_symbol);
CREATE INDEX idx_token_info_updated ON token_info(last_updated);

-- Create functions and triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_educational_modules_updated_at BEFORE UPDATE ON educational_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grid_trading_updated_at BEFORE UPDATE ON grid_trading_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION update_progress_last_accessed()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_educational_progress_last_accessed BEFORE UPDATE ON educational_progress
    FOR EACH ROW EXECUTE FUNCTION update_progress_last_accessed();

CREATE OR REPLACE FUNCTION update_session_last_accessed()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_accessed_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_sessions_last_accessed BEFORE UPDATE ON user_sessions
    FOR EACH ROW EXECUTE FUNCTION update_session_last_accessed();

-- Create views
CREATE VIEW user_progress_summary AS
SELECT 
    u.id as user_id,
    u.wallet_address,
    u.username,
    u.trading_experience_level,
    u.is_certified,
    COUNT(ep.id) as modules_enrolled,
    COUNT(CASE WHEN ep.completion_status = 'completed' THEN 1 END) as modules_completed,
    COUNT(pt.id) as practice_trades_count,
    COUNT(ua.id) as achievements_earned,
    AVG(CASE WHEN ep.completion_status = 'completed' THEN ep.best_score END) as avg_quiz_score,
    MAX(ep.last_accessed_at) as last_learning_activity
FROM users u
LEFT JOIN educational_progress ep ON u.id = ep.user_id
LEFT JOIN practice_trades pt ON u.id = pt.user_id AND pt.completed = true
LEFT JOIN user_achievements ua ON u.id = ua.user_id
GROUP BY u.id, u.wallet_address, u.username, u.trading_experience_level, u.is_certified;

CREATE VIEW active_users_today AS
SELECT DISTINCT u.*
FROM users u
JOIN user_activities ua ON u.id = ua.user_id
WHERE ua.created_at >= CURRENT_DATE
AND u.is_active = true;

-- Record migration
INSERT INTO schema_migrations (version, description) 
VALUES ('001', 'Initial database schema with all core tables for user progress tracking');

COMMIT;

-- Migration completed successfully
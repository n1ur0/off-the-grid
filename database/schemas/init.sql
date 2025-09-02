-- Off the Grid Database Schema
-- PostgreSQL schema for user progress tracking and educational system

-- Create database (run manually)
-- CREATE DATABASE offthegrid;
-- \c offthegrid;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table for wallet-based authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    
    -- User preferences
    preferences JSONB DEFAULT '{}',
    
    -- Index for fast wallet lookups
    CONSTRAINT users_wallet_address_check CHECK (length(wallet_address) >= 10)
);

CREATE INDEX idx_users_wallet_address ON users (wallet_address);
CREATE INDEX idx_users_created_at ON users (created_at);

-- Educational modules table
CREATE TABLE education_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_key VARCHAR(50) UNIQUE NOT NULL, -- 'grid-basics', 'risk-management', etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content JSONB NOT NULL, -- Module content and structure
    quiz_questions JSONB NOT NULL, -- Quiz questions and answers
    required_score INTEGER DEFAULT 80, -- Minimum score to pass (percentage)
    unlock_requirements TEXT[], -- Array of prerequisite module keys
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_education_modules_module_key ON education_modules (module_key);

-- User progress tracking for educational modules
CREATE TABLE user_module_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_key VARCHAR(50) NOT NULL REFERENCES education_modules(module_key),
    
    -- Progress tracking
    status VARCHAR(20) NOT NULL DEFAULT 'not_started', -- 'not_started', 'in_progress', 'completed', 'failed'
    progress_percentage INTEGER DEFAULT 0, -- 0-100
    
    -- Quiz tracking
    quiz_attempts INTEGER DEFAULT 0,
    best_score INTEGER DEFAULT 0,
    last_score INTEGER DEFAULT 0,
    quiz_answers JSONB, -- Last quiz answers for review
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, module_key),
    CONSTRAINT user_module_progress_status_check CHECK (status IN ('not_started', 'in_progress', 'completed', 'failed')),
    CONSTRAINT user_module_progress_progress_check CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    CONSTRAINT user_module_progress_score_check CHECK (best_score >= 0 AND best_score <= 100)
);

CREATE INDEX idx_user_module_progress_user_id ON user_module_progress (user_id);
CREATE INDEX idx_user_module_progress_module_key ON user_module_progress (module_key);
CREATE INDEX idx_user_module_progress_status ON user_module_progress (status);

-- Practice trading sessions
CREATE TABLE practice_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session data
    session_data JSONB NOT NULL, -- Simulated portfolio, trades, etc.
    initial_balance NUMERIC(20, 8) DEFAULT 1000000, -- Simulated ERG balance
    final_balance NUMERIC(20, 8),
    profit_loss NUMERIC(20, 8),
    
    -- Performance metrics
    trades_count INTEGER DEFAULT 0,
    successful_trades INTEGER DEFAULT 0,
    grid_orders_created INTEGER DEFAULT 0,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    
    CONSTRAINT practice_sessions_balance_check CHECK (initial_balance > 0)
);

CREATE INDEX idx_practice_sessions_user_id ON practice_sessions (user_id);
CREATE INDEX idx_practice_sessions_started_at ON practice_sessions (started_at);

-- User achievements and milestones
CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Achievement details
    achievement_type VARCHAR(50) NOT NULL, -- 'education_complete', 'first_trade', 'profitable_week', etc.
    achievement_data JSONB, -- Additional achievement-specific data
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, achievement_type)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements (user_id);
CREATE INDEX idx_user_achievements_type ON user_achievements (achievement_type);

-- Trading history and grid tracking
CREATE TABLE user_grids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Grid identification
    grid_identity VARCHAR(255) NOT NULL,
    token_id VARCHAR(255) NOT NULL,
    
    -- Grid configuration
    initial_value NUMERIC(20, 8) NOT NULL,
    order_count INTEGER NOT NULL,
    price_range_min NUMERIC(20, 8),
    price_range_max NUMERIC(20, 8),
    
    -- Current status
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'completed', 'cancelled'
    current_value NUMERIC(20, 8),
    profit_erg NUMERIC(20, 8) DEFAULT 0,
    profit_percentage NUMERIC(10, 4) DEFAULT 0,
    
    -- Order tracking
    buy_orders INTEGER DEFAULT 0,
    sell_orders INTEGER DEFAULT 0,
    filled_orders INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT user_grids_status_check CHECK (status IN ('active', 'completed', 'cancelled'))
);

CREATE INDEX idx_user_grids_user_id ON user_grids (user_id);
CREATE INDEX idx_user_grids_grid_identity ON user_grids (grid_identity);
CREATE INDEX idx_user_grids_status ON user_grids (status);
CREATE INDEX idx_user_grids_token_id ON user_grids (token_id);

-- Session management table (for JWT token blacklisting)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session details
    session_token_hash VARCHAR(255) UNIQUE NOT NULL, -- Hashed JWT token
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Session metadata
    user_agent TEXT,
    ip_address INET,
    is_revoked BOOLEAN DEFAULT false
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions (session_token_hash);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_education_modules_updated_at BEFORE UPDATE ON education_modules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_grids_updated_at BEFORE UPDATE ON user_grids 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default educational modules
INSERT INTO education_modules (module_key, title, description, content, quiz_questions, required_score) VALUES 
(
    'grid-basics',
    'Grid Trading Fundamentals',
    'Learn how grid trading works with buy-low, sell-high automation',
    '{
        "sections": [
            {
                "type": "text",
                "title": "What is Grid Trading?",
                "content": "Grid trading is an automated trading strategy that places buy and sell orders at predetermined intervals above and below a set price..."
            },
            {
                "type": "interactive",
                "title": "Price Range Visualization",
                "component": "GridVisualization",
                "props": {"interactive": true, "showProfits": true}
            }
        ]
    }',
    '{
        "questions": [
            {
                "question": "What happens when price moves above your grid range?",
                "options": ["Profits are locked", "All orders become sells", "Grid stops working"],
                "correct": 0,
                "explanation": "When price exceeds the range, you have sold all tokens at the top prices, locking in maximum profit."
            },
            {
                "question": "Grid trading works best in which market conditions?",
                "options": ["Strong trending markets", "Sideways/ranging markets", "Highly volatile crashes"],
                "correct": 1,
                "explanation": "Grid trading profits from price oscillations within a range, making sideways markets ideal."
            }
        ]
    }',
    80
),
(
    'risk-management',
    'Risk Management Strategies',
    'Understanding risks and how to manage them in grid trading',
    '{
        "sections": [
            {
                "type": "text",
                "title": "Understanding Grid Trading Risks",
                "content": "While grid trading can be profitable, it carries specific risks that must be understood and managed..."
            }
        ]
    }',
    '{
        "questions": [
            {
                "question": "What is the main risk when price trends strongly in one direction?",
                "options": ["Losing money on fees", "Holding too much of a depreciating asset", "Missing profit opportunities"],
                "correct": 1,
                "explanation": "In strong downtrends, you may accumulate more of a depreciating token, leading to losses."
            }
        ]
    }',
    80
),
(
    'market-conditions',
    'Optimal Market Conditions',
    'Learn when to use grid trading and when to avoid it',
    '{
        "sections": [
            {
                "type": "text",
                "title": "Identifying Suitable Markets",
                "content": "Grid trading performance depends heavily on market conditions. Learn to identify the best opportunities..."
            }
        ]
    }',
    '{
        "questions": [
            {
                "question": "Which volatility level is typically best for grid trading?",
                "options": ["Very low volatility", "Moderate volatility", "Extremely high volatility"],
                "correct": 1,
                "explanation": "Moderate volatility provides enough price movement for profitable trades without excessive risk."
            }
        ]
    }',
    80
);

-- Create views for common queries
CREATE VIEW user_education_summary AS
SELECT 
    u.id as user_id,
    u.wallet_address,
    COUNT(ump.id) as modules_started,
    COUNT(CASE WHEN ump.status = 'completed' THEN 1 END) as modules_completed,
    AVG(CASE WHEN ump.status = 'completed' THEN ump.best_score END) as average_score,
    BOOL_AND(CASE WHEN em.module_key IN ('grid-basics', 'risk-management', 'market-conditions') 
                  THEN ump.status = 'completed' ELSE true END) as ready_for_trading
FROM users u
LEFT JOIN user_module_progress ump ON u.id = ump.user_id
LEFT JOIN education_modules em ON ump.module_key = em.module_key
GROUP BY u.id, u.wallet_address;

CREATE VIEW user_trading_summary AS
SELECT 
    u.id as user_id,
    u.wallet_address,
    COUNT(ug.id) as total_grids,
    COUNT(CASE WHEN ug.status = 'active' THEN 1 END) as active_grids,
    COUNT(CASE WHEN ug.status = 'completed' THEN 1 END) as completed_grids,
    COALESCE(SUM(ug.profit_erg), 0) as total_profit_erg,
    COALESCE(AVG(CASE WHEN ug.status = 'completed' THEN ug.profit_percentage END), 0) as avg_profit_percentage
FROM users u
LEFT JOIN user_grids ug ON u.id = ug.user_id
GROUP BY u.id, u.wallet_address;

-- Grant appropriate permissions (adjust for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO offthegrid_api;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO offthegrid_api;
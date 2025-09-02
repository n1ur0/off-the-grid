# Off the Grid Progress Tracking API Documentation

This document provides comprehensive documentation for the user progress tracking system implemented in the Off the Grid educational trading platform.

## Overview

The progress tracking API provides comprehensive user progress monitoring, competency validation, and readiness assessment for live trading. It implements:

- **Module Progress Tracking**: Track user completion of educational modules
- **Quiz Assessment**: Record quiz attempts and scores 
- **Practice Trading**: Log practice trading sessions and performance
- **Achievement System**: Award badges and track milestones
- **Competency Validation**: Assess readiness for live trading
- **Analytics**: Provide detailed progress analytics and insights

## Base URL

All endpoints are prefixed with `/api/v1/progress`

## Authentication

All endpoints require valid authentication. Include the user's JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Data Models

### CompletionStatus Enum
```
- NOT_STARTED: "not_started"
- IN_PROGRESS: "in_progress" 
- COMPLETED: "completed"
- FAILED: "failed"
```

### AchievementType Enum
```
- EDUCATION: "education"
- PRACTICE: "practice"
- PERFORMANCE: "performance"
- MILESTONE: "milestone"
- SPECIAL: "special"
```

### DifficultyLevel Enum
```
- BEGINNER: "beginner"
- INTERMEDIATE: "intermediate"
- ADVANCED: "advanced"
```

## API Endpoints

### 1. Get Comprehensive User Progress

**GET** `/api/v1/progress/{user_id}`

Get detailed user progress including modules, quizzes, practice trades, and achievements.

#### Parameters
- `user_id` (path): User UUID (required)
- `include_practice_sessions` (query): Include practice sessions (default: true)
- `limit_recent_attempts` (query): Limit recent quiz attempts (default: 10, max: 50)

#### Response
```json
{
  "summary": {
    "user_id": "uuid",
    "completed_modules": ["grid-basics", "risk-management"],
    "in_progress_modules": ["market-conditions"],
    "total_time_spent_minutes": 180,
    "average_quiz_score": 85.5,
    "practice_trades_count": 3,
    "practice_time_spent_minutes": 720,
    "achievements_earned": 5,
    "certification_progress": 60.0,
    "is_ready_for_live_trading": false,
    "next_recommended_module": "market-conditions"
  },
  "module_progress": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "module_id": "uuid",
      "module_code": "grid-basics",
      "module_title": "Grid Trading Fundamentals",
      "completion_status": "completed",
      "progress_percentage": 100,
      "time_spent_minutes": 45,
      "best_score": 88,
      "completion_date": "2024-01-15T10:30:00Z",
      "first_started_at": "2024-01-15T09:00:00Z",
      "last_accessed_at": "2024-01-15T10:30:00Z",
      "attempts_count": 2,
      "metadata": {}
    }
  ],
  "recent_quiz_attempts": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "module_id": "uuid",
      "attempt_number": 2,
      "score": 8,
      "max_score": 10,
      "percentage_score": 80.0,
      "time_taken_minutes": 15,
      "completed": true,
      "passed": true,
      "attempt_date": "2024-01-15T10:15:00Z",
      "feedback": {}
    }
  ],
  "practice_sessions": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "session_name": "First Grid Practice",
      "base_token": "ERG",
      "quote_token": "SigUSD",
      "initial_balance_base": 100.0,
      "initial_balance_quote": 500.0,
      "final_balance_base": 95.0,
      "final_balance_quote": 520.0,
      "total_pnl_percentage": 2.5,
      "trades_executed": 12,
      "duration_minutes": 240,
      "market_conditions": "sideways",
      "performance_rating": "good",
      "lessons_learned": ["Grid spacing was appropriate", "Should monitor volatility more"],
      "completed": true,
      "created_at": "2024-01-14T14:00:00Z",
      "completed_at": "2024-01-14T18:00:00Z"
    }
  ],
  "achievements": [
    {
      "id": "uuid",
      "achievement_code": "first_module_complete",
      "title": "First Steps",
      "description": "Complete your first educational module",
      "achievement_type": "education",
      "reward_points": 100,
      "badge_icon": "first-steps-badge.svg",
      "earned_at": "2024-01-15T10:30:00Z",
      "criteria": {"modules_completed": 1}
    }
  ],
  "competency_validation": {
    "is_ready": false,
    "last_checked": "2024-01-15T12:00:00Z"
  }
}
```

#### Status Codes
- `200`: Success
- `404`: User not found
- `422`: Invalid user ID format
- `500`: Internal server error

---

### 2. Update Module Progress

**POST** `/api/v1/progress/module`

Update user progress on an educational module.

#### Request Body
```json
{
  "user_id": "uuid",
  "module_id": "uuid", 
  "time_spent_minutes": 30,
  "progress_percentage": 75,
  "completion_status": "in_progress",
  "metadata": {
    "section_completed": "risk_factors",
    "interactive_elements_used": ["risk_calculator"]
  }
}
```

#### Response
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "module_id": "uuid",
  "module_code": "risk-management",
  "module_title": "Risk Management in Grid Trading",
  "completion_status": "in_progress",
  "progress_percentage": 75,
  "time_spent_minutes": 105,
  "best_score": null,
  "completion_date": null,
  "first_started_at": "2024-01-15T11:00:00Z",
  "last_accessed_at": "2024-01-15T12:30:00Z",
  "attempts_count": 0,
  "metadata": {
    "section_completed": "risk_factors",
    "interactive_elements_used": ["risk_calculator"]
  }
}
```

#### Status Codes
- `200`: Success
- `404`: User or module not found
- `422`: Validation error
- `500`: Internal server error

---

### 3. Record Quiz Attempt

**POST** `/api/v1/progress/quiz`

Record a quiz attempt and calculate score.

#### Request Body
```json
{
  "user_id": "uuid",
  "module_id": "uuid",
  "questions_answers": {
    "question_1": "option_a",
    "question_2": "option_c",
    "question_3": "true"
  },
  "time_taken_minutes": 12
}
```

#### Response
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "module_id": "uuid",
  "attempt_number": 1,
  "score": 8,
  "max_score": 10,
  "percentage_score": 80.0,
  "time_taken_minutes": 12,
  "completed": true,
  "passed": true,
  "attempt_date": "2024-01-15T13:00:00Z",
  "feedback": {
    "correct_answers": 8,
    "incorrect_answers": 2,
    "areas_for_improvement": ["Position sizing calculations"]
  }
}
```

#### Status Codes
- `200`: Success
- `404`: User or module not found
- `422`: Validation error
- `500`: Internal server error

---

### 4. Create Practice Session

**POST** `/api/v1/progress/practice`

Create a new practice trading session.

#### Request Body
```json
{
  "user_id": "uuid",
  "session_name": "Risk Management Practice",
  "trade_config": {
    "grid_count": 10,
    "price_range": 0.15,
    "investment_amount": 100
  },
  "simulation_parameters": {
    "market_type": "sideways",
    "volatility": 0.08,
    "duration_hours": 4
  },
  "base_token": "ERG",
  "quote_token": "SigUSD",
  "initial_balance_base": 100.0,
  "initial_balance_quote": 500.0,
  "duration_minutes": 240,
  "market_conditions": "moderate_volatility"
}
```

#### Response
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "session_name": "Risk Management Practice",
  "base_token": "ERG",
  "quote_token": "SigUSD",
  "initial_balance_base": 100.0,
  "initial_balance_quote": 500.0,
  "final_balance_base": null,
  "final_balance_quote": null,
  "total_pnl_percentage": null,
  "trades_executed": 0,
  "duration_minutes": 240,
  "market_conditions": "moderate_volatility",
  "performance_rating": null,
  "lessons_learned": [],
  "completed": false,
  "created_at": "2024-01-15T14:00:00Z",
  "completed_at": null
}
```

#### Status Codes
- `201`: Created
- `404`: User not found
- `422`: Validation error
- `500`: Internal server error

---

### 5. Complete Practice Session

**PUT** `/api/v1/progress/practice/complete`

Complete a practice trading session with results.

#### Request Body
```json
{
  "session_id": "uuid",
  "simulation_results": {
    "total_trades": 15,
    "successful_trades": 12,
    "average_trade_profit": 0.8,
    "max_drawdown": 2.1,
    "sharpe_ratio": 1.4
  },
  "final_balance_base": 98.5,
  "final_balance_quote": 515.0,
  "total_pnl_percentage": 1.8,
  "trades_executed": 15,
  "performance_rating": "good",
  "lessons_learned": [
    "Grid spacing worked well for this volatility",
    "Should have taken profits earlier during the spike"
  ]
}
```

#### Response
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "session_name": "Risk Management Practice",
  "base_token": "ERG",
  "quote_token": "SigUSD",
  "initial_balance_base": 100.0,
  "initial_balance_quote": 500.0,
  "final_balance_base": 98.5,
  "final_balance_quote": 515.0,
  "total_pnl_percentage": 1.8,
  "trades_executed": 15,
  "duration_minutes": 240,
  "market_conditions": "moderate_volatility",
  "performance_rating": "good",
  "lessons_learned": [
    "Grid spacing worked well for this volatility",
    "Should have taken profits earlier during the spike"
  ],
  "completed": true,
  "created_at": "2024-01-15T14:00:00Z",
  "completed_at": "2024-01-15T18:00:00Z"
}
```

#### Status Codes
- `200`: Success
- `404`: Practice session not found
- `422`: Validation error
- `500`: Internal server error

---

### 6. Get User Achievements

**GET** `/api/v1/progress/achievements/{user_id}`

Get all achievements earned by a user.

#### Parameters
- `user_id` (path): User UUID (required)
- `achievement_type` (query): Filter by achievement type (optional)

#### Response
```json
[
  {
    "id": "uuid",
    "achievement_code": "first_module_complete", 
    "title": "First Steps",
    "description": "Complete your first educational module",
    "achievement_type": "education",
    "reward_points": 100,
    "badge_icon": "first-steps-badge.svg",
    "earned_at": "2024-01-15T10:30:00Z",
    "criteria": {"modules_completed": 1}
  },
  {
    "id": "uuid",
    "achievement_code": "quiz_master",
    "title": "Quiz Master", 
    "description": "Score 90% or higher on any quiz",
    "achievement_type": "education",
    "reward_points": 150,
    "badge_icon": "quiz-master-badge.svg",
    "earned_at": "2024-01-15T13:15:00Z",
    "criteria": {"quiz_score_min": 90}
  }
]
```

#### Status Codes
- `200`: Success
- `404`: User not found
- `422`: Invalid user ID format
- `500`: Internal server error

---

### 7. Validate Live Trading Readiness

**GET** `/api/v1/progress/validate-readiness/{user_id}`

Validate if user meets all requirements for live trading.

#### Parameters
- `user_id` (path): User UUID (required)

#### Response
```json
{
  "user_id": "uuid",
  "is_ready_for_live_trading": false,
  "requirements_met": {
    "required_modules_completed": true,
    "practice_trades_minimum": false,
    "practice_time_minimum": false
  },
  "missing_requirements": [
    "Complete 1 more practice trading sessions",
    "Practice trading for 18.5 more hours"
  ],
  "completion_percentage": 33.3,
  "estimated_time_to_completion_hours": 20.0,
  "recommendations": [
    "Complete more practice trading sessions",
    "Spend more time in practice trading mode"
  ],
  "validation_date": "2024-01-15T15:00:00Z"
}
```

#### Requirements for Live Trading
1. **Required Modules**: Complete all of:
   - `grid-basics` - Grid Trading Fundamentals
   - `risk-management` - Risk Management in Grid Trading  
   - `market-conditions` - Market Analysis for Grid Trading

2. **Practice Requirements**:
   - Minimum 3 completed practice trading sessions
   - Minimum 24 hours total practice time

#### Status Codes
- `200`: Success
- `404`: User not found
- `422`: Invalid user ID format
- `500`: Internal server error

---

### 8. Get Educational Modules

**GET** `/api/v1/progress/modules`

Get all educational modules with optional user progress.

#### Parameters
- `user_id` (query): User UUID to include progress (optional)
- `include_inactive` (query): Include inactive modules (default: false)

#### Response
```json
[
  {
    "id": "uuid",
    "module_code": "grid-basics",
    "title": "Grid Trading Fundamentals",
    "description": "Learn the basics of grid trading strategy...",
    "difficulty_level": "beginner",
    "estimated_duration_minutes": 45,
    "prerequisites": [],
    "learning_objectives": [
      "Understand what grid trading is and how it works",
      "Learn the key components of a grid trading strategy"
    ],
    "passing_score": 75,
    "is_active": true,
    "sort_order": 1,
    "user_progress": {
      "id": "uuid",
      "completion_status": "completed",
      "progress_percentage": 100,
      "time_spent_minutes": 45,
      "best_score": 88,
      "completion_date": "2024-01-15T10:30:00Z"
    }
  }
]
```

#### Status Codes
- `200`: Success
- `500`: Internal server error

---

### 9. Get User Progress Summary

**GET** `/api/v1/progress/summary/{user_id}`

Get condensed user progress summary for dashboard display.

#### Parameters
- `user_id` (path): User UUID (required)

#### Response
```json
{
  "user_id": "uuid",
  "completed_modules": ["grid-basics", "platform-usage"],
  "in_progress_modules": ["risk-management"],
  "total_time_spent_minutes": 120,
  "average_quiz_score": 82.5,
  "practice_trades_count": 2,
  "practice_time_spent_minutes": 480,
  "achievements_earned": 3,
  "certification_progress": 40.0,
  "is_ready_for_live_trading": false,
  "next_recommended_module": "risk-management"
}
```

#### Status Codes
- `200`: Success
- `404`: User not found
- `422`: Invalid user ID format
- `500`: Internal server error

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error description",
  "error_code": "ERROR_CODE",
  "timestamp": "2024-01-15T15:00:00Z"
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Request validation failed
- `USER_NOT_FOUND`: User does not exist
- `MODULE_NOT_FOUND`: Educational module does not exist
- `UNAUTHORIZED`: Authentication required
- `INTERNAL_SERVER_ERROR`: Server error

---

## Achievement System

### Achievement Categories

1. **Education Achievements**
   - Module completion milestones
   - Quiz performance achievements
   - Learning time milestones

2. **Practice Achievements**
   - First practice session completion
   - Practice session quantity milestones
   - Practice time milestones

3. **Performance Achievements**
   - Profitable trading sessions
   - High performance ratings
   - Consistent performance

4. **Milestone Achievements**
   - Certification completion
   - Overall progress milestones
   - Special accomplishments

### Achievement Criteria

Achievements are automatically awarded based on user activity:

- **Module Completion**: Triggered when modules are marked complete
- **Quiz Scores**: Triggered when quiz attempts are recorded
- **Practice Performance**: Triggered when practice sessions are completed
- **Time Milestones**: Calculated from cumulative time tracking

---

## Database Schema

### Core Tables

- `users`: User profiles and authentication
- `educational_modules`: Module definitions and content metadata
- `educational_progress`: User progress through modules
- `quiz_questions`: Quiz questions and answers
- `quiz_attempts`: User quiz attempts and scores
- `practice_trades`: Practice trading sessions and results
- `achievements`: Achievement definitions
- `user_achievements`: User-earned achievements
- `user_activities`: Activity logging for analytics

### Relationships

- User → Educational Progress (1:many)
- User → Quiz Attempts (1:many) 
- User → Practice Trades (1:many)
- User → User Achievements (1:many)
- Educational Module → Educational Progress (1:many)
- Educational Module → Quiz Questions (1:many)
- Achievement → User Achievements (1:many)

---

## Integration Examples

### Frontend Integration

```javascript
// Get user progress
const response = await fetch('/api/v1/progress/user-123', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const progress = await response.json();

// Update module progress
await fetch('/api/v1/progress/module', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_id: 'user-123',
    module_id: 'module-456', 
    time_spent_minutes: 15,
    progress_percentage: 50
  })
});
```

### Practice Trading Integration

```javascript
// Start practice session
const session = await fetch('/api/v1/progress/practice', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_id: 'user-123',
    session_name: 'Grid Strategy Test',
    trade_config: { /* config */ },
    simulation_parameters: { /* params */ },
    base_token: 'ERG',
    quote_token: 'SigUSD',
    initial_balance_base: 100,
    initial_balance_quote: 500
  })
});

// Complete session
await fetch('/api/v1/progress/practice/complete', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    session_id: session.id,
    simulation_results: { /* results */ },
    final_balance_base: 105,
    final_balance_quote: 485,
    total_pnl_percentage: 2.5,
    trades_executed: 12
  })
});
```

---

## Best Practices

### Progress Tracking
1. Update progress frequently during learning sessions
2. Include meaningful metadata for analytics
3. Track time spent accurately
4. Handle network failures gracefully

### Quiz Implementation
1. Randomize question order
2. Implement time limits
3. Provide immediate feedback
4. Allow multiple attempts with learning

### Practice Trading
1. Save session state regularly
2. Implement realistic simulation
3. Track detailed metrics
4. Provide actionable feedback

### Achievement System
1. Check achievements after relevant activities
2. Notify users immediately when earned
3. Display progress towards unearned achievements
4. Make criteria transparent

---

This documentation provides complete coverage of the progress tracking API. For additional support or feature requests, please contact the development team.
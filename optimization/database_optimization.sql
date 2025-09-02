-- Database optimization queries and configurations for Off the Grid platform
-- PostgreSQL performance tuning, indexing strategies, and query optimization

-- =============================================================================
-- PERFORMANCE MONITORING SETUP
-- =============================================================================

-- Enable pg_stat_statements extension for query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Enable timing of database I/O calls
ALTER SYSTEM SET track_io_timing = on;

-- Track function call statistics
ALTER SYSTEM SET track_functions = 'all';

-- Track activity for better monitoring
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;

-- Log slow queries (queries taking more than 1 second)
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Log queries that wait for locks
ALTER SYSTEM SET log_lock_waits = on;

-- Log checkpoint activity
ALTER SYSTEM SET log_checkpoints = on;

-- Reload configuration
SELECT pg_reload_conf();

-- =============================================================================
-- INDEXING STRATEGY
-- =============================================================================

-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
ON users (email) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at 
ON users (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_status 
ON users (status) WHERE status != 'active';

-- User progress indexes  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_progress_user_lesson 
ON user_progress (user_id, lesson_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_progress_completed 
ON user_progress (completed_at DESC) WHERE completed_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_progress_score 
ON user_progress (score DESC) WHERE score IS NOT NULL;

-- Grid orders indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grid_orders_user_status 
ON grid_orders (user_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grid_orders_created_at 
ON grid_orders (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grid_orders_token_pair 
ON grid_orders (base_token, quote_token);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grid_orders_active 
ON grid_orders (status) WHERE status = 'active';

-- Partial index for active orders only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grid_orders_active_user 
ON grid_orders (user_id, created_at DESC) 
WHERE status = 'active';

-- Bot operations indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_operations_timestamp 
ON bot_operations (timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_operations_grid_id 
ON bot_operations (grid_order_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bot_operations_type_status 
ON bot_operations (operation_type, status);

-- Tokens table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tokens_symbol 
ON tokens (symbol);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tokens_active 
ON tokens (active) WHERE active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tokens_updated_at 
ON tokens (updated_at DESC);

-- Audit log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_user_action 
ON audit_log (user_id, action);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_timestamp 
ON audit_log (timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_table_record 
ON audit_log (table_name, record_id);

-- =============================================================================
-- QUERY OPTIMIZATION FUNCTIONS
-- =============================================================================

-- Function to get slow queries
CREATE OR REPLACE FUNCTION get_slow_queries(min_duration_ms integer DEFAULT 1000)
RETURNS TABLE(
    query_text text,
    mean_time_ms numeric,
    total_time_ms numeric,
    calls bigint,
    rows bigint,
    hit_percent numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pss.query,
        ROUND(pss.mean_exec_time::numeric, 2) as mean_time_ms,
        ROUND(pss.total_exec_time::numeric, 2) as total_time_ms,
        pss.calls,
        pss.rows,
        ROUND(
            (100.0 * pss.shared_blks_hit / 
            NULLIF(pss.shared_blks_hit + pss.shared_blks_read, 0))::numeric, 
            2
        ) as hit_percent
    FROM pg_stat_statements pss
    WHERE pss.mean_exec_time > min_duration_ms
    ORDER BY pss.mean_exec_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function to get table statistics
CREATE OR REPLACE FUNCTION get_table_stats()
RETURNS TABLE(
    table_name text,
    row_count bigint,
    table_size text,
    index_size text,
    total_size text,
    seq_scans bigint,
    seq_tup_read bigint,
    idx_scans bigint,
    idx_tup_fetch bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename::text,
        c.reltuples::bigint as row_count,
        pg_size_pretty(pg_total_relation_size(c.oid) - pg_indexes_size(c.oid)) as table_size,
        pg_size_pretty(pg_indexes_size(c.oid)) as index_size,
        pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
        s.seq_scan,
        s.seq_tup_read,
        s.idx_scan,
        s.idx_tup_fetch
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    JOIN pg_stat_user_tables s ON s.relname = t.tablename
    WHERE t.schemaname = 'public'
    ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to find unused indexes
CREATE OR REPLACE FUNCTION get_unused_indexes()
RETURNS TABLE(
    schema_name text,
    table_name text,
    index_name text,
    index_size text,
    index_scans bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname::text,
        tablename::text,
        indexname::text,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
        idx_scan
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0
    AND schemaname = 'public'
    ORDER BY pg_relation_size(indexrelid) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get missing index suggestions
CREATE OR REPLACE FUNCTION get_index_suggestions()
RETURNS TABLE(
    table_name text,
    column_name text,
    n_distinct integer,
    correlation real,
    suggestion text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.tablename::text,
        s.attname::text,
        s.n_distinct,
        s.correlation,
        CASE 
            WHEN s.n_distinct > 100 AND s.correlation < 0.1 THEN 'Consider B-tree index'
            WHEN s.n_distinct < 10 AND s.correlation > 0.9 THEN 'Consider partial index'
            WHEN s.n_distinct = 1 THEN 'Consider partial index or remove from queries'
            ELSE 'Review query patterns'
        END as suggestion
    FROM pg_stats s
    WHERE s.schemaname = 'public'
    AND (s.n_distinct > 100 OR s.n_distinct < 10 OR s.correlation < 0.1)
    ORDER BY s.n_distinct DESC, s.correlation ASC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =============================================================================

-- Materialized view for user statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_stats AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT up.lesson_id) as lessons_completed,
    COUNT(DISTINCT go.id) as total_grids_created,
    COUNT(DISTINCT CASE WHEN go.status = 'active' THEN go.id END) as active_grids,
    AVG(up.score) as average_score,
    MAX(up.completed_at) as last_activity,
    DATE_TRUNC('day', u.created_at) as signup_date
FROM users u
LEFT JOIN user_progress up ON u.id = up.user_id
LEFT JOIN grid_orders go ON u.id = go.user_id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email, u.created_at;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS mv_user_stats_user_id 
ON mv_user_stats (user_id);

-- Materialized view for token statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_token_stats AS
SELECT 
    t.id as token_id,
    t.symbol,
    t.name,
    COUNT(DISTINCT go.id) as grid_orders_count,
    COUNT(DISTINCT go.user_id) as unique_users,
    AVG(go.upper_price - go.lower_price) as avg_price_range,
    MAX(go.created_at) as last_used,
    SUM(CASE WHEN go.status = 'active' THEN 1 ELSE 0 END) as active_orders
FROM tokens t
LEFT JOIN grid_orders go ON (t.id = go.base_token OR t.id = go.quote_token)
WHERE t.active = true
GROUP BY t.id, t.symbol, t.name;

-- Create unique index on token stats materialized view
CREATE UNIQUE INDEX IF NOT EXISTS mv_token_stats_token_id 
ON mv_token_stats (token_id);

-- =============================================================================
-- OPTIMIZATION PROCEDURES
-- =============================================================================

-- Procedure to refresh materialized views
CREATE OR REPLACE PROCEDURE refresh_materialized_views()
LANGUAGE plpgsql AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_token_stats;
    
    -- Log the refresh
    INSERT INTO system_log (event_type, message, timestamp)
    VALUES ('materialized_view_refresh', 'Refreshed all materialized views', NOW());
    
    COMMIT;
END;
$$;

-- Procedure to update table statistics
CREATE OR REPLACE PROCEDURE update_table_statistics()
LANGUAGE plpgsql AS $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE 'ANALYZE ' || table_record.tablename;
    END LOOP;
    
    -- Log the update
    INSERT INTO system_log (event_type, message, timestamp)
    VALUES ('statistics_update', 'Updated table statistics', NOW());
    
    COMMIT;
END;
$$;

-- Procedure to clean up old data
CREATE OR REPLACE PROCEDURE cleanup_old_data()
LANGUAGE plpgsql AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Clean up old audit logs (keep 90 days)
    DELETE FROM audit_log 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up old bot operations (keep 30 days)
    DELETE FROM bot_operations 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    -- Clean up old system logs (keep 30 days)  
    DELETE FROM system_log
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    -- Log the cleanup
    INSERT INTO system_log (event_type, message, timestamp)
    VALUES ('data_cleanup', 'Cleaned up old data: ' || deleted_count || ' records', NOW());
    
    COMMIT;
END;
$$;

-- =============================================================================
-- PERFORMANCE MONITORING VIEWS
-- =============================================================================

-- View for database performance metrics
CREATE OR REPLACE VIEW v_performance_metrics AS
SELECT 
    'connections' as metric,
    count(*) as value,
    'active' as unit
FROM pg_stat_activity 
WHERE state = 'active'

UNION ALL

SELECT 
    'cache_hit_ratio' as metric,
    ROUND(
        100.0 * sum(heap_blks_hit) / 
        NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 
        2
    ) as value,
    'percent' as unit
FROM pg_statio_user_tables

UNION ALL

SELECT 
    'checkpoint_write_time' as metric,
    checkpoint_write_time as value,
    'ms' as unit
FROM pg_stat_bgwriter

UNION ALL

SELECT 
    'deadlocks' as metric,
    deadlocks as value,
    'count' as unit  
FROM pg_stat_database
WHERE datname = current_database();

-- View for table health metrics
CREATE OR REPLACE VIEW v_table_health AS
SELECT 
    t.tablename,
    c.reltuples::bigint as estimated_rows,
    pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
    ROUND(
        100.0 * s.idx_scan / NULLIF(s.seq_scan + s.idx_scan, 0), 
        2
    ) as index_usage_percent,
    s.n_tup_ins + s.n_tup_upd + s.n_tup_del as total_operations,
    CASE 
        WHEN s.last_analyze < NOW() - INTERVAL '7 days' THEN 'STALE'
        WHEN s.last_analyze < NOW() - INTERVAL '1 day' THEN 'OLD'
        ELSE 'CURRENT'
    END as stats_freshness
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_stat_user_tables s ON s.relname = t.tablename
WHERE t.schemaname = 'public'
ORDER BY pg_total_relation_size(c.oid) DESC;

-- =============================================================================
-- AUTOMATED MAINTENANCE SETUP
-- =============================================================================

-- Create system log table for tracking maintenance
CREATE TABLE IF NOT EXISTS system_log (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    details JSONB
);

CREATE INDEX IF NOT EXISTS idx_system_log_timestamp 
ON system_log (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_system_log_event_type 
ON system_log (event_type);

-- =============================================================================
-- QUERY OPTIMIZATION EXAMPLES
-- =============================================================================

-- Optimized query for user dashboard
CREATE OR REPLACE FUNCTION get_user_dashboard(user_id_param integer)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'user_stats', (
            SELECT json_build_object(
                'lessons_completed', lessons_completed,
                'total_grids', total_grids_created,
                'active_grids', active_grids,
                'average_score', ROUND(average_score::numeric, 2)
            )
            FROM mv_user_stats 
            WHERE user_id = user_id_param
        ),
        'recent_grids', (
            SELECT json_agg(
                json_build_object(
                    'id', go.id,
                    'status', go.status,
                    'created_at', go.created_at,
                    'base_token', bt.symbol,
                    'quote_token', qt.symbol
                )
            )
            FROM grid_orders go
            JOIN tokens bt ON go.base_token = bt.id
            JOIN tokens qt ON go.quote_token = qt.id
            WHERE go.user_id = user_id_param
            ORDER BY go.created_at DESC
            LIMIT 10
        ),
        'recent_progress', (
            SELECT json_agg(
                json_build_object(
                    'lesson_id', up.lesson_id,
                    'score', up.score,
                    'completed_at', up.completed_at
                )
            )
            FROM user_progress up
            WHERE up.user_id = user_id_param
            AND up.completed_at IS NOT NULL
            ORDER BY up.completed_at DESC
            LIMIT 10
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- MONITORING AND ALERTING FUNCTIONS  
-- =============================================================================

-- Function to check database health
CREATE OR REPLACE FUNCTION check_database_health()
RETURNS TABLE(
    check_name text,
    status text,
    value numeric,
    threshold numeric,
    message text
) AS $$
BEGIN
    RETURN QUERY
    WITH health_checks AS (
        SELECT 
            'active_connections' as check_name,
            CASE WHEN count(*) > 100 THEN 'CRITICAL'
                 WHEN count(*) > 50 THEN 'WARNING'
                 ELSE 'OK' END as status,
            count(*)::numeric as value,
            100::numeric as threshold,
            'Active database connections' as message
        FROM pg_stat_activity 
        WHERE state = 'active'
        
        UNION ALL
        
        SELECT 
            'cache_hit_ratio' as check_name,
            CASE WHEN ratio < 90 THEN 'CRITICAL'
                 WHEN ratio < 95 THEN 'WARNING'  
                 ELSE 'OK' END as status,
            ratio as value,
            90::numeric as threshold,
            'Database cache hit ratio (%)' as message
        FROM (
            SELECT ROUND(
                100.0 * sum(heap_blks_hit) / 
                NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 
                2
            ) as ratio
            FROM pg_statio_user_tables
        ) cache_stats
        
        UNION ALL
        
        SELECT 
            'database_size' as check_name,
            CASE WHEN size_gb > 100 THEN 'WARNING'
                 WHEN size_gb > 50 THEN 'INFO'
                 ELSE 'OK' END as status,
            size_gb as value,
            100::numeric as threshold,
            'Database size (GB)' as message
        FROM (
            SELECT ROUND(pg_database_size(current_database()) / 1024.0^3, 2) as size_gb
        ) size_stats
    )
    SELECT * FROM health_checks;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CONFIGURATION RECOMMENDATIONS
-- =============================================================================

/*
Recommended PostgreSQL configuration settings for production:

# Memory settings
shared_buffers = 256MB                    # 25% of RAM for dedicated server
effective_cache_size = 1GB               # 75% of available RAM  
work_mem = 4MB                           # Per-operation memory limit
maintenance_work_mem = 64MB              # Memory for maintenance operations

# Checkpoint settings
checkpoint_completion_target = 0.9       # Spread checkpoint I/O
checkpoint_timeout = 15min               # Maximum time between checkpoints
max_wal_size = 2GB                       # WAL file size limit

# Connection settings  
max_connections = 100                    # Maximum concurrent connections
shared_preload_libraries = 'pg_stat_statements'  # Load query stats extension

# Logging settings
log_min_duration_statement = 1000        # Log queries > 1 second
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on                     # Log checkpoint activity
log_connections = on                     # Log new connections
log_disconnections = on                  # Log disconnections
log_lock_waits = on                      # Log lock waits

# Autovacuum settings
autovacuum = on                          # Enable automatic cleanup
autovacuum_max_workers = 3               # Number of autovacuum workers
autovacuum_naptime = 60s                 # Sleep time between runs

# Replication settings (if using replication)
wal_level = replica                      # WAL level for replication
max_wal_senders = 3                      # Number of WAL sender processes
*/

-- =============================================================================
-- MAINTENANCE SCHEDULE SETUP
-- =============================================================================

-- Example cron jobs for automated maintenance:
/*
# Refresh materialized views every hour
0 * * * * psql -d off_the_grid -c "CALL refresh_materialized_views();"

# Update statistics daily at 2 AM
0 2 * * * psql -d off_the_grid -c "CALL update_table_statistics();"

# Clean up old data weekly on Sunday at 3 AM  
0 3 * * 0 psql -d off_the_grid -c "CALL cleanup_old_data();"

# Check database health every 15 minutes
*/15 * * * * psql -d off_the_grid -t -c "SELECT * FROM check_database_health() WHERE status != 'OK';" | [ -s ] && echo "Database health issues detected" | mail -s "DB Health Alert" admin@offthegrid.io
*/
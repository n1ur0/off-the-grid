# Off the Grid Database Infrastructure

This directory contains the database infrastructure for the Off the Grid platform, including PostgreSQL for persistent data and Redis for session management and caching.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │      Redis      │
│                 │    │                 │
│ • User data     │    │ • Sessions      │
│ • Education     │    │ • Caching       │
│ • Progress      │    │ • WebSocket     │
│ • Trading       │    │ • Rate limits   │
└─────────────────┘    └─────────────────┘
```

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Linux/macOS (Windows with WSL2)

### Setup
```bash
cd database
./scripts/setup.sh
```

This will:
1. Create necessary directories and configuration files
2. Start PostgreSQL and Redis containers
3. Initialize the database schema
4. Create backup and reset scripts

### Manual Setup
```bash
# Start services
docker-compose up -d

# Start with development tools
docker-compose --profile development up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Database Schema

### Core Tables

#### `users`
- Primary user table with wallet-based authentication
- Stores wallet addresses and user preferences
- No traditional passwords - authentication via wallet signatures

#### `education_modules`
- Educational content and quiz questions
- Modular system for learning grid trading concepts
- JSON-based content structure for flexibility

#### `user_module_progress`
- Tracks user progress through educational modules
- Quiz scores and completion status
- Unlock requirements enforcement

#### `practice_sessions`
- Simulated trading sessions for risk-free learning
- Performance tracking and metrics
- Portfolio simulation data

#### `user_grids`
- Real grid trading activity tracking
- Performance metrics and profit calculation
- Integration with blockchain data

#### `user_sessions`
- JWT token management and session tracking
- Security and audit logging
- Token revocation support

### Views

#### `user_education_summary`
- Aggregated education progress per user
- Ready-for-trading status calculation

#### `user_trading_summary`
- Trading performance metrics
- Profit and loss aggregation

## Redis Structure

### Key Patterns

```
session:{user_id}           # User session data
user_grids:{user_id}        # Cached grid data
grid_cache:{grid_id}        # Individual grid cache
ws_connections:{user_id}    # WebSocket tracking
rate_limit:{ip_address}     # Rate limiting
temp:{key}                  # Temporary data with TTL
```

### Configuration

- **Memory**: 256MB with LRU eviction
- **Persistence**: AOF + RDB snapshots
- **Security**: Password protected, command renaming
- **TTL**: Automatic expiration for temporary data

## Development Tools

### pgAdmin
- **URL**: http://localhost:8080
- **Email**: admin@offthegrid.local
- **Password**: Check docker-compose.yml

### Redis Commander
- **URL**: http://localhost:8081
- **Password**: Check redis.conf

## Backup & Recovery

### Automated Backups
```bash
./backup.sh
```

Creates timestamped backups in `backups/` directory:
- `postgres_backup_YYYYMMDD_HHMMSS.sql.gz`
- `redis_backup_YYYYMMDD_HHMMSS.rdb.gz`

### Restore from Backup
```bash
# PostgreSQL
gunzip -c backups/postgres_backup_*.sql.gz | docker exec -i offthegrid-postgres psql -U offthegrid -d offthegrid

# Redis
gunzip -c backups/redis_backup_*.rdb.gz | docker exec -i offthegrid-redis redis-cli --pipe
```

## Security Considerations

### Database Security
- Change default passwords in production
- Use environment variables for credentials
- Enable SSL/TLS for external connections
- Regular security updates

### Redis Security
- Password protection enabled
- Dangerous commands renamed/disabled
- Bind to localhost only by default
- Memory limits to prevent DoS

### Application Security
- Prepared statements prevent SQL injection
- Connection pooling for performance
- Session token validation
- Rate limiting implementation

## Performance Tuning

### PostgreSQL
```sql
-- Connection pooling
max_connections = 100

-- Memory settings
shared_buffers = 256MB
effective_cache_size = 1GB

-- Query optimization
enable_seqscan = off  -- For specific queries
```

### Redis
```
# Memory optimization
maxmemory-policy allkeys-lru
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
```

## Monitoring

### Health Checks
```bash
# PostgreSQL
docker exec offthegrid-postgres pg_isready -U offthegrid -d offthegrid

# Redis
docker exec offthegrid-redis redis-cli ping
```

### Metrics
- Connection pool utilization
- Query performance (slow query log)
- Memory usage
- Cache hit ratios

### Logs
```bash
# View database logs
docker-compose logs postgres

# View Redis logs
docker-compose logs redis

# Follow logs in real-time
docker-compose logs -f
```

## Migration Management

### Schema Changes
1. Create migration script in `migrations/`
2. Test on development database
3. Apply to staging environment
4. Schedule production deployment

### Example Migration
```sql
-- migrations/002_add_user_preferences.sql
ALTER TABLE users ADD COLUMN theme VARCHAR(20) DEFAULT 'light';
ALTER TABLE users ADD COLUMN notifications_enabled BOOLEAN DEFAULT true;

-- Always include rollback
-- ROLLBACK: ALTER TABLE users DROP COLUMN theme, DROP COLUMN notifications_enabled;
```

## Troubleshooting

### Common Issues

**Connection Refused**
```bash
# Check if containers are running
docker-compose ps

# Restart services
docker-compose restart
```

**Out of Memory**
```bash
# Check Redis memory usage
docker exec offthegrid-redis redis-cli info memory

# Increase memory limit in redis.conf
maxmemory 512mb
```

**Slow Queries**
```sql
-- Enable slow query log
SET log_min_duration_statement = 1000;

-- Check for missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public';
```

### Reset Database
```bash
# DANGER: This will delete all data
./reset.sh
```

## Production Deployment

### Environment Variables
```bash
# Required for production
DATABASE_URL=postgresql://user:pass@prod-db:5432/offthegrid
REDIS_URL=redis://:pass@prod-redis:6379
POSTGRES_PASSWORD=secure-random-password
REDIS_PASSWORD=secure-random-password
```

### Scaling Considerations
- Read replicas for PostgreSQL
- Redis clustering for high availability  
- Connection pooling configuration
- Regular maintenance and vacuum operations

### Backup Strategy
- Daily automated backups
- Point-in-time recovery capability
- Off-site backup storage
- Disaster recovery procedures

## Support

For database-related issues:
1. Check logs first: `docker-compose logs`
2. Verify connectivity: Health check commands
3. Review configuration: Environment variables
4. Consult PostgreSQL/Redis documentation
5. Check application database service integration
#!/bin/bash

# Off the Grid Database Setup Script
# This script sets up PostgreSQL and Redis for development

set -e

echo "🚀 Setting up Off the Grid database infrastructure..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs backups

# Set up environment variables
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Database Configuration
POSTGRES_DB=offthegrid
POSTGRES_USER=offthegrid
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)

# Connection URLs
DATABASE_URL=postgresql://offthegrid:\${POSTGRES_PASSWORD}@localhost:5432/offthegrid
REDIS_URL=redis://:\${REDIS_PASSWORD}@localhost:6379

# Development flags
DEVELOPMENT=true
EOF
    echo "✅ Created .env file with secure passwords"
    echo "⚠️  Please update the passwords in .env and docker-compose.yml"
else
    echo "✅ .env file already exists"
fi

# Start database services
echo "🐳 Starting database containers..."
docker-compose up -d postgres redis

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker exec offthegrid-postgres pg_isready -U offthegrid -d offthegrid; do
    sleep 2
done

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
until docker exec offthegrid-redis redis-cli ping; do
    sleep 2
done

echo "✅ Database services are running!"

# Verify schema
echo "🔍 Verifying database schema..."
docker exec offthegrid-postgres psql -U offthegrid -d offthegrid -c "\dt" || echo "Schema verification failed"

# Show connection information
echo "
🎉 Setup complete! 

📊 Connection Details:
├── PostgreSQL: localhost:5432
├── Redis: localhost:6379
└── Database name: offthegrid

🛠️  Development Tools:
├── pgAdmin: http://localhost:8080 (run with --profile development)
└── Redis Commander: http://localhost:8081 (run with --profile development)

🔧 Useful Commands:
├── Start services: docker-compose up -d
├── Stop services: docker-compose down
├── View logs: docker-compose logs -f
├── Backup database: ./backup.sh
└── Reset database: ./reset.sh

📁 Configuration:
├── PostgreSQL config: schemas/init.sql
├── Redis config: redis.conf
└── Environment: .env (update passwords!)
"

# Create backup script
echo "💾 Creating backup script..."
cat > backup.sh << 'EOF'
#!/bin/bash

# Database backup script
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups"

echo "🗄️  Creating database backup..."

# PostgreSQL backup
docker exec offthegrid-postgres pg_dump -U offthegrid -d offthegrid | gzip > "${BACKUP_DIR}/postgres_backup_${DATE}.sql.gz"

# Redis backup
docker exec offthegrid-redis redis-cli --rdb - | gzip > "${BACKUP_DIR}/redis_backup_${DATE}.rdb.gz"

echo "✅ Backup complete: ${BACKUP_DIR}/"
ls -la ${BACKUP_DIR}/*${DATE}*
EOF

chmod +x backup.sh

# Create reset script
echo "🔄 Creating reset script..."
cat > reset.sh << 'EOF'
#!/bin/bash

read -p "⚠️  This will destroy all data. Continue? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Stopping and removing containers..."
    docker-compose down -v
    
    echo "🔄 Starting fresh containers..."
    docker-compose up -d postgres redis
    
    echo "✅ Database reset complete!"
else
    echo "❌ Reset cancelled"
fi
EOF

chmod +x reset.sh

echo "✅ Setup scripts created!"
echo "🎯 Next steps: Update passwords in .env and docker-compose.yml, then restart containers"
#!/usr/bin/env python3
"""
Migration runner for Off the Grid database
Handles applying and rolling back database migrations
"""

import os
import sys
import argparse
import logging
import psycopg2
from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MigrationRunner:
    def __init__(self, database_url: str):
        """Initialize migration runner with database connection."""
        self.database_url = database_url
        self.migrations_dir = Path(__file__).parent
        
    def get_connection(self):
        """Create database connection."""
        try:
            conn = psycopg2.connect(self.database_url)
            conn.autocommit = False
            return conn
        except psycopg2.Error as e:
            logger.error(f"Failed to connect to database: {e}")
            sys.exit(1)
    
    def ensure_migrations_table(self, conn):
        """Create schema_migrations table if it doesn't exist."""
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(10) PRIMARY KEY,
                    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    description TEXT
                );
            """)
        conn.commit()
    
    def get_applied_migrations(self, conn) -> List[str]:
        """Get list of applied migration versions."""
        with conn.cursor() as cursor:
            cursor.execute("SELECT version FROM schema_migrations ORDER BY version;")
            return [row[0] for row in cursor.fetchall()]
    
    def get_migration_files(self) -> List[Tuple[str, Path]]:
        """Get all migration files sorted by version."""
        migration_files = []
        for file_path in self.migrations_dir.glob("*.sql"):
            if file_path.name.startswith("migrate.py"):
                continue
            
            # Extract version from filename (e.g., "001_initial_schema.sql" -> "001")
            version = file_path.stem.split('_')[0]
            migration_files.append((version, file_path))
        
        # Sort by version
        migration_files.sort(key=lambda x: x[0])
        return migration_files
    
    def apply_migration(self, conn, version: str, file_path: Path) -> bool:
        """Apply a single migration."""
        logger.info(f"Applying migration {version}: {file_path.name}")
        
        try:
            # Read migration file
            with open(file_path, 'r') as f:
                migration_sql = f.read()
            
            # Execute migration
            with conn.cursor() as cursor:
                cursor.execute(migration_sql)
            
            conn.commit()
            logger.info(f"Successfully applied migration {version}")
            return True
            
        except psycopg2.Error as e:
            logger.error(f"Failed to apply migration {version}: {e}")
            conn.rollback()
            return False
        except Exception as e:
            logger.error(f"Error reading migration file {file_path}: {e}")
            return False
    
    def migrate_up(self, target_version: Optional[str] = None) -> bool:
        """Apply all pending migrations up to target version."""
        conn = self.get_connection()
        
        try:
            self.ensure_migrations_table(conn)
            applied_migrations = set(self.get_applied_migrations(conn))
            migration_files = self.get_migration_files()
            
            if not migration_files:
                logger.info("No migration files found.")
                return True
            
            pending_migrations = [
                (version, file_path) for version, file_path in migration_files
                if version not in applied_migrations
            ]
            
            if target_version:
                pending_migrations = [
                    (version, file_path) for version, file_path in pending_migrations
                    if version <= target_version
                ]
            
            if not pending_migrations:
                logger.info("No pending migrations to apply.")
                return True
            
            logger.info(f"Found {len(pending_migrations)} pending migration(s)")
            
            for version, file_path in pending_migrations:
                if not self.apply_migration(conn, version, file_path):
                    return False
            
            logger.info("All migrations applied successfully!")
            return True
            
        finally:
            conn.close()
    
    def get_migration_status(self) -> None:
        """Display current migration status."""
        conn = self.get_connection()
        
        try:
            self.ensure_migrations_table(conn)
            applied_migrations = set(self.get_applied_migrations(conn))
            migration_files = self.get_migration_files()
            
            print("\nMigration Status:")
            print("================")
            
            if not migration_files:
                print("No migration files found.")
                return
            
            for version, file_path in migration_files:
                status = "APPLIED" if version in applied_migrations else "PENDING"
                print(f"{version}: {file_path.name} - {status}")
            
            applied_count = len(applied_migrations)
            total_count = len(migration_files)
            pending_count = total_count - applied_count
            
            print(f"\nSummary: {applied_count}/{total_count} applied, {pending_count} pending")
            
        finally:
            conn.close()
    
    def create_migration(self, name: str) -> None:
        """Create a new migration file template."""
        # Find next version number
        migration_files = self.get_migration_files()
        if migration_files:
            last_version = int(migration_files[-1][0])
            next_version = f"{last_version + 1:03d}"
        else:
            next_version = "001"
        
        # Create filename
        clean_name = name.lower().replace(' ', '_').replace('-', '_')
        filename = f"{next_version}_{clean_name}.sql"
        file_path = self.migrations_dir / filename
        
        # Create migration template
        template = f"""-- Migration: {filename}
-- Description: {name}
-- Created: {datetime.now().strftime('%Y-%m-%d')}
-- Author: Generated

BEGIN;

-- Check if migration has already been applied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
        IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '{next_version}') THEN
            RAISE EXCEPTION 'Migration {next_version} has already been applied';
        END IF;
    END IF;
END;
$$;

-- Add your migration SQL here
-- Example:
-- ALTER TABLE users ADD COLUMN new_field VARCHAR(255);
-- CREATE INDEX idx_users_new_field ON users(new_field);

-- Record migration
INSERT INTO schema_migrations (version, description) 
VALUES ('{next_version}', '{name}');

COMMIT;

-- Migration completed
"""
        
        with open(file_path, 'w') as f:
            f.write(template)
        
        logger.info(f"Created migration: {file_path}")

def get_database_url() -> str:
    """Get database URL from environment or default."""
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        # Build from individual components
        host = os.getenv('POSTGRES_HOST', 'localhost')
        port = os.getenv('POSTGRES_PORT', '5432')
        database = os.getenv('POSTGRES_DB', 'off_the_grid')
        user = os.getenv('POSTGRES_USER', 'postgres')
        password = os.getenv('POSTGRES_PASSWORD', 'postgres')
        
        database_url = f"postgresql://{user}:{password}@{host}:{port}/{database}"
    
    return database_url

def main():
    """Main migration runner CLI."""
    parser = argparse.ArgumentParser(description='Database migration runner for Off the Grid')
    subparsers = parser.add_subparsers(dest='command', help='Migration commands')
    
    # Migrate up command
    migrate_parser = subparsers.add_parser('up', help='Apply pending migrations')
    migrate_parser.add_argument('--to', dest='target_version', 
                               help='Target migration version to migrate up to')
    
    # Status command
    subparsers.add_parser('status', help='Show migration status')
    
    # Create migration command
    create_parser = subparsers.add_parser('create', help='Create new migration file')
    create_parser.add_argument('name', help='Migration name/description')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    database_url = get_database_url()
    runner = MigrationRunner(database_url)
    
    try:
        if args.command == 'up':
            success = runner.migrate_up(args.target_version)
            sys.exit(0 if success else 1)
        elif args.command == 'status':
            runner.get_migration_status()
        elif args.command == 'create':
            runner.create_migration(args.name)
    except KeyboardInterrupt:
        logger.info("Migration cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
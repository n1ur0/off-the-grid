"""
Database initialization script for Off the Grid educational platform.
Creates all tables and optionally seeds with initial data.
"""

import logging
import argparse
import sys
from pathlib import Path

# Add the API directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from database import create_tables, drop_tables, check_database_health, db_config
from seed_data import seed_database

logger = logging.getLogger(__name__)


def init_database(drop_existing: bool = False, seed_data: bool = True):
    """Initialize the database with tables and optional seed data."""
    
    logger.info("Starting database initialization...")
    
    try:
        # Check database connection
        logger.info("Checking database connection...")
        if not check_database_health():
            logger.error("Database connection failed. Please check your configuration.")
            return False
        
        logger.info("Database connection successful")
        
        # Drop existing tables if requested
        if drop_existing:
            logger.warning("Dropping existing tables...")
            drop_tables()
            logger.info("Existing tables dropped")
        
        # Create tables
        logger.info("Creating database tables...")
        create_tables()
        logger.info("Database tables created successfully")
        
        # Seed with initial data if requested
        if seed_data:
            logger.info("Seeding database with initial data...")
            seed_database()
            logger.info("Database seeding completed")
        
        logger.info("Database initialization completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        return False


def main():
    """Main function with command line argument parsing."""
    
    parser = argparse.ArgumentParser(
        description="Initialize Off the Grid database"
    )
    
    parser.add_argument(
        "--drop",
        action="store_true",
        help="Drop existing tables before creating new ones (DESTRUCTIVE)"
    )
    
    parser.add_argument(
        "--no-seed",
        action="store_true",
        help="Skip seeding the database with initial data"
    )
    
    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Set logging level"
    )
    
    args = parser.parse_args()
    
    # Configure logging
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Confirm destructive operations
    if args.drop:
        confirm = input("WARNING: This will drop all existing tables and data. Are you sure? (yes/no): ")
        if confirm.lower() != 'yes':
            logger.info("Operation cancelled by user")
            return
    
    # Initialize database
    success = init_database(
        drop_existing=args.drop,
        seed_data=not args.no_seed
    )
    
    if success:
        logger.info("Database initialization completed successfully!")
        
        # Print connection info
        logger.info(f"Database URL: {db_config.database_url}")
        
        # Print summary
        if not args.no_seed:
            logger.info("\nInitial data created:")
            logger.info("- Educational modules: 5")
            logger.info("- Quiz questions: Sample questions for each module")
            logger.info("- Achievements: 12 achievement definitions")
            logger.info("\nYou can now start the API server and begin using the educational features.")
        
        sys.exit(0)
    else:
        logger.error("Database initialization failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
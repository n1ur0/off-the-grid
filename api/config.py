"""
Configuration management for Off the Grid FastAPI server
"""
import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings with validation"""
    
    # Server Configuration
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    workers: int = Field(default=1, env="WORKERS")
    reload: bool = Field(default=True, env="RELOAD")
    log_level: str = Field(default="info", env="LOG_LEVEL")
    
    # Security Configuration
    secret_key: str = Field(default="change-me-in-production", env="SECRET_KEY")
    algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=60 * 24)  # 24 hours
    
    # CLI Configuration
    cli_path: str = Field(default="../result/bin/off-the-grid", env="CLI_PATH")
    cli_timeout: float = Field(default=30.0, env="CLI_TIMEOUT")
    
    # CORS Configuration
    allowed_origins: str = Field(
        default="http://localhost:3000,http://localhost:3001",
        env="ALLOWED_ORIGINS"
    )
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse comma-separated origins string into list"""
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]
    
    # WebSocket Configuration
    websocket_ping_interval: int = Field(default=20, env="WS_PING_INTERVAL")
    websocket_ping_timeout: int = Field(default=10, env="WS_PING_TIMEOUT")
    
    # Background Task Configuration
    grid_poll_interval: int = Field(default=30, env="GRID_POLL_INTERVAL")
    
    # Development/Production Mode
    debug: bool = Field(default=False, env="DEBUG")
    testing: bool = Field(default=False, env="TESTING")
    
    # Database Configuration (for future use)
    database_url: str = Field(default="", env="DATABASE_URL")
    redis_url: str = Field(default="", env="REDIS_URL")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Create global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get settings instance (useful for dependency injection)"""
    return settings
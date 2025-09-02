#!/usr/bin/env python3
"""
Startup script for Off the Grid FastAPI server
"""
import os
import sys
import uvicorn
from pathlib import Path

# Add the current directory to Python path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Import our config to validate it
try:
    from config import get_settings
    settings = get_settings()
except Exception as e:
    print(f"Error loading configuration: {e}")
    sys.exit(1)

def main():
    # CLI path validation
    cli_path = settings.cli_path
    alternative_paths = [
        "../result/bin/off-the-grid",
        "./result/bin/off-the-grid", 
        "../target/release/off-the-grid",
        "./target/release/off-the-grid"
    ]
    
    if not os.path.exists(cli_path):
        print(f"Warning: Rust CLI not found at configured path: {cli_path}")
        
        # Try alternative paths
        found = False
        for alt_path in alternative_paths:
            if os.path.exists(alt_path):
                print(f"Found CLI at alternative path: {alt_path}")
                found = True
                break
        
        if not found:
            print("Error: Rust CLI executable not found!")
            print("Please build the Rust CLI first:")
            print("  - With Nix: nix build")
            print("  - With Cargo: cargo build --release")
            print("")
            print("Or set the CLI_PATH environment variable to the correct path.")
            sys.exit(1)
    
    print("=" * 60)
    print("  Off the Grid FastAPI Middleware")
    print("=" * 60)
    print(f"Server: {settings.host}:{settings.port}")
    print(f"CLI Path: {settings.cli_path}")
    print(f"Debug Mode: {settings.debug}")
    print(f"Workers: {settings.workers}")
    print(f"Allowed Origins: {settings.allowed_origins_list}")
    print("=" * 60)
    
    # Start the server
    try:
        uvicorn.run(
            "main:app",
            host=settings.host,
            port=settings.port,
            workers=1 if settings.reload else settings.workers,  # Single worker for reload
            reload=settings.reload and settings.debug,
            log_level=settings.log_level.lower(),
            access_log=settings.debug
        )
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
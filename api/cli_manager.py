"""
CLI Manager for executing Rust CLI commands with robust error handling
"""
import asyncio
import json
import os
import time
import logging
from typing import Dict, Any, Optional, List, Union
from pathlib import Path

from fastapi import HTTPException

from config import get_settings
from models import CLICommandResult

logger = logging.getLogger(__name__)


class CLIManager:
    """Robust CLI manager for subprocess execution"""
    
    def __init__(self, cli_path: Optional[str] = None, timeout: Optional[float] = None):
        self.settings = get_settings()
        self.cli_path = cli_path or self.settings.cli_path
        self.default_timeout = timeout or self.settings.cli_timeout
        self.environment = self._prepare_environment()
        
        # Validate CLI path on initialization
        self._validate_cli_path()
    
    def _validate_cli_path(self) -> None:
        """Validate that the CLI executable exists and is accessible"""
        cli_path = Path(self.cli_path)
        
        if not cli_path.exists():
            logger.warning(f"CLI executable not found at {self.cli_path}")
            # Try alternative paths
            alternative_paths = [
                "./result/bin/off-the-grid",
                "../result/bin/off-the-grid",
                "./target/release/off-the-grid",
                "../target/release/off-the-grid"
            ]
            
            for alt_path in alternative_paths:
                if Path(alt_path).exists():
                    self.cli_path = alt_path
                    logger.info(f"Found CLI at alternative path: {alt_path}")
                    return
            
            logger.error(f"CLI executable not found. Please build the Rust CLI first.")
        
        elif not os.access(cli_path, os.X_OK):
            logger.error(f"CLI executable at {self.cli_path} is not executable")
    
    def _prepare_environment(self) -> Dict[str, str]:
        """Prepare environment variables for CLI execution"""
        env = os.environ.copy()
        
        # Set logging level to reduce noise
        env["RUST_LOG"] = "error" if not self.settings.debug else "info"
        
        # Set any additional environment variables needed by the CLI
        if self.settings.debug:
            env["DEBUG"] = "1"
        
        return env
    
    async def execute_command(
        self, 
        command: List[str], 
        timeout: Optional[float] = None,
        include_json_flag: bool = True,
        working_directory: Optional[str] = None
    ) -> CLICommandResult:
        """
        Execute CLI command with comprehensive error handling and result parsing
        
        Args:
            command: List of command arguments (without the executable)
            timeout: Command timeout in seconds (uses default if None)
            include_json_flag: Whether to add --json flag automatically
            working_directory: Working directory for command execution
        
        Returns:
            CLICommandResult with execution details
        """
        start_time = time.time()
        timeout = timeout or self.default_timeout
        
        # Build full command
        full_command = [self.cli_path] + command
        if include_json_flag and "--json" not in command:
            full_command.append("--json")
        
        logger.info(f"Executing CLI command: {' '.join(full_command)}")
        
        try:
            # Create subprocess
            process = await asyncio.create_subprocess_exec(
                *full_command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=self.environment,
                cwd=working_directory
            )
            
            # Wait for completion with timeout
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout
                )
            except asyncio.TimeoutError:
                logger.error(f"Command timed out after {timeout}s")
                process.kill()
                await process.wait()
                
                return CLICommandResult(
                    success=False,
                    error=f"Command timed out after {timeout}s",
                    execution_time=time.time() - start_time
                )
            
            execution_time = time.time() - start_time
            stdout_str = stdout.decode('utf-8') if stdout else ""
            stderr_str = stderr.decode('utf-8') if stderr else ""
            
            logger.info(f"Command completed in {execution_time:.2f}s with exit code {process.returncode}")
            
            if process.returncode == 0:
                # Success case
                data = self._parse_output(stdout_str, include_json_flag)
                
                return CLICommandResult(
                    success=True,
                    data=data,
                    stderr=stderr_str if stderr_str else None,
                    execution_time=execution_time
                )
            else:
                # Error case
                error_message = self._extract_error_message(stderr_str, stdout_str)
                
                return CLICommandResult(
                    success=False,
                    error=error_message,
                    stderr=stderr_str if stderr_str else None,
                    exit_code=process.returncode,
                    execution_time=execution_time
                )
                
        except FileNotFoundError:
            error_msg = f"CLI executable not found at {self.cli_path}"
            logger.error(error_msg)
            
            return CLICommandResult(
                success=False,
                error=error_msg,
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            error_msg = f"Unexpected error during CLI execution: {str(e)}"
            logger.error(error_msg, exc_info=True)
            
            return CLICommandResult(
                success=False,
                error=error_msg,
                execution_time=time.time() - start_time
            )
    
    def _parse_output(self, output: str, expect_json: bool) -> Union[Dict[str, Any], List[Any], str]:
        """Parse CLI output, handling both JSON and plain text"""
        if not output.strip():
            return [] if expect_json else ""
        
        if expect_json:
            try:
                # Try to parse as JSON
                data = json.loads(output.strip())
                return data
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON output: {e}")
                logger.debug(f"Raw output: {output}")
                
                # Return as raw text with warning
                return {
                    "raw_output": output.strip(),
                    "parse_warning": f"Expected JSON but got plain text: {str(e)}"
                }
        else:
            return output.strip()
    
    def _extract_error_message(self, stderr: str, stdout: str) -> str:
        """Extract meaningful error message from CLI output"""
        if stderr.strip():
            # Try to parse structured error from stderr
            try:
                error_data = json.loads(stderr.strip())
                if isinstance(error_data, dict) and "error" in error_data:
                    return error_data["error"]
            except json.JSONDecodeError:
                pass
            
            return stderr.strip()
        
        if stdout.strip():
            # Check if stdout contains error information
            try:
                data = json.loads(stdout.strip())
                if isinstance(data, dict) and "error" in data:
                    return data["error"]
            except json.JSONDecodeError:
                pass
            
            return stdout.strip()
        
        return "Command failed with unknown error"
    
    async def test_cli_connection(self) -> CLICommandResult:
        """Test CLI connectivity and basic functionality"""
        try:
            # Try a simple command that should always work
            result = await self.execute_command(["--help"], timeout=5.0, include_json_flag=False)
            
            if result.success:
                return CLICommandResult(
                    success=True,
                    data={"status": "CLI accessible", "version": "unknown"},
                    execution_time=result.execution_time
                )
            else:
                return result
                
        except Exception as e:
            return CLICommandResult(
                success=False,
                error=f"CLI test failed: {str(e)}"
            )
    
    async def get_grid_list(self, token_id: Optional[str] = None) -> CLICommandResult:
        """Get list of grid orders"""
        command = ["grid", "list"]
        if token_id:
            command.extend(["--token-id", token_id])
        
        return await self.execute_command(command)
    
    async def get_grid_details(self, grid_identity: str) -> CLICommandResult:
        """Get details of a specific grid order"""
        command = ["grid", "details", "--grid-identity", grid_identity]
        return await self.execute_command(command)
    
    async def create_grid(
        self, 
        token_id: str, 
        value: int, 
        orders: int, 
        range_pct: float, 
        identity: str
    ) -> CLICommandResult:
        """Create a new grid order"""
        command = [
            "grid", "create",
            "-t", token_id,
            "-v", str(value),
            "-o", str(orders),
            "-r", str(range_pct),
            "-i", identity
        ]
        
        # Grid creation can take longer
        return await self.execute_command(command, timeout=120.0)
    
    async def redeem_grid(self, grid_identity: str) -> CLICommandResult:
        """Redeem a grid order"""
        command = ["grid", "redeem", "--grid-identity", grid_identity]
        return await self.execute_command(command, timeout=60.0)
    
    async def get_tokens(self) -> CLICommandResult:
        """Get token information"""
        command = ["tokens", "list"]
        return await self.execute_command(command)
    
    async def update_tokens(self) -> CLICommandResult:
        """Update token information from Spectrum pools"""
        command = ["tokens", "update"]
        return await self.execute_command(command, timeout=120.0)


# Global CLI manager instance
_cli_manager: Optional[CLIManager] = None


def get_cli_manager() -> CLIManager:
    """Get or create CLI manager instance"""
    global _cli_manager
    if _cli_manager is None:
        _cli_manager = CLIManager()
    return _cli_manager
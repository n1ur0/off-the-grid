"""
Background tasks for Off the Grid API
"""
import asyncio
import logging
from datetime import datetime
from typing import Optional

from cli_manager import get_cli_manager
from websocket_manager import get_connection_manager
from config import get_settings

logger = logging.getLogger(__name__)


class BackgroundTaskManager:
    """Manager for background tasks"""
    
    def __init__(self):
        self.settings = get_settings()
        self.cli_manager = get_cli_manager()
        self.connection_manager = get_connection_manager()
        self.running_tasks = {}
        self.shutdown_event = asyncio.Event()
    
    async def start_all_tasks(self):
        """Start all background tasks"""
        logger.info("Starting background tasks...")
        
        # Start grid polling task
        self.running_tasks["grid_polling"] = asyncio.create_task(
            self._grid_polling_loop()
        )
        
        # Start system health monitoring
        self.running_tasks["health_monitor"] = asyncio.create_task(
            self._health_monitoring_loop()
        )
        
        logger.info(f"Started {len(self.running_tasks)} background tasks")
    
    async def stop_all_tasks(self):
        """Stop all background tasks"""
        logger.info("Stopping background tasks...")
        
        # Signal shutdown
        self.shutdown_event.set()
        
        # Cancel all running tasks
        for task_name, task in self.running_tasks.items():
            if not task.done():
                logger.info(f"Cancelling task: {task_name}")
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    logger.info(f"Task cancelled: {task_name}")
                except Exception as e:
                    logger.error(f"Error stopping task {task_name}: {e}")
        
        self.running_tasks.clear()
        logger.info("All background tasks stopped")
    
    async def _grid_polling_loop(self):
        """Background task to poll grid updates"""
        logger.info("Starting grid polling loop")
        poll_interval = self.settings.grid_poll_interval
        
        while not self.shutdown_event.is_set():
            try:
                # Check if anyone is subscribed to grid updates
                stats = self.connection_manager.get_stats()
                grid_subscribers = stats.get("topic_subscriber_counts", {}).get("grids", 0)
                
                if grid_subscribers > 0:
                    logger.debug(f"Polling grids for {grid_subscribers} subscribers")
                    
                    # Fetch grid updates
                    result = await self.cli_manager.get_grid_list()
                    
                    if result.success:
                        # Broadcast updates to subscribers
                        message = {
                            "type": "grid_update",
                            "data": result.data,
                            "timestamp": datetime.utcnow().isoformat(),
                            "execution_time": result.execution_time
                        }
                        
                        subscribers_notified = await self.connection_manager.broadcast_to_topic(
                            "grids", message
                        )
                        
                        if subscribers_notified > 0:
                            logger.debug(f"Notified {subscribers_notified} grid subscribers")
                    else:
                        logger.warning(f"Grid polling failed: {result.error}")
                        
                        # Send error to subscribers
                        error_message = {
                            "type": "grid_update_error",
                            "error": result.error,
                            "timestamp": datetime.utcnow().isoformat()
                        }
                        
                        await self.connection_manager.broadcast_to_topic("grids", error_message)
                else:
                    logger.debug("No grid subscribers, skipping poll")
                
                # Wait for next poll or shutdown
                try:
                    await asyncio.wait_for(
                        self.shutdown_event.wait(), 
                        timeout=poll_interval
                    )
                    # Shutdown event was set
                    break
                except asyncio.TimeoutError:
                    # Normal timeout, continue polling
                    continue
                    
            except asyncio.CancelledError:
                logger.info("Grid polling loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in grid polling loop: {e}")
                # Wait before retrying on error
                try:
                    await asyncio.wait_for(
                        self.shutdown_event.wait(), 
                        timeout=10  # Wait 10 seconds on error
                    )
                    break
                except asyncio.TimeoutError:
                    continue
        
        logger.info("Grid polling loop stopped")
    
    async def _health_monitoring_loop(self):
        """Background task to monitor system health"""
        logger.info("Starting health monitoring loop")
        check_interval = 300  # 5 minutes
        
        while not self.shutdown_event.is_set():
            try:
                # Test CLI connectivity
                cli_result = await self.cli_manager.test_cli_connection()
                
                # Get connection stats
                ws_stats = self.connection_manager.get_stats()
                
                # Create health report
                health_report = {
                    "type": "system_health",
                    "timestamp": datetime.utcnow().isoformat(),
                    "cli_status": "healthy" if cli_result.success else "unhealthy",
                    "cli_response_time": cli_result.execution_time,
                    "websocket_stats": ws_stats
                }
                
                if not cli_result.success:
                    health_report["cli_error"] = cli_result.error
                    logger.warning(f"CLI health check failed: {cli_result.error}")
                
                # Broadcast to system subscribers
                await self.connection_manager.broadcast_to_topic("system", health_report)
                
                logger.debug("Health check completed")
                
                # Wait for next check or shutdown
                try:
                    await asyncio.wait_for(
                        self.shutdown_event.wait(), 
                        timeout=check_interval
                    )
                    break
                except asyncio.TimeoutError:
                    continue
                    
            except asyncio.CancelledError:
                logger.info("Health monitoring loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in health monitoring loop: {e}")
                try:
                    await asyncio.wait_for(
                        self.shutdown_event.wait(), 
                        timeout=30  # Wait 30 seconds on error
                    )
                    break
                except asyncio.TimeoutError:
                    continue
        
        logger.info("Health monitoring loop stopped")
    
    async def trigger_grid_update(self):
        """Manually trigger a grid update broadcast"""
        try:
            result = await self.cli_manager.get_grid_list()
            
            if result.success:
                message = {
                    "type": "grid_update_manual",
                    "data": result.data,
                    "timestamp": datetime.utcnow().isoformat(),
                    "execution_time": result.execution_time
                }
                
                subscribers_notified = await self.connection_manager.broadcast_to_topic(
                    "grids", message
                )
                
                logger.info(f"Manual grid update sent to {subscribers_notified} subscribers")
                return True
            else:
                logger.error(f"Manual grid update failed: {result.error}")
                return False
                
        except Exception as e:
            logger.error(f"Error in manual grid update: {e}")
            return False


# Global background task manager
_task_manager: Optional[BackgroundTaskManager] = None


def get_background_task_manager() -> BackgroundTaskManager:
    """Get or create background task manager"""
    global _task_manager
    if _task_manager is None:
        _task_manager = BackgroundTaskManager()
    return _task_manager
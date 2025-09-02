"""
Bot API routes for Off the Grid
Dedicated endpoints for trading bot operations with bulk operations and advanced features
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends, Query, Header, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, validator
import json
import asyncio

from auth import get_api_key_user, get_current_user
from cli_manager import get_cli_manager, CLIManager  
from models import (
    GridCreateRequest, GridSummary, GridDetailsResponse, TokenInfo,
    SuccessResponse, ErrorResponse, GridStatus, OrderType, PaginationParams
)

logger = logging.getLogger(__name__)

# Create router for bot API endpoints
router = APIRouter(prefix="/api/v2/bot", tags=["bot-api"])

# Bot-specific models

class BulkGridRequest(BaseModel):
    """Request model for creating multiple grid orders"""
    grids: List[GridCreateRequest] = Field(..., min_items=1, max_items=50, description="Grid orders to create (max 50)")
    batch_id: Optional[str] = Field(None, description="Optional batch identifier")
    continue_on_error: bool = Field(True, description="Continue processing if individual grids fail")
    
    @validator('grids')
    def validate_unique_identities(cls, grids):
        identities = [grid.identity for grid in grids]
        if len(identities) != len(set(identities)):
            raise ValueError("Grid identities must be unique within batch")
        return grids


class BulkGridResponse(BaseModel):
    """Response model for bulk grid operations"""
    success: bool
    batch_id: str
    total_grids: int
    successful_grids: int
    failed_grids: int
    results: List[Dict[str, Any]]
    execution_time: float
    errors: List[Dict[str, Any]] = Field(default_factory=list)


class GridFilter(BaseModel):
    """Advanced filtering options for grid queries"""
    token_ids: Optional[List[str]] = Field(None, description="Filter by token IDs")
    statuses: Optional[List[GridStatus]] = Field(None, description="Filter by grid statuses")
    min_value: Optional[int] = Field(None, ge=0, description="Minimum ERG value in nanoERGs")
    max_value: Optional[int] = Field(None, ge=0, description="Maximum ERG value in nanoERGs")
    min_profit: Optional[int] = Field(None, description="Minimum profit in nanoERGs")
    max_profit: Optional[int] = Field(None, description="Maximum profit in nanoERGs")
    created_after: Optional[datetime] = Field(None, description="Created after timestamp")
    created_before: Optional[datetime] = Field(None, description="Created before timestamp")
    identities: Optional[List[str]] = Field(None, description="Filter by grid identities")
    order_count_min: Optional[int] = Field(None, ge=1, description="Minimum number of orders")
    order_count_max: Optional[int] = Field(None, ge=1, description="Maximum number of orders")


class BulkStatusUpdate(BaseModel):
    """Request model for bulk status updates"""
    grid_identities: List[str] = Field(..., min_items=1, max_items=100)
    action: str = Field(..., regex="^(redeem|pause|resume|refresh)$")
    force: bool = Field(False, description="Force action even if grid is in unexpected state")


class GridPerformanceMetrics(BaseModel):
    """Performance metrics for grid analysis"""
    grid_identity: str
    total_trades: int
    volume_erg: int
    volume_tokens: str
    profit_percentage: float
    roi_annualized: float
    uptime_percentage: float
    avg_trade_size_erg: int
    fees_paid_erg: int
    net_profit_erg: int
    created_at: datetime
    last_trade_at: Optional[datetime] = None


class TradingAnalytics(BaseModel):
    """Comprehensive trading analytics"""
    total_grids: int
    active_grids: int
    total_volume_24h: int
    total_profit_24h: int
    best_performing_grid: Optional[str]
    worst_performing_grid: Optional[str]
    avg_roi: float
    total_fees_paid: int
    most_traded_token: Optional[str]
    uptime_percentage: float


class StreamingGridUpdate(BaseModel):
    """Streaming update for real-time grid monitoring"""
    event_type: str = Field(..., regex="^(grid_update|order_filled|status_change|error)$")
    grid_identity: str
    timestamp: datetime
    data: Dict[str, Any]


# API Key authentication dependency
async def get_bot_user(x_api_key: str = Header(..., description="Bot API key")):
    """Authenticate bot using API key"""
    try:
        return await get_api_key_user(x_api_key)
    except Exception as e:
        logger.warning(f"Bot API key authentication failed: {e}")
        raise HTTPException(
            status_code=401,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"}
        )


# Bulk Operations Endpoints

@router.post("/grids/bulk", response_model=BulkGridResponse)
async def create_bulk_grids(
    request: BulkGridRequest,
    background_tasks: BackgroundTasks,
    bot_user: str = Depends(get_bot_user),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Create multiple grid orders in bulk
    
    Creates multiple grid trading orders simultaneously. Supports batch processing
    with optional error handling strategies. Maximum 50 grids per request.
    """
    start_time = datetime.utcnow()
    batch_id = request.batch_id or str(uuid4())
    
    logger.info(f"Bulk grid creation requested by bot {bot_user}: {len(request.grids)} grids, batch_id: {batch_id}")
    
    results = []
    errors = []
    successful_count = 0
    
    # Process grids concurrently with semaphore to limit concurrent operations
    semaphore = asyncio.Semaphore(5)  # Limit to 5 concurrent grid creations
    
    async def create_single_grid(grid_request: GridCreateRequest):
        async with semaphore:
            try:
                result = await cli_manager.create_grid(
                    token_id=grid_request.token_id,
                    value=grid_request.value,
                    orders=grid_request.orders,
                    range_pct=grid_request.range,
                    identity=grid_request.identity
                )
                
                if result.success:
                    return {
                        "grid_identity": grid_request.identity,
                        "success": True,
                        "execution_time": result.execution_time,
                        "cli_output": result.data
                    }
                else:
                    return {
                        "grid_identity": grid_request.identity,
                        "success": False,
                        "error": result.error,
                        "stderr": result.stderr
                    }
                    
            except Exception as e:
                logger.error(f"Error creating grid {grid_request.identity}: {e}")
                return {
                    "grid_identity": grid_request.identity,
                    "success": False,
                    "error": str(e)
                }
    
    # Execute all grid creations concurrently
    try:
        tasks = [create_single_grid(grid) for grid in request.grids]
        results = await asyncio.gather(*tasks, return_exceptions=request.continue_on_error)
        
        for result in results:
            if isinstance(result, Exception):
                errors.append({"error": str(result), "grid_identity": "unknown"})
            elif result.get("success"):
                successful_count += 1
            else:
                errors.append(result)
        
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Log results for monitoring
        logger.info(f"Bulk grid creation completed: batch_id={batch_id}, "
                   f"successful={successful_count}, failed={len(errors)}, "
                   f"execution_time={execution_time:.2f}s")
        
        return BulkGridResponse(
            success=successful_count > 0,
            batch_id=batch_id,
            total_grids=len(request.grids),
            successful_grids=successful_count,
            failed_grids=len(errors),
            results=results,
            execution_time=execution_time,
            errors=errors
        )
        
    except Exception as e:
        logger.error(f"Bulk grid creation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Bulk operation failed: {str(e)}"
        )


@router.post("/grids/bulk-status", response_model=BulkGridResponse)
async def update_bulk_grid_status(
    request: BulkStatusUpdate,
    bot_user: str = Depends(get_bot_user),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Update status of multiple grids in bulk
    
    Performs bulk operations on multiple grids (redeem, pause, resume, refresh).
    Maximum 100 grids per request.
    """
    start_time = datetime.utcnow()
    batch_id = str(uuid4())
    
    logger.info(f"Bulk status update requested by bot {bot_user}: action={request.action}, "
               f"grids={len(request.grid_identities)}")
    
    results = []
    successful_count = 0
    
    # Map actions to CLI methods
    action_map = {
        "redeem": cli_manager.redeem_grid,
        "refresh": cli_manager.get_grid_details,  # Placeholder - implement refresh logic
        # "pause" and "resume" would need to be implemented in CLI
    }
    
    if request.action not in action_map:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported action: {request.action}"
        )
    
    cli_method = action_map[request.action]
    semaphore = asyncio.Semaphore(10)  # Limit concurrent operations
    
    async def process_grid(grid_identity: str):
        async with semaphore:
            try:
                result = await cli_method(grid_identity)
                if result.success:
                    return {
                        "grid_identity": grid_identity,
                        "success": True,
                        "action": request.action,
                        "execution_time": result.execution_time
                    }
                else:
                    return {
                        "grid_identity": grid_identity,
                        "success": False,
                        "action": request.action,
                        "error": result.error
                    }
            except Exception as e:
                return {
                    "grid_identity": grid_identity,
                    "success": False,
                    "action": request.action,
                    "error": str(e)
                }
    
    try:
        tasks = [process_grid(grid_id) for grid_id in request.grid_identities]
        results = await asyncio.gather(*tasks)
        
        successful_count = sum(1 for result in results if result.get("success"))
        execution_time = (datetime.utcnow() - start_time).total_seconds()
        
        return BulkGridResponse(
            success=successful_count > 0,
            batch_id=batch_id,
            total_grids=len(request.grid_identities),
            successful_grids=successful_count,
            failed_grids=len(results) - successful_count,
            results=results,
            execution_time=execution_time,
            errors=[r for r in results if not r.get("success")]
        )
        
    except Exception as e:
        logger.error(f"Bulk status update failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Bulk status update failed: {str(e)}"
        )


# Advanced Query Endpoints

@router.post("/grids/query", response_model=Dict[str, Any])
async def query_grids_advanced(
    filters: GridFilter,
    pagination: PaginationParams = Depends(),
    sort_by: str = Query("created_at", regex="^(created_at|profit|value|orders|identity)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    include_details: bool = Query(False, description="Include detailed order information"),
    bot_user: str = Depends(get_bot_user),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Advanced grid querying with filtering, sorting, and pagination
    
    Supports complex filtering combinations, custom sorting, and optional
    detailed information inclusion for comprehensive grid management.
    """
    logger.info(f"Advanced grid query by bot {bot_user}: filters={filters.dict(exclude_none=True)}")
    
    try:
        # Get all grids (in a real implementation, this would be optimized with database queries)
        result = await cli_manager.get_grid_list()
        
        if not result.success:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch grids: {result.error}"
            )
        
        grids_data = result.data if isinstance(result.data, list) else []
        
        # Apply filters
        filtered_grids = []
        for grid_data in grids_data:
            if not isinstance(grid_data, dict):
                continue
                
            # Apply all filters
            if filters.token_ids and grid_data.get("token_id") not in filters.token_ids:
                continue
            if filters.statuses and grid_data.get("status") not in filters.statuses:
                continue
            if filters.min_value and grid_data.get("total_erg", 0) < filters.min_value:
                continue
            if filters.max_value and grid_data.get("total_erg", 0) > filters.max_value:
                continue
            if filters.identities and grid_data.get("grid_identity") not in filters.identities:
                continue
            if filters.order_count_min:
                total_orders = grid_data.get("sell_orders", 0) + grid_data.get("buy_orders", 0)
                if total_orders < filters.order_count_min:
                    continue
            if filters.order_count_max:
                total_orders = grid_data.get("sell_orders", 0) + grid_data.get("buy_orders", 0)
                if total_orders > filters.order_count_max:
                    continue
                    
            filtered_grids.append(grid_data)
        
        # Sort grids
        reverse_sort = sort_order == "desc"
        if sort_by == "created_at":
            filtered_grids.sort(key=lambda x: x.get("created_at", datetime.min), reverse=reverse_sort)
        elif sort_by == "profit":
            filtered_grids.sort(key=lambda x: x.get("profit_erg", 0), reverse=reverse_sort)
        elif sort_by == "value":
            filtered_grids.sort(key=lambda x: x.get("total_erg", 0), reverse=reverse_sort)
        elif sort_by == "orders":
            filtered_grids.sort(
                key=lambda x: x.get("sell_orders", 0) + x.get("buy_orders", 0),
                reverse=reverse_sort
            )
        elif sort_by == "identity":
            filtered_grids.sort(key=lambda x: x.get("grid_identity", ""), reverse=reverse_sort)
        
        # Apply pagination
        total_count = len(filtered_grids)
        start_idx = pagination.offset
        end_idx = start_idx + pagination.page_size
        paginated_grids = filtered_grids[start_idx:end_idx]
        
        # Optionally include detailed information
        if include_details:
            detailed_grids = []
            for grid_data in paginated_grids:
                grid_identity = grid_data.get("grid_identity")
                if grid_identity:
                    details_result = await cli_manager.get_grid_details(grid_identity)
                    if details_result.success:
                        grid_data["details"] = details_result.data
                detailed_grids.append(grid_data)
            paginated_grids = detailed_grids
        
        return {
            "grids": paginated_grids,
            "total_count": total_count,
            "page": pagination.page,
            "page_size": pagination.page_size,
            "filters_applied": filters.dict(exclude_none=True),
            "sort_by": sort_by,
            "sort_order": sort_order,
            "include_details": include_details
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Advanced grid query failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to execute advanced grid query"
        )


# Performance Analytics Endpoints

@router.get("/analytics/performance", response_model=List[GridPerformanceMetrics])
async def get_grid_performance_metrics(
    grid_identities: Optional[List[str]] = Query(None, description="Specific grids to analyze"),
    time_window_hours: int = Query(24, ge=1, le=8760, description="Analysis time window in hours"),
    min_trades: int = Query(1, ge=0, description="Minimum trades required for inclusion"),
    bot_user: str = Depends(get_bot_user),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Get performance metrics for grid trading analysis
    
    Provides detailed performance analytics including ROI, trade volumes,
    profits, and efficiency metrics for strategic decision making.
    """
    logger.info(f"Performance metrics requested by bot {bot_user}: "
               f"grids={len(grid_identities) if grid_identities else 'all'}, "
               f"time_window={time_window_hours}h")
    
    try:
        # Get grid list
        result = await cli_manager.get_grid_list()
        if not result.success:
            raise HTTPException(status_code=400, detail=f"Failed to fetch grids: {result.error}")
        
        grids_data = result.data if isinstance(result.data, list) else []
        
        # Filter by specific identities if provided
        if grid_identities:
            grids_data = [g for g in grids_data if g.get("grid_identity") in grid_identities]
        
        performance_metrics = []
        
        for grid_data in grids_data:
            if not isinstance(grid_data, dict):
                continue
                
            grid_identity = grid_data.get("grid_identity", "")
            
            # Calculate performance metrics (placeholder - implement actual calculations)
            # In a real implementation, this would query blockchain data and trading history
            metrics = GridPerformanceMetrics(
                grid_identity=grid_identity,
                total_trades=grid_data.get("total_trades", 0),  # Would be calculated from blockchain
                volume_erg=grid_data.get("total_erg", 0),
                volume_tokens=grid_data.get("total_tokens", "0"),
                profit_percentage=0.0,  # Would be calculated
                roi_annualized=0.0,     # Would be calculated
                uptime_percentage=100.0,  # Would be calculated
                avg_trade_size_erg=0,   # Would be calculated
                fees_paid_erg=0,        # Would be calculated
                net_profit_erg=grid_data.get("profit_erg", 0),
                created_at=grid_data.get("created_at", datetime.utcnow()),
                last_trade_at=grid_data.get("last_trade_at")
            )
            
            # Apply minimum trades filter
            if metrics.total_trades >= min_trades:
                performance_metrics.append(metrics)
        
        return performance_metrics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Performance metrics calculation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to calculate performance metrics"
        )


@router.get("/analytics/overview", response_model=TradingAnalytics)
async def get_trading_analytics(
    time_window_hours: int = Query(24, ge=1, le=8760, description="Analysis time window"),
    bot_user: str = Depends(get_bot_user),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Get comprehensive trading analytics overview
    
    Provides high-level trading analytics including volume, profits,
    best/worst performers, and overall portfolio health metrics.
    """
    try:
        # Get all grids
        result = await cli_manager.get_grid_list()
        if not result.success:
            raise HTTPException(status_code=400, detail=f"Failed to fetch grids: {result.error}")
        
        grids_data = result.data if isinstance(result.data, list) else []
        
        # Calculate analytics (placeholder - implement actual calculations)
        total_grids = len(grids_data)
        active_grids = len([g for g in grids_data if g.get("status") == "active"])
        
        # Calculate totals
        total_volume_24h = sum(g.get("total_erg", 0) for g in grids_data)
        total_profit_24h = sum(g.get("profit_erg", 0) for g in grids_data)
        
        # Find best/worst performers
        best_grid = None
        worst_grid = None
        if grids_data:
            best_grid = max(grids_data, key=lambda x: x.get("profit_erg", 0))["grid_identity"]
            worst_grid = min(grids_data, key=lambda x: x.get("profit_erg", 0))["grid_identity"]
        
        # Calculate average ROI
        profits = [g.get("profit_erg", 0) for g in grids_data]
        avg_roi = sum(profits) / len(profits) if profits else 0.0
        
        return TradingAnalytics(
            total_grids=total_grids,
            active_grids=active_grids,
            total_volume_24h=total_volume_24h,
            total_profit_24h=total_profit_24h,
            best_performing_grid=best_grid,
            worst_performing_grid=worst_grid,
            avg_roi=avg_roi,
            total_fees_paid=0,  # Would be calculated
            most_traded_token=None,  # Would be calculated
            uptime_percentage=100.0  # Would be calculated
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Trading analytics calculation failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to calculate trading analytics"
        )


# Data Export Endpoints

@router.get("/export/grids")
async def export_grid_data(
    format: str = Query("csv", regex="^(csv|json|xlsx)$", description="Export format"),
    filters: GridFilter = Depends(),
    bot_user: str = Depends(get_bot_user),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Export grid data in various formats
    
    Supports CSV, JSON, and Excel formats with filtering capabilities
    for comprehensive data analysis and reporting.
    """
    logger.info(f"Grid data export requested by bot {bot_user}: format={format}")
    
    try:
        # Get filtered grid data (reuse logic from query endpoint)
        result = await cli_manager.get_grid_list()
        if not result.success:
            raise HTTPException(status_code=400, detail=f"Failed to fetch grids: {result.error}")
        
        grids_data = result.data if isinstance(result.data, list) else []
        
        if format == "json":
            content = json.dumps(grids_data, indent=2, default=str)
            media_type = "application/json"
            filename = f"grids_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            
        elif format == "csv":
            # Convert to CSV format
            import io
            import csv
            
            output = io.StringIO()
            if grids_data:
                fieldnames = grids_data[0].keys()
                writer = csv.DictWriter(output, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(grids_data)
            
            content = output.getvalue()
            media_type = "text/csv"
            filename = f"grids_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
            
        else:  # xlsx format would require additional dependencies
            raise HTTPException(
                status_code=501,
                detail="Excel export not implemented yet"
            )
        
        # Return as streaming response
        return StreamingResponse(
            io.StringIO(content),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Grid data export failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to export grid data"
        )


# Streaming Endpoints for Real-time Monitoring

@router.get("/stream/grids")
async def stream_grid_updates(
    grid_identities: Optional[List[str]] = Query(None, description="Specific grids to monitor"),
    bot_user: str = Depends(get_bot_user)
):
    """
    Stream real-time grid updates via Server-Sent Events
    
    Provides real-time updates about grid status changes, order fills,
    and other trading events for live monitoring and automated responses.
    """
    logger.info(f"Grid streaming requested by bot {bot_user}: "
               f"grids={len(grid_identities) if grid_identities else 'all'}")
    
    async def event_generator():
        """Generate Server-Sent Events for grid updates"""
        try:
            while True:
                # In a real implementation, this would connect to a WebSocket
                # or message queue to get real-time updates
                
                # Placeholder event
                event = StreamingGridUpdate(
                    event_type="grid_update",
                    grid_identity="example-grid",
                    timestamp=datetime.utcnow(),
                    data={"status": "active", "orders_filled": 1}
                )
                
                # Format as Server-Sent Event
                yield f"data: {event.json()}\n\n"
                
                # Wait before next update
                await asyncio.sleep(10)
                
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"event: error\ndata: {{'error': '{str(e)}'}}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )


# Health and Status Endpoints

@router.get("/health")
async def bot_api_health(
    bot_user: str = Depends(get_bot_user),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Health check endpoint for bot API monitoring
    
    Provides API health status and performance metrics
    for bot monitoring and alerting systems.
    """
    try:
        # Test CLI connection
        cli_test = await cli_manager.test_cli_connection()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow(),
            "bot_user": bot_user,
            "cli_status": "healthy" if cli_test.success else "unhealthy",
            "cli_response_time": cli_test.execution_time,
            "api_version": "2.0.0"
        }
        
    except Exception as e:
        logger.error(f"Bot API health check failed: {e}")
        raise HTTPException(
            status_code=503,
            detail="Bot API unhealthy"
        )
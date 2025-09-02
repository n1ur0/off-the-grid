"""
Grid trading routes for Off the Grid API
"""
import logging
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse

from auth import get_current_user
from cli_manager import get_cli_manager, CLIManager
from models import (
    GridCreateRequest, GridListResponse, GridDetailsResponse, 
    GridSummary, GridOrderDetail, SuccessResponse, ErrorResponse,
    PaginationParams, GridFilterParams
)

logger = logging.getLogger(__name__)

# Create router for grid trading endpoints
router = APIRouter(prefix="/api/v1/grids", tags=["grid-trading"])


@router.get("/", response_model=GridListResponse)
async def list_grids(
    token_id: Optional[str] = Query(None, description="Filter by token ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=500, description="Items per page"),
    current_user: str = Depends(get_current_user),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Get list of grid orders
    
    Returns a paginated list of grid orders, optionally filtered by token ID.
    """
    logger.info(f"Fetching grid list for user: {current_user}, token_id: {token_id}")
    
    try:
        # Execute CLI command to get grid list
        result = await cli_manager.get_grid_list(token_id)
        
        if not result.success:
            logger.error(f"CLI command failed: {result.error}")
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to fetch grid list: {result.error}"
            )
        
        # Parse grid data
        grid_data = result.data if isinstance(result.data, list) else []
        
        # Convert to GridSummary objects
        grids = []
        for item in grid_data:
            try:
                grid = GridSummary(**item)
                grids.append(grid)
            except Exception as e:
                logger.warning(f"Failed to parse grid item: {e}")
                continue
        
        # Apply pagination
        total_count = len(grids)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_grids = grids[start_idx:end_idx]
        
        logger.info(f"Returning {len(paginated_grids)}/{total_count} grids (page {page})")
        
        return GridListResponse(
            grids=paginated_grids,
            total_count=total_count,
            page=page,
            page_size=page_size
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching grids: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while fetching grids"
        )


@router.get("/{grid_identity}", response_model=GridDetailsResponse)
async def get_grid_details(
    grid_identity: str,
    current_user: str = Depends(get_current_user),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Get detailed information about a specific grid order
    
    Returns comprehensive details about a grid order including all individual orders.
    """
    logger.info(f"Fetching grid details for: {grid_identity}, user: {current_user}")
    
    try:
        # Execute CLI command to get grid details
        result = await cli_manager.get_grid_details(grid_identity)
        
        if not result.success:
            if "not found" in result.error.lower():
                raise HTTPException(
                    status_code=404,
                    detail=f"Grid order '{grid_identity}' not found"
                )
            else:
                logger.error(f"CLI command failed: {result.error}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to fetch grid details: {result.error}"
                )
        
        # Parse grid details
        details_data = result.data
        if not details_data:
            raise HTTPException(
                status_code=404,
                detail=f"Grid order '{grid_identity}' not found"
            )
        
        # Convert to structured response
        # Note: The exact structure depends on the CLI output format
        if isinstance(details_data, list):
            # List of order details
            orders = [GridOrderDetail(**order) for order in details_data]
            
            # Create a summary (we'd need to get this from the list endpoint)
            summary = GridSummary(
                grid_identity=grid_identity,
                token_id="",  # Would need to be filled from actual data
                sell_orders=len([o for o in orders if o.order_type == "Sell"]),
                buy_orders=len([o for o in orders if o.order_type == "Buy"]),
                bid_price="",
                ask_price="",
                profit_erg=0,
                profit_token="",
                total_erg=0,
                total_tokens=""
            )
        else:
            # Handle other response formats
            orders = []
            summary = GridSummary(**details_data) if isinstance(details_data, dict) else None
        
        return GridDetailsResponse(
            grid_identity=grid_identity,
            token_id=summary.token_id if summary else "",
            orders=orders,
            summary=summary,
            raw_data=details_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching grid details: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while fetching grid details"
        )


@router.post("/", response_model=SuccessResponse)
async def create_grid(
    grid_request: GridCreateRequest,
    current_user: str = Depends(get_current_user),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Create a new grid trading order
    
    Creates a new grid order with the specified parameters. This operation
    interacts with the blockchain and may take some time to complete.
    """
    logger.info(f"Creating grid for user: {current_user}, identity: {grid_request.identity}")
    
    try:
        # Execute CLI command to create grid
        result = await cli_manager.create_grid(
            token_id=grid_request.token_id,
            value=grid_request.value,
            orders=grid_request.orders,
            range_pct=grid_request.range,
            identity=grid_request.identity
        )
        
        if not result.success:
            logger.error(f"Grid creation failed: {result.error}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to create grid: {result.error}"
            )
        
        logger.info(f"Grid created successfully: {grid_request.identity}")
        
        return SuccessResponse(
            success=True,
            message=f"Grid '{grid_request.identity}' created successfully",
            data={
                "grid_identity": grid_request.identity,
                "token_id": grid_request.token_id,
                "execution_time": result.execution_time,
                "cli_output": result.data
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error creating grid: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while creating grid"
        )


@router.delete("/{grid_identity}", response_model=SuccessResponse)
async def redeem_grid(
    grid_identity: str,
    current_user: str = Depends(get_current_user),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Redeem (close) a grid trading order
    
    Redeems the specified grid order, returning all funds to the wallet.
    This operation interacts with the blockchain and may take some time.
    """
    logger.info(f"Redeeming grid: {grid_identity}, user: {current_user}")
    
    try:
        # Execute CLI command to redeem grid
        result = await cli_manager.redeem_grid(grid_identity)
        
        if not result.success:
            if "not found" in result.error.lower():
                raise HTTPException(
                    status_code=404,
                    detail=f"Grid order '{grid_identity}' not found"
                )
            else:
                logger.error(f"Grid redemption failed: {result.error}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to redeem grid: {result.error}"
                )
        
        logger.info(f"Grid redeemed successfully: {grid_identity}")
        
        return SuccessResponse(
            success=True,
            message=f"Grid '{grid_identity}' redeemed successfully",
            data={
                "grid_identity": grid_identity,
                "execution_time": result.execution_time,
                "cli_output": result.data
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error redeeming grid: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while redeeming grid"
        )
"""
Token information routes for Off the Grid API
"""
import logging
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks

from auth import get_current_user, get_current_user_optional
from cli_manager import get_cli_manager, CLIManager
from models import TokenInfo, TokenListResponse, SuccessResponse

logger = logging.getLogger(__name__)

# Create router for token endpoints
router = APIRouter(prefix="/api/v1/tokens", tags=["tokens"])


@router.get("/", response_model=TokenListResponse)
async def list_tokens(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(100, ge=1, le=1000, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name or symbol"),
    current_user: Optional[str] = Depends(get_current_user_optional),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Get list of available tokens
    
    Returns information about tokens available for grid trading.
    This endpoint doesn't require authentication for basic token info.
    """
    logger.info(f"Fetching token list, user: {current_user or 'anonymous'}")
    
    try:
        # Execute CLI command to get token list
        result = await cli_manager.get_tokens()
        
        if not result.success:
            logger.error(f"CLI command failed: {result.error}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch token list: {result.error}"
            )
        
        # Parse token data
        token_data = result.data if isinstance(result.data, list) else []
        
        # Convert to TokenInfo objects
        tokens = []
        for item in token_data:
            try:
                if isinstance(item, dict):
                    # Map CLI output to TokenInfo model
                    token_info = TokenInfo(
                        token_id=item.get("token_id", ""),
                        name=item.get("name"),
                        symbol=item.get("symbol"),
                        decimals=item.get("decimals"),
                        description=item.get("description"),
                        logo_url=item.get("logo_url")
                    )
                    tokens.append(token_info)
            except Exception as e:
                logger.warning(f"Failed to parse token item: {e}")
                continue
        
        # Apply search filter
        if search:
            search_lower = search.lower()
            tokens = [
                token for token in tokens
                if (token.name and search_lower in token.name.lower()) or
                   (token.symbol and search_lower in token.symbol.lower()) or
                   (token.token_id and search_lower in token.token_id.lower())
            ]
        
        # Apply pagination
        total_count = len(tokens)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_tokens = tokens[start_idx:end_idx]
        
        logger.info(f"Returning {len(paginated_tokens)}/{total_count} tokens (page {page})")
        
        return TokenListResponse(
            tokens=paginated_tokens,
            total_count=total_count
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching tokens: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while fetching tokens"
        )


@router.get("/{token_id}", response_model=TokenInfo)
async def get_token_info(
    token_id: str,
    current_user: Optional[str] = Depends(get_current_user_optional),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Get information about a specific token
    
    Returns detailed information about a specific token by its ID.
    """
    logger.info(f"Fetching token info for: {token_id}")
    
    try:
        # Get all tokens and find the specific one
        result = await cli_manager.get_tokens()
        
        if not result.success:
            logger.error(f"CLI command failed: {result.error}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch token info: {result.error}"
            )
        
        # Parse token data and find the requested token
        token_data = result.data if isinstance(result.data, list) else []
        
        for item in token_data:
            if isinstance(item, dict) and item.get("token_id") == token_id:
                return TokenInfo(
                    token_id=item.get("token_id", ""),
                    name=item.get("name"),
                    symbol=item.get("symbol"),
                    decimals=item.get("decimals"),
                    description=item.get("description"),
                    logo_url=item.get("logo_url")
                )
        
        # Token not found
        raise HTTPException(
            status_code=404,
            detail=f"Token '{token_id}' not found"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching token info: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while fetching token info"
        )


@router.post("/update", response_model=SuccessResponse)
async def update_token_info(
    background_tasks: BackgroundTasks,
    current_user: str = Depends(get_current_user),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Update token information from Spectrum pools
    
    Triggers an update of token information from Spectrum AMM pools.
    This operation runs in the background and may take some time.
    Requires authentication.
    """
    logger.info(f"Updating token info, requested by user: {current_user}")
    
    async def update_tokens():
        """Background task to update tokens"""
        try:
            result = await cli_manager.update_tokens()
            if result.success:
                logger.info("Token update completed successfully")
            else:
                logger.error(f"Token update failed: {result.error}")
        except Exception as e:
            logger.error(f"Token update error: {e}")
    
    # Add the update task to background tasks
    background_tasks.add_task(update_tokens)
    
    return SuccessResponse(
        success=True,
        message="Token update started in background",
        data={"requested_by": current_user}
    )


@router.get("/stats/summary")
async def get_token_stats(
    current_user: Optional[str] = Depends(get_current_user_optional),
    cli_manager: CLIManager = Depends(get_cli_manager)
):
    """
    Get summary statistics about available tokens
    
    Returns aggregate statistics about tokens available for grid trading.
    """
    try:
        # Get token list
        result = await cli_manager.get_tokens()
        
        if not result.success:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch token stats: {result.error}"
            )
        
        token_data = result.data if isinstance(result.data, list) else []
        
        # Calculate stats
        total_tokens = len(token_data)
        tokens_with_names = sum(1 for item in token_data if isinstance(item, dict) and item.get("name"))
        tokens_with_symbols = sum(1 for item in token_data if isinstance(item, dict) and item.get("symbol"))
        
        return {
            "total_tokens": total_tokens,
            "tokens_with_names": tokens_with_names,
            "tokens_with_symbols": tokens_with_symbols,
            "completion_percentage": {
                "names": round((tokens_with_names / total_tokens * 100) if total_tokens > 0 else 0, 2),
                "symbols": round((tokens_with_symbols / total_tokens * 100) if total_tokens > 0 else 0, 2)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching token stats: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while fetching token stats"
        )
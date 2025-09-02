"""
Authentication routes for Off the Grid API
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Response, Cookie, Depends
from fastapi.responses import JSONResponse

from auth import get_auth_manager, AuthManager, get_current_user
from models import WalletAuthRequest, AuthResponse, SuccessResponse

logger = logging.getLogger(__name__)

# Create router for authentication endpoints
router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


@router.post("/login", response_model=AuthResponse)
async def login(
    auth_request: WalletAuthRequest, 
    response: Response,
    auth_manager: AuthManager = Depends(get_auth_manager)
):
    """
    Authenticate user with wallet signature
    
    This endpoint verifies the wallet signature and returns a JWT token
    for subsequent API calls. The token is also set as an HTTP-only cookie.
    """
    logger.info(f"Login attempt for wallet: {auth_request.wallet_address}")
    
    try:
        # Authenticate the request
        auth_response = await auth_manager.authenticate_request(auth_request)
        
        # Set HTTP-only cookie for browser clients
        if auth_response.access_token:
            response.set_cookie(
                key="access_token",
                value=auth_response.access_token,
                httponly=True,
                secure=True,  # Use secure cookies in production
                samesite="strict",
                max_age=auth_response.expires_in
            )
        
        logger.info(f"Successful login for wallet: {auth_request.wallet_address}")
        return auth_response
        
    except HTTPException:
        logger.warning(f"Failed login attempt for wallet: {auth_request.wallet_address}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during login: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during authentication"
        )


@router.post("/logout", response_model=SuccessResponse)
async def logout(
    response: Response,
    current_user: str = Depends(get_current_user)
):
    """
    Logout current user
    
    This endpoint clears the authentication cookie and invalidates the session.
    """
    logger.info(f"Logout for wallet: {current_user}")
    
    # Clear the authentication cookie
    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=True,
        samesite="strict"
    )
    
    return SuccessResponse(
        success=True,
        message="Successfully logged out",
        data={"wallet_address": current_user}
    )


@router.get("/me", response_model=dict)
async def get_current_user_info(
    current_user: str = Depends(get_current_user)
):
    """
    Get current user information
    
    Returns information about the currently authenticated user.
    """
    return {
        "wallet_address": current_user,
        "authenticated": True,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/verify", response_model=dict)
async def verify_token(
    current_user: str = Depends(get_current_user)
):
    """
    Verify authentication token
    
    This endpoint can be used by clients to verify if their token is still valid.
    """
    return {
        "valid": True,
        "wallet_address": current_user,
        "timestamp": datetime.utcnow().isoformat()
    }
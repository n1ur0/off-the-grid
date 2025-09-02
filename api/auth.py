"""
Authentication system for Off the Grid API
Handles wallet-based authentication with JWT tokens
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

from config import get_settings
from models import WalletAuthRequest, AuthResponse

logger = logging.getLogger(__name__)

# Security setup
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthManager:
    """Authentication manager for wallet-based auth and JWT tokens"""
    
    def __init__(self):
        self.settings = get_settings()
        self.secret_key = self.settings.secret_key
        self.algorithm = self.settings.algorithm
        self.access_token_expire_minutes = self.settings.access_token_expire_minutes
    
    async def verify_wallet_signature(
        self, 
        wallet_address: str, 
        message: str, 
        signature: str
    ) -> bool:
        """
        Verify Ergo wallet signature
        
        TODO: Implement actual signature verification using ergo-lib
        This is currently a placeholder implementation
        """
        logger.info(f"Verifying signature for wallet: {wallet_address}")
        
        # Basic validation checks
        if not wallet_address or not message or not signature:
            logger.warning("Missing required fields for signature verification")
            return False
        
        # Validate wallet address format (Ergo P2PK addresses start with '9')
        if not wallet_address.startswith('9') or len(wallet_address) != 51:
            logger.warning(f"Invalid wallet address format: {wallet_address}")
            return False
        
        # TODO: Replace this placeholder with actual ergo-lib signature verification
        # For now, we accept any non-empty signature
        # Real implementation would:
        # 1. Parse the signature hex string
        # 2. Recover the public key from wallet address
        # 3. Verify signature against message using ergo-lib
        
        if len(signature) < 10:  # Minimum reasonable signature length
            logger.warning("Signature too short")
            return False
        
        # Placeholder verification - replace with actual implementation
        is_valid = len(signature) > 0 and len(wallet_address) == 51
        
        logger.info(f"Signature verification result for {wallet_address}: {is_valid}")
        return is_valid
    
    def create_access_token(self, wallet_address: str) -> str:
        """Create JWT access token for authenticated wallet"""
        expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        
        payload = {
            "wallet_address": wallet_address,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access",
            "iss": "off-the-grid-api",
            "sub": wallet_address
        }
        
        token = jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
        logger.info(f"Created access token for wallet: {wallet_address}")
        
        return token
    
    def verify_token(self, token: str) -> Optional[str]:
        """Verify JWT token and return wallet address if valid"""
        try:
            payload = jwt.decode(
                token, 
                self.secret_key, 
                algorithms=[self.algorithm],
                options={"verify_exp": True, "verify_iat": True}
            )
            
            wallet_address: str = payload.get("wallet_address")
            token_type: str = payload.get("type")
            
            if not wallet_address or token_type != "access":
                logger.warning("Invalid token payload")
                return None
            
            logger.debug(f"Token verified for wallet: {wallet_address}")
            return wallet_address
            
        except JWTError as e:
            logger.warning(f"JWT verification failed: {str(e)}")
            return None
    
    def create_refresh_token(self, wallet_address: str) -> str:
        """Create a refresh token (longer lived)"""
        expire = datetime.utcnow() + timedelta(days=30)  # 30 days
        
        payload = {
            "wallet_address": wallet_address,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "refresh",
            "iss": "off-the-grid-api",
            "sub": wallet_address
        }
        
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def verify_refresh_token(self, token: str) -> Optional[str]:
        """Verify refresh token and return wallet address if valid"""
        try:
            payload = jwt.decode(
                token, 
                self.secret_key, 
                algorithms=[self.algorithm]
            )
            
            wallet_address: str = payload.get("wallet_address")
            token_type: str = payload.get("type")
            
            if not wallet_address or token_type != "refresh":
                return None
            
            return wallet_address
            
        except JWTError:
            return None
    
    async def authenticate_request(self, auth_request: WalletAuthRequest) -> AuthResponse:
        """Authenticate wallet signature and return tokens"""
        # Verify the wallet signature
        is_valid = await self.verify_wallet_signature(
            auth_request.wallet_address,
            auth_request.message,
            auth_request.signature
        )
        
        if not is_valid:
            raise HTTPException(
                status_code=401, 
                detail="Invalid wallet signature"
            )
        
        # Create tokens
        access_token = self.create_access_token(auth_request.wallet_address)
        
        return AuthResponse(
            success=True,
            wallet_address=auth_request.wallet_address,
            access_token=access_token,
            expires_in=self.access_token_expire_minutes * 60
        )


# Global auth manager instance
_auth_manager: Optional[AuthManager] = None


def get_auth_manager() -> AuthManager:
    """Get or create auth manager instance"""
    global _auth_manager
    if _auth_manager is None:
        _auth_manager = AuthManager()
    return _auth_manager


# FastAPI dependency for authentication
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_manager: AuthManager = Depends(get_auth_manager)
) -> str:
    """FastAPI dependency to get current authenticated user"""
    wallet_address = auth_manager.verify_token(credentials.credentials)
    
    if wallet_address is None:
        raise HTTPException(
            status_code=401, 
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return wallet_address


# Optional authentication dependency (doesn't raise error if not authenticated)
async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
    auth_manager: AuthManager = Depends(get_auth_manager)
) -> Optional[str]:
    """FastAPI dependency for optional authentication"""
    if credentials is None:
        return None
    
    return auth_manager.verify_token(credentials.credentials)
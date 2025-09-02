"""
Certification management and security module for Off the Grid platform.
Implements cryptographic certificate generation, validation, and management.

Security Features:
- Cryptographic signing of certificates using ECDSA
- Time-limited certificates with automatic expiration
- Certificate revocation support
- Tamper detection through digital signatures
- Secure storage with encryption at rest
- Audit logging for all certificate operations
"""

import logging
import json
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Any
from uuid import UUID, uuid4
from dataclasses import dataclass, asdict
from enum import Enum

from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidSignature
import jwt
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

from database import UserActivity
from config import CERTIFICATE_SIGNING_KEY, CERTIFICATE_ENCRYPTION_KEY

logger = logging.getLogger(__name__)

class CertificateStatus(Enum):
    VALID = "valid"
    EXPIRED = "expired"
    REVOKED = "revoked"
    SUSPENDED = "suspended"

class CompetencyLevel(Enum):
    RESTRICTED = "restricted"
    BASIC = "basic"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"

@dataclass
class CertificateMetadata:
    """Metadata for certificate generation and validation."""
    user_id: str
    wallet_address: str
    competency_level: CompetencyLevel
    educational_scores: Dict[str, float]
    practice_session_count: int
    practice_total_hours: float
    practice_quality_score: float
    risk_assessment_score: float
    assessment_date: datetime
    issuing_authority: str = "Off the Grid Platform"
    certificate_version: str = "2.0"

@dataclass
class TradingRestriction:
    """Trading restriction definition."""
    type: str  # positionSize, tradingPair, feature, timeLimit
    description: str
    limit_value: str
    expires_at: Optional[datetime] = None

@dataclass
class SecureCertificate:
    """Secure certificate with cryptographic proof."""
    certificate_id: str
    user_id: str
    wallet_address: str
    competency_level: CompetencyLevel
    issued_at: datetime
    expires_at: datetime
    restrictions: List[TradingRestriction]
    metadata: CertificateMetadata
    digital_signature: str
    certificate_hash: str
    version: str = "2.0"
    status: CertificateStatus = CertificateStatus.VALID

@dataclass
class CertificateValidationResult:
    """Result of certificate validation."""
    is_valid: bool
    status: CertificateStatus
    expires_at: Optional[datetime] = None
    time_until_expiry_minutes: Optional[int] = None
    errors: List[str] = None
    warnings: List[str] = None
    restrictions: List[TradingRestriction] = None

class CertificationManager:
    """Manages certificate lifecycle with cryptographic security."""
    
    def __init__(self, db: Session):
        self.db = db
        self.backend = default_backend()
        self.certificate_validity_days = 90
        self.renewal_warning_days = 7
        
        # Initialize cryptographic keys
        self._init_crypto_keys()
    
    def _init_crypto_keys(self):
        """Initialize cryptographic keys for signing and encryption."""
        try:
            # In production, load these from secure key management system
            self.signing_key = ec.generate_private_key(ec.SECP256R1(), self.backend)
            self.verification_key = self.signing_key.public_key()
            
            # Encryption key for certificate storage
            self.encryption_key = secrets.token_bytes(32)  # 256-bit AES key
            
        except Exception as e:
            logger.error(f"Failed to initialize cryptographic keys: {e}")
            raise
    
    def generate_certificate(self, metadata: CertificateMetadata) -> SecureCertificate:
        """Generate a new secure certificate with cryptographic proof."""
        try:
            # Generate unique certificate ID
            certificate_id = self._generate_certificate_id()
            
            # Determine restrictions based on competency level
            restrictions = self._determine_restrictions(metadata.competency_level)
            
            # Create certificate data structure
            issued_at = datetime.now(timezone.utc)
            expires_at = issued_at + timedelta(days=self.certificate_validity_days)
            
            certificate_data = {
                'certificate_id': certificate_id,
                'user_id': metadata.user_id,
                'wallet_address': metadata.wallet_address,
                'competency_level': metadata.competency_level.value,
                'issued_at': issued_at.isoformat(),
                'expires_at': expires_at.isoformat(),
                'restrictions': [asdict(r) for r in restrictions],
                'metadata': asdict(metadata),
                'version': metadata.certificate_version
            }
            
            # Generate cryptographic hash
            certificate_hash = self._generate_certificate_hash(certificate_data)
            
            # Generate digital signature
            digital_signature = self._sign_certificate(certificate_data)
            
            # Create secure certificate
            certificate = SecureCertificate(
                certificate_id=certificate_id,
                user_id=metadata.user_id,
                wallet_address=metadata.wallet_address,
                competency_level=metadata.competency_level,
                issued_at=issued_at,
                expires_at=expires_at,
                restrictions=restrictions,
                metadata=metadata,
                digital_signature=digital_signature,
                certificate_hash=certificate_hash,
                version=metadata.certificate_version,
                status=CertificateStatus.VALID
            )
            
            # Store certificate securely
            self._store_certificate(certificate)
            
            # Log certificate generation
            self._log_certificate_operation(
                user_id=UUID(metadata.user_id),
                operation='certificate_generated',
                certificate_id=certificate_id,
                details={
                    'competency_level': metadata.competency_level.value,
                    'restrictions_count': len(restrictions),
                    'expires_at': expires_at.isoformat()
                }
            )
            
            return certificate
            
        except Exception as e:
            logger.error(f"Certificate generation failed for user {metadata.user_id}: {e}")
            raise
    
    def validate_certificate(self, certificate_data: str, 
                           check_expiry: bool = True,
                           check_revocation: bool = True) -> CertificateValidationResult:
        """Validate certificate with comprehensive security checks."""
        try:
            # Parse certificate data
            try:
                certificate = self._parse_certificate(certificate_data)
            except Exception as e:
                return CertificateValidationResult(
                    is_valid=False,
                    status=CertificateStatus.REVOKED,
                    errors=[f"Certificate parsing failed: {str(e)}"]
                )
            
            errors = []
            warnings = []
            
            # Verify digital signature
            if not self._verify_signature(certificate):
                errors.append("Digital signature verification failed")
            
            # Verify certificate hash
            if not self._verify_certificate_hash(certificate):
                errors.append("Certificate hash verification failed")
            
            # Check expiry
            current_time = datetime.now(timezone.utc)
            if check_expiry and current_time > certificate.expires_at:
                errors.append("Certificate has expired")
                certificate.status = CertificateStatus.EXPIRED
            
            # Check renewal warning period
            warning_threshold = certificate.expires_at - timedelta(days=self.renewal_warning_days)
            if current_time > warning_threshold:
                warnings.append(f"Certificate expires in {self.renewal_warning_days} days")
            
            # Check revocation status
            if check_revocation and self._is_certificate_revoked(certificate.certificate_id):
                errors.append("Certificate has been revoked")
                certificate.status = CertificateStatus.REVOKED
            
            # Check certificate version compatibility
            if not self._is_version_supported(certificate.version):
                warnings.append(f"Certificate version {certificate.version} is deprecated")
            
            # Calculate time until expiry
            time_until_expiry = None
            if certificate.expires_at > current_time:
                time_until_expiry = int((certificate.expires_at - current_time).total_seconds() / 60)
            
            is_valid = len(errors) == 0
            
            # Log validation attempt
            self._log_certificate_operation(
                user_id=UUID(certificate.user_id),
                operation='certificate_validated',
                certificate_id=certificate.certificate_id,
                details={
                    'validation_result': is_valid,
                    'errors_count': len(errors),
                    'warnings_count': len(warnings),
                    'status': certificate.status.value
                }
            )
            
            return CertificateValidationResult(
                is_valid=is_valid,
                status=certificate.status,
                expires_at=certificate.expires_at,
                time_until_expiry_minutes=time_until_expiry,
                errors=errors if errors else None,
                warnings=warnings if warnings else None,
                restrictions=certificate.restrictions
            )
            
        except Exception as e:
            logger.error(f"Certificate validation failed: {e}")
            return CertificateValidationResult(
                is_valid=False,
                status=CertificateStatus.REVOKED,
                errors=[f"Validation process failed: {str(e)}"]
            )
    
    def revoke_certificate(self, certificate_id: str, reason: str, 
                          revoked_by: str) -> bool:
        """Revoke a certificate with audit logging."""
        try:
            # Check if certificate exists
            certificate = self._get_stored_certificate(certificate_id)
            if not certificate:
                logger.warning(f"Attempted to revoke non-existent certificate: {certificate_id}")
                return False
            
            # Add to revocation list
            revocation_data = {
                'certificate_id': certificate_id,
                'revoked_at': datetime.now(timezone.utc).isoformat(),
                'reason': reason,
                'revoked_by': revoked_by
            }
            
            self._store_revocation(revocation_data)
            
            # Log revocation
            self._log_certificate_operation(
                user_id=UUID(certificate['user_id']),
                operation='certificate_revoked',
                certificate_id=certificate_id,
                details={
                    'reason': reason,
                    'revoked_by': revoked_by
                }
            )
            
            logger.info(f"Certificate {certificate_id} revoked by {revoked_by}: {reason}")
            return True
            
        except Exception as e:
            logger.error(f"Certificate revocation failed for {certificate_id}: {e}")
            return False
    
    def renew_certificate(self, old_certificate_id: str, 
                         new_metadata: CertificateMetadata) -> SecureCertificate:
        """Renew an existing certificate with updated competency data."""
        try:
            # Validate old certificate exists and belongs to user
            old_cert = self._get_stored_certificate(old_certificate_id)
            if not old_cert or old_cert['user_id'] != new_metadata.user_id:
                raise ValueError("Invalid certificate for renewal")
            
            # Generate new certificate
            new_certificate = self.generate_certificate(new_metadata)
            
            # Mark old certificate as superseded
            self._mark_certificate_superseded(old_certificate_id, new_certificate.certificate_id)
            
            # Log renewal
            self._log_certificate_operation(
                user_id=UUID(new_metadata.user_id),
                operation='certificate_renewed',
                certificate_id=new_certificate.certificate_id,
                details={
                    'old_certificate_id': old_certificate_id,
                    'competency_level': new_metadata.competency_level.value
                }
            )
            
            return new_certificate
            
        except Exception as e:
            logger.error(f"Certificate renewal failed for {old_certificate_id}: {e}")
            raise
    
    def get_user_certificates(self, user_id: str, 
                             include_revoked: bool = False) -> List[SecureCertificate]:
        """Get all certificates for a user."""
        try:
            user_uuid = UUID(user_id)
            
            # Query certificates from storage
            certificates = self._get_user_certificates_from_storage(user_uuid, include_revoked)
            
            return certificates
            
        except Exception as e:
            logger.error(f"Failed to retrieve certificates for user {user_id}: {e}")
            return []
    
    def get_certificate_analytics(self, user_id: str) -> Dict[str, Any]:
        """Get analytics data for user's certification history."""
        try:
            user_uuid = UUID(user_id)
            
            # Get all certificate operations
            activities = self.db.query(UserActivity).filter(
                UserActivity.user_id == user_uuid,
                UserActivity.activity_type.in_([
                    'certificate_generated', 'certificate_validated', 
                    'certificate_revoked', 'certificate_renewed'
                ])
            ).order_by(desc(UserActivity.created_at)).all()
            
            # Calculate analytics
            total_certificates = len([a for a in activities if a.activity_type == 'certificate_generated'])
            validation_attempts = len([a for a in activities if a.activity_type == 'certificate_validated'])
            revoked_certificates = len([a for a in activities if a.activity_type == 'certificate_revoked'])
            renewed_certificates = len([a for a in activities if a.activity_type == 'certificate_renewed'])
            
            # Get current competency level
            current_cert = self._get_current_certificate(user_uuid)
            current_level = current_cert.competency_level.value if current_cert else 'none'
            
            return {
                'total_certificates_issued': total_certificates,
                'validation_attempts': validation_attempts,
                'revoked_certificates': revoked_certificates,
                'renewed_certificates': renewed_certificates,
                'current_competency_level': current_level,
                'first_certified_at': activities[-1].created_at.isoformat() if activities else None,
                'last_activity_at': activities[0].created_at.isoformat() if activities else None
            }
            
        except Exception as e:
            logger.error(f"Failed to generate certificate analytics for user {user_id}: {e}")
            return {}
    
    # Private helper methods
    
    def _generate_certificate_id(self) -> str:
        """Generate unique certificate ID."""
        timestamp = int(datetime.now().timestamp())
        random_suffix = secrets.token_hex(8)
        return f"cert_{timestamp}_{random_suffix}"
    
    def _determine_restrictions(self, level: CompetencyLevel) -> List[TradingRestriction]:
        """Determine trading restrictions based on competency level."""
        restrictions = []
        
        if level == CompetencyLevel.RESTRICTED:
            restrictions.append(TradingRestriction(
                type='feature',
                description='Live trading disabled - complete requirements first',
                limit_value='none'
            ))
        elif level == CompetencyLevel.BASIC:
            restrictions.extend([
                TradingRestriction(
                    type='positionSize',
                    description='Maximum position size per grid order',
                    limit_value='10 ERG'
                ),
                TradingRestriction(
                    type='feature',
                    description='Advanced grid strategies disabled',
                    limit_value='basic_only'
                )
            ])
        elif level == CompetencyLevel.INTERMEDIATE:
            restrictions.append(TradingRestriction(
                type='positionSize',
                description='Maximum position size per grid order',
                limit_value='50 ERG'
            ))
        elif level == CompetencyLevel.ADVANCED:
            restrictions.append(TradingRestriction(
                type='positionSize',
                description='Maximum position size per grid order',
                limit_value='200 ERG'
            ))
        # EXPERT level has no restrictions
        
        return restrictions
    
    def _generate_certificate_hash(self, certificate_data: Dict) -> str:
        """Generate cryptographic hash of certificate data."""
        # Sort keys for consistent hashing
        sorted_data = json.dumps(certificate_data, sort_keys=True)
        return hashlib.sha256(sorted_data.encode()).hexdigest()
    
    def _sign_certificate(self, certificate_data: Dict) -> str:
        """Generate digital signature for certificate."""
        try:
            # Create message to sign
            message = json.dumps(certificate_data, sort_keys=True).encode()
            
            # Sign with private key
            signature = self.signing_key.sign(message, ec.ECDSA(hashes.SHA256()))
            
            # Return base64 encoded signature
            import base64
            return base64.b64encode(signature).decode()
            
        except Exception as e:
            logger.error(f"Certificate signing failed: {e}")
            raise
    
    def _verify_signature(self, certificate: SecureCertificate) -> bool:
        """Verify digital signature of certificate."""
        try:
            # Reconstruct original data
            certificate_data = {
                'certificate_id': certificate.certificate_id,
                'user_id': certificate.user_id,
                'wallet_address': certificate.wallet_address,
                'competency_level': certificate.competency_level.value,
                'issued_at': certificate.issued_at.isoformat(),
                'expires_at': certificate.expires_at.isoformat(),
                'restrictions': [asdict(r) for r in certificate.restrictions],
                'metadata': asdict(certificate.metadata),
                'version': certificate.version
            }
            
            message = json.dumps(certificate_data, sort_keys=True).encode()
            
            # Decode signature
            import base64
            signature = base64.b64decode(certificate.digital_signature.encode())
            
            # Verify signature
            self.verification_key.verify(signature, message, ec.ECDSA(hashes.SHA256()))
            return True
            
        except InvalidSignature:
            return False
        except Exception as e:
            logger.error(f"Signature verification failed: {e}")
            return False
    
    def _verify_certificate_hash(self, certificate: SecureCertificate) -> bool:
        """Verify certificate hash integrity."""
        try:
            certificate_data = {
                'certificate_id': certificate.certificate_id,
                'user_id': certificate.user_id,
                'wallet_address': certificate.wallet_address,
                'competency_level': certificate.competency_level.value,
                'issued_at': certificate.issued_at.isoformat(),
                'expires_at': certificate.expires_at.isoformat(),
                'restrictions': [asdict(r) for r in certificate.restrictions],
                'metadata': asdict(certificate.metadata),
                'version': certificate.version
            }
            
            computed_hash = self._generate_certificate_hash(certificate_data)
            return computed_hash == certificate.certificate_hash
            
        except Exception as e:
            logger.error(f"Hash verification failed: {e}")
            return False
    
    def _parse_certificate(self, certificate_data: str) -> SecureCertificate:
        """Parse certificate from encoded string."""
        try:
            # Decode certificate (in production, this would be more sophisticated)
            import base64
            decoded = base64.b64decode(certificate_data)
            cert_dict = json.loads(decoded.decode())
            
            # Convert to SecureCertificate object
            certificate = SecureCertificate(
                certificate_id=cert_dict['certificate_id'],
                user_id=cert_dict['user_id'],
                wallet_address=cert_dict['wallet_address'],
                competency_level=CompetencyLevel(cert_dict['competency_level']),
                issued_at=datetime.fromisoformat(cert_dict['issued_at']),
                expires_at=datetime.fromisoformat(cert_dict['expires_at']),
                restrictions=[
                    TradingRestriction(**r) for r in cert_dict['restrictions']
                ],
                metadata=CertificateMetadata(**cert_dict['metadata']),
                digital_signature=cert_dict['digital_signature'],
                certificate_hash=cert_dict['certificate_hash'],
                version=cert_dict['version'],
                status=CertificateStatus(cert_dict.get('status', 'valid'))
            )
            
            return certificate
            
        except Exception as e:
            logger.error(f"Certificate parsing failed: {e}")
            raise ValueError(f"Invalid certificate format: {str(e)}")
    
    def _is_certificate_revoked(self, certificate_id: str) -> bool:
        """Check if certificate is in revocation list."""
        # In production, query revocation database
        revocation_activity = self.db.query(UserActivity).filter(
            UserActivity.activity_type == 'certificate_revoked',
            UserActivity.metadata.contains({'certificate_id': certificate_id})
        ).first()
        
        return revocation_activity is not None
    
    def _is_version_supported(self, version: str) -> bool:
        """Check if certificate version is supported."""
        supported_versions = ['1.0', '2.0']
        return version in supported_versions
    
    def _store_certificate(self, certificate: SecureCertificate):
        """Store certificate securely in database."""
        # Serialize certificate data
        cert_data = {
            'certificate_id': certificate.certificate_id,
            'user_id': certificate.user_id,
            'wallet_address': certificate.wallet_address,
            'competency_level': certificate.competency_level.value,
            'issued_at': certificate.issued_at.isoformat(),
            'expires_at': certificate.expires_at.isoformat(),
            'restrictions': [asdict(r) for r in certificate.restrictions],
            'metadata': asdict(certificate.metadata),
            'digital_signature': certificate.digital_signature,
            'certificate_hash': certificate.certificate_hash,
            'version': certificate.version,
            'status': certificate.status.value
        }
        
        # Encrypt certificate data
        encrypted_data = self._encrypt_certificate_data(cert_data)
        
        # Store as user activity (in production, use dedicated certificates table)
        activity = UserActivity(
            user_id=UUID(certificate.user_id),
            activity_type='certificate_stored',
            activity_description=f'Certificate stored: {certificate.competency_level.value}',
            resource_type='certificate',
            metadata={
                'certificate_id': certificate.certificate_id,
                'competency_level': certificate.competency_level.value,
                'expires_at': certificate.expires_at.isoformat(),
                'encrypted_data': encrypted_data
            }
        )
        
        self.db.add(activity)
        self.db.commit()
    
    def _encrypt_certificate_data(self, data: Dict) -> str:
        """Encrypt certificate data for secure storage."""
        try:
            # Convert to JSON
            json_data = json.dumps(data)
            
            # Generate random IV
            iv = secrets.token_bytes(16)
            
            # Encrypt with AES-256-CBC
            cipher = Cipher(algorithms.AES(self.encryption_key), modes.CBC(iv), backend=self.backend)
            encryptor = cipher.encryptor()
            
            # Pad data to block size
            padded_data = self._pad_data(json_data.encode())
            encrypted = encryptor.update(padded_data) + encryptor.finalize()
            
            # Combine IV and encrypted data
            combined = iv + encrypted
            
            # Return base64 encoded
            import base64
            return base64.b64encode(combined).decode()
            
        except Exception as e:
            logger.error(f"Certificate encryption failed: {e}")
            raise
    
    def _decrypt_certificate_data(self, encrypted_data: str) -> Dict:
        """Decrypt certificate data."""
        try:
            import base64
            
            # Decode from base64
            combined = base64.b64decode(encrypted_data.encode())
            
            # Extract IV and encrypted data
            iv = combined[:16]
            encrypted = combined[16:]
            
            # Decrypt
            cipher = Cipher(algorithms.AES(self.encryption_key), modes.CBC(iv), backend=self.backend)
            decryptor = cipher.decryptor()
            padded_data = decryptor.update(encrypted) + decryptor.finalize()
            
            # Remove padding
            json_data = self._unpad_data(padded_data).decode()
            
            return json.loads(json_data)
            
        except Exception as e:
            logger.error(f"Certificate decryption failed: {e}")
            raise
    
    def _pad_data(self, data: bytes) -> bytes:
        """Apply PKCS7 padding."""
        block_size = 16
        padding_length = block_size - (len(data) % block_size)
        padding = bytes([padding_length] * padding_length)
        return data + padding
    
    def _unpad_data(self, padded_data: bytes) -> bytes:
        """Remove PKCS7 padding."""
        padding_length = padded_data[-1]
        return padded_data[:-padding_length]
    
    def _get_stored_certificate(self, certificate_id: str) -> Optional[Dict]:
        """Retrieve stored certificate by ID."""
        activity = self.db.query(UserActivity).filter(
            UserActivity.activity_type == 'certificate_stored',
            UserActivity.metadata.contains({'certificate_id': certificate_id})
        ).first()
        
        if not activity:
            return None
        
        try:
            encrypted_data = activity.metadata.get('encrypted_data')
            if encrypted_data:
                return self._decrypt_certificate_data(encrypted_data)
        except Exception as e:
            logger.error(f"Failed to decrypt certificate {certificate_id}: {e}")
        
        return None
    
    def _store_revocation(self, revocation_data: Dict):
        """Store certificate revocation."""
        activity = UserActivity(
            user_id=UUID('00000000-0000-0000-0000-000000000000'),  # System user
            activity_type='certificate_revoked',
            activity_description=f'Certificate revoked: {revocation_data["certificate_id"]}',
            resource_type='revocation',
            metadata=revocation_data
        )
        
        self.db.add(activity)
        self.db.commit()
    
    def _mark_certificate_superseded(self, old_cert_id: str, new_cert_id: str):
        """Mark certificate as superseded by a newer one."""
        activity = UserActivity(
            user_id=UUID('00000000-0000-0000-0000-000000000000'),  # System user
            activity_type='certificate_superseded',
            activity_description=f'Certificate superseded: {old_cert_id}',
            resource_type='supersession',
            metadata={
                'old_certificate_id': old_cert_id,
                'new_certificate_id': new_cert_id,
                'superseded_at': datetime.now(timezone.utc).isoformat()
            }
        )
        
        self.db.add(activity)
        self.db.commit()
    
    def _get_user_certificates_from_storage(self, user_id: UUID, 
                                          include_revoked: bool = False) -> List[SecureCertificate]:
        """Get all certificates for user from storage."""
        activities = self.db.query(UserActivity).filter(
            UserActivity.user_id == user_id,
            UserActivity.activity_type == 'certificate_stored'
        ).order_by(desc(UserActivity.created_at)).all()
        
        certificates = []
        for activity in activities:
            try:
                encrypted_data = activity.metadata.get('encrypted_data')
                if encrypted_data:
                    cert_data = self._decrypt_certificate_data(encrypted_data)
                    
                    # Check if revoked
                    if not include_revoked and self._is_certificate_revoked(cert_data['certificate_id']):
                        continue
                    
                    # Convert to SecureCertificate
                    certificate = SecureCertificate(
                        certificate_id=cert_data['certificate_id'],
                        user_id=cert_data['user_id'],
                        wallet_address=cert_data['wallet_address'],
                        competency_level=CompetencyLevel(cert_data['competency_level']),
                        issued_at=datetime.fromisoformat(cert_data['issued_at']),
                        expires_at=datetime.fromisoformat(cert_data['expires_at']),
                        restrictions=[TradingRestriction(**r) for r in cert_data['restrictions']],
                        metadata=CertificateMetadata(**cert_data['metadata']),
                        digital_signature=cert_data['digital_signature'],
                        certificate_hash=cert_data['certificate_hash'],
                        version=cert_data['version'],
                        status=CertificateStatus(cert_data['status'])
                    )
                    
                    certificates.append(certificate)
                    
            except Exception as e:
                logger.error(f"Failed to load certificate from activity {activity.id}: {e}")
                continue
        
        return certificates
    
    def _get_current_certificate(self, user_id: UUID) -> Optional[SecureCertificate]:
        """Get user's current valid certificate."""
        certificates = self._get_user_certificates_from_storage(user_id)
        
        # Find most recent valid certificate
        current_time = datetime.now(timezone.utc)
        for cert in certificates:
            if (cert.status == CertificateStatus.VALID and 
                cert.expires_at > current_time and
                not self._is_certificate_revoked(cert.certificate_id)):
                return cert
        
        return None
    
    def _log_certificate_operation(self, user_id: UUID, operation: str, 
                                 certificate_id: str, details: Dict[str, Any]):
        """Log certificate operations for audit trail."""
        activity = UserActivity(
            user_id=user_id,
            activity_type=operation,
            activity_description=f'Certificate operation: {operation}',
            resource_type='certificate',
            metadata={
                'certificate_id': certificate_id,
                'operation': operation,
                **details
            }
        )
        
        self.db.add(activity)
        self.db.commit()
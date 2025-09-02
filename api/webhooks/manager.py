"""
Webhook manager for Off the Grid API
Handles webhook registration, event dispatching, delivery, and retry logic
"""
import asyncio
import hashlib
import hmac
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from uuid import uuid4

import aiohttp
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc

from database import get_db
from webhooks.models import (
    WebhookRegistration, WebhookEvent, WebhookDelivery, 
    WebhookEventType, WebhookStatus, WebhookDeliveryStatus,
    WebhookRegistrationRequest, WebhookUpdateRequest
)

logger = logging.getLogger(__name__)


class WebhookManager:
    """Centralized webhook management system"""
    
    def __init__(self, db: Session):
        self.db = db
        self.delivery_queue = asyncio.Queue()
        self.retry_queue = asyncio.Queue()
        self.active_deliveries = set()
        self._delivery_workers = []
        self._retry_workers = []
        
    async def start_workers(self, delivery_workers: int = 5, retry_workers: int = 2):
        """Start background workers for webhook delivery and retries"""
        logger.info(f"Starting webhook workers: {delivery_workers} delivery, {retry_workers} retry")
        
        # Start delivery workers
        for i in range(delivery_workers):
            worker = asyncio.create_task(self._delivery_worker(f"delivery-{i}"))
            self._delivery_workers.append(worker)
        
        # Start retry workers  
        for i in range(retry_workers):
            worker = asyncio.create_task(self._retry_worker(f"retry-{i}"))
            self._retry_workers.append(worker)
        
        # Start periodic cleanup task
        asyncio.create_task(self._cleanup_old_deliveries())
        
    async def stop_workers(self):
        """Stop all webhook workers"""
        logger.info("Stopping webhook workers")
        
        # Cancel all workers
        for worker in self._delivery_workers + self._retry_workers:
            worker.cancel()
        
        # Wait for workers to finish
        await asyncio.gather(*self._delivery_workers, *self._retry_workers, return_exceptions=True)
        
    def register_webhook(self, user_id: str, request: WebhookRegistrationRequest) -> WebhookRegistration:
        """Register a new webhook"""
        webhook = WebhookRegistration(
            user_id=user_id,
            url=request.url,
            events=request.events,
            secret=request.secret,
            filters=request.filters,
            retry_config=request.retry_config
        )
        
        # Save to database (in a real implementation)
        # self.db.add(webhook)
        # self.db.commit()
        
        logger.info(f"Registered webhook {webhook.id} for user {user_id}: {request.url}")
        return webhook
        
    def update_webhook(self, webhook_id: str, user_id: str, request: WebhookUpdateRequest) -> Optional[WebhookRegistration]:
        """Update existing webhook"""
        # In a real implementation, fetch from database
        # webhook = self.db.query(WebhookRegistration).filter(
        #     WebhookRegistration.id == webhook_id,
        #     WebhookRegistration.user_id == user_id
        # ).first()
        
        # Placeholder implementation
        logger.info(f"Updated webhook {webhook_id} for user {user_id}")
        return None
        
    def delete_webhook(self, webhook_id: str, user_id: str) -> bool:
        """Delete webhook"""
        # In a real implementation, delete from database
        # result = self.db.query(WebhookRegistration).filter(
        #     WebhookRegistration.id == webhook_id,
        #     WebhookRegistration.user_id == user_id
        # ).delete()
        # self.db.commit()
        
        logger.info(f"Deleted webhook {webhook_id} for user {user_id}")
        return True
        
    def get_user_webhooks(self, user_id: str, status: Optional[WebhookStatus] = None) -> List[WebhookRegistration]:
        """Get all webhooks for a user"""
        # In a real implementation, query database
        # query = self.db.query(WebhookRegistration).filter(WebhookRegistration.user_id == user_id)
        # if status:
        #     query = query.filter(WebhookRegistration.status == status)
        # return query.all()
        
        return []  # Placeholder
        
    async def emit_event(self, event_type: WebhookEventType, data: Dict[str, Any], 
                        user_id: Optional[str] = None, correlation_id: Optional[str] = None) -> str:
        """Emit a webhook event"""
        event = WebhookEvent(
            event_type=event_type,
            data=data,
            user_id=user_id,
            correlation_id=correlation_id
        )
        
        logger.info(f"Emitting webhook event {event.id}: {event_type} for user {user_id}")
        
        # Find matching webhooks
        matching_webhooks = await self._find_matching_webhooks(event)
        
        # Create deliveries for each matching webhook
        deliveries_created = 0
        for webhook in matching_webhooks:
            if webhook.status == WebhookStatus.ACTIVE:
                await self._create_delivery(webhook, event)
                deliveries_created += 1
        
        logger.info(f"Created {deliveries_created} deliveries for event {event.id}")
        return event.id
        
    async def _find_matching_webhooks(self, event: WebhookEvent) -> List[WebhookRegistration]:
        """Find webhooks that should receive this event"""
        # In a real implementation, query database for webhooks that:
        # 1. Subscribe to this event type
        # 2. Are active
        # 3. Match user_id if event is user-specific
        # 4. Pass any filters
        
        matching_webhooks = []
        
        # Placeholder logic
        logger.debug(f"Finding webhooks for event {event.event_type}")
        
        return matching_webhooks
        
    async def _create_delivery(self, webhook: WebhookRegistration, event: WebhookEvent):
        """Create a delivery for webhook and event"""
        payload = {
            "event": event.event_type,
            "data": event.data,
            "timestamp": event.timestamp.isoformat(),
            "webhook_id": webhook.id,
            "event_id": event.id
        }
        
        # Generate signature
        signature = self._generate_signature(payload, webhook.secret)
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
            "X-Webhook-Event": event.event_type,
            "X-Webhook-ID": webhook.id,
            "User-Agent": "Off-The-Grid-Webhook/1.0"
        }
        
        delivery = WebhookDelivery(
            webhook_id=webhook.id,
            event_id=event.id,
            url=webhook.url,
            payload=payload,
            headers=headers,
            max_attempts=webhook.retry_config.get("max_attempts", 3)
        )
        
        # Queue for delivery
        await self.delivery_queue.put(delivery)
        logger.debug(f"Queued delivery {delivery.id} for webhook {webhook.id}")
        
    def _generate_signature(self, payload: Dict[str, Any], secret: str) -> str:
        """Generate HMAC signature for webhook payload"""
        payload_bytes = json.dumps(payload, sort_keys=True).encode('utf-8')
        signature = hmac.new(
            secret.encode('utf-8'),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        return f"sha256={signature}"
        
    def verify_signature(self, payload: str, signature: str, secret: str) -> bool:
        """Verify webhook signature"""
        expected_signature = hmac.new(
            secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        expected = f"sha256={expected_signature}"
        return hmac.compare_digest(signature, expected)
        
    async def _delivery_worker(self, worker_name: str):
        """Background worker for webhook deliveries"""
        logger.info(f"Started delivery worker: {worker_name}")
        
        while True:
            try:
                # Get delivery from queue
                delivery = await self.delivery_queue.get()
                
                # Track active delivery
                self.active_deliveries.add(delivery.id)
                
                try:
                    await self._attempt_delivery(delivery)
                finally:
                    self.active_deliveries.discard(delivery.id)
                    self.delivery_queue.task_done()
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Delivery worker {worker_name} error: {e}")
                
    async def _retry_worker(self, worker_name: str):
        """Background worker for webhook retries"""
        logger.info(f"Started retry worker: {worker_name}")
        
        while True:
            try:
                # Get delivery from retry queue
                delivery = await self.retry_queue.get()
                
                # Check if it's time to retry
                if datetime.utcnow() < delivery.next_retry_at:
                    await asyncio.sleep((delivery.next_retry_at - datetime.utcnow()).total_seconds())
                
                # Track active retry
                self.active_deliveries.add(delivery.id)
                
                try:
                    await self._attempt_delivery(delivery)
                finally:
                    self.active_deliveries.discard(delivery.id)
                    self.retry_queue.task_done()
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Retry worker {worker_name} error: {e}")
                
    async def _attempt_delivery(self, delivery: WebhookDelivery):
        """Attempt to deliver a webhook"""
        delivery.attempt_count += 1
        delivery.status = WebhookDeliveryStatus.RETRYING if delivery.attempt_count > 1 else WebhookDeliveryStatus.PENDING
        
        logger.info(f"Attempting delivery {delivery.id} (attempt {delivery.attempt_count}/{delivery.max_attempts})")
        
        try:
            timeout = aiohttp.ClientTimeout(total=30)  # 30 second timeout
            
            async with aiohttp.ClientSession(timeout=timeout) as session:
                start_time = datetime.utcnow()
                
                async with session.post(
                    str(delivery.url),
                    json=delivery.payload,
                    headers=delivery.headers
                ) as response:
                    delivery.response_status_code = response.status
                    delivery.response_body = await response.text()
                    delivery.response_headers = dict(response.headers)
                    delivery.delivered_at = datetime.utcnow()
                    
                    # Check if delivery was successful
                    if 200 <= response.status < 300:
                        delivery.status = WebhookDeliveryStatus.SUCCESS
                        logger.info(f"Delivery {delivery.id} successful: {response.status}")
                        
                        # Update webhook stats
                        await self._update_webhook_stats(delivery.webhook_id, success=True)
                        
                    else:
                        delivery.status = WebhookDeliveryStatus.FAILED
                        delivery.error_message = f"HTTP {response.status}: {delivery.response_body}"
                        logger.warning(f"Delivery {delivery.id} failed: {response.status}")
                        
                        await self._handle_delivery_failure(delivery)
                        
        except asyncio.TimeoutError:
            delivery.status = WebhookDeliveryStatus.FAILED
            delivery.error_message = "Delivery timeout (30s)"
            logger.warning(f"Delivery {delivery.id} timed out")
            await self._handle_delivery_failure(delivery)
            
        except Exception as e:
            delivery.status = WebhookDeliveryStatus.FAILED
            delivery.error_message = str(e)
            logger.error(f"Delivery {delivery.id} failed with exception: {e}")
            await self._handle_delivery_failure(delivery)
            
        # Save delivery result (in a real implementation)
        # self.db.add(delivery)
        # self.db.commit()
        
    async def _handle_delivery_failure(self, delivery: WebhookDelivery):
        """Handle failed delivery and schedule retry if needed"""
        await self._update_webhook_stats(delivery.webhook_id, success=False)
        
        # Check if we should retry
        if delivery.attempt_count < delivery.max_attempts:
            # Calculate retry delay with exponential backoff
            base_delay = 60  # 1 minute base delay
            backoff_multiplier = 2
            max_delay = 3600  # 1 hour max delay
            
            delay_seconds = min(
                base_delay * (backoff_multiplier ** (delivery.attempt_count - 1)),
                max_delay
            )
            
            delivery.next_retry_at = datetime.utcnow() + timedelta(seconds=delay_seconds)
            
            logger.info(f"Scheduling retry for delivery {delivery.id} in {delay_seconds} seconds")
            
            # Queue for retry
            await self.retry_queue.put(delivery)
        else:
            logger.error(f"Delivery {delivery.id} failed permanently after {delivery.attempt_count} attempts")
            
            # Consider disabling webhook if it has too many failures
            await self._check_webhook_health(delivery.webhook_id)
            
    async def _update_webhook_stats(self, webhook_id: str, success: bool):
        """Update webhook delivery statistics"""
        # In a real implementation, update database
        logger.debug(f"Updating stats for webhook {webhook_id}: success={success}")
        
    async def _check_webhook_health(self, webhook_id: str):
        """Check webhook health and disable if necessary"""
        # In a real implementation:
        # 1. Check recent failure rate
        # 2. Disable webhook if failure rate is too high
        # 3. Notify user about webhook issues
        logger.warning(f"Checking health for webhook {webhook_id}")
        
    async def _cleanup_old_deliveries(self):
        """Periodic cleanup of old delivery records"""
        while True:
            try:
                # Sleep for 1 hour between cleanups
                await asyncio.sleep(3600)
                
                # Delete delivery records older than 30 days
                cutoff_date = datetime.utcnow() - timedelta(days=30)
                logger.info(f"Cleaning up deliveries older than {cutoff_date}")
                
                # In a real implementation, delete from database
                # deleted_count = self.db.query(WebhookDelivery).filter(
                #     WebhookDelivery.created_at < cutoff_date
                # ).delete()
                # self.db.commit()
                # logger.info(f"Cleaned up {deleted_count} old delivery records")
                
            except Exception as e:
                logger.error(f"Delivery cleanup error: {e}")
                
    def get_delivery_stats(self, webhook_id: str, hours: int = 24) -> Dict[str, Any]:
        """Get delivery statistics for a webhook"""
        # In a real implementation, query database for stats
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Placeholder stats
        return {
            "webhook_id": webhook_id,
            "time_window_hours": hours,
            "total_deliveries": 0,
            "successful_deliveries": 0,
            "failed_deliveries": 0,
            "success_rate": 0.0,
            "avg_response_time_ms": None,
            "last_delivery_at": None
        }
        
    async def test_webhook(self, webhook_id: str, event_type: WebhookEventType, 
                          test_data: Dict[str, Any]) -> Dict[str, Any]:
        """Send a test event to webhook"""
        # In a real implementation, fetch webhook from database
        logger.info(f"Testing webhook {webhook_id} with event {event_type}")
        
        # Create test event
        test_event = WebhookEvent(
            event_type=event_type,
            data=test_data,
            metadata={"test": True}
        )
        
        # For testing, we would create a delivery and attempt it immediately
        return {
            "test_id": str(uuid4()),
            "webhook_id": webhook_id,
            "event_type": event_type,
            "status": "sent",
            "timestamp": datetime.utcnow()
        }


# Global webhook manager instance
_webhook_manager: Optional[WebhookManager] = None

async def get_webhook_manager() -> WebhookManager:
    """Get webhook manager instance"""
    global _webhook_manager
    
    if _webhook_manager is None:
        db = next(get_db())  # In a real implementation, handle this properly
        _webhook_manager = WebhookManager(db)
        await _webhook_manager.start_workers()
    
    return _webhook_manager
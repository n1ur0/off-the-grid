"""
WebSocket connection manager for real-time updates
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set, Optional, Any, List

from fastapi import WebSocket, WebSocketDisconnect

from config import get_settings
from models import WebSocketMessage, GridUpdateMessage, SubscribeMessage

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket connection manager with subscription support"""
    
    def __init__(self):
        self.settings = get_settings()
        
        # Active WebSocket connections: user_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        
        # User subscriptions: user_id -> Set[topic]
        self.user_subscriptions: Dict[str, Set[str]] = {}
        
        # Topic subscriptions: topic -> Set[user_id]
        self.topic_subscriptions: Dict[str, Set[str]] = {}
        
        # Connection metadata
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}
        
        # Health check task
        self._health_check_task: Optional[asyncio.Task] = None
        
        logger.info("WebSocket ConnectionManager initialized")
    
    async def connect(self, websocket: WebSocket, user_id: str, metadata: Optional[Dict[str, Any]] = None):
        """Accept new WebSocket connection"""
        await websocket.accept()
        
        # Store connection
        self.active_connections[user_id] = websocket
        self.user_subscriptions[user_id] = set()
        self.connection_metadata[user_id] = metadata or {}
        
        # Add connection timestamp
        self.connection_metadata[user_id]["connected_at"] = datetime.utcnow()
        self.connection_metadata[user_id]["last_ping"] = datetime.utcnow()
        
        logger.info(f"WebSocket connected for user: {user_id}")
        
        # Send welcome message
        await self.send_to_user(user_id, {
            "type": "connection_established",
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Start health check if it's the first connection
        if len(self.active_connections) == 1 and self._health_check_task is None:
            self._health_check_task = asyncio.create_task(self._health_check_loop())
    
    def disconnect(self, user_id: str):
        """Handle WebSocket disconnection"""
        if user_id in self.active_connections:
            # Remove from all topic subscriptions
            for topic in self.user_subscriptions.get(user_id, set()):
                if topic in self.topic_subscriptions:
                    self.topic_subscriptions[topic].discard(user_id)
                    if not self.topic_subscriptions[topic]:
                        del self.topic_subscriptions[topic]
            
            # Clean up user data
            del self.active_connections[user_id]
            if user_id in self.user_subscriptions:
                del self.user_subscriptions[user_id]
            if user_id in self.connection_metadata:
                del self.connection_metadata[user_id]
            
            logger.info(f"WebSocket disconnected for user: {user_id}")
            
            # Stop health check if no more connections
            if not self.active_connections and self._health_check_task:
                self._health_check_task.cancel()
                self._health_check_task = None
    
    async def send_to_user(self, user_id: str, message: Dict[str, Any]) -> bool:
        """Send message to specific user"""
        if user_id not in self.active_connections:
            logger.warning(f"Attempted to send message to disconnected user: {user_id}")
            return False
        
        try:
            websocket = self.active_connections[user_id]
            message_with_timestamp = {
                **message,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            await websocket.send_text(json.dumps(message_with_timestamp))
            
            # Update last activity
            self.connection_metadata[user_id]["last_activity"] = datetime.utcnow()
            
            return True
            
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected during send for user: {user_id}")
            self.disconnect(user_id)
            return False
            
        except Exception as e:
            logger.error(f"Error sending message to user {user_id}: {e}")
            self.disconnect(user_id)
            return False
    
    async def broadcast_to_topic(self, topic: str, message: Dict[str, Any]) -> int:
        """Broadcast message to all users subscribed to a topic"""
        if topic not in self.topic_subscriptions:
            logger.debug(f"No subscribers for topic: {topic}")
            return 0
        
        subscribers = list(self.topic_subscriptions[topic])
        successful_sends = 0
        
        message_with_topic = {
            **message,
            "topic": topic,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to all subscribers
        for user_id in subscribers:
            success = await self.send_to_user(user_id, message_with_topic)
            if success:
                successful_sends += 1
        
        logger.debug(f"Broadcasted to {successful_sends}/{len(subscribers)} subscribers of topic '{topic}'")
        return successful_sends
    
    async def broadcast_to_all(self, message: Dict[str, Any]) -> int:
        """Broadcast message to all connected users"""
        users = list(self.active_connections.keys())
        successful_sends = 0
        
        for user_id in users:
            success = await self.send_to_user(user_id, message)
            if success:
                successful_sends += 1
        
        logger.debug(f"Broadcasted to {successful_sends}/{len(users)} connected users")
        return successful_sends
    
    def subscribe_user(self, user_id: str, topic: str) -> bool:
        """Subscribe user to a topic"""
        if user_id not in self.active_connections:
            logger.warning(f"Attempted to subscribe disconnected user: {user_id}")
            return False
        
        # Add to user subscriptions
        self.user_subscriptions[user_id].add(topic)
        
        # Add to topic subscriptions
        if topic not in self.topic_subscriptions:
            self.topic_subscriptions[topic] = set()
        self.topic_subscriptions[topic].add(user_id)
        
        logger.info(f"User {user_id} subscribed to topic '{topic}'")
        return True
    
    def unsubscribe_user(self, user_id: str, topic: str) -> bool:
        """Unsubscribe user from a topic"""
        if user_id not in self.active_connections:
            return False
        
        # Remove from user subscriptions
        self.user_subscriptions[user_id].discard(topic)
        
        # Remove from topic subscriptions
        if topic in self.topic_subscriptions:
            self.topic_subscriptions[topic].discard(user_id)
            if not self.topic_subscriptions[topic]:
                del self.topic_subscriptions[topic]
        
        logger.info(f"User {user_id} unsubscribed from topic '{topic}'")
        return True
    
    async def handle_message(self, user_id: str, message: str):
        """Handle incoming WebSocket message from user"""
        try:
            data = json.loads(message)
            message_type = data.get("type")
            
            if message_type == "subscribe":
                topic = data.get("topic")
                if topic:
                    success = self.subscribe_user(user_id, topic)
                    await self.send_to_user(user_id, {
                        "type": "subscription_response",
                        "topic": topic,
                        "success": success,
                        "subscriptions": list(self.user_subscriptions[user_id])
                    })
            
            elif message_type == "unsubscribe":
                topic = data.get("topic")
                if topic:
                    success = self.unsubscribe_user(user_id, topic)
                    await self.send_to_user(user_id, {
                        "type": "unsubscription_response",
                        "topic": topic,
                        "success": success,
                        "subscriptions": list(self.user_subscriptions[user_id])
                    })
            
            elif message_type == "ping":
                # Update ping timestamp and respond with pong
                self.connection_metadata[user_id]["last_ping"] = datetime.utcnow()
                await self.send_to_user(user_id, {
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            elif message_type == "get_status":
                # Send connection status
                await self.send_to_user(user_id, {
                    "type": "status_response",
                    "user_id": user_id,
                    "subscriptions": list(self.user_subscriptions[user_id]),
                    "connected_users": len(self.active_connections),
                    "active_topics": list(self.topic_subscriptions.keys())
                })
            
            else:
                logger.warning(f"Unknown message type from user {user_id}: {message_type}")
                await self.send_to_user(user_id, {
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                })
        
        except json.JSONDecodeError:
            logger.warning(f"Invalid JSON message from user {user_id}: {message}")
            await self.send_to_user(user_id, {
                "type": "error",
                "message": "Invalid JSON message"
            })
        
        except Exception as e:
            logger.error(f"Error handling message from user {user_id}: {e}")
            await self.send_to_user(user_id, {
                "type": "error",
                "message": "Internal error processing message"
            })
    
    async def _health_check_loop(self):
        """Background task to check connection health"""
        while self.active_connections:
            try:
                current_time = datetime.utcnow()
                ping_timeout = timedelta(seconds=self.settings.websocket_ping_timeout)
                
                # Check for stale connections
                stale_users = []
                for user_id, metadata in self.connection_metadata.items():
                    last_ping = metadata.get("last_ping", metadata.get("connected_at"))
                    if current_time - last_ping > ping_timeout:
                        stale_users.append(user_id)
                
                # Disconnect stale users
                for user_id in stale_users:
                    logger.info(f"Disconnecting stale user: {user_id}")
                    if user_id in self.active_connections:
                        try:
                            await self.active_connections[user_id].close(code=1000)
                        except:
                            pass
                        self.disconnect(user_id)
                
                # Wait before next health check
                await asyncio.sleep(self.settings.websocket_ping_interval)
                
            except asyncio.CancelledError:
                logger.info("Health check loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in health check loop: {e}")
                await asyncio.sleep(5)  # Short wait on error
    
    def get_stats(self) -> Dict[str, Any]:
        """Get connection statistics"""
        return {
            "active_connections": len(self.active_connections),
            "total_subscriptions": sum(len(subs) for subs in self.user_subscriptions.values()),
            "active_topics": list(self.topic_subscriptions.keys()),
            "topic_subscriber_counts": {
                topic: len(subscribers) 
                for topic, subscribers in self.topic_subscriptions.items()
            }
        }


# Global connection manager instance
_connection_manager: Optional[ConnectionManager] = None


def get_connection_manager() -> ConnectionManager:
    """Get or create connection manager instance"""
    global _connection_manager
    if _connection_manager is None:
        _connection_manager = ConnectionManager()
    return _connection_manager
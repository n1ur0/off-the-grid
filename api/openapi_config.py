"""
Enhanced OpenAPI configuration for Off the Grid API
Provides comprehensive API documentation with examples, security schemes, and metadata
"""
from typing import Dict, Any, List
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi


def get_enhanced_openapi_schema(app: FastAPI) -> Dict[str, Any]:
    """Generate enhanced OpenAPI schema with comprehensive documentation."""
    
    if app.openapi_schema:
        return app.openapi_schema
    
    # Base OpenAPI schema
    openapi_schema = get_openapi(
        title="Off the Grid API",
        version="2.0.0",
        description=get_api_description(),
        routes=app.routes,
        servers=[
            {"url": "http://localhost:8000", "description": "Development server"},
            {"url": "https://api.off-the-grid.io", "description": "Production server"},
        ]
    )
    
    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = get_security_schemes()
    
    # Add custom extensions
    openapi_schema["x-logo"] = {
        "url": "https://off-the-grid.io/logo.png",
        "altText": "Off the Grid Logo"
    }
    
    # Add rate limiting information
    openapi_schema["x-rate-limits"] = get_rate_limit_info()
    
    # Add webhook documentation
    openapi_schema["webhooks"] = get_webhook_schemas()
    
    # Add comprehensive examples
    add_comprehensive_examples(openapi_schema)
    
    # Add error response documentation
    add_error_responses(openapi_schema)
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


def get_api_description() -> str:
    """Get comprehensive API description."""
    return """
# Off the Grid API

**Off the Grid** is a decentralized grid trading platform built on the Ergo blockchain. 
This API provides a comprehensive interface for managing grid trading orders, user authentication, 
educational progress tracking, and real-time market interactions.

## Features

- **Grid Trading**: Create, manage, and monitor automated grid trading orders
- **Authentication**: Wallet-based authentication with JWT tokens
- **Educational System**: Comprehensive progress tracking and competency validation
- **Real-time Updates**: WebSocket connections for live data
- **Token Management**: Comprehensive token information and statistics
- **Bot Integration**: Dedicated endpoints for trading bot operations
- **Webhook Notifications**: Event-driven notifications for trading activities

## Authentication

The API supports multiple authentication methods:

1. **JWT Bearer Tokens** - For web applications and authenticated requests
2. **API Keys** - For bot operations and server-to-server communication  
3. **Wallet Signatures** - For initial authentication and wallet verification

## Rate Limiting

API endpoints are rate limited based on user tier and endpoint type:

- **Free Tier**: 100 requests/hour for trading operations, 1000 requests/hour for data retrieval
- **Premium Tier**: 1000 requests/hour for trading operations, 10000 requests/hour for data retrieval
- **Bot API**: Custom limits based on subscription plan

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when the rate limit resets

## WebSocket Connections

Real-time updates are available via WebSocket at `/ws/{user_id}`. 
Supported message types include:
- Grid order updates
- Token price changes  
- System notifications
- Educational progress updates

## Error Handling

All endpoints return structured error responses with:
- `success`: Boolean indicating success/failure
- `error`: Human-readable error message
- `error_code`: Machine-readable error code
- `details`: Additional error context (development only)
- `timestamp`: ISO 8601 timestamp

Common error codes:
- `UNAUTHORIZED`: Authentication required or invalid
- `FORBIDDEN`: Insufficient permissions
- `RATE_LIMITED`: Rate limit exceeded
- `VALIDATION_ERROR`: Invalid request data
- `BLOCKCHAIN_ERROR`: Blockchain interaction failed

## SDKs and Client Libraries

Official SDKs are available for:
- **Python**: `pip install off-the-grid-sdk`
- **JavaScript/TypeScript**: `npm install @off-the-grid/sdk`
- **Rust**: `cargo add off-the-grid-sdk`

Community SDKs:
- **Go**: Available on GitHub
- **Java**: Available via Maven Central

## Support

- **Documentation**: https://docs.off-the-grid.io
- **GitHub**: https://github.com/off-the-grid/api
- **Discord**: https://discord.gg/off-the-grid
- **Email**: support@off-the-grid.io
"""


def get_security_schemes() -> Dict[str, Any]:
    """Define security schemes for authentication."""
    return {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT token obtained from the login endpoint"
        },
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "API key for bot operations and server-to-server communication"
        },
        "CookieAuth": {
            "type": "apiKey",
            "in": "cookie",
            "name": "access_token",
            "description": "JWT token stored in HTTP-only cookie"
        },
        "WebhookSignature": {
            "type": "apiKey",
            "in": "header", 
            "name": "X-Webhook-Signature",
            "description": "HMAC-SHA256 signature for webhook verification"
        }
    }


def get_rate_limit_info() -> Dict[str, Any]:
    """Get rate limiting information."""
    return {
        "tiers": {
            "free": {
                "trading_operations": "100/hour",
                "data_retrieval": "1000/hour",
                "websocket_connections": 1
            },
            "premium": {
                "trading_operations": "1000/hour", 
                "data_retrieval": "10000/hour",
                "websocket_connections": 5
            },
            "enterprise": {
                "trading_operations": "unlimited",
                "data_retrieval": "unlimited", 
                "websocket_connections": "unlimited"
            }
        },
        "headers": {
            "X-RateLimit-Limit": "Request limit per window",
            "X-RateLimit-Remaining": "Remaining requests in current window",
            "X-RateLimit-Reset": "Unix timestamp when limit resets",
            "X-RateLimit-Tier": "Current user tier"
        }
    }


def get_webhook_schemas() -> Dict[str, Any]:
    """Define webhook schemas for event notifications."""
    return {
        "gridCreated": {
            "post": {
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "event": {"type": "string", "enum": ["grid.created"]},
                                    "data": {
                                        "type": "object",
                                        "properties": {
                                            "grid_identity": {"type": "string"},
                                            "token_id": {"type": "string"},
                                            "user_id": {"type": "string"},
                                            "value": {"type": "integer"},
                                            "orders": {"type": "integer"},
                                            "range": {"type": "number"},
                                            "created_at": {"type": "string", "format": "date-time"}
                                        }
                                    },
                                    "timestamp": {"type": "string", "format": "date-time"},
                                    "webhook_id": {"type": "string", "format": "uuid"}
                                }
                            }
                        }
                    }
                },
                "responses": {
                    "200": {"description": "Webhook processed successfully"},
                    "400": {"description": "Invalid webhook payload"},
                    "401": {"description": "Invalid webhook signature"}
                }
            }
        },
        "gridFilled": {
            "post": {
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "event": {"type": "string", "enum": ["grid.order_filled"]},
                                    "data": {
                                        "type": "object",
                                        "properties": {
                                            "grid_identity": {"type": "string"},
                                            "order_type": {"type": "string", "enum": ["Buy", "Sell"]},
                                            "amount": {"type": "string"},
                                            "price": {"type": "string"},
                                            "filled_at": {"type": "string", "format": "date-time"},
                                            "transaction_id": {"type": "string"}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "userProgressUpdate": {
            "post": {
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object", 
                                "properties": {
                                    "event": {"type": "string", "enum": ["user.progress_update"]},
                                    "data": {
                                        "type": "object",
                                        "properties": {
                                            "user_id": {"type": "string"},
                                            "module_code": {"type": "string"},
                                            "completion_status": {"type": "string"},
                                            "progress_percentage": {"type": "integer"},
                                            "achievement_earned": {"type": "string"}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }


def add_comprehensive_examples(schema: Dict[str, Any]) -> None:
    """Add comprehensive examples to the OpenAPI schema."""
    if "paths" not in schema:
        return
        
    # Grid creation example
    if "/api/v1/grids" in schema["paths"] and "post" in schema["paths"]["/api/v1/grids"]:
        schema["paths"]["/api/v1/grids"]["post"]["requestBody"]["content"]["application/json"]["examples"] = {
            "basicGrid": {
                "summary": "Basic grid order",
                "description": "Create a simple grid order with 5 orders",
                "value": {
                    "token_id": "4ab9da11fc216660e974842cc3b7705e62ebb9e0bf5ff78e53f9cd40abadd117",
                    "value": 1000000000,
                    "orders": 5,
                    "range": 0.1,
                    "identity": "my-first-grid"
                }
            },
            "advancedGrid": {
                "summary": "Advanced grid order",
                "description": "Create a larger grid with more orders and wider range",
                "value": {
                    "token_id": "4ab9da11fc216660e974842cc3b7705e62ebb9e0bf5ff78e53f9cd40abadd117",
                    "value": 5000000000,
                    "orders": 20,
                    "range": 0.25,
                    "identity": "advanced-grid-strategy"
                }
            }
        }
    
    # Authentication example
    if "/api/v1/auth/login" in schema["paths"] and "post" in schema["paths"]["/api/v1/auth/login"]:
        schema["paths"]["/api/v1/auth/login"]["post"]["requestBody"]["content"]["application/json"]["examples"] = {
            "walletAuth": {
                "summary": "Wallet authentication",
                "description": "Authenticate using Ergo wallet signature",
                "value": {
                    "wallet_address": "9fRAWhdxEsTcdb8PhGNrpfkCk4Dz8V3u5oT2YXQT1234567890abcdef",
                    "message": "Login to Off the Grid - 2024-01-01T12:00:00Z",
                    "signature": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
                }
            }
        }


def add_error_responses(schema: Dict[str, Any]) -> None:
    """Add standardized error responses to all endpoints."""
    common_errors = {
        "400": {
            "description": "Bad Request",
            "content": {
                "application/json": {
                    "schema": {"$ref": "#/components/schemas/ErrorResponse"},
                    "examples": {
                        "validation_error": {
                            "summary": "Validation error",
                            "value": {
                                "success": False,
                                "error": "Validation error",
                                "error_code": "VALIDATION_ERROR",
                                "details": "Token ID must be 64 characters",
                                "timestamp": "2024-01-01T12:00:00Z"
                            }
                        }
                    }
                }
            }
        },
        "401": {
            "description": "Unauthorized",
            "content": {
                "application/json": {
                    "schema": {"$ref": "#/components/schemas/ErrorResponse"},
                    "examples": {
                        "missing_auth": {
                            "summary": "Missing authentication",
                            "value": {
                                "success": False,
                                "error": "Authentication required",
                                "error_code": "UNAUTHORIZED",
                                "timestamp": "2024-01-01T12:00:00Z"
                            }
                        },
                        "invalid_token": {
                            "summary": "Invalid token",
                            "value": {
                                "success": False,
                                "error": "Invalid or expired token",
                                "error_code": "INVALID_TOKEN",
                                "timestamp": "2024-01-01T12:00:00Z"
                            }
                        }
                    }
                }
            }
        },
        "403": {
            "description": "Forbidden",
            "content": {
                "application/json": {
                    "schema": {"$ref": "#/components/schemas/ErrorResponse"},
                    "example": {
                        "success": False,
                        "error": "Insufficient permissions",
                        "error_code": "FORBIDDEN",
                        "timestamp": "2024-01-01T12:00:00Z"
                    }
                }
            }
        },
        "429": {
            "description": "Rate Limited",
            "headers": {
                "X-RateLimit-Limit": {"schema": {"type": "integer"}},
                "X-RateLimit-Remaining": {"schema": {"type": "integer"}},
                "X-RateLimit-Reset": {"schema": {"type": "integer"}},
                "Retry-After": {"schema": {"type": "integer"}}
            },
            "content": {
                "application/json": {
                    "schema": {"$ref": "#/components/schemas/ErrorResponse"},
                    "example": {
                        "success": False,
                        "error": "Rate limit exceeded",
                        "error_code": "RATE_LIMITED",
                        "details": "Try again in 60 seconds",
                        "timestamp": "2024-01-01T12:00:00Z"
                    }
                }
            }
        },
        "500": {
            "description": "Internal Server Error",
            "content": {
                "application/json": {
                    "schema": {"$ref": "#/components/schemas/ErrorResponse"},
                    "example": {
                        "success": False,
                        "error": "Internal server error",
                        "error_code": "INTERNAL_SERVER_ERROR",
                        "timestamp": "2024-01-01T12:00:00Z"
                    }
                }
            }
        }
    }
    
    # Add common errors to all endpoints
    if "paths" in schema:
        for path, methods in schema["paths"].items():
            for method, endpoint in methods.items():
                if isinstance(endpoint, dict) and "responses" in endpoint:
                    # Add authentication errors to protected endpoints
                    if any("security" in endpoint.get(key, []) for key in ["security", "parameters"]):
                        endpoint["responses"].update({
                            "401": common_errors["401"],
                            "403": common_errors["403"]
                        })
                    
                    # Add common errors to all endpoints
                    endpoint["responses"].update({
                        "400": common_errors["400"],
                        "429": common_errors["429"],
                        "500": common_errors["500"]
                    })


def get_tags_metadata() -> List[Dict[str, Any]]:
    """Get metadata for API tags/groups."""
    return [
        {
            "name": "authentication",
            "description": "User authentication and session management",
            "externalDocs": {
                "description": "Authentication Guide",
                "url": "https://docs.off-the-grid.io/authentication"
            }
        },
        {
            "name": "grid-trading", 
            "description": "Grid trading order management and operations",
            "externalDocs": {
                "description": "Grid Trading Guide",
                "url": "https://docs.off-the-grid.io/grid-trading"
            }
        },
        {
            "name": "tokens",
            "description": "Token information and market data",
            "externalDocs": {
                "description": "Token API Guide", 
                "url": "https://docs.off-the-grid.io/tokens"
            }
        },
        {
            "name": "progress",
            "description": "Educational progress tracking and competency validation",
            "externalDocs": {
                "description": "Education System Guide",
                "url": "https://docs.off-the-grid.io/education"
            }
        },
        {
            "name": "bot-api",
            "description": "Dedicated endpoints for trading bot operations", 
            "externalDocs": {
                "description": "Bot Integration Guide",
                "url": "https://docs.off-the-grid.io/bot-api"
            }
        },
        {
            "name": "webhooks",
            "description": "Webhook registration and event notifications",
            "externalDocs": {
                "description": "Webhook Guide",
                "url": "https://docs.off-the-grid.io/webhooks"
            }
        }
    ]
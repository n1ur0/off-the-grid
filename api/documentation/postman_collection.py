"""
Generate Postman collection for Off the Grid API
Creates a comprehensive Postman collection with all endpoints, authentication, and examples
"""
import json
from typing import Dict, Any, List
from datetime import datetime


def generate_postman_collection() -> Dict[str, Any]:
    """Generate complete Postman collection for the API"""
    
    collection = {
        "info": {
            "name": "Off the Grid API v2.0",
            "description": "Comprehensive collection for Off the Grid decentralized trading platform API",
            "version": "2.0.0",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "auth": {
            "type": "bearer",
            "bearer": [
                {
                    "key": "token",
                    "value": "{{jwt_token}}",
                    "type": "string"
                }
            ]
        },
        "variable": [
            {
                "key": "base_url",
                "value": "http://localhost:8000",
                "type": "string"
            },
            {
                "key": "jwt_token", 
                "value": "",
                "type": "string"
            },
            {
                "key": "api_key",
                "value": "",
                "type": "string"
            },
            {
                "key": "wallet_address",
                "value": "9fRAWhdxEsTcdb8PhGNrpfkCk4Dz8V3u5oT2YXQT1234567890abcdef",
                "type": "string"
            }
        ],
        "item": []
    }
    
    # Authentication folder
    auth_folder = {
        "name": "Authentication",
        "description": "User authentication and session management",
        "item": [
            {
                "name": "Login with Wallet",
                "request": {
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "wallet_address": "{{wallet_address}}",
                            "message": f"Login to Off the Grid - {datetime.utcnow().isoformat()}Z",
                            "signature": "demo_signature_for_testing"
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/v1/auth/login",
                        "host": ["{{base_url}}"],
                        "path": ["api", "v1", "auth", "login"]
                    }
                },
                "event": [
                    {
                        "listen": "test",
                        "script": {
                            "exec": [
                                "if (pm.response.code === 200) {",
                                "    const response = pm.response.json();",
                                "    pm.collectionVariables.set('jwt_token', response.access_token);",
                                "    console.log('JWT token saved:', response.access_token.substring(0, 20) + '...');",
                                "}"
                            ]
                        }
                    }
                ]
            },
            {
                "name": "Get Current User",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api/v1/auth/me",
                        "host": ["{{base_url}}"],
                        "path": ["api", "v1", "auth", "me"]
                    }
                }
            },
            {
                "name": "Create API Key",
                "request": {
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "name": "My Bot API Key",
                            "role": "bot",
                            "expires_days": 90
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/v1/auth/api-keys",
                        "host": ["{{base_url}}"],
                        "path": ["api", "v1", "auth", "api-keys"]
                    }
                },
                "event": [
                    {
                        "listen": "test",
                        "script": {
                            "exec": [
                                "if (pm.response.code === 200) {",
                                "    const response = pm.response.json();",
                                "    pm.collectionVariables.set('api_key', response.key);",
                                "    console.log('API key saved:', response.key.substring(0, 20) + '...');",
                                "}"
                            ]
                        }
                    }
                ]
            }
        ]
    }
    
    # Grid Trading folder
    grid_folder = {
        "name": "Grid Trading",
        "description": "Grid trading order management",
        "item": [
            {
                "name": "List Grids",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api/v1/grids?page=1&page_size=10",
                        "host": ["{{base_url}}"],
                        "path": ["api", "v1", "grids"],
                        "query": [
                            {"key": "page", "value": "1"},
                            {"key": "page_size", "value": "10"}
                        ]
                    }
                }
            },
            {
                "name": "Create Grid Order",
                "request": {
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "token_id": "4ab9da11fc216660e974842cc3b7705e62ebb9e0bf5ff78e53f9cd40abadd117",
                            "value": 1000000000,
                            "orders": 5,
                            "range": 0.1,
                            "identity": "test-grid-postman"
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/v1/grids",
                        "host": ["{{base_url}}"],
                        "path": ["api", "v1", "grids"]
                    }
                }
            },
            {
                "name": "Get Grid Details",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api/v1/grids/test-grid-postman",
                        "host": ["{{base_url}}"],
                        "path": ["api", "v1", "grids", "test-grid-postman"]
                    }
                }
            }
        ]
    }
    
    # Bot API folder
    bot_folder = {
        "name": "Bot API",
        "description": "Advanced bot operations and bulk endpoints",
        "auth": {
            "type": "apikey",
            "apikey": [
                {
                    "key": "key",
                    "value": "X-API-Key"
                },
                {
                    "key": "value",
                    "value": "{{api_key}}"
                },
                {
                    "key": "in",
                    "value": "header"
                }
            ]
        },
        "item": [
            {
                "name": "Bulk Create Grids",
                "request": {
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        },
                        {
                            "key": "X-API-Key",
                            "value": "{{api_key}}"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "grids": [
                                {
                                    "token_id": "4ab9da11fc216660e974842cc3b7705e62ebb9e0bf5ff78e53f9cd40abadd117",
                                    "value": 1000000000,
                                    "orders": 5,
                                    "range": 0.1,
                                    "identity": "bulk-grid-1"
                                },
                                {
                                    "token_id": "4ab9da11fc216660e974842cc3b7705e62ebb9e0bf5ff78e53f9cd40abadd117",
                                    "value": 2000000000,
                                    "orders": 10,
                                    "range": 0.15,
                                    "identity": "bulk-grid-2"
                                }
                            ],
                            "continue_on_error": True
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/v2/bot/grids/bulk",
                        "host": ["{{base_url}}"],
                        "path": ["api", "v2", "bot", "grids", "bulk"]
                    }
                }
            },
            {
                "name": "Advanced Grid Query",
                "request": {
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        },
                        {
                            "key": "X-API-Key",
                            "value": "{{api_key}}"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "min_value": 500000000,
                            "max_value": 5000000000,
                            "order_count_min": 3,
                            "order_count_max": 20
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/v2/bot/grids/query?page=1&page_size=50&sort_by=profit&sort_order=desc",
                        "host": ["{{base_url}}"],
                        "path": ["api", "v2", "bot", "grids", "query"],
                        "query": [
                            {"key": "page", "value": "1"},
                            {"key": "page_size", "value": "50"},
                            {"key": "sort_by", "value": "profit"},
                            {"key": "sort_order", "value": "desc"}
                        ]
                    }
                }
            },
            {
                "name": "Get Trading Analytics",
                "request": {
                    "method": "GET",
                    "header": [
                        {
                            "key": "X-API-Key",
                            "value": "{{api_key}}"
                        }
                    ],
                    "url": {
                        "raw": "{{base_url}}/api/v2/bot/analytics/overview?time_window_hours=24",
                        "host": ["{{base_url}}"],
                        "path": ["api", "v2", "bot", "analytics", "overview"],
                        "query": [
                            {"key": "time_window_hours", "value": "24"}
                        ]
                    }
                }
            }
        ]
    }
    
    # Webhooks folder
    webhook_folder = {
        "name": "Webhooks",
        "description": "Webhook registration and management",
        "item": [
            {
                "name": "Register Webhook",
                "request": {
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "url": "https://webhook.site/unique-id",
                            "events": ["grid.created", "grid.order_filled"],
                            "secret": "my_webhook_secret_key_123456"
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/v1/webhooks",
                        "host": ["{{base_url}}"],
                        "path": ["api", "v1", "webhooks"]
                    }
                }
            },
            {
                "name": "List Webhooks",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api/v1/webhooks",
                        "host": ["{{base_url}}"],
                        "path": ["api", "v1", "webhooks"]
                    }
                }
            },
            {
                "name": "Test Webhook",
                "request": {
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "event_type": "system.maintenance",
                            "test_data": {
                                "test": True,
                                "message": "Test webhook from Postman"
                            }
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/v1/webhooks/{{webhook_id}}/test",
                        "host": ["{{base_url}}"],
                        "path": ["api", "v1", "webhooks", "{{webhook_id}}", "test"]
                    }
                }
            }
        ]
    }
    
    # System endpoints folder
    system_folder = {
        "name": "System",
        "description": "System health and information endpoints",
        "item": [
            {
                "name": "Health Check",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/health",
                        "host": ["{{base_url}}"],
                        "path": ["health"]
                    }
                }
            },
            {
                "name": "API Info",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api/info",
                        "host": ["{{base_url}}"],
                        "path": ["api", "info"]
                    }
                }
            },
            {
                "name": "API Stats",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api/stats",
                        "host": ["{{base_url}}"],
                        "path": ["api", "stats"]
                    }
                }
            }
        ]
    }
    
    # Add all folders to collection
    collection["item"] = [
        auth_folder,
        grid_folder,
        bot_folder,
        webhook_folder,
        system_folder
    ]
    
    return collection


def save_postman_collection(filepath: str = "off_the_grid_api.postman_collection.json"):
    """Save Postman collection to file"""
    collection = generate_postman_collection()
    
    with open(filepath, 'w') as f:
        json.dump(collection, f, indent=2, default=str)
    
    print(f"Postman collection saved to {filepath}")
    return filepath


if __name__ == "__main__":
    # Generate and save collection
    save_postman_collection("/home/n1ur0/Documents/git/off-the-grid/api/documentation/off_the_grid_api.postman_collection.json")
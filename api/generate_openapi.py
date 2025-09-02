"""
Generate complete OpenAPI specification for Off the Grid API
Creates the final OpenAPI spec with all enhancements and exports to JSON/YAML
"""
import json
import yaml
import sys
from pathlib import Path

# Add the API directory to Python path
sys.path.append(str(Path(__file__).parent))

try:
    from main_enhanced import app
    from openapi_config import get_enhanced_openapi_schema
    
    def generate_openapi_spec():
        """Generate and export OpenAPI specification"""
        
        # Generate the enhanced OpenAPI schema
        openapi_spec = get_enhanced_openapi_schema(app)
        
        # Add additional metadata
        openapi_spec["info"]["contact"] = {
            "name": "Off the Grid Support",
            "url": "https://off-the-grid.io/support",
            "email": "support@off-the-grid.io"
        }
        
        openapi_spec["info"]["license"] = {
            "name": "MIT",
            "url": "https://opensource.org/licenses/MIT"
        }
        
        # Add external documentation
        openapi_spec["externalDocs"] = {
            "description": "Complete API Documentation",
            "url": "https://docs.off-the-grid.io"
        }
        
        # Export to JSON
        json_path = Path(__file__).parent / "documentation" / "openapi.json"
        with open(json_path, 'w') as f:
            json.dump(openapi_spec, f, indent=2, default=str)
        
        # Export to YAML
        yaml_path = Path(__file__).parent / "documentation" / "openapi.yaml" 
        with open(yaml_path, 'w') as f:
            yaml.dump(openapi_spec, f, default_flow_style=False, sort_keys=False)
        
        # Generate summary
        summary = generate_api_summary(openapi_spec)
        
        return {
            "json_path": str(json_path),
            "yaml_path": str(yaml_path),
            "summary": summary
        }
    
    def generate_api_summary(spec):
        """Generate API summary from OpenAPI spec"""
        paths = spec.get("paths", {})
        components = spec.get("components", {})
        
        # Count endpoints by method
        methods = {}
        tags = set()
        
        for path, path_spec in paths.items():
            for method, endpoint in path_spec.items():
                if method in ["get", "post", "put", "delete", "patch"]:
                    methods[method.upper()] = methods.get(method.upper(), 0) + 1
                    
                    # Collect tags
                    endpoint_tags = endpoint.get("tags", [])
                    tags.update(endpoint_tags)
        
        # Count schemas
        schemas = len(components.get("schemas", {}))
        security_schemes = len(components.get("securitySchemes", {}))
        
        return {
            "version": spec["info"]["version"],
            "title": spec["info"]["title"],
            "total_endpoints": sum(methods.values()),
            "methods": methods,
            "tags": sorted(list(tags)),
            "schemas": schemas,
            "security_schemes": security_schemes,
            "webhook_events": len(spec.get("webhooks", {})),
            "servers": len(spec.get("servers", []))
        }
    
    if __name__ == "__main__":
        try:
            result = generate_openapi_spec()
            
            print("✅ OpenAPI Specification Generated Successfully!")
            print(f"📄 JSON: {result['json_path']}")
            print(f"📄 YAML: {result['yaml_path']}")
            print("\n📊 API Summary:")
            
            summary = result['summary']
            print(f"   Version: {summary['version']}")
            print(f"   Title: {summary['title']}")
            print(f"   Total Endpoints: {summary['total_endpoints']}")
            print(f"   HTTP Methods: {summary['methods']}")
            print(f"   API Groups: {len(summary['tags'])} ({', '.join(summary['tags'])})")
            print(f"   Data Models: {summary['schemas']}")
            print(f"   Auth Methods: {summary['security_schemes']}")
            print(f"   Webhook Events: {summary['webhook_events']}")
            print(f"   Server Environments: {summary['servers']}")
            
            print("\n🚀 Next Steps:")
            print("   1. Import openapi.json into Swagger Editor")
            print("   2. Import Postman collection for testing")
            print("   3. Review interactive docs at /docs and /redoc")
            print("   4. Set up webhooks for event notifications")
            print("   5. Create API keys for bot integration")
            
        except Exception as e:
            print(f"❌ Error generating OpenAPI spec: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)

except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Make sure all required dependencies are installed:")
    print("pip install fastapi uvicorn pydantic jose passlib redis aiohttp")
    sys.exit(1)
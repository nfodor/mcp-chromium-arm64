# MCP Server Discovery Files

This repository contains several standardized files that make the MCP Chromium ARM64 Server easily discoverable by other MCP implementations, marketplaces, and tools.

## Discovery Files Overview

### Core MCP Metadata
- **`mcp.json`** - Primary MCP server metadata with comprehensive information
- **`tools-manifest.json`** - Detailed tool schemas and usage examples  
- **`api-schema.json`** - OpenAPI 3.0 specification for all endpoints

### Registry & Marketplace Integration
- **`.mcp-registry.json`** - MCP server registry entry format
- **`.claude-code-marketplace.json`** - Claude Code marketplace listing metadata

## File Purposes

### `mcp.json` - Primary Server Metadata
Contains comprehensive server information including:
- Server name, version, description, author
- Platform support and requirements
- All 22 available tools with descriptions
- Use cases and capabilities
- Performance benchmarks
- ROI analysis data
- Integration instructions

**Used by**: MCP registries, documentation generators, IDE extensions

### `tools-manifest.json` - Tool Discovery
Detailed manifest of all browser automation tools:
- Complete input/output schemas for each tool
- Tool categorization (navigation, interaction, monitoring, etc.)
- Workflow examples for common use cases
- Natural language integration examples
- Capability mappings

**Used by**: Tool discovery systems, auto-completion, documentation

### `api-schema.json` - OpenAPI Specification
Standard OpenAPI 3.0 documentation:
- Complete API endpoint documentation
- Request/response schemas
- Tool parameter validation
- Example requests and responses
- Standards-compliant API documentation

**Used by**: API documentation tools, client generators, testing frameworks

### `.mcp-registry.json` - Registry Integration
Standardized format for MCP server registries:
- Registry-specific metadata
- Search optimization tags
- Category classifications
- Installation instructions
- Performance metrics
- ROI calculations

**Used by**: MCP server registries, package managers, discovery platforms

### `.claude-code-marketplace.json` - Marketplace Listing
Claude Code marketplace-specific metadata:
- Value proposition and use cases
- Before/after scenarios
- Testimonials and case studies
- Pricing and ROI information
- Feature highlights
- Demo scenarios

**Used by**: Claude Code marketplace, recommendation engines

## Discovery Standards

### File Naming Convention
- `mcp.json` - Primary metadata (standard)
- `tools-manifest.json` - Tool schemas (convention)
- `api-schema.json` - OpenAPI spec (standard)
- `.mcp-registry.json` - Registry format (hidden file)
- `.claude-code-marketplace.json` - Marketplace format (hidden file)

### Key Identifiers
All files use consistent identifiers:
- **Name**: `chromium-arm64` / `MCP Chromium ARM64 Server`
- **Slug**: `chromium-arm64`
- **Version**: `1.3.0`
- **Category**: `browser-automation`
- **Primary Use Case**: `Claude Code Web App Quality Confidence`

### Search Tags
Standardized tags across all files:
- `claude-code-integration`
- `browser-automation`
- `web-app-quality`
- `arm64-optimized`
- `console-monitoring`
- `network-analysis`
- `quality-assurance`
- `ui-testing`
- `performance-monitoring`

## Integration Examples

### Registry Discovery
```javascript
// Registry systems can parse mcp.json
const serverInfo = JSON.parse(fs.readFileSync('mcp.json'));
console.log(serverInfo.name); // "chromium-arm64"
console.log(serverInfo.tools.length); // 22 tools
console.log(serverInfo.primary_use_case); // Claude Code confidence
```

### Tool Auto-completion
```javascript
// IDEs can use tools-manifest.json for auto-complete
const manifest = JSON.parse(fs.readFileSync('tools-manifest.json'));
const navigateTool = manifest.mcp_tools_manifest.tools.find(t => t.name === 'navigate');
console.log(navigateTool.input_schema); // Complete schema for validation
```

### Marketplace Display
```javascript
// Marketplaces can use .claude-code-marketplace.json
const listing = JSON.parse(fs.readFileSync('.claude-code-marketplace.json'));
console.log(listing.claude_code_marketplace.value_proposition.headline);
// "Claude Code Web App Quality Confidence"
```

## Validation

Each file follows its respective schema:
- `mcp.json` - Custom MCP server metadata schema
- `tools-manifest.json` - Tool manifest schema with input/output validation
- `api-schema.json` - OpenAPI 3.0 specification
- Registry files - Platform-specific schemas

## Maintenance

These discovery files should be updated whenever:
- New tools are added
- Server version changes
- Use cases are updated
- Performance benchmarks change
- Integration methods are modified

All files maintain version synchronization with the main package version.

## Future Extensions

Planned additional discovery files:
- `docker-compose.discovery.yml` - Container deployment metadata
- `.github-marketplace.json` - GitHub Actions integration
- `helm-chart.discovery.yaml` - Kubernetes deployment metadata
- `.vscode-extension.json` - VS Code extension integration
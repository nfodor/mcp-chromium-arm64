#!/bin/bash

# VS Code MCP Configuration Script for Chromium ARM64 Server
# This script configures VS Code to use the MCP Chromium ARM64 server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[SETUP]${NC} $1"
}

# Detect the current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
MCP_SERVER_DIR="$SCRIPT_DIR/mcp-chromium-arm64-fresh"

print_header "VS Code MCP Server Configuration"
echo "Script directory: $SCRIPT_DIR"
echo "MCP Server directory: $MCP_SERVER_DIR"

# Check if we're in the right directory
if [ ! -f "$MCP_SERVER_DIR/index.js" ]; then
    print_error "index.js not found in $MCP_SERVER_DIR"
    print_error "Please run this script from the mcp-chromium-arm64 directory"
    exit 1
fi

# Check if package.json exists and has the right dependencies
if [ ! -f "$MCP_SERVER_DIR/package.json" ]; then
    print_error "package.json not found in $MCP_SERVER_DIR"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "$MCP_SERVER_DIR/node_modules" ]; then
    print_warning "node_modules not found. Installing dependencies..."
    cd "$MCP_SERVER_DIR"
    npm install
    cd "$SCRIPT_DIR"
fi

# Determine VS Code configuration directory
VSCODE_CONFIG_DIR=""
if [ -d "$HOME/.config/Code/User" ]; then
    VSCODE_CONFIG_DIR="$HOME/.config/Code/User"
elif [ -d "$HOME/.config/code-server/User" ]; then
    VSCODE_CONFIG_DIR="$HOME/.config/code-server/User"
elif [ -d "$HOME/Library/Application Support/Code/User" ]; then
    VSCODE_CONFIG_DIR="$HOME/Library/Application Support/Code/User"
elif [ -d "$HOME/AppData/Roaming/Code/User" ]; then
    VSCODE_CONFIG_DIR="$HOME/AppData/Roaming/Code/User"
else
    print_error "Could not find VS Code configuration directory"
    print_error "Please manually add the MCP server to your VS Code settings"
    print_error "Add this to your settings.json:"
    echo '{
  "mcp.servers": {
    "chromium-arm64": {
      "command": "node",
      "args": ["index.js"],
      "cwd": "'$MCP_SERVER_DIR'"
    }
  }
}'
    exit 1
fi

print_status "Found VS Code config directory: $VSCODE_CONFIG_DIR"

# Create settings.json if it doesn't exist
SETTINGS_FILE="$VSCODE_CONFIG_DIR/settings.json"
if [ ! -f "$SETTINGS_FILE" ]; then
    print_status "Creating new settings.json file"
    echo '{}' > "$SETTINGS_FILE"
fi

# Backup existing settings
cp "$SETTINGS_FILE" "$SETTINGS_FILE.backup.$(date +%Y%m%d_%H%M%S)"
print_status "Backup created: $SETTINGS_FILE.backup.$(date +%Y%m%d_%H%M%S)"

# Use Python to modify the JSON file
python3 << EOF
import json
import sys

settings_file = "$SETTINGS_FILE"
mcp_server_dir = "$MCP_SERVER_DIR"

try:
    with open(settings_file, 'r') as f:
        settings = json.load(f)
except json.JSONDecodeError:
    print("Invalid JSON in settings.json, creating new settings")
    settings = {}

# Add MCP server configuration
if 'mcp.servers' not in settings:
    settings['mcp.servers'] = {}

settings['mcp.servers']['chromium-arm64'] = {
    "command": "node",
    "args": ["index.js"],
    "cwd": mcp_server_dir
}

# Write back to file
with open(settings_file, 'w') as f:
    json.dump(settings, f, indent=2)

print("✓ VS Code settings updated successfully")
EOF

if [ $? -eq 0 ]; then
    print_status "✓ MCP server added to VS Code settings"
    print_status "✓ Server name: chromium-arm64"
    print_status "✓ Command: node index.js"
    print_status "✓ Working directory: $MCP_SERVER_DIR"
    echo
    print_header "Next Steps:"
    echo "1. Restart VS Code to load the new MCP server"
    echo "2. The MCP server should be available in the MCP panel"
    echo "3. You can now use the chromium-arm64 tools in VS Code"
    echo
    print_header "Available Tools:"
    echo "• navigate - Navigate to URLs"
    echo "• screenshot - Capture screenshots"
    echo "• click - Click elements by CSS selector"
    echo "• fill - Fill input fields"
    echo "• evaluate - Execute JavaScript"
    echo "• get_content - Extract page content"
    echo "• hover - Hover over elements"
    echo "• select - Select dropdown options"
    echo "• get_console_logs - Get console output"
    echo "• get_network_logs - Monitor network requests"
    echo "• run_accessibility_audit - Check accessibility"
    echo "• run_performance_audit - Performance analysis"
    echo "• run_seo_audit - SEO validation"
    echo "• close_browser - Clean shutdown"
    echo
    print_status "Configuration complete!"
else
    print_error "Failed to update VS Code settings"
    exit 1
fi
#!/bin/bash
# System-wide installation script for MCP Chromium Browser-Only Mode
# This script installs the browser-only MCP server globally for safe browsing

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🌐 MCP Chromium Browser-Only System-Wide Installation${NC}"
echo ""

# Get the absolute path of the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if Claude Code is installed
if ! command -v claude &> /dev/null; then
    echo -e "${RED}❌ Claude Code CLI not found. Please install it first:${NC}"
    echo "npm install -g @anthropic-ai/claude-code"
    exit 1
fi

# Remove any existing installation
echo -e "${YELLOW}📦 Removing any existing MCP server installations...${NC}"
claude mcp remove chromium-arm64 --scope user 2>/dev/null || true
claude mcp remove chromium-browser-only --scope user 2>/dev/null || true

# Install the browser-only MCP server globally (user scope)
echo -e "${GREEN}🔧 Installing MCP Browser-Only Server system-wide...${NC}"
claude mcp add chromium-browser-only "$SCRIPT_DIR/mcp-browser-only.sh" --scope user

# Verify installation
echo ""
echo -e "${GREEN}✅ Verifying installation...${NC}"
claude mcp list

echo ""
echo -e "${GREEN}🎉 Browser-only system-wide installation complete!${NC}"
echo ""
echo -e "${YELLOW}📝 Available tools (5 safe browsing tools):${NC}"
echo "  ✅ navigate - Go to any URL"
echo "  ✅ get_content - Extract page text or HTML"
echo "  ✅ screenshot - Capture page images"
echo "  ✅ evaluate - Run read-only JavaScript"
echo "  ✅ close_browser - Clean shutdown"
echo ""
echo -e "${YELLOW}❌ Disabled tools for safety:${NC}"
echo "  ❌ No form filling or clicking"
echo "  ❌ No console/network monitoring"
echo "  ❌ No testing/auditing tools"
echo ""
echo -e "${GREEN}📍 Installation location:${NC} $SCRIPT_DIR"
echo -e "${GREEN}🌍 Scope:${NC} User-wide (available in all projects)"
echo ""
echo -e "${YELLOW}💡 To switch back to full version:${NC}"
echo "  ./install-system-wide.sh"
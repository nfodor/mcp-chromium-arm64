#!/bin/bash
# System-wide installation script for MCP Chromium ARM64 Server
# This script installs the MCP server globally for use across all projects

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 MCP Chromium ARM64 System-Wide Installation${NC}"
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

# Install the full MCP server globally (user scope)
echo -e "${GREEN}🔧 Installing MCP Chromium ARM64 Server system-wide...${NC}"
claude mcp add chromium-arm64 "$SCRIPT_DIR/mcp-wrapper.sh" --scope user

# Verify installation
echo ""
echo -e "${GREEN}✅ Verifying installation...${NC}"
claude mcp list

echo ""
echo -e "${GREEN}🎉 System-wide installation complete!${NC}"
echo ""
echo -e "${YELLOW}📝 Usage instructions:${NC}"
echo "1. The MCP server is now available in ALL Claude Code sessions"
echo "2. Start a new Claude session: claude"
echo "3. Use browser automation tools in any project:"
echo "   - Navigate to URLs: 'Navigate to https://example.com'"
echo "   - Take screenshots: 'Take a screenshot of the page'"
echo "   - Extract content: 'Get the text content of the page'"
echo ""
echo -e "${YELLOW}💡 Browser-Only Mode:${NC}"
echo "For safe browsing without form/click capabilities:"
echo "  ./install-browser-only-system-wide.sh"
echo ""
echo -e "${GREEN}📍 Installation location:${NC} $SCRIPT_DIR"
echo -e "${GREEN}🌍 Scope:${NC} User-wide (available in all projects)"
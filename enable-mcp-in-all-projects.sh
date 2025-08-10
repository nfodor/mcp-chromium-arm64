#!/bin/bash
# Script to enable MCP servers in all projects by setting enableAllProjectMcpServers to true

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Enabling MCP Servers in All Projects${NC}"
echo ""

CLAUDE_CONFIG="$HOME/.claude.json"

if [ ! -f "$CLAUDE_CONFIG" ]; then
    echo -e "${RED}❌ Claude config file not found: $CLAUDE_CONFIG${NC}"
    exit 1
fi

echo -e "${YELLOW}📝 Backing up Claude configuration...${NC}"
cp "$CLAUDE_CONFIG" "${CLAUDE_CONFIG}.backup"

echo -e "${YELLOW}🔄 Updating project MCP settings...${NC}"

# Use jq to enable MCP servers in all project configurations
jq '
  walk(
    if type == "object" and has("enableAllProjectMcpServers") then
      .enableAllProjectMcpServers = true
    else
      .
    end
  )
' "$CLAUDE_CONFIG" > "${CLAUDE_CONFIG}.tmp" && mv "${CLAUDE_CONFIG}.tmp" "$CLAUDE_CONFIG"

echo -e "${GREEN}✅ Successfully enabled MCP servers in all projects!${NC}"
echo ""
echo -e "${YELLOW}📍 Changes made:${NC}"
echo "- Set enableAllProjectMcpServers = true in all project configurations"
echo "- This allows user-level MCP servers to be available in all projects"
echo "- Backup saved as: ${CLAUDE_CONFIG}.backup"
echo ""
echo -e "${GREEN}🚀 Your chromium-arm64 MCP server is now available in ALL Claude sessions!${NC}"
echo ""
echo -e "${YELLOW}💡 To verify:${NC}"
echo "1. Start Claude in any project: cd ~/dev/your_project && claude"
echo "2. Ask Claude to use chromium-arm64 tools"
echo "3. The MCP server should now be accessible"
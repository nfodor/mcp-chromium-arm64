# VS Code MCP Integration Guide

## Overview

Your MCP Chromium ARM64 server is now configured and ready to use in VS Code! This guide explains how to access and use the browser automation tools directly within the VS Code environment.

## ✅ Configuration Complete

The MCP server has been successfully added to your VS Code settings with:
- **Server Name**: `chromium-arm64`
- **Command**: `node index.js`
- **Working Directory**: `/home/pi/dev/mcp-chromium-arm64/mcp-chromium-arm64-fresh`

## 🔄 Next Steps

### 1. Restart VS Code
**Important**: You must restart VS Code for the new MCP server to be recognized.

```bash
# If running VS Code from terminal:
code --restart

# Or close and reopen VS Code manually
```

### 2. Access MCP Tools in VS Code

After restarting VS Code, you can access the MCP server in several ways:

#### Method 1: Command Palette
1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "MCP" to see available MCP commands
3. Select "MCP: List Available Tools" to see all tools from the chromium-arm64 server

#### Method 2: MCP Panel (if available)
1. Look for an MCP panel in the sidebar or bottom panel
2. Select the `chromium-arm64` server
3. Browse available tools

#### Method 3: Chat Interface (if MCP chat is enabled)
You can directly ask VS Code to use specific tools:
- "Use the chromium-arm64 server to navigate to https://example.com"
- "Take a screenshot using the chromium-arm64 tools"
- "Run an accessibility audit on the current page"

## 🛠️ Available Tools

Your MCP server provides 22 powerful browser automation tools:

### Core Browser Control
- **navigate** - Navigate to any URL
- **screenshot** - Capture page screenshots (viewport or full page)
- **click** - Click elements using CSS selectors
- **fill** - Fill input fields and forms
- **hover** - Hover over elements for interactions
- **select** - Select dropdown options
- **evaluate** - Execute JavaScript code in the browser
- **get_content** - Extract page HTML or text content

### Monitoring & Debugging
- **get_console_logs** - Retrieve browser console output
- **get_console_errors** - Get only console error messages
- **get_network_logs** - Monitor all network requests/responses
- **get_network_errors** - Track failed network requests (4xx/5xx)
- **wipe_logs** - Clear all stored logs from memory
- **get_selected_element** - Get info about focused elements
- **run_debugger_mode** - Comprehensive debugging information

### Audit & Analysis Tools
- **run_accessibility_audit** - Check accessibility compliance
- **run_performance_audit** - Measure page performance
- **run_seo_audit** - Validate SEO best practices
- **run_best_practices_audit** - Check web standards compliance
- **run_nextjs_audit** - Next.js specific optimizations
- **run_audit_mode** - Run all audits with comprehensive report

### System Control
- **close_browser** - Clean shutdown of browser instance

## 💡 Usage Examples

### Example 1: Basic Web Navigation
```json
{
  "tool": "navigate",
  "arguments": {
    "url": "https://github.com"
  }
}
```

### Example 2: Taking Screenshots
```json
{
  "tool": "screenshot",
  "arguments": {
    "name": "github-homepage.png",
    "fullPage": true
  }
}
```

### Example 3: Form Automation
```json
{
  "tool": "fill",
  "arguments": {
    "selector": "input[name='q']",
    "value": "VS Code MCP"
  }
}
```

### Example 4: Running Audits
```json
{
  "tool": "run_accessibility_audit",
  "arguments": {}
}
```

### Example 5: JavaScript Execution
```json
{
  "tool": "evaluate",
  "arguments": {
    "script": "document.querySelector('h1').textContent"
  }
}
```

## 🧪 Testing the Integration

### Quick Test Commands

You can test the MCP server integration by running these from the terminal:

```bash
# Test basic connectivity
cd /home/pi/dev/mcp-chromium-arm64/mcp-chromium-arm64-fresh
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node index.js

# Test navigation
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"navigate","arguments":{"url":"https://example.com"}}}' | node index.js

# Test screenshot
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"screenshot","arguments":{"name":"test.png"}}}' | node index.js
```

## 🔧 Troubleshooting

### Server Not Appearing in VS Code
1. Ensure VS Code has been restarted after configuration
2. Check that the MCP extension is installed and enabled
3. Verify the settings.json file contains the server configuration:
   ```json
   {
     "mcp.servers": {
       "chromium-arm64": {
         "command": "node",
         "args": ["index.js"],
         "cwd": "/home/pi/dev/mcp-chromium-arm64/mcp-chromium-arm64-fresh"
       }
     }
   }
   ```

### Server Errors
1. Check that Node.js is installed: `node --version`
2. Verify dependencies are installed: `npm list` in the server directory
3. Test the server directly using the terminal commands above
4. Check that Chromium browser is installed: `chromium-browser --version`

### Browser Automation Issues
1. Ensure Chromium/Chrome is installed and accessible
2. Check system resources (RAM and CPU usage)
3. Test with simple pages first (like example.com)
4. Review console logs using the `get_console_logs` tool

## 📁 File Locations

- **MCP Server Code**: `/home/pi/dev/mcp-chromium-arm64/mcp-chromium-arm64-fresh/index.js`
- **VS Code Settings**: `/home/pi/.config/Code/User/settings.json`
- **Screenshots**: Saved to `/tmp/` directory by default
- **Configuration Script**: `/home/pi/dev/mcp-chromium-arm64/configure-vscode-mcp.sh`

## 🚀 Next Steps

1. **Restart VS Code** to load the MCP server
2. **Explore the tools** using the Command Palette or MCP panel
3. **Test basic functionality** with navigation and screenshots
4. **Build workflows** combining multiple tools for automated testing
5. **Integrate with your projects** for QA and development tasks

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review the main project README.md for detailed documentation
3. Test the server directly using terminal commands
4. Check VS Code's output panel for MCP-related errors

---

**Congratulations!** Your MCP Chromium ARM64 server is now ready to provide powerful browser automation directly within VS Code. Happy automating! 🎉
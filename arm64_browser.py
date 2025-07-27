#!/usr/bin/env python3
"""
ARM64 Browser Automation - Global tool for Claude Code cross-session access

This module provides browser automation capabilities that work from any session
by automatically finding the MCP server path and calling the appropriate tools.

Usage from any Python session:
    import sys
    sys.path.append('/path/to/claude-arm64-browser')
    import arm64_browser
    
    arm64_browser.navigate("https://example.com")
    arm64_browser.screenshot("test.png")
"""

import subprocess
import json
import os
import sys
from typing import Dict, Any, Optional

# Determine MCP server directory relative to this file
MCP_SERVER_PATH = os.path.dirname(os.path.abspath(__file__))
if MCP_SERVER_PATH not in sys.path:
    sys.path.append(MCP_SERVER_PATH)

def call_mcp_tool(tool_name: str, **kwargs) -> str:
    """Call an MCP tool with the given arguments.
    
    Args:
        tool_name: Name of the MCP tool to call
        **kwargs: Arguments to pass to the tool
        
    Returns:
        Tool result or error message
    """
    request = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": kwargs},
        "id": 1
    }
    
    try:
        result = subprocess.run(
            ["node", os.path.join(MCP_SERVER_PATH, "index.js")],
            input=json.dumps(request),
            text=True,
            capture_output=True,
            timeout=30,
            cwd=MCP_SERVER_PATH
        )
        
        # Parse both stdout and stderr for JSON responses
        all_output = result.stdout + result.stderr
        lines = [line for line in all_output.strip().split('\n') if line.startswith('{"')]
        
        for line in lines:
            try:
                response = json.loads(line)
                if 'result' in response:
                    content = response.get('result', {}).get('content', [{}])
                    return content[0].get('text', f'Tool {tool_name} executed successfully')
                elif 'error' in response:
                    return f"Error: {response['error']['message']}"
            except json.JSONDecodeError:
                continue
        
        return f"No valid response found. Output: {all_output[:200]}"
        
    except FileNotFoundError:
        return f"MCP server not found. Please ensure Node.js is installed and index.js exists in {MCP_SERVER_PATH}"
    except Exception as e:
        return f"Tool execution error: {e}"

def navigate(url: str) -> str:
    """Navigate to a URL"""
    return call_mcp_tool("navigate", url=url)

def screenshot(name: str = "screenshot.png", full_page: bool = False) -> str:
    """Take a screenshot"""
    return call_mcp_tool("screenshot", name=name, fullPage=full_page)

def click(selector: str) -> str:
    """Click an element by CSS selector"""
    return call_mcp_tool("click", selector=selector)

def fill(selector: str, value: str) -> str:
    """Fill a form field"""
    return call_mcp_tool("fill", selector=selector, value=value)

def evaluate(script: str) -> str:
    """Execute JavaScript in the browser"""
    return call_mcp_tool("evaluate", script=script)

def get_content(content_type: str = "text") -> str:
    """Get page content (text or html)"""
    return call_mcp_tool("get_content", type=content_type)

def close_browser() -> str:
    """Close the browser"""
    return call_mcp_tool("close_browser")

def test_browser() -> str:
    """Test browser functionality with a simple workflow"""
    try:
        # Navigate to a test page
        nav_result = navigate("https://example.com")
        print(f"Navigation: {nav_result}")
        
        # Take a screenshot
        screenshot_result = screenshot("test_example.png")
        print(f"Screenshot: {screenshot_result}")
        
        # Get page title
        title_result = evaluate("document.title")
        print(f"Page title: {title_result}")
        
        # Get page content
        content_result = get_content("text")
        print(f"Content length: {len(content_result)} characters")
        
        return "✅ Browser test completed successfully"
        
    except Exception as e:
        return f"❌ Browser test failed: {e}"

# Make all functions available at module level
__all__ = [
    'navigate',
    'screenshot', 
    'click',
    'fill',
    'evaluate',
    'get_content',
    'close_browser',
    'test_browser',
    'call_mcp_tool'
]

if __name__ == "__main__":
    print("🚀 ARM64 Browser Automation Tool")
    print("=" * 40)
    print(test_browser())
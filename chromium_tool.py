#!/usr/bin/env python3
"""
ARM64 Chromium Tool for Claude Code
A direct tool implementation that bypasses MCP server issues
"""

import subprocess
import json
import sys
import os
import tempfile
from typing import Dict, Any, Optional

class ChromiumARM64Tool:
    def __init__(self):
        # Dynamically determine paths based on script location
        script_dir = os.path.dirname(os.path.abspath(__file__))
        self.server_path = os.path.join(script_dir, "index.js")
        self.working_dir = script_dir
        
    def _call_mcp_server(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Call our MCP server directly and return the result."""
        request = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": method,
                "arguments": params
            },
            "id": 1
        }
        
        try:
            # Run the MCP server with the request
            process = subprocess.run(
                ["node", self.server_path],
                input=json.dumps(request),
                text=True,
                capture_output=True,
                timeout=30,
                cwd=self.working_dir
            )
            
            if process.returncode == 0:
                # Parse the JSON response
                lines = process.stdout.strip().split('\n')
                for line in lines:
                    if line.startswith('{"result"'):
                        response = json.loads(line)
                        return response.get('result', {})
            
            return {"error": f"Server error: {process.stderr}"}
            
        except subprocess.TimeoutExpired:
            return {"error": "Request timeout"}
        except json.JSONDecodeError as e:
            return {"error": f"JSON decode error: {e}"}
        except Exception as e:
            return {"error": f"Unexpected error: {e}"}
    
    def navigate(self, url: str) -> str:
        """Navigate to a URL."""
        result = self._call_mcp_server("navigate", {"url": url})
        if "error" in result:
            return f"Error: {result['error']}"
        
        content = result.get("content", [{}])
        return content[0].get("text", "Navigation completed")
    
    def screenshot(self, name: str = "screenshot.png", full_page: bool = False) -> str:
        """Take a screenshot of the current page."""
        result = self._call_mcp_server("screenshot", {"name": name, "fullPage": full_page})
        if "error" in result:
            return f"Error: {result['error']}"
        
        content = result.get("content", [{}])
        return content[0].get("text", "Screenshot taken")
    
    def click(self, selector: str) -> str:
        """Click an element by CSS selector."""
        result = self._call_mcp_server("click", {"selector": selector})
        if "error" in result:
            return f"Error: {result['error']}"
        
        content = result.get("content", [{}])
        return content[0].get("text", "Element clicked")
    
    def fill(self, selector: str, value: str) -> str:
        """Fill an input field by CSS selector."""
        result = self._call_mcp_server("fill", {"selector": selector, "value": value})
        if "error" in result:
            return f"Error: {result['error']}"
        
        content = result.get("content", [{}])
        return content[0].get("text", "Field filled")
    
    def evaluate(self, script: str) -> str:
        """Execute JavaScript in the browser."""
        result = self._call_mcp_server("evaluate", {"script": script})
        if "error" in result:
            return f"Error: {result['error']}"
        
        content = result.get("content", [{}])
        return content[0].get("text", "Script executed")
    
    def get_content(self, content_type: str = "text") -> str:
        """Get page content (html or text)."""
        result = self._call_mcp_server("get_content", {"type": content_type})
        if "error" in result:
            return f"Error: {result['error']}"
        
        content = result.get("content", [{}])
        return content[0].get("text", "No content")
    
    def close_browser(self) -> str:
        """Close the browser instance."""
        result = self._call_mcp_server("close_browser", {})
        if "error" in result:
            return f"Error: {result['error']}"
        
        content = result.get("content", [{}])
        return content[0].get("text", "Browser closed")

def main():
    """CLI interface for the tool."""
    if len(sys.argv) < 2:
        print("Usage: python3 chromium_tool.py <command> [args...]")
        print("Commands: navigate, screenshot, click, fill, evaluate, get_content, close_browser")
        return
    
    tool = ChromiumARM64Tool()
    command = sys.argv[1]
    
    try:
        if command == "navigate" and len(sys.argv) >= 3:
            result = tool.navigate(sys.argv[2])
        elif command == "screenshot":
            name = sys.argv[2] if len(sys.argv) >= 3 else "screenshot.png"
            result = tool.screenshot(name)
        elif command == "click" and len(sys.argv) >= 3:
            result = tool.click(sys.argv[2])
        elif command == "fill" and len(sys.argv) >= 4:
            result = tool.fill(sys.argv[2], sys.argv[3])
        elif command == "evaluate" and len(sys.argv) >= 3:
            result = tool.evaluate(sys.argv[2])
        elif command == "get_content":
            content_type = sys.argv[2] if len(sys.argv) >= 3 else "text"
            result = tool.get_content(content_type)
        elif command == "close_browser":
            result = tool.close_browser()
        else:
            result = f"Unknown command: {command}"
        
        print(result)
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
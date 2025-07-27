#!/usr/bin/env python3
"""
ARM64 Browser Tools - Custom functions for Claude Code
Direct integration bypassing broken MCP server connections
"""

import subprocess
import json
import tempfile
import os
from typing import Dict, Any

def arm64_browser_navigate(url: str) -> str:
    """Navigate to a URL using ARM64 Chromium browser.
    
    Args:
        url: The URL to navigate to
        
    Returns:
        Success message or error details
    """
    request = {
        "jsonrpc": "2.0",
        "method": "tools/call", 
        "params": {"name": "navigate", "arguments": {"url": url}},
        "id": 1
    }
    
    try:
        result = subprocess.run(
            ["node", "/home/pi/dev/vitrain/mcp-chromium-server/index.js"],
            input=json.dumps(request),
            text=True,
            capture_output=True,
            timeout=30,
            cwd="/home/pi/dev/vitrain/mcp-chromium-server"
        )
        
        # Parse both stdout and stderr for JSON responses
        all_output = result.stdout + result.stderr
        lines = [line for line in all_output.strip().split('\n') if line.startswith('{"')]
        
        for line in lines:
            try:
                response = json.loads(line)
                if 'result' in response:
                    content = response.get('result', {}).get('content', [{}])
                    return content[0].get('text', f'Successfully navigated to {url}')
            except json.JSONDecodeError:
                continue
        
        return f"No valid response found. Output: {all_output[:200]}"
        
    except Exception as e:
        return f"Navigation error: {e}"

def arm64_browser_screenshot(name: str = "screenshot.png", full_page: bool = False) -> str:
    """Take a screenshot using ARM64 Chromium browser.
    
    Args:
        name: Filename for the screenshot
        full_page: Whether to capture the full page
        
    Returns:
        Path to screenshot file or error message
    """
    request = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": "screenshot", "arguments": {"name": name, "fullPage": full_page}},
        "id": 1
    }
    
    try:
        result = subprocess.run(
            ["node", "/home/pi/dev/vitrain/mcp-chromium-server/index.js"],
            input=json.dumps(request),
            text=True,
            capture_output=True,
            timeout=30,
            cwd="/home/pi/dev/vitrain/mcp-chromium-server"
        )
        
        # Parse both stdout and stderr for JSON responses
        all_output = result.stdout + result.stderr
        lines = [line for line in all_output.strip().split('\n') if line.startswith('{"')]
        
        for line in lines:
            try:
                response = json.loads(line)
                if 'result' in response:
                    content = response.get('result', {}).get('content', [{}])
                    return content[0].get('text', f'Screenshot saved as {name}')
            except json.JSONDecodeError:
                continue
        
        return f"No valid response found. Output: {all_output[:200]}"
        
    except Exception as e:
        return f"Screenshot error: {e}"

def arm64_browser_get_content(content_type: str = "text") -> str:
    """Get page content using ARM64 Chromium browser.
    
    Args:
        content_type: 'text' or 'html'
        
    Returns:
        Page content or error message
    """
    request = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": "get_content", "arguments": {"type": content_type}},
        "id": 1
    }
    
    try:
        result = subprocess.run(
            ["node", "/home/pi/dev/vitrain/mcp-chromium-server/index.js"],
            input=json.dumps(request),
            text=True,
            capture_output=True,
            timeout=30,
            cwd="/home/pi/dev/vitrain/mcp-chromium-server"
        )
        
        # Parse both stdout and stderr for JSON responses
        all_output = result.stdout + result.stderr
        lines = [line for line in all_output.strip().split('\n') if line.startswith('{"')]
        
        for line in lines:
            try:
                response = json.loads(line)
                if 'result' in response:
                    content = response.get('result', {}).get('content', [{}])
                    return content[0].get('text', 'No content retrieved')
            except json.JSONDecodeError:
                continue
        
        return f"No valid response found. Output: {all_output[:200]}"
        
    except Exception as e:
        return f"Content retrieval error: {e}"

def arm64_browser_evaluate(script: str) -> str:
    """Execute JavaScript in ARM64 Chromium browser.
    
    Args:
        script: JavaScript code to execute
        
    Returns:
        Script result or error message
    """
    request = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": "evaluate", "arguments": {"script": script}},
        "id": 1
    }
    
    try:
        result = subprocess.run(
            ["node", "/home/pi/dev/vitrain/mcp-chromium-server/index.js"],
            input=json.dumps(request),
            text=True,
            capture_output=True,
            timeout=30,
            cwd="/home/pi/dev/vitrain/mcp-chromium-server"
        )
        
        # Parse both stdout and stderr for JSON responses
        all_output = result.stdout + result.stderr
        lines = [line for line in all_output.strip().split('\n') if line.startswith('{"')]
        
        for line in lines:
            try:
                response = json.loads(line)
                if 'result' in response:
                    content = response.get('result', {}).get('content', [{}])
                    return content[0].get('text', 'Script executed')
            except json.JSONDecodeError:
                continue
        
        return f"No valid response found. Output: {all_output[:200]}"
        
    except Exception as e:
        return f"JavaScript execution error: {e}"

# Make functions available at module level
__all__ = [
    'arm64_browser_navigate',
    'arm64_browser_screenshot', 
    'arm64_browser_get_content',
    'arm64_browser_evaluate'
]
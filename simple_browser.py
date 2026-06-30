#!/usr/bin/env python3
"""
Simple ARM64 Browser Tool - Direct approach
"""

import subprocess
import json
import os
import sys

# Dynamically determine the server directory
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))

def _call(name, args, fallback):
    """Send a JSON-RPC tools/call to index.js over stdin (no shell)."""
    request = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": name, "arguments": args},
        "id": 1,
    }

    try:
        result = subprocess.run(
            ["node", os.path.join(SERVER_DIR, "index.js")],
            input=json.dumps(request),
            text=True,
            capture_output=True,
            timeout=15,
            cwd=SERVER_DIR,
        )

        # Look for JSON in both stdout and stderr
        all_output = result.stdout + result.stderr

        # Find the JSON response line
        for line in all_output.split('\n'):
            if '{"result"' in line:
                try:
                    response = json.loads(line)
                    content = response.get('result', {}).get('content', [{}])
                    return content[0].get('text', fallback)
                except json.JSONDecodeError:
                    continue

        return fallback

    except Exception as e:
        return f"Error: {e}"

def browser_navigate(url):
    """Navigate to URL using ARM64 Chromium."""
    return _call("navigate", {"url": url}, f"Successfully called navigate for {url}")

def browser_screenshot(name="test.png"):
    """Take screenshot using ARM64 Chromium."""
    return _call("screenshot", {"name": name}, f"Screenshot command sent for {name}")

def browser_evaluate(script):
    """Execute JavaScript using ARM64 Chromium."""
    return _call("evaluate", {"script": script}, "Script executed")

if __name__ == "__main__":
    print("=== Simple ARM64 Browser Demo ===")
    print()
    
    print("1. Navigate to httpbin.org...")
    nav_result = browser_navigate("https://httpbin.org")
    print(f"Navigation: {nav_result}")
    print()
    
    print("2. Get page title...")
    title_result = browser_evaluate("document.title")
    print(f"Title: {title_result}")
    print()
    
    print("3. Take screenshot...")
    screenshot_result = browser_screenshot("simple_demo.png")
    print(f"Screenshot: {screenshot_result}")
    print()
    
    print("=== Demo Complete ===")
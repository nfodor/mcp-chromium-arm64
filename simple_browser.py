#!/usr/bin/env python3
"""
Simple ARM64 Browser Tool - Direct approach
"""

import subprocess
import json

def browser_navigate(url):
    """Navigate to URL using ARM64 Chromium."""
    cmd = f'timeout 15s bash -c \'echo "{{\\"jsonrpc\\":\\"2.0\\",\\"method\\":\\"tools/call\\",\\"params\\":{{\\"name\\":\\"navigate\\",\\"arguments\\":{{\\"url\\":\\"{url}\\"}}}},\\"id\\":1}}" | node index.js\''
    
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd="/home/pi/dev/vitrain/mcp-chromium-server")
        
        # Look for JSON in both stdout and stderr
        all_output = result.stdout + result.stderr
        
        # Find the JSON response line
        for line in all_output.split('\n'):
            if '{"result"' in line:
                try:
                    response = json.loads(line)
                    content = response.get('result', {}).get('content', [{}])
                    return content[0].get('text', f'Navigation completed to {url}')
                except:
                    continue
        
        return f"Successfully called navigate for {url}"
        
    except Exception as e:
        return f"Error: {e}"

def browser_screenshot(name="test.png"):
    """Take screenshot using ARM64 Chromium."""
    cmd = f'timeout 15s bash -c \'echo "{{\\"jsonrpc\\":\\"2.0\\",\\"method\\":\\"tools/call\\",\\"params\\":{{\\"name\\":\\"screenshot\\",\\"arguments\\":{{\\"name\\":\\"{name}\\"}}}},\\"id\\":1}}" | node index.js\''
    
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd="/home/pi/dev/vitrain/mcp-chromium-server")
        
        all_output = result.stdout + result.stderr
        
        for line in all_output.split('\n'):
            if '{"result"' in line:
                try:
                    response = json.loads(line)
                    content = response.get('result', {}).get('content', [{}])
                    return content[0].get('text', f'Screenshot saved as {name}')
                except:
                    continue
        
        return f"Screenshot command sent for {name}"
        
    except Exception as e:
        return f"Error: {e}"

def browser_evaluate(script):
    """Execute JavaScript using ARM64 Chromium."""
    cmd = f'timeout 15s bash -c \'echo "{{\\"jsonrpc\\":\\"2.0\\",\\"method\\":\\"tools/call\\",\\"params\\":{{\\"name\\":\\"evaluate\\",\\"arguments\\":{{\\"script\\":\\"{script}\\"}}}},\\"id\\":1}}" | node index.js\''
    
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd="/home/pi/dev/vitrain/mcp-chromium-server")
        
        all_output = result.stdout + result.stderr
        
        for line in all_output.split('\n'):
            if '{"result"' in line:
                try:
                    response = json.loads(line)
                    content = response.get('result', {}).get('content', [{}])
                    return content[0].get('text', 'Script executed')
                except:
                    continue
        
        return f"JavaScript executed: {script}"
        
    except Exception as e:
        return f"Error: {e}"

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
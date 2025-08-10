# Browser-Only Mode Setup

This configuration limits Claude Code to only browsing capabilities - no form filling, clicking, or testing features. Perfect for safe web browsing and content extraction.

## Quick Setup

### 1. Install Browser-Only Version
```bash
# Add browser-only server to Claude Code
claude mcp add chromium-browser-only "$(pwd)/mcp-browser-only.sh" --scope user

# Verify it's connected
claude mcp list
# Should show: chromium-browser-only: /path/to/mcp-browser-only.sh - ✓ Connected
```

### 2. Start Using
```bash
# Start new Claude session
claude

# Claude can now browse safely:
"Use chromium-browser-only to navigate to https://news.ycombinator.com and summarize the top stories"

"Browse to https://example.com and extract all the text content for analysis"

"Take a screenshot of https://github.com and describe what you see"
```

## Available Tools (Browse-Only)

### ✅ **Allowed Tools (5 total):**
1. **`navigate`** - Go to any URL
2. **`get_content`** - Extract page text or HTML
3. **`screenshot`** - Capture page images
4. **`evaluate`** - Run read-only JavaScript (for page info)
5. **`close_browser`** - Clean shutdown

### ❌ **Disabled Tools (17 removed):**
- No form filling (`fill`)
- No clicking (`click`) 
- No hovering (`hover`)
- No dropdown selection (`select`)
- No console monitoring (`get_console_logs`)
- No network monitoring (`get_network_logs`)
- No testing/auditing tools
- No log management tools

## Use Cases

### ✅ **Perfect For:**
- Safe web browsing and research
- Content extraction and analysis
- Visual documentation (screenshots)
- Reading web pages and articles
- Gathering information from websites
- Academic research assistance
- News and content summarization

### ❌ **Not Suitable For:**
- Web app testing
- Form automation
- User interaction simulation
- Performance monitoring
- Debugging web applications
- E-commerce testing

## Example Commands

### Research and Content Analysis:
```bash
"Browse to the latest research paper at https://arxiv.org/abs/2301.00001 and summarize the key findings"

"Navigate to https://wikipedia.org and extract information about quantum computing"

"Go to https://news.bbc.com and give me a summary of today's top technology stories"
```

### Visual Documentation:
```bash
"Take a screenshot of https://github.com/microsoft/vscode for documentation purposes"

"Navigate to my company website and capture a full-page screenshot of the homepage"
```

### Page Analysis:
```bash
"Browse to https://example.com and analyze the page structure - what sections does it have?"

"Go to https://stackoverflow.com and extract the titles of the trending questions"
```

## Safety Benefits

### 🔒 **Security Advantages:**
- Cannot modify any web forms
- Cannot trigger button clicks or actions
- Cannot submit data anywhere
- Cannot interact with web applications
- Read-only access to web content
- No risk of accidental form submissions

### 🛡️ **Privacy Protection:**
- No credentials can be entered
- No personal data can be submitted
- No cookies or sessions modified
- Pure consumption of web content

## Switching Between Modes

### Switch to Browser-Only:
```bash
# Remove full server
claude mcp remove chromium-arm64

# Add browser-only version
claude mcp add chromium-browser-only "$(pwd)/mcp-browser-only.sh" --scope user
```

### Switch Back to Full Version:
```bash
# Remove browser-only server
claude mcp remove chromium-browser-only

# Add full server back
claude mcp add chromium-arm64 "$(pwd)/mcp-wrapper.sh" --scope user
```

## Testing Browser-Only Mode

```bash
# Test that only browsing tools are available
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node index-browser-only.js

# Should return only 5 tools: navigate, get_content, screenshot, evaluate, close_browser
```

## Performance

Browser-only mode has the same performance characteristics:
- **Navigation:** ~800ms on Raspberry Pi 4
- **Screenshots:** ~1.2s full page
- **Memory usage:** ~80MB baseline
- **Content extraction:** ~300ms typical page

## Troubleshooting

### If Claude doesn't see the browser-only tools:
```bash
# Restart Claude after switching
exit  # Exit current Claude session
claude  # Start new session
```

### Verify correct mode:
```bash
claude mcp list
# Should show "chromium-browser-only" not "chromium-arm64"
```

This configuration gives you all the benefits of Claude Code web browsing while maintaining complete safety from any interactive web operations! 🌐🔒
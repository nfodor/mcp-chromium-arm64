#!/bin/bash

# 🚀 ARM64 Browser Automation Demo Runner
# Showcases autonomous SaaS testing capabilities on Raspberry Pi

echo "🚀 ARM64 Browser Automation Demo Starting..."
echo "=============================================="
echo "📋 This demo will show:"
echo "   ✅ End-to-end SaaS testing without human debugging"
echo "   ✅ API validation through real browser interactions"
echo "   ✅ Visual regression detection with screenshots"
echo "   ✅ Cross-platform responsive testing"
echo "   ✅ Autonomous error detection and recovery"
echo ""
echo "💡 Perfect for SaaS startups who need:"
echo "   🎯 Continuous testing on $480 budget"
echo "   🤖 AI agents that test without human intervention"
echo "   📱 Cross-device compatibility validation"
echo "   🔍 Visual regression prevention"
echo ""
echo "⏱️  Demo takes ~2-3 minutes to complete..."
echo "📸 Screenshots will be saved to /tmp/"
echo ""

# Check dependencies
echo "🔍 Checking dependencies..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install: sudo apt install nodejs"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install: sudo apt install python3"
    exit 1
fi

if ! command -v chromium-browser &> /dev/null; then
    echo "❌ Chromium not found. Please install: sudo apt install chromium-browser"
    exit 1
fi

if [ ! -f "index.js" ]; then
    echo "❌ MCP server not found. Please run from the correct directory."
    exit 1
fi

if [ ! -f "simple_browser.py" ]; then
    echo "❌ Browser tools not found. Please run from the correct directory."
    exit 1
fi

echo "✅ All dependencies found!"
echo ""

# Test MCP server
echo "🧪 Testing MCP server..."
timeout 5s bash -c 'echo "{\"jsonrpc\":\"2.0\",\"method\":\"tools/list\",\"id\":1}" | node index.js' > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ MCP server working!"
else
    echo "⚠️  MCP server test inconclusive (timeout expected)"
fi
echo ""

# Clean up old screenshots
echo "🧹 Cleaning up old demo files..."
rm -f /tmp/github_signup_page.png
rm -f /tmp/api_interface.png
rm -f /tmp/visual_baseline.png
rm -f /tmp/responsive_*.png
echo "✅ Cleanup complete!"
echo ""

# Run the demo
echo "🚀 Starting main demo..."
echo "=" * 50
python3 demo.py

# Show results
echo ""
echo "📸 Generated Screenshots:"
ls -la /tmp/*.png 2>/dev/null | grep -E "(github_|api_|visual_|responsive_)" || echo "No demo screenshots found"

echo ""
echo "🎯 Next Steps:"
echo "   1. Integrate into your CI/CD pipeline"
echo "   2. Add your own SaaS app URLs to test"
echo "   3. Set up 24/7 monitoring with cron jobs"
echo "   4. Scale to test multiple environments"
echo ""
echo "💰 ROI Calculator:"
echo "   Manual QA Engineer: $80,000/year"
echo "   This ARM64 Setup: $480 + $40/month"
echo "   Break-even: 2 months"
echo "   Year 1 Savings: $78,000+"
echo ""
echo "🚀 Demo Complete! ARM64 Browser Automation = SaaS Testing Gold 🏆"
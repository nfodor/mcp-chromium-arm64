#!/bin/bash
# MCP Wrapper for chromium-arm64 server
# Ensures compatibility with Claude CLI

exec node "$(dirname "$0")/index.js" "$@"
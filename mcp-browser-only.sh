#!/bin/bash
# MCP Wrapper for browse-only functionality
# Only exposes navigation, content extraction, and basic interaction tools

exec node "$(dirname "$0")/index-browser-only.js" "$@"
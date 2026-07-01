#!/usr/bin/env bash
set -euo pipefail

# LaunchAgent entrypoint for running Memorwise directly from this checkout.
# Keeping this logic in-repo means local changes to startup behavior take effect
# the next time launchd restarts com.benjaminkoop.memorwise.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export HOME="${HOME:-/Users/benjaminkoop}"
export NODE_ENV=production
export MEMORWISE_DATA_DIR="${MEMORWISE_DATA_DIR:-$HOME/.memorwise/.memorwise}"

cd "$REPO_ROOT"

web_pid=""
mcp_pid=""

cleanup() {
	status=$?
	if [ -n "$web_pid" ]; then
		kill "$web_pid" 2>/dev/null || true
	fi
	if [ -n "$mcp_pid" ]; then
		kill "$mcp_pid" 2>/dev/null || true
	fi
	if [ -n "$web_pid" ]; then
		wait "$web_pid" 2>/dev/null || true
	fi
	if [ -n "$mcp_pid" ]; then
		wait "$mcp_pid" 2>/dev/null || true
	fi
	exit "$status"
}

trap cleanup INT TERM EXIT

node node_modules/next/dist/bin/next start --port 4747 &
web_pid=$!

node mcp-server.js &
mcp_pid=$!

while :; do
	if ! kill -0 "$web_pid" 2>/dev/null; then
		wait "$web_pid"
		exit $?
	fi
	if ! kill -0 "$mcp_pid" 2>/dev/null; then
		wait "$mcp_pid"
		exit $?
	fi
	sleep 2
done

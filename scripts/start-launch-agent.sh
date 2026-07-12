#!/usr/bin/env bash
set -euo pipefail

# LaunchAgent entrypoint for running The Stacks directly from this checkout.
# Keeping this logic in-repo means local changes to startup behavior take effect
# the next time launchd restarts com.benjaminkoop.thestacks.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT="${THE_STACKS_PORT:-4747}"

export HOME="${HOME:-/Users/benjaminkoop}"
export NODE_ENV=production
export THE_STACKS_DATA_DIR="${THE_STACKS_DATA_DIR:-$HOME/.the-stacks}"

cd "$REPO_ROOT"

# Free the port if a stale dev/prod process is still bound.
if command -v lsof >/dev/null 2>&1; then
	lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
fi

# Production server requires a build artifact.
if [ ! -f "$REPO_ROOT/.next/BUILD_ID" ]; then
	npm run build
fi

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

node node_modules/next/dist/bin/next start --port "$PORT" &
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

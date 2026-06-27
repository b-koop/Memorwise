#!/usr/bin/env bash
set -euo pipefail

# LaunchAgent entrypoint for running Memorwise directly from this checkout.
# Keeping this logic in-repo means local changes to startup behavior take effect
# the next time launchd restarts com.benjaminkoop.memorwise.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export HOME="${HOME:-/Users/benjaminkoop}"
export NODE_ENV="${NODE_ENV:-production}"
export MEMORWISE_DATA_DIR="${MEMORWISE_DATA_DIR:-$HOME/.memorwise/.memorwise}"

cd "$REPO_ROOT"
exec npm run start

#!/usr/bin/env bash
set -euo pipefail

# Migrates legacy Memorwise launch agent, then imports data if present.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "$REPO_ROOT/scripts/import-memorwise-data.sh" "$@"

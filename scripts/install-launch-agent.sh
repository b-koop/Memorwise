#!/usr/bin/env bash
set -euo pipefail

# Install or refresh the macOS LaunchAgent for The Stacks (production mode).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LABEL="com.benjaminkoop.thestacks"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/the-stacks"
NODE_BIN="$(command -v node || true)"

if [ -z "$NODE_BIN" ]; then
	echo "node not found in PATH"
	exit 1
fi

NODE_DIR="$(dirname "$NODE_BIN")"
mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || \
	launchctl unload "$PLIST" 2>/dev/null || true

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${REPO_ROOT}/scripts/start-launch-agent.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${HOME}</string>
    <key>PATH</key>
    <string>${NODE_DIR}:/Users/benjaminkoop/Library/pnpm:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>THE_STACKS_DATA_DIR</key>
    <string>${THE_STACKS_DATA_DIR:-$HOME/.the-stacks}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/the-stacks.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/the-stacks.err.log</string>
</dict>
</plist>
PLIST

echo "Building production bundle..."
(cd "$REPO_ROOT" && npm run build)

launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || \
	launchctl load "$PLIST"

echo "Installed LaunchAgent $LABEL (production)"
echo "Logs: $LOG_DIR"

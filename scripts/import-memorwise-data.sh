#!/usr/bin/env bash
set -euo pipefail

# Imports legacy Memorwise data into The Stacks (~/.the-stacks by default).
# Handles nested legacy dirs like ~/.memorwise/.memorwise and rewrites absolute paths.

HOME="${HOME:-$HOME}"
NEW_DATA="${THE_STACKS_DATA_DIR:-$HOME/.the-stacks}"
LABEL="com.benjaminkoop.thestacks"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"

legacy_candidates=(
  "$HOME/.memorwise/.memorwise"
  "$HOME/.memorwise"
  "./.memorwise"
)

OLD_DATA="${1:-}"
if [ -z "$OLD_DATA" ]; then
  for candidate in "${legacy_candidates[@]}"; do
    if [ -f "$candidate/memorwise.db" ] || [ -f "$candidate/thestacks.db" ]; then
      OLD_DATA="$(cd "$candidate" && pwd)"
      break
    fi
  done
fi

if [ -z "$OLD_DATA" ] || [ ! -d "$OLD_DATA" ]; then
  echo "No legacy Memorwise data found."
  echo "Usage: bash scripts/import-memorwise-data.sh [path-to-legacy-data-dir]"
  exit 1
fi

OLD_DATA="$(cd "$OLD_DATA" && pwd)"
echo "Importing from: $OLD_DATA"
echo "Importing into: $NEW_DATA"

if [ "$OLD_DATA" = "$NEW_DATA" ]; then
  echo "Source and destination are the same; nothing to do."
  exit 0
fi

if [ -f "$PLIST" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || \
    launchctl unload "$PLIST" 2>/dev/null || true
fi

if [ -d "$NEW_DATA" ] && [ "$(ls -A "$NEW_DATA" 2>/dev/null | wc -l | tr -d ' ')" != 0 ]; then
  backup="$NEW_DATA.import-backup-$(date +%Y%m%d-%H%M%S)"
  echo "Backing up current data to $backup"
  mv "$NEW_DATA" "$backup"
fi

mkdir -p "$NEW_DATA"
rsync -a "$OLD_DATA/" "$NEW_DATA/"

if [ -f "$NEW_DATA/memorwise.db" ]; then
  mv "$NEW_DATA/memorwise.db" "$NEW_DATA/thestacks.db"
fi
for suffix in -shm -wal; do
  if [ -f "$NEW_DATA/memorwise.db$suffix" ]; then
    mv "$NEW_DATA/memorwise.db$suffix" "$NEW_DATA/thestacks.db$suffix"
  fi
done

DB="$NEW_DATA/thestacks.db"
if [ ! -f "$DB" ]; then
  echo "Expected database at $DB after import"
  exit 1
fi

sqlite3 "$DB" "PRAGMA wal_checkpoint(TRUNCATE);"
sqlite3 "$DB" <<SQL
UPDATE sources
SET filepath = REPLACE(filepath, '$OLD_DATA', '$NEW_DATA')
WHERE filepath LIKE '$OLD_DATA%';
SQL

notebooks="$(sqlite3 "$DB" "select count(*) from notebooks;")"
sources="$(sqlite3 "$DB" "select count(*) from sources;")"
echo "Imported $notebooks notebooks and $sources sources into $NEW_DATA"

if [ -f "$PLIST" ]; then
  launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || \
    launchctl load "$PLIST" 2>/dev/null || true
  echo "Restarted LaunchAgent $LABEL"
fi

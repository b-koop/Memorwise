#!/usr/bin/env bash
set -euo pipefail

# Adds local.thestacks.com -> 127.0.0.1 and removes legacy memorwise host entries.
HOSTS_FILE="/etc/hosts"
MARKER_BEGIN="# the-stacks local dns"
MARKER_END="# end the-stacks local dns"
HOSTNAME="local.thestacks.com"
LEGACY_HOSTS=("local.memorwise.com" "memorwise.local")

if [ "$(id -u)" -ne 0 ]; then
  echo "Re-run with sudo: sudo bash scripts/setup-local-dns.sh"
  exit 1
fi

tmp="$(mktemp)"
awk -v begin="$MARKER_BEGIN" -v end="$MARKER_END" '
  $0 == begin { skip=1; next }
  $0 == end { skip=0; next }
  skip { next }
  { print }
' "$HOSTS_FILE" > "$tmp"

for legacy in local.memorwise.com memorwise.local; do
  awk -v h="$legacy" '$0 !~ h { print }' "$tmp" > "${tmp}.2" && mv "${tmp}.2" "$tmp"
done

{
  cat "$tmp"
  echo "$MARKER_BEGIN"
  echo "127.0.0.1 $HOSTNAME"
  echo "$MARKER_END"
} > "${tmp}.final"

mv "${tmp}.final" "$HOSTS_FILE"
rm -f "$tmp"

echo "Updated $HOSTS_FILE:"
grep -E "thestacks|memorwise" "$HOSTS_FILE" || echo "  (no memorwise entries; thestacks entry added)"

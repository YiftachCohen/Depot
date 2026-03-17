#!/usr/bin/env bash
#
# Lint guard: ensure Electron IPC calls go through the channel map
# rather than using raw .send() / .invoke() with hardcoded channel strings.
#
# Allowed patterns:
#   - channel-map.ts itself (defines the mappings)
#   - preload/index.ts (builds the API from channel map)
#   - test files
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ELECTRON_SRC="$ROOT_DIR/apps/electron/src"

ERRORS=0

# Check for raw ipcRenderer.send / ipcRenderer.invoke with string literals
# (excluding channel-map.ts, preload files, and test files)
while IFS= read -r file; do
  # Skip allowed files
  case "$file" in
    */channel-map.ts|*/preload/*|*.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx|*__tests__*) continue ;;
  esac

  # Look for raw ipcRenderer.send('...') or ipcRenderer.invoke('...')
  if grep -nE "ipcRenderer\.(send|invoke)\s*\(\s*['\"\`]" "$file" 2>/dev/null; then
    echo "  ^ Found in: $file"
    ERRORS=$((ERRORS + 1))
  fi
done < <(find "$ELECTRON_SRC" -name '*.ts' -o -name '*.tsx' | grep -v node_modules)

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "ERROR: Found $ERRORS file(s) with raw ipcRenderer.send/invoke calls."
  echo "Use the channel map in apps/electron/src/transport/channel-map.ts instead."
  exit 1
fi

echo "No raw IPC sends found."

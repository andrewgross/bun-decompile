#!/usr/bin/env bash
set -eo pipefail

# End-to-end test: compile real binaries with multiple Bun versions,
# then extract them with our CLI and verify the results.
#
# This is slow (downloads Bun versions, compiles ~60MB binaries) and is meant
# to be run separately from `bun test`.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DUMMY_SRC="$PROJECT_DIR/src/lib/tests/dummy/index.ts"

source "$SCRIPT_DIR/get-bun.sh"

# Milestone versions representing each format revision
VERSIONS=("1.1.0" "1.1.26" "1.2.4" "1.3.9")

for version in "${VERSIONS[@]}"; do
  echo "=== Testing Bun v${version} ==="

  BUN_BIN=$(get_bun_path "$version")
  outfile="/tmp/dummy-e2e-${version}"
  outdir="/tmp/decompiled-e2e-${version}"

  # 1. Compile the dummy binary using that Bun version
  "$BUN_BIN" build --compile --sourcemap=inline \
    "$DUMMY_SRC" --outfile "$outfile"

  # 2. Extract using our CLI (always runs with current Bun)
  bun "$PROJECT_DIR/src/cli.ts" "$outfile" -o "$outdir"

  # 3. Verify expected files exist
  if [ ! -f "$outdir/index.js" ]; then
    echo "  FAIL: index.js not found"
    exit 1
  fi

  file_count=$(ls "$outdir/" | wc -l | tr -d ' ')
  echo "  Extracted ${file_count} files"

  # 4. Cleanup
  rm -rf "$outfile" "$outdir"

  echo ""
done

echo "All versions passed!"

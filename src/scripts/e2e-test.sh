#!/usr/bin/env bash
set -eo pipefail

# End-to-end test: compile real binaries with multiple Bun versions,
# then extract them with our CLI and verify the results.
#
# This is slow (downloads Bun versions, compiles ~60MB binaries) and is meant
# to be run separately from `bun test`.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DUMMY_DIR="$PROJECT_DIR/src/lib/tests/dummy"
DUMMY_SRC="$DUMMY_DIR/index.ts"

source "$SCRIPT_DIR/get-bun.sh"

# Milestone versions representing each format revision
VERSIONS=("1.1.0" "1.1.26" "1.2.4" "1.3.9")

for version in "${VERSIONS[@]}"; do
  echo "=== Testing Bun v${version} ==="

  BUN_BIN=$(get_bun_path "$version")
  outname="dummy-e2e-${version}"
  outfile="/tmp/${outname}"
  outdir="/tmp/decompiled-e2e-${version}"

  # 1. Compile the dummy binary using that Bun version
  #    Older Bun versions ignore the --outfile directory and write next to the
  #    source file, so we check both locations.
  "$BUN_BIN" build --compile --sourcemap=inline \
    "$DUMMY_SRC" --outfile "$outfile" || true

  # Handle older Bun writing output next to source instead of --outfile path
  if [ ! -f "$outfile" ] && [ -f "$DUMMY_DIR/$outname" ]; then
    mv "$DUMMY_DIR/$outname" "$outfile"
  fi

  if [ ! -f "$outfile" ]; then
    echo "  FAIL: compilation failed for Bun v${version}"
    exit 1
  fi

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

# Cross-platform: recent Bun (≥ ~1.3.10) embeds the payload in ELF/PE `.bun`
# sections rather than appending it, so exercise Linux and Windows extraction.
echo "=== Cross-platform sections (Bun v1.3.14): ELF + PE ==="
XBUN=$(get_bun_path "1.3.14")
for target in "bun-linux-x64:linux" "bun-windows-x64:win.exe"; do
  tgt="${target%%:*}"
  label="${target##*:}"
  outfile="/tmp/dummy-xplat-${label}"
  outdir="/tmp/decompiled-xplat-${label}"

  "$XBUN" build --compile --target="$tgt" "$DUMMY_SRC" --outfile "$outfile" 2>&1 | tail -1 || true
  if [ ! -f "$outfile" ]; then
    echo "  FAIL: cross-compile $tgt failed"
    exit 1
  fi

  bun "$PROJECT_DIR/src/cli.ts" "$outfile" -o "$outdir"
  if [ ! -f "$outdir/index.js" ]; then
    echo "  FAIL: index.js not found for $tgt"
    exit 1
  fi
  echo "  $tgt: extracted $(ls "$outdir" | wc -l | tr -d ' ') files"

  rm -rf "$outfile" "$outdir"
done

echo ""
echo "All versions passed!"

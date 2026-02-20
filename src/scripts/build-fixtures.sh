#!/usr/bin/env bash
set -eo pipefail

# Build test fixtures for milestone Bun versions.
#
# Each fixture is a small extracted data section (~few KB) suitable for
# checking into git and running fast unit tests against.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURES_DIR="$PROJECT_DIR/src/lib/tests/fixtures"
DUMMY_SRC="$PROJECT_DIR/src/lib/tests/dummy/index.ts"

source "$SCRIPT_DIR/get-bun.sh"

# Milestone versions representing each format revision
VERSIONS=("1.1.0" "1.1.26" "1.2.4" "1.3.9")

mkdir -p "$FIXTURES_DIR"

for version in "${VERSIONS[@]}"; do
  echo "=== Building fixture for Bun v${version} ==="

  BUN_BIN=$(get_bun_path "$version")
  outfile="/tmp/dummy-fixture-${version}"

  # Compile the dummy binary using that Bun version
  "$BUN_BIN" build --compile --sourcemap=inline \
    "$DUMMY_SRC" --outfile "$outfile"

  # Extract just the data section (using current Bun)
  bun "$SCRIPT_DIR/extract-section.ts" "$outfile" -o "$FIXTURES_DIR/v${version}.bin"

  # Cleanup the full binary
  rm -f "$outfile"

  echo ""
done

echo "All fixtures built in $FIXTURES_DIR"
ls -la "$FIXTURES_DIR"

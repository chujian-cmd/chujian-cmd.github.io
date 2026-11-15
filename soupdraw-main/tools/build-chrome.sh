#!/usr/bin/env bash
# Assemble a Chrome MV3 build of SoupDraw from the shared codebase.
# The code is browser-agnostic (browser||chrome shim); only the manifest differs
# (service_worker vs background.scripts, no gecko block). We stage the runtime
# files with the Chrome manifest as manifest.json, then zip.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
STAGE="build/chrome"
OUT="web-ext-artifacts/soupdraw-chrome-${VERSION}.zip"

rm -rf "$STAGE"
mkdir -p "$STAGE" web-ext-artifacts

# Runtime files only (no node_modules, tests, docs, .env, site).
cp -r src vendor icons "$STAGE"/
cp LICENSE "$STAGE"/ 2>/dev/null || true
# The Chrome manifest becomes THE manifest.
cp manifest.chrome.json "$STAGE"/manifest.json

# Load-unpacked dir is ready at build/chrome. Also produce a store-ready zip
# (contents at the zip root, as the Chrome Web Store expects).
rm -f "$OUT"
( cd "$STAGE" && zip -rq "$ROOT/$OUT" . -x '*.DS_Store' )

echo "Chrome build ready:"
echo "  • load unpacked → $STAGE"
echo "  • store zip     → $OUT"

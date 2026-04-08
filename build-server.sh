#!/usr/bin/env bash
#
# Builds the BrewBar POS server package for Linux (API + Angular).
#
# 1. Publishes the .NET API as self-contained linux-x64
# 2. Builds Angular admin and POS apps
# 3. Copies Angular output into API wwwroot
# 4. Bundles deploy scripts and creates a tarball
#
# Usage: ./build-server.sh [--version 1.2.3]

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Parse arguments
VERSION=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

# Resolve version: explicit flag > package.json
if [ -z "$VERSION" ]; then
    VERSION=$(node -p "require('./package.json').version")
fi

echo ""
echo "========================================"
echo "  BrewBar POS Server Build  v${VERSION}"
echo "========================================"
echo ""

# Clean build output
rm -rf "$ROOT/build/server"
mkdir -p "$ROOT/build/server"

# ── Step 1: Publish .NET API ──────────────────────────────────────────────────
echo "[1/4] Publishing .NET API (self-contained linux-x64)..."
dotnet publish "$ROOT/server/src/BrewBar.API/BrewBar.API.csproj" \
    -p:PublishProfile=Server \
    -c Release
echo "  API published to build/server/"

# ── Step 2: Build Angular apps ────────────────────────────────────────────────
echo "[2/4] Building Angular apps..."
cd "$ROOT/client"
npm ci --silent
npx ng build pos --configuration production
npx ng build admin --configuration production --base-href /admin/
cd "$ROOT"
echo "  Angular apps built"

# ── Step 3: Copy Angular into API wwwroot ─────────────────────────────────────
echo "[3/4] Copying Angular output to API wwwroot..."
WWWROOT="$ROOT/build/server/wwwroot"
mkdir -p "$WWWROOT/admin"
cp -r "$ROOT/client/dist/pos/browser/." "$WWWROOT/"
cp -r "$ROOT/client/dist/admin/browser/." "$WWWROOT/admin/"
echo "  POS -> wwwroot/, Admin -> wwwroot/admin/"

# ── Step 4: Create tarball ────────────────────────────────────────────────────
echo "[4/4] Packaging tarball..."
cp "$ROOT/deploy/brewbar.service" "$ROOT/build/server/"
cp "$ROOT/deploy/install.sh" "$ROOT/build/server/"
chmod +x "$ROOT/build/server/BrewBar.API"
chmod +x "$ROOT/build/server/install.sh"

cd "$ROOT/build"
tar czf "brewbar-server-${VERSION}-linux-x64.tar.gz" -C server .
echo "  Tarball: build/brewbar-server-${VERSION}-linux-x64.tar.gz"

echo ""
echo "========================================"
echo "  Build complete!"
echo "========================================"
echo "  Package: build/brewbar-server-${VERSION}-linux-x64.tar.gz"
echo ""

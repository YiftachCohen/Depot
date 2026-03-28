#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ELECTRON_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$(dirname "$ELECTRON_DIR")")"

# Helper function to check required file/directory exists
require_path() {
    local path="$1"
    local description="$2"
    local hint="$3"

    if [ ! -e "$path" ]; then
        echo "ERROR: $description not found at $path"
        [ -n "$hint" ] && echo "$hint"
        exit 1
    fi
}

# Sync secrets from 1Password if CLI is available
if command -v op &> /dev/null; then
    echo "1Password CLI detected, syncing secrets..."
    cd "$ROOT_DIR"
    if bun run sync-secrets 2>/dev/null; then
        echo "Secrets synced from 1Password"
    else
        echo "Warning: Failed to sync secrets from 1Password (continuing with existing .env if present)"
    fi
fi

# Load environment variables from .env
if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi

# Parse arguments
ARCH="arm64"
UPLOAD=false
UPLOAD_LATEST=false
UPLOAD_SCRIPT=false
FAST=false
SKIP_ZIP=false

show_help() {
    cat << EOF
Usage: build-dmg.sh [arm64|x64] [--upload] [--latest] [--script] [--fast] [--no-zip]

Arguments:
  arm64|x64    Target architecture (default: arm64)
  --upload     Upload DMG to S3 after building
  --latest     Also update electron/latest (requires --upload)
  --script     Also upload install-app.sh (requires --upload)
  --fast       Skip full clean and redundant dependency installation
  --no-zip     Skip building the .zip target (faster)

Environment variables (from .env or environment):
  APPLE_SIGNING_IDENTITY    - Code signing identity
  APPLE_ID                  - Apple ID for notarization
  APPLE_TEAM_ID             - Apple Team ID
  APPLE_APP_SPECIFIC_PASSWORD - App-specific password
  S3_VERSIONS_BUCKET_*      - S3 credentials (for --upload)
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case $1 in
        arm64|x64)     ARCH="$1"; shift ;;
        --upload)      UPLOAD=true; shift ;;
        --latest)      UPLOAD_LATEST=true; shift ;;
        --script)      UPLOAD_SCRIPT=true; shift ;;
        --fast)        FAST=true; shift ;;
        --no-zip)      SKIP_ZIP=true; shift ;;
        -h|--help)     show_help ;;
        *)
            echo "Unknown option: $1"
            echo "Run with --help for usage"
            exit 1
            ;;
    esac
done

# Configuration
BUN_VERSION="bun-v1.3.5"  # Pinned version for reproducible builds
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/depot-build"
mkdir -p "$CACHE_DIR"

echo "=== Building Depot Agents DMG (${ARCH}) using electron-builder ==="
if [ "$UPLOAD" = true ]; then
    echo "Will upload to S3 after build"
fi

# 1. Clean previous build artifacts
if [ "$FAST" = true ]; then
    echo "Fast build enabled, skipping full clean..."
    rm -rf "$ELECTRON_DIR/release"
else
    echo "Cleaning previous builds..."
    rm -rf "$ELECTRON_DIR/vendor"
    rm -rf "$ELECTRON_DIR/node_modules/@anthropic-ai"
    rm -rf "$ELECTRON_DIR/packages"
    rm -rf "$ELECTRON_DIR/release"
fi

# 2. Install dependencies
if [ "$FAST" = true ] && [ -d "$ROOT_DIR/node_modules" ]; then
    echo "Fast build enabled and node_modules exists, skipping 'bun install'..."
else
    echo "Installing dependencies..."
    cd "$ROOT_DIR"
    bun install
fi

# 3. Get Bun binary (with caching)
BUN_DOWNLOAD="bun-darwin-$([ "$ARCH" = "arm64" ] && echo "aarch64" || echo "x64")"
CACHED_BUN="$CACHE_DIR/${BUN_VERSION}-${BUN_DOWNLOAD}.zip"
CACHED_SHASUMS="$CACHE_DIR/${BUN_VERSION}-SHASUMS256.txt"

echo "Checking for cached Bun ${BUN_VERSION} for ${ARCH}..."

if [ ! -f "$CACHED_BUN" ] || [ ! -f "$CACHED_SHASUMS" ]; then
    echo "Cache miss, downloading Bun ${BUN_VERSION} for darwin-${ARCH}..."
    curl -fSL "https://github.com/oven-sh/bun/releases/download/${BUN_VERSION}/${BUN_DOWNLOAD}.zip" -o "$CACHED_BUN"
    curl -fSL "https://github.com/oven-sh/bun/releases/download/${BUN_VERSION}/SHASUMS256.txt" -o "$CACHED_SHASUMS"
else
    echo "Using cached Bun binary"
fi

# Create temp directory for extraction
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Verify checksum
echo "Verifying checksum..."
cp "$CACHED_BUN" "$TEMP_DIR/${BUN_DOWNLOAD}.zip"
cp "$CACHED_SHASUMS" "$TEMP_DIR/SHASUMS256.txt"
cd "$TEMP_DIR"
grep "${BUN_DOWNLOAD}.zip" SHASUMS256.txt | shasum -a 256 -c -
cd - > /dev/null

# Extract and install
echo "Installing Bun binary to vendor/..."
mkdir -p "$ELECTRON_DIR/vendor/bun"
unzip -o "$TEMP_DIR/${BUN_DOWNLOAD}.zip" -d "$TEMP_DIR"
cp "$TEMP_DIR/${BUN_DOWNLOAD}/bun" "$ELECTRON_DIR/vendor/bun/"
chmod +x "$ELECTRON_DIR/vendor/bun/bun"

# 4. Copy SDK from root node_modules (monorepo hoisting)
# Note: The SDK is hoisted to root node_modules by the package manager.
# We copy it here because electron-builder only sees apps/electron/.
SDK_SOURCE="$ROOT_DIR/node_modules/@anthropic-ai/claude-agent-sdk"
require_path "$SDK_SOURCE" "SDK" "Run 'bun install' from the repository root first."
echo "Copying SDK..."
mkdir -p "$ELECTRON_DIR/node_modules/@anthropic-ai"
cp -r "$SDK_SOURCE" "$ELECTRON_DIR/node_modules/@anthropic-ai/"

# 5. Copy interceptor
INTERCEPTOR_SOURCE="$ROOT_DIR/packages/shared/src/interceptor-request-utils.ts"
require_path "$INTERCEPTOR_SOURCE" "Interceptor" "Ensure packages/shared/src/interceptor-request-utils.ts exists."
echo "Copying interceptor..."
mkdir -p "$ELECTRON_DIR/packages/shared/src"
cp "$INTERCEPTOR_SOURCE" "$ELECTRON_DIR/packages/shared/src/"

# 6. Build Electron app
echo "Building Electron app..."
cd "$ROOT_DIR"
if [ "$FAST" = true ]; then
    export FAST_BUILD=true
fi
bun run electron:build

# 7. Package with electron-builder
echo "Packaging app with electron-builder..."
cd "$ELECTRON_DIR"

# Set up environment for electron-builder
export CSC_IDENTITY_AUTO_DISCOVERY=true

# Build electron-builder arguments
BUILDER_ARGS="--mac --${ARCH}"

# Skip zip target if requested (much faster build)
if [ "$SKIP_ZIP" = true ]; then
    echo "Skipping .zip target..."
    BUILDER_ARGS="$BUILDER_ARGS -c.mac.target=dmg"
fi

# Add code signing if identity is available
if [ -n "$APPLE_SIGNING_IDENTITY" ]; then
    # Strip "Developer ID Application: " prefix if present (electron-builder adds it automatically)
    CSC_NAME_CLEAN="${APPLE_SIGNING_IDENTITY#Developer ID Application: }"
    echo "Using signing identity: $CSC_NAME_CLEAN"
    export CSC_NAME="$CSC_NAME_CLEAN"
fi

# Add notarization if all credentials are available
if [ -n "$APPLE_ID" ] && [ -n "$APPLE_TEAM_ID" ] && [ -n "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
    echo "Notarization enabled"
    export APPLE_ID="$APPLE_ID"
    export APPLE_TEAM_ID="$APPLE_TEAM_ID"
    export APPLE_APP_SPECIFIC_PASSWORD="$APPLE_APP_SPECIFIC_PASSWORD"

    # electron-builder.yml sets notarize: true; actual notarization triggers
    # only when Apple env vars above are present.
fi

# Run electron-builder
"$ROOT_DIR/node_modules/.bin/electron-builder" $BUILDER_ARGS

# 8. Verify the DMG was built
# electron-builder.yml uses artifactName to output: Depot-Agent-${arch}.dmg
DMG_NAME="Depot-Agent-${ARCH}.dmg"
DMG_PATH="$ELECTRON_DIR/release/$DMG_NAME"

if [ ! -f "$DMG_PATH" ]; then
    echo "ERROR: Expected DMG not found at $DMG_PATH"
    echo "Contents of release directory:"
    ls -la "$ELECTRON_DIR/release/"
    exit 1
fi

echo ""
echo "=== Build Complete ==="
echo "DMG: $ELECTRON_DIR/release/${DMG_NAME}"
echo "Size: $(du -h "$ELECTRON_DIR/release/${DMG_NAME}" | cut -f1)"

# 9. Create manifest.json for upload script
# Read version from package.json
ELECTRON_VERSION=$(cat "$ELECTRON_DIR/package.json" | grep '"version"' | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
echo "Creating manifest.json (version: $ELECTRON_VERSION)..."
mkdir -p "$ROOT_DIR/.build/upload"
echo "{\"version\": \"$ELECTRON_VERSION\"}" > "$ROOT_DIR/.build/upload/manifest.json"

# 10. Upload to S3 (if --upload flag is set)
if [ "$UPLOAD" = true ]; then
    echo ""
    echo "=== Uploading to S3 ==="

    # Check for S3 credentials
    if [ -z "$S3_VERSIONS_BUCKET_ENDPOINT" ] || [ -z "$S3_VERSIONS_BUCKET_ACCESS_KEY_ID" ] || [ -z "$S3_VERSIONS_BUCKET_SECRET_ACCESS_KEY" ]; then
        cat << EOF
ERROR: Missing S3 credentials. Set these environment variables:
  S3_VERSIONS_BUCKET_ENDPOINT
  S3_VERSIONS_BUCKET_ACCESS_KEY_ID
  S3_VERSIONS_BUCKET_SECRET_ACCESS_KEY

You can add them to .env or export them directly.
EOF
        exit 1
    fi

    # Build upload flags
    UPLOAD_FLAGS="--electron"
    [ "$UPLOAD_LATEST" = true ] && UPLOAD_FLAGS="$UPLOAD_FLAGS --latest"
    [ "$UPLOAD_SCRIPT" = true ] && UPLOAD_FLAGS="$UPLOAD_FLAGS --script"

    cd "$ROOT_DIR"
    bun run scripts/upload.ts $UPLOAD_FLAGS

    echo ""
    echo "=== Upload Complete ==="
fi

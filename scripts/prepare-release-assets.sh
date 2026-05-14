#!/usr/bin/env bash
# prepare-release-assets.sh
#
# Normalize electron-updater metadata from multi-arch build artifacts
# into a deterministic release-assets/ directory.
#
# Usage:
#   ./scripts/prepare-release-assets.sh [ARTIFACTS_DIR] [OUTPUT_DIR]
#
# Defaults:
#   ARTIFACTS_DIR = build-artifacts
#   OUTPUT_DIR    = release-assets

set -euo pipefail

ARTIFACTS_DIR="${1:-build-artifacts}"
OUTPUT_DIR="${2:-release-assets}"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# ---------------------------------------------------------------------------
# 1) Copy all distributables (unique file names)
# ---------------------------------------------------------------------------
echo "==> Copying distributables from $ARTIFACTS_DIR ..."
DISTRIBUTABLES=()
while IFS= read -r file; do
  base_name="$(basename "$file")"
  if [[ "$base_name" =~ -(mac|macos|win|windows|linux|android|harmony|harmonyos)- ]]; then
    DISTRIBUTABLES+=("$file")
  fi
done < <(find "$ARTIFACTS_DIR" -type f \( \
  -name "*.aab" -o \
  -name "*.apk" -o \
  -name "*.app" -o \
  -name "*.hap" -o \
  -name "*.exe" -o \
  -name "*.msi" -o \
  -name "*.dmg" -o \
  -name "*.deb" -o \
  -name "*.zip" \
\) | sort)

DUPLICATE_BASENAMES=$(for file in "${DISTRIBUTABLES[@]}"; do basename "$file"; done | sort | uniq -d || true)
if [ -n "$DUPLICATE_BASENAMES" ]; then
  echo "::error::Found duplicate distributable basenames that would be overwritten in flat output:"
  echo "$DUPLICATE_BASENAMES"
  exit 1
fi

for file in "${DISTRIBUTABLES[@]}"; do
  cp -f "$file" "$OUTPUT_DIR/"
done

# ---------------------------------------------------------------------------
# 2) Collect updater metadata from each platform artifact directory
# ---------------------------------------------------------------------------
echo "==> Collecting updater metadata ..."

WIN_X64_LATEST=$(find "$ARTIFACTS_DIR" -type f -path "*/windows-build-x64/*" -name "latest.yml" | sort | head -n 1 || true)
WIN_ARM64_LATEST=$(find "$ARTIFACTS_DIR" -type f -path "*/windows-build-arm64/*" -name "latest.yml" | sort | head -n 1 || true)
MAC_X64_LATEST=$(find "$ARTIFACTS_DIR" -type f -path "*/macos-build-x64/*" -name "latest-mac.yml" | sort | head -n 1 || true)
MAC_ARM64_LATEST=$(find "$ARTIFACTS_DIR" -type f -path "*/macos-build-arm64/*" -name "latest-mac.yml" | sort | head -n 1 || true)
LINUX_X64_LATEST=$(find "$ARTIFACTS_DIR" -type f -path "*/linux-build/*" -name "latest-linux.yml" | sort | head -n 1 || true)
LINUX_ARM64_LATEST=$(find "$ARTIFACTS_DIR" -type f -path "*/linux-build/*" -name "latest-linux-arm64.yml" | sort | head -n 1 || true)

# ---------------------------------------------------------------------------
# 3) Publish deterministic canonical metadata for electron-updater
#    (avoid nondeterministic overwrite when multiple jobs produce same names)
# ---------------------------------------------------------------------------
echo "==> Writing canonical updater metadata ..."

[ -n "$WIN_X64_LATEST" ]    && cp -f "$WIN_X64_LATEST"    "$OUTPUT_DIR/latest.yml"
[ -n "$MAC_X64_LATEST" ]    && cp -f "$MAC_X64_LATEST"    "$OUTPUT_DIR/latest-mac.yml"
[ -n "$LINUX_X64_LATEST" ]  && cp -f "$LINUX_X64_LATEST"  "$OUTPUT_DIR/latest-linux.yml"
[ -n "$LINUX_ARM64_LATEST" ] && cp -f "$LINUX_ARM64_LATEST" "$OUTPUT_DIR/latest-linux-arm64.yml"

# ---------------------------------------------------------------------------
# 4) Architecture-specific metadata required by electron-updater
# ---------------------------------------------------------------------------
echo "==> Writing architecture-specific updater metadata ..."

[ -n "$WIN_ARM64_LATEST" ]  && cp -f "$WIN_ARM64_LATEST"  "$OUTPUT_DIR/latest-win-arm64.yml"

# electron-updater on macOS constructs the yml filename as "${channel}-mac.yml".
# For arm64, channel is "latest-arm64", so it looks for "latest-arm64-mac.yml".
[ -n "$MAC_ARM64_LATEST" ]  && cp -f "$MAC_ARM64_LATEST"  "$OUTPUT_DIR/latest-arm64-mac.yml"

# ---------------------------------------------------------------------------
# 5) Validate updater metadata for the platform/arch assets that were built
# ---------------------------------------------------------------------------
echo "==> Validating required metadata ..."

MISSING=0

has_output_asset() {
  local pattern="$1"
  find "$OUTPUT_DIR" -maxdepth 1 -type f | grep -Eq "$pattern"
}

require_metadata_if_asset_exists() {
  local asset_pattern="$1"
  local metadata_file="$2"
  local description="$3"

  if ! has_output_asset "$asset_pattern"; then
    echo "INFO: skipping ${description} metadata check (no matching asset)"
    return
  fi

  if [ ! -f "$OUTPUT_DIR/$metadata_file" ]; then
    echo "::error::Missing required updater metadata for ${description}: $metadata_file"
    MISSING=1
  fi
}

require_metadata_if_asset_exists '/ContextGo-.*-(win|windows)-x64\.(exe|msi|zip)$' 'latest.yml' 'windows/x64'
require_metadata_if_asset_exists '/ContextGo-.*-(win|windows)-arm64\.(exe|msi|zip)$' 'latest-win-arm64.yml' 'windows/arm64'
require_metadata_if_asset_exists '/ContextGo-.*-(mac|macos)-x64\.(dmg|zip)$' 'latest-mac.yml' 'macos/x64'
require_metadata_if_asset_exists '/ContextGo-.*-(mac|macos)-arm64\.(dmg|zip)$' 'latest-arm64-mac.yml' 'macos/arm64'
require_metadata_if_asset_exists '/ContextGo-.*-linux-x64\.deb$' 'latest-linux.yml' 'linux/x64'
require_metadata_if_asset_exists '/ContextGo-.*-linux-arm64\.deb$' 'latest-linux-arm64.yml' 'linux/arm64'

if [ "$MISSING" -ne 0 ]; then
  exit 1
fi

# ---------------------------------------------------------------------------
# 6) Generate deterministic release manifest for the website download center
# ---------------------------------------------------------------------------
echo "==> Generating release manifest ..."
node scripts/generate-release-manifest.mjs "$OUTPUT_DIR"

echo ""
echo "==> Prepared release assets:"
ls -lh "$OUTPUT_DIR"
echo ""
echo "==> Done."

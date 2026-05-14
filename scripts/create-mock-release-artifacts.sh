#!/usr/bin/env bash

set -euo pipefail

ARTIFACTS_DIR="${1:-build-artifacts}"

rm -rf "$ARTIFACTS_DIR"
mkdir -p "$ARTIFACTS_DIR/windows-build-x64"
mkdir -p "$ARTIFACTS_DIR/windows-build-arm64"
mkdir -p "$ARTIFACTS_DIR/macos-build-x64"
mkdir -p "$ARTIFACTS_DIR/macos-build-arm64"
mkdir -p "$ARTIFACTS_DIR/linux-build"
mkdir -p "$ARTIFACTS_DIR/android-build"
mkdir -p "$ARTIFACTS_DIR/harmony-build"

# Windows x64
touch "$ARTIFACTS_DIR/windows-build-x64/ContextGo-1.0.0-win-x64.exe"
cat > "$ARTIFACTS_DIR/windows-build-x64/latest.yml" <<'EOF'
version: 1.0.0
files:
  - url: ContextGo-1.0.0-win-x64.exe
    sha512: fake-sha512-x64
    size: 100000
path: ContextGo-1.0.0-win-x64.exe
sha512: fake-sha512-x64
releaseDate: '2025-01-01'
EOF

# Windows arm64
touch "$ARTIFACTS_DIR/windows-build-arm64/ContextGo-1.0.0-win-arm64.exe"
cat > "$ARTIFACTS_DIR/windows-build-arm64/latest.yml" <<'EOF'
version: 1.0.0
files:
  - url: ContextGo-1.0.0-win-arm64.exe
    sha512: fake-sha512-arm64
    size: 100000
path: ContextGo-1.0.0-win-arm64.exe
sha512: fake-sha512-arm64
releaseDate: '2025-01-01'
EOF

# macOS x64
touch "$ARTIFACTS_DIR/macos-build-x64/ContextGo-1.0.0-mac-x64.dmg"
touch "$ARTIFACTS_DIR/macos-build-x64/ContextGo-1.0.0-mac-x64.zip"
cat > "$ARTIFACTS_DIR/macos-build-x64/latest-mac.yml" <<'EOF'
version: 1.0.0
files:
  - url: ContextGo-1.0.0-mac-x64.dmg
    sha512: fake-sha512-mac-x64
    size: 200000
EOF

# macOS arm64
touch "$ARTIFACTS_DIR/macos-build-arm64/ContextGo-1.0.0-mac-arm64.dmg"
touch "$ARTIFACTS_DIR/macos-build-arm64/ContextGo-1.0.0-mac-arm64.zip"
cat > "$ARTIFACTS_DIR/macos-build-arm64/latest-mac.yml" <<'EOF'
version: 1.0.0
files:
  - url: ContextGo-1.0.0-mac-arm64.dmg
    sha512: fake-sha512-mac-arm64
    size: 200000
EOF

# Linux
touch "$ARTIFACTS_DIR/linux-build/ContextGo-1.0.0-linux-x64.deb"
touch "$ARTIFACTS_DIR/linux-build/ContextGo-1.0.0-linux-arm64.deb"
cat > "$ARTIFACTS_DIR/linux-build/latest-linux.yml" <<'EOF'
version: 1.0.0
files:
  - url: ContextGo-1.0.0-linux-x64.deb
    sha512: fake-sha512-linux
    size: 300000
EOF
cat > "$ARTIFACTS_DIR/linux-build/latest-linux-arm64.yml" <<'EOF'
version: 1.0.0
files:
  - url: ContextGo-1.0.0-linux-arm64.deb
    sha512: fake-sha512-linux-arm64
    size: 300000
EOF

# Android
touch "$ARTIFACTS_DIR/android-build/ContextGo-1.0.0-android-universal.apk"
touch "$ARTIFACTS_DIR/android-build/ContextGo-1.0.0-android-universal.aab"

# HarmonyOS
touch "$ARTIFACTS_DIR/harmony-build/ContextGo-1.0.0-harmony-arm64.hap"
touch "$ARTIFACTS_DIR/harmony-build/ContextGo-1.0.0-harmony-arm64.app"

echo "Mock artifacts created in $ARTIFACTS_DIR:"
find "$ARTIFACTS_DIR" -type f | sort

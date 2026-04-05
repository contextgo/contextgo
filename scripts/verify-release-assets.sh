#!/usr/bin/env bash

set -euo pipefail

OUTPUT_DIR="${1:-release-assets}"
ERRORS=0

fail() {
  echo "FAIL: $1"
  ERRORS=$((ERRORS + 1))
}

pass() {
  echo "PASS: $1"
}

for file in latest.yml latest-mac.yml latest-linux.yml latest-linux-arm64.yml release-manifest.json; do
  if [ ! -f "$OUTPUT_DIR/$file" ]; then
    fail "missing required release file: $file"
  else
    pass "$file exists"
  fi
done

while IFS= read -r suspicious; do
  fail "release output contains forbidden secret/config artifact: $(basename "$suspicious")"
done < <(find "$OUTPUT_DIR" -type f \( \
  -name '.env' -o \
  -name '.env.*' -o \
  -name '*.p12' -o \
  -name '*.mobileprovision' -o \
  -name '*.keystore' -o \
  -name '*.jks' -o \
  -name '*.p8' -o \
  -name '*.pem' -o \
  -name '*.key' -o \
  -name 'contextgo-config.txt' -o \
  -name 'contextgo-chat.txt' -o \
  -name 'contextgo-chat-message.txt' -o \
  -name 'contextgo.db' -o \
  -name 'db.sqlite' \
\) | sort)

extract_ref_file() {
  local metadata_file="$1"
  local ref
  ref=$(grep -E '^path:' "$metadata_file" | head -n 1 | sed -E 's/^path:[[:space:]]*//')
  if [ -z "$ref" ]; then
    ref=$(grep -E '^[[:space:]]*-?[[:space:]]*url:' "$metadata_file" | head -n 1 | sed -E 's/^[[:space:]]*-?[[:space:]]*url:[[:space:]]*//')
  fi
  echo "$ref"
}

assert_metadata_points_to_existing_file() {
  local metadata_name="$1"
  local expected_pattern="$2"
  local metadata_path="$OUTPUT_DIR/$metadata_name"

  if [ ! -f "$metadata_path" ]; then
    return
  fi

  local ref_file
  ref_file=$(extract_ref_file "$metadata_path")

  if [ -z "$ref_file" ]; then
    fail "$metadata_name has no path/url entry"
    return
  fi

  if [[ ! "$ref_file" =~ $expected_pattern ]]; then
    fail "$metadata_name points to unexpected file: $ref_file"
    return
  fi

  if [ ! -f "$OUTPUT_DIR/$ref_file" ]; then
    fail "$metadata_name references missing file: $ref_file"
    return
  fi

  pass "$metadata_name -> $ref_file"
}

assert_metadata_points_to_existing_file "latest.yml" '(win|windows).*(x64|amd64)|ContextGo-.*-(win|windows)-x64'
assert_metadata_points_to_existing_file "latest-mac.yml" '(mac|macos).*(x64)|ContextGo-.*-(mac|macos)-x64'
assert_metadata_points_to_existing_file "latest-linux.yml" '(linux).*(x64|amd64)|ContextGo-.*-linux-x64'
assert_metadata_points_to_existing_file "latest-linux-arm64.yml" '(linux).*(arm64|aarch64)|ContextGo-.*-linux-arm64'

for file in latest-win-arm64.yml latest-arm64-mac.yml; do
  if [ ! -f "$OUTPUT_DIR/$file" ]; then
    fail "missing arch-specific updater metadata: $file"
  else
    pass "$file exists"
  fi
done

if ! node - "$OUTPUT_DIR" <<'EOF'; then
const fs = require('node:fs');
const path = require('node:path');

const outputDir = process.argv[2];
const manifestPath = path.join(outputDir, 'release-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const errors = [];

if (manifest.schemaVersion !== 1) {
  errors.push(`unexpected schemaVersion: ${manifest.schemaVersion}`);
}

if (manifest.checksumAlgorithm !== 'sha256') {
  errors.push(`unexpected checksum algorithm: ${manifest.checksumAlgorithm}`);
}

if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
  errors.push('manifest assets missing or empty');
}

const assetPattern = /^ContextGo-\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?-(mac|macos|win|windows|linux|android|harmony|harmonyos)-[A-Za-z0-9._-]+\.(aab|apk|app|deb|dmg|exe|hap|msi|zip)$/i;
const requiredPairs = [
  ['windows', 'x64'],
  ['windows', 'arm64'],
  ['macos', 'x64'],
  ['macos', 'arm64'],
  ['linux', 'x64'],
  ['linux', 'arm64'],
];

for (const asset of manifest.assets || []) {
  if (!assetPattern.test(asset.fileName)) {
    errors.push(`manifest asset name does not match canonical pattern: ${asset.fileName}`);
  }

  if (!/^[a-f0-9]{64}$/i.test(asset.sha256 || '')) {
    errors.push(`invalid sha256 for ${asset.fileName}`);
  }

  const assetPath = path.join(outputDir, asset.fileName);
  if (!fs.existsSync(assetPath)) {
    errors.push(`manifest references missing file: ${asset.fileName}`);
    continue;
  }

  const size = fs.statSync(assetPath).size;
  if (size !== asset.size) {
    errors.push(`size mismatch for ${asset.fileName}: manifest=${asset.size} actual=${size}`);
  }
}

for (const [platform, arch] of requiredPairs) {
  const exists = manifest.assets.some((asset) => asset.platform === platform && asset.arch === arch);
  if (!exists) {
    errors.push(`missing required manifest asset for ${platform}/${arch}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
EOF
  fail "release manifest validation failed"
else
  pass "release manifest is valid"
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "FAILED: $ERRORS errors found"
  exit 1
fi

echo "ALL CHECKS PASSED"

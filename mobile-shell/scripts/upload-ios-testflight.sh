#!/usr/bin/env bash

set -euo pipefail

IPA_PATH="${1:?usage: upload-ios-testflight.sh <ipa-path>}"
API_KEY_PATH="${APPLE_API_PRIVATE_KEY_FILE:-${APPLE_API_KEY_PATH:-}}"
API_KEY_ID="${APPLE_API_KEY_ID:?APPLE_API_KEY_ID is required}"
API_ISSUER_ID="${APPLE_API_ISSUER_ID:?APPLE_API_ISSUER_ID is required}"

: "${API_KEY_PATH:?APPLE_API_PRIVATE_KEY_FILE or APPLE_API_KEY_PATH is required}"

KEYS_DIR="$(mktemp -d "${TMPDIR:-/tmp}/contextgo-appstoreconnect-XXXXXX")"
cleanup() {
  rm -rf "${KEYS_DIR}"
}
trap cleanup EXIT

# Xcode 16.4's altool resolves JWT keys from a private keys directory more reliably
# than the old --api-key/--api-issuer plus --p8-file-path combination.
cp "${API_KEY_PATH}" "${KEYS_DIR}/AuthKey_${API_KEY_ID}.p8"
cp "${API_KEY_PATH}" "${KEYS_DIR}/ApiKey_${API_KEY_ID}.p8"

export API_PRIVATE_KEYS_DIR="${KEYS_DIR}"

xcrun altool \
  --upload-app \
  -f "${IPA_PATH}" \
  -t ios \
  --apiKey "${API_KEY_ID}" \
  --apiIssuer "${API_ISSUER_ID}" \
  --output-format json \
  --wait

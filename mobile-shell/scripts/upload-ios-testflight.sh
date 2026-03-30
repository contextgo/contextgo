#!/usr/bin/env bash

set -euo pipefail

IPA_PATH="${1:?usage: upload-ios-testflight.sh <ipa-path>}"
API_KEY_PATH="${APPLE_API_PRIVATE_KEY_FILE:-${APPLE_API_KEY_PATH:-}}"

: "${APPLE_API_KEY_ID:?APPLE_API_KEY_ID is required}"
: "${APPLE_API_ISSUER_ID:?APPLE_API_ISSUER_ID is required}"
: "${API_KEY_PATH:?APPLE_API_PRIVATE_KEY_FILE or APPLE_API_KEY_PATH is required}"

xcrun altool \
  --upload-app \
  -f "${IPA_PATH}" \
  --api-key "${APPLE_API_KEY_ID}" \
  --api-issuer "${APPLE_API_ISSUER_ID}" \
  --p8-file-path "${API_KEY_PATH}" \
  --output-format json \
  --wait

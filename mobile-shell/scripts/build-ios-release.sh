#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:?usage: build-ios-release.sh <version> <output-dir>}"
OUTPUT_DIR="${2:?usage: build-ios-release.sh <version> <output-dir>}"

PROJECT_PATH="${ROOT_DIR}/ios/ContextGo.xcodeproj"
SCHEME="${CONTEXTGO_IOS_SCHEME:-ContextGo}"
ARCHIVE_PATH="${CONTEXTGO_IOS_ARCHIVE_PATH:-${OUTPUT_DIR}/ContextGo.xcarchive}"
EXPORT_DIR="${CONTEXTGO_IOS_EXPORT_DIR:-${OUTPUT_DIR}/export}"
EXPORT_OPTIONS_PLIST="${CONTEXTGO_IOS_EXPORT_OPTIONS_PLIST:-}"
BUILD_NUMBER="${CONTEXTGO_RELEASE_BUILD_NUMBER:-1}"
API_KEY_PATH="${APPLE_API_PRIVATE_KEY_FILE:-${APPLE_API_KEY_PATH:-}}"

BUILD_SETTINGS=(
  "MARKETING_VERSION=${VERSION}"
  "CURRENT_PROJECT_VERSION=${BUILD_NUMBER}"
  "CODE_SIGN_STYLE=${IOS_CODE_SIGN_STYLE:-Automatic}"
)

AUTH_ARGS=()

if [[ -n "${IOS_DEVELOPMENT_TEAM:-}" ]]; then
  BUILD_SETTINGS+=("DEVELOPMENT_TEAM=${IOS_DEVELOPMENT_TEAM}")
fi

if [[ -n "${IOS_PROVISIONING_PROFILE_SPECIFIER:-}" ]]; then
  BUILD_SETTINGS+=("PROVISIONING_PROFILE_SPECIFIER=${IOS_PROVISIONING_PROFILE_SPECIFIER}")
fi

if [[ -n "${IOS_CODE_SIGN_IDENTITY:-}" ]]; then
  BUILD_SETTINGS+=("CODE_SIGN_IDENTITY=${IOS_CODE_SIGN_IDENTITY}")
fi

if [[ -n "${API_KEY_PATH}" ]]; then
  : "${APPLE_API_KEY_ID:?APPLE_API_KEY_ID is required when APPLE_API_PRIVATE_KEY_FILE is set}"
  : "${APPLE_API_ISSUER_ID:?APPLE_API_ISSUER_ID is required when APPLE_API_PRIVATE_KEY_FILE is set}"

  AUTH_ARGS=(
    -allowProvisioningUpdates
    -authenticationKeyPath "${API_KEY_PATH}"
    -authenticationKeyID "${APPLE_API_KEY_ID}"
    -authenticationKeyIssuerID "${APPLE_API_ISSUER_ID}"
  )
fi

rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"

xcodebuild \
  -project "${PROJECT_PATH}" \
  -scheme "${SCHEME}" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "${ARCHIVE_PATH}" \
  "${AUTH_ARGS[@]}" \
  "${BUILD_SETTINGS[@]}" \
  archive

if [[ -n "${EXPORT_OPTIONS_PLIST}" ]]; then
  mkdir -p "${EXPORT_DIR}"

  xcodebuild \
    "${AUTH_ARGS[@]}" \
    -exportArchive \
    -archivePath "${ARCHIVE_PATH}" \
    -exportPath "${EXPORT_DIR}" \
    -exportOptionsPlist "${EXPORT_OPTIONS_PLIST}"

  IPA_SOURCE="$(find "${EXPORT_DIR}" -maxdepth 1 -type f -name '*.ipa' | sort | head -n 1 || true)"
  if [[ -n "${IPA_SOURCE}" ]]; then
    cp -f "${IPA_SOURCE}" "${OUTPUT_DIR}/ContextGo-${VERSION}-ios-universal.ipa"
  fi
fi

echo "Prepared iOS shell artifacts:"
find "${OUTPUT_DIR}" -maxdepth 2 | sort

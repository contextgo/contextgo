#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:?usage: build-android-release.sh <version> <output-dir>}"
OUTPUT_DIR="${2:?usage: build-android-release.sh <version> <output-dir>}"
BUILD_VARIANT="${CONTEXTGO_ANDROID_BUILD_VARIANT:-release}"
VERSION_CODE="${CONTEXTGO_RELEASE_VERSION_CODE:-1}"

case "$BUILD_VARIANT" in
  debug)
    GRADLE_TASKS=(clean assembleDebug)
    APK_SEARCH_DIR="${ROOT_DIR}/android/app/build/outputs/apk/debug"
    TARGET_APK_NAME="ContextGo-${VERSION}-android-universal-debug.apk"
    ;;
  release)
    GRADLE_TASKS=(clean assembleRelease bundleRelease)
    APK_SEARCH_DIR="${ROOT_DIR}/android/app/build/outputs/apk/release"
    AAB_SEARCH_DIR="${ROOT_DIR}/android/app/build/outputs/bundle/release"
    TARGET_APK_NAME="ContextGo-${VERSION}-android-universal.apk"
    TARGET_AAB_NAME="ContextGo-${VERSION}-android-universal.aab"
    ;;
  *)
    echo "Unsupported CONTEXTGO_ANDROID_BUILD_VARIANT: ${BUILD_VARIANT}" >&2
    echo "Expected one of: debug, release" >&2
    exit 1
    ;;
esac

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

(
  cd "$ROOT_DIR"
  CONTEXTGO_RELEASE_VERSION="$VERSION" \
  CONTEXTGO_RELEASE_VERSION_CODE="$VERSION_CODE" \
  bash "${ROOT_DIR}/scripts/android-gradlew.sh" "${GRADLE_TASKS[@]}"
)

APK_SOURCE="$(find "$APK_SEARCH_DIR" -maxdepth 1 -type f -name '*.apk' | sort | head -n 1 || true)"
if [[ -z "$APK_SOURCE" ]]; then
  echo "No APK was produced under ${APK_SEARCH_DIR}" >&2
  exit 1
fi

if [[ "$BUILD_VARIANT" == "release" && "$APK_SOURCE" == *"-unsigned.apk" ]]; then
  echo "Release APK is unsigned. Configure ANDROID_KEYSTORE_PATH / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS / ANDROID_KEY_PASSWORD before publishing stable tags." >&2
  exit 1
fi

cp -f "$APK_SOURCE" "${OUTPUT_DIR}/${TARGET_APK_NAME}"

if [[ "$BUILD_VARIANT" == "release" ]]; then
  AAB_SOURCE="$(find "$AAB_SEARCH_DIR" -maxdepth 1 -type f -name '*.aab' | sort | head -n 1 || true)"
  if [[ -n "$AAB_SOURCE" ]]; then
    cp -f "$AAB_SOURCE" "${OUTPUT_DIR}/${TARGET_AAB_NAME}"
  fi
fi

echo "Prepared Android shell artifacts:"
find "$OUTPUT_DIR" -maxdepth 1 -type f | sort

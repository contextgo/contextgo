#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:?usage: build-harmony-release.sh <version> <output-dir>}"
OUTPUT_DIR="${2:?usage: build-harmony-release.sh <version> <output-dir>}"
HARMONY_DIR="${ROOT_DIR}/harmony"
TARGET_ARCH="${CONTEXTGO_HARMONY_ARCH:-arm64}"
BUILD_COMMAND="${CONTEXTGO_HARMONY_RELEASE_COMMAND:-}"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

if [[ -n "$BUILD_COMMAND" ]]; then
  (
    cd "$HARMONY_DIR"
    eval "$BUILD_COMMAND"
  )
fi

APP_SOURCE="$(find "$HARMONY_DIR" -type f -name '*.app' ! -name '*unsigned*' | sort | head -n 1 || true)"
HAP_SOURCE="$(find "$HARMONY_DIR" -type f -name '*.hap' ! -name '*unsigned*' | sort | head -n 1 || true)"
ARTIFACT_SUFFIX=''

if [[ -z "$APP_SOURCE" && -z "$HAP_SOURCE" ]]; then
  APP_SOURCE="$(find "$HARMONY_DIR" -type f -name '*unsigned*.app' | sort | head -n 1 || true)"
  HAP_SOURCE="$(find "$HARMONY_DIR" -type f -name '*unsigned*.hap' | sort | head -n 1 || true)"

  if [[ -n "$APP_SOURCE" || -n "$HAP_SOURCE" ]]; then
    ARTIFACT_SUFFIX='-unsigned'
    echo "No signed HarmonyOS packages were produced; falling back to unsigned outputs." >&2
  fi
fi

if [[ -z "$APP_SOURCE" && -z "$HAP_SOURCE" ]]; then
  echo "No HarmonyOS packages were produced." >&2
  echo "Set CONTEXTGO_HARMONY_RELEASE_COMMAND on the runner, or ensure unsigned outputs are available under the Harmony build directories." >&2
  exit 1
fi

if [[ -n "$APP_SOURCE" ]]; then
  cp -f "$APP_SOURCE" "${OUTPUT_DIR}/ContextGo-${VERSION}-harmony-${TARGET_ARCH}${ARTIFACT_SUFFIX}.app"
fi

if [[ -n "$HAP_SOURCE" ]]; then
  cp -f "$HAP_SOURCE" "${OUTPUT_DIR}/ContextGo-${VERSION}-harmony-${TARGET_ARCH}${ARTIFACT_SUFFIX}.hap"
fi

echo "Prepared HarmonyOS shell artifacts:"
find "$OUTPUT_DIR" -maxdepth 1 -type f | sort

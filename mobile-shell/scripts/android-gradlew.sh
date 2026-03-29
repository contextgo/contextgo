#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]]; then
  cd "${ROOT_DIR}/android"
  exec ./gradlew "$@"
fi

JAVA_CANDIDATES=(
  "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  "/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home"
)

for candidate in "${JAVA_CANDIDATES[@]}"; do
  if [[ -x "${candidate}/bin/java" ]]; then
    export JAVA_HOME="${candidate}"
    cd "${ROOT_DIR}/android"
    exec ./gradlew "$@"
  fi
done

echo "No compatible JDK found. Install openjdk@17 or configure JAVA_HOME manually." >&2
exit 1

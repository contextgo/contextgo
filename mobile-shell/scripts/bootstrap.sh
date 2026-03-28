#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

resolve_java_home() {
  if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]]; then
    echo "${JAVA_HOME}"
    return 0
  fi

  local candidates=(
    "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
    "/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home"
  )

  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -x "${candidate}/bin/java" ]]; then
      echo "${candidate}"
      return 0
    fi
  done

  return 1
}

"${ROOT_DIR}/scripts/generate-icons.sh"

if command -v xcodegen >/dev/null 2>&1; then
  echo "Generating iOS Xcode project..."
  (
    cd "${ROOT_DIR}/ios"
    xcodegen generate
  )
else
  echo "Skipping iOS project generation because xcodegen is not installed."
fi

if command -v gradle >/dev/null 2>&1; then
  echo "Generating Android Gradle wrapper..."
  JAVA_HOME_VALUE="$(resolve_java_home || true)"
  if [[ -z "${JAVA_HOME_VALUE}" ]]; then
    echo "Skipping Android Gradle wrapper because no compatible JAVA_HOME was found."
  else
    (
      cd "${ROOT_DIR}/android"
      JAVA_HOME="${JAVA_HOME_VALUE}" gradle wrapper --gradle-version 8.7
    )
  fi
else
  echo "Skipping Android Gradle wrapper because gradle is not installed."
fi

echo "Bootstrap complete."

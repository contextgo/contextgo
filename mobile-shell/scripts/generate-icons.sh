#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_ICON="${ROOT_DIR}/../mobile/assets/images/icon.png"

if [[ ! -f "${SOURCE_ICON}" ]]; then
  echo "Source icon not found: ${SOURCE_ICON}" >&2
  exit 1
fi

resize_png() {
  local size="$1"
  local output="$2"
  mkdir -p "$(dirname "${output}")"
  sips --resampleHeightWidth "${size}" "${size}" "${SOURCE_ICON}" --out "${output}" >/dev/null
}

echo "Generating iOS app icons..."
resize_png 40 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-20@2x.png"
resize_png 60 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-20@3x.png"
resize_png 58 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-29@2x.png"
resize_png 87 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-29@3x.png"
resize_png 80 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-40@2x.png"
resize_png 120 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-40@3x.png"
resize_png 120 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-60@2x.png"
resize_png 180 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-60@3x.png"
resize_png 20 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-20-ipad.png"
resize_png 40 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-20@2x-ipad.png"
resize_png 29 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-29-ipad.png"
resize_png 58 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-29@2x-ipad.png"
resize_png 40 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-40-ipad.png"
resize_png 80 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-40@2x-ipad.png"
resize_png 76 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-76.png"
resize_png 152 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-76@2x.png"
resize_png 167 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-83.5@2x.png"
resize_png 1024 "${ROOT_DIR}/ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png"

echo "Generating Android launcher icons..."
resize_png 48 "${ROOT_DIR}/android/app/src/main/res/mipmap-mdpi/ic_launcher.png"
resize_png 48 "${ROOT_DIR}/android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png"
resize_png 72 "${ROOT_DIR}/android/app/src/main/res/mipmap-hdpi/ic_launcher.png"
resize_png 72 "${ROOT_DIR}/android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png"
resize_png 96 "${ROOT_DIR}/android/app/src/main/res/mipmap-xhdpi/ic_launcher.png"
resize_png 96 "${ROOT_DIR}/android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png"
resize_png 144 "${ROOT_DIR}/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png"
resize_png 144 "${ROOT_DIR}/android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png"
resize_png 192 "${ROOT_DIR}/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"
resize_png 192 "${ROOT_DIR}/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png"

echo "Copying HarmonyOS icon..."
mkdir -p "${ROOT_DIR}/harmony/entry/src/main/resources/base/media"
resize_png 41 "${ROOT_DIR}/harmony/entry/src/main/resources/base/media/app_icon.png"
resize_png 144 "${ROOT_DIR}/harmony/entry/src/main/resources/base/media/start_window_icon.png"

echo "Icon generation complete."

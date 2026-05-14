# Android Shell

## Open

- Android Studio: open the `android/` folder directly
- CLI: use `./gradlew`

## Requirements

- Android SDK installed and configured
- Compatible JDK, preferably **JDK 17**

Example:

```bash
../scripts/android-gradlew.sh assembleDebug
```

Signed release packaging for tag builds uses:

```bash
CONTEXTGO_RELEASE_VERSION=1.0.2 \
CONTEXTGO_RELEASE_VERSION_CODE=123 \
ANDROID_KEYSTORE_PATH=/path/to/release.keystore \
ANDROID_KEYSTORE_PASSWORD=... \
ANDROID_KEY_ALIAS=... \
ANDROID_KEY_PASSWORD=... \
../scripts/build-android-release.sh 1.0.2 /tmp/contextgo-android-release
```

## Shell Behavior

- First launch defaults to `https://remote.contextgo.io/remote/devices`
- Accepts a base WebUI URL such as `http://192.168.1.10:3000`
- Accepts a QR-login URL such as `http://192.168.1.10:3000/qr-login?token=...`
- Persists the last successful endpoint in `SharedPreferences`
- Enables file picker forwarding for web uploads inside the WebView

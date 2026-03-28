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

## Shell Behavior

- Accepts a base WebUI URL such as `http://192.168.1.10:3000`
- Accepts a QR-login URL such as `http://192.168.1.10:3000/qr-login?token=...`
- Persists the last successful endpoint in `SharedPreferences`
- Enables file picker forwarding for web uploads inside the WebView

# HarmonyOS Shell

This is a HarmonyOS NEXT shell scaffold for loading ContextGo WebUI in a native `Web` container.

Notes:

- Local CLI verification now works with:
  - `DEVECO_SDK_HOME="$HOME/Library/Huawei/command-line-tools/sdk"`
  - `ohpm install`
  - `hvigorw tasks`
- Local CLI full assemble also works:
  - `DEVECO_SDK_HOME="$HOME/Library/Huawei/command-line-tools/sdk" hvigorw assembleApp --debug --stacktrace`
- Current unsigned output files:
  - `build/outputs/default/harmony-default-unsigned.app`
  - `entry/build/default/outputs/default/entry-default-unsigned.hap`
- Open this folder in DevEco Studio to add signing material and produce store-ready signed packages.
- Connection flow matches the Android and iOS shells: the app opens Official Remote by default and still allows a custom WebUI URL or `/qr-login?token=...` URL when needed.

import web_webview from '@ohos.web.webview';

const OFFICIAL_REMOTE_HOST: string = 'remote.contextgo.io';
const OFFICIAL_REMOTE_URL: string = 'https://remote.contextgo.io/remote/devices';
const MOBILE_SHELL_RUNTIME_TOKEN: string = 'ContextGoMobileShell/1.0';
const STARTUP_BRIDGE_NAME: string = 'ContextGoMobileShell';
const STARTUP_OVERLAY_FALLBACK_DELAY_MS: number = 500;
const STARTUP_READY_OBSERVER_SCRIPT: string =
  `
  (function() {
    if (window.__contextGoMobileShellStartupReadyObserverInstalled) {
      return;
    }

    window.__contextGoMobileShellStartupReadyObserverInstalled = true;
    const notifyReady = function() {
      if (window.${STARTUP_BRIDGE_NAME} && typeof window.${STARTUP_BRIDGE_NAME}.notifyReady === 'function') {
        window.${STARTUP_BRIDGE_NAME}.notifyReady();
      }
    };

    const maybeNotifyReady = function() {
      if (
        window.__CONTEXTGO_STARTUP_READY === true ||
        (document.documentElement && document.documentElement.dataset.contextgoStartupReady === 'true')
      ) {
        notifyReady();
      }
    };

    window.addEventListener('contextgo:startup-ready', notifyReady, { once: true });

    if (document.documentElement) {
      new MutationObserver(maybeNotifyReady).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-contextgo-startup-ready']
      });
    }

    maybeNotifyReady();
  })();
  `;

PersistentStorage.persistProp('shellTargetUrl', '');
PersistentStorage.persistProp('shellIncomingUrl', '');

function normalizePathSuffix(suffix: string): string {
  if (suffix.length === 0 || suffix === '/') {
    return '/login';
  }

  if (suffix.startsWith('/?') || suffix.startsWith('/#')) {
    return `/login${suffix.substring(1)}`;
  }

  return suffix;
}

function findPathStartIndex(value: string): number {
  const slashIndex = value.indexOf('/');
  const queryIndex = value.indexOf('?');
  const hashIndex = value.indexOf('#');

  let firstIndex = -1;

  if (slashIndex >= 0) {
    firstIndex = slashIndex;
  }

  if (queryIndex >= 0 && (firstIndex < 0 || queryIndex < firstIndex)) {
    firstIndex = queryIndex;
  }

  if (hashIndex >= 0 && (firstIndex < 0 || hashIndex < firstIndex)) {
    firstIndex = hashIndex;
  }

  return firstIndex;
}

function findQueryStartIndex(value: string): number {
  const queryIndex = value.indexOf('?');
  const hashIndex = value.indexOf('#');

  if (queryIndex >= 0 && hashIndex >= 0) {
    return Math.min(queryIndex, hashIndex);
  }

  return Math.max(queryIndex, hashIndex);
}

function decodeQueryValue(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, '%20'));
  } catch (_error) {
    return value;
  }
}

function getQueryParameter(rawInput: string, name: string): string | null {
  const queryStartIndex = findQueryStartIndex(rawInput);
  if (queryStartIndex < 0) {
    return null;
  }

  const query = rawInput.substring(queryStartIndex + 1);
  const hashIndex = query.indexOf('#');
  const queryWithoutHash = hashIndex >= 0 ? query.substring(0, hashIndex) : query;
  const pairs = queryWithoutHash.split('&');

  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index];
    if (!pair) {
      continue;
    }

    const separatorIndex = pair.indexOf('=');
    const rawName = separatorIndex >= 0 ? pair.substring(0, separatorIndex) : pair;
    if (decodeQueryValue(rawName) !== name) {
      continue;
    }

    const rawValue = separatorIndex >= 0 ? pair.substring(separatorIndex + 1) : '';
    return decodeQueryValue(rawValue);
  }

  return null;
}

function resolveTarget(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('contextgo-remote://')) {
    const wrappedTarget = getQueryParameter(trimmed, 'target');
    return resolveTarget(wrappedTarget ?? OFFICIAL_REMOTE_URL);
  }

  const normalized = trimmed.includes('://') ? trimmed : `http://${trimmed}`;
  const schemeSeparatorIndex = normalized.indexOf('://');
  if (schemeSeparatorIndex <= 0) {
    return null;
  }

  const protocol = normalized.substring(0, schemeSeparatorIndex).toLowerCase();
  if (protocol !== 'http' && protocol !== 'https') {
    return null;
  }

  const remainder = normalized.substring(schemeSeparatorIndex + 3);
  if (remainder.length === 0) {
    return null;
  }

  const pathStartIndex = findPathStartIndex(remainder);
  const authority = pathStartIndex >= 0 ? remainder.substring(0, pathStartIndex) : remainder;
  if (authority.length === 0) {
    return null;
  }

  const suffix = pathStartIndex >= 0 ? remainder.substring(pathStartIndex) : '';
  if (authority.toLowerCase() === OFFICIAL_REMOTE_HOST) {
    if (suffix.length === 0 || suffix === '/' || suffix === '/login') {
      return `${protocol}://${authority}/remote/devices`;
    }

    if (suffix.startsWith('/?') || suffix.startsWith('/#')) {
      return `${protocol}://${authority}/remote/devices${suffix.substring(1)}`;
    }
  }

  return `${protocol}://${authority}${normalizePathSuffix(suffix)}`;
}

class StartupBridge {
  private onReady: (() => void) | undefined = undefined;

  setOnReady(callback: () => void): void {
    this.onReady = callback;
  }

  notifyReady(): void {
    if (this.onReady) {
      this.onReady();
    }
  }
}

@Entry
@Component
struct Index {
  private controller: web_webview.WebviewController = new web_webview.WebviewController();
  private startupBridge: StartupBridge = new StartupBridge();

  @StorageLink('shellTargetUrl') storedTargetUrl: string = '';
  @StorageLink('shellIncomingUrl') incomingUrl: string = '';
  @State inputUrl: string = '';
  @State activeUrl: string = '';
  @State errorText: string = '';
  @State startupOverlayVisible: boolean = false;
  @State startupNavigationFinished: boolean = false;
  @State startupReadyReceived: boolean = false;
  @State startupOverlayMessage: string = 'Connecting to your desktop…';

  aboutToAppear(): void {
    this.startupBridge.setOnReady(() => {
      this.startupReadyReceived = true;
      this.dismissStartupOverlayIfReady();
    });

    if (this.incomingUrl.length > 0) {
      const resolvedIncomingUrl = resolveTarget(this.incomingUrl);
      AppStorage.setOrCreate('shellIncomingUrl', '');
      if (resolvedIncomingUrl) {
        this.openTarget(resolvedIncomingUrl);
        return;
      }
    }

    if (this.storedTargetUrl.length > 0) {
      this.inputUrl = this.storedTargetUrl;
      this.openTarget(this.storedTargetUrl, false);
      return;
    }

    this.openOfficialRemote(false);
  }

  private connect(): void {
    const resolved = resolveTarget(this.inputUrl);
    if (!resolved) {
      this.errorText = 'Enter a valid http(s) ContextGo WebUI URL or a /qr-login link.';
      return;
    }

    this.openTarget(resolved);
  }

  private openOfficialRemote(persist: boolean = true): void {
    const resolved = resolveTarget(OFFICIAL_REMOTE_URL);
    if (!resolved) {
      return;
    }

    this.openTarget(resolved, persist);
  }

  private openTarget(targetUrl: string, persist: boolean = true): void {
    this.errorText = '';
    this.inputUrl = targetUrl;
    if (persist) {
      this.storedTargetUrl = targetUrl;
    }
    this.showStartupOverlay(targetUrl);
    this.activeUrl = targetUrl;
  }

  private showConnectionSettings(): void {
    this.errorText = '';
    this.inputUrl = this.storedTargetUrl.length > 0 ? this.storedTargetUrl : this.activeUrl;
    this.activeUrl = '';
    this.startupOverlayVisible = false;
  }

  private showStartupOverlay(targetUrl: string): void {
    this.startupNavigationFinished = false;
    this.startupReadyReceived = false;
    this.startupOverlayVisible = true;
    this.startupOverlayMessage = this.resolveStartupOverlayMessage(targetUrl);
  }

  private dismissStartupOverlayIfReady(): void {
    if (this.startupNavigationFinished && this.startupReadyReceived) {
      this.startupOverlayVisible = false;
    }
  }

  private resolveStartupOverlayMessage(targetUrl: string): string {
    if (targetUrl.includes('/remote/devices')) {
      return 'Loading your device list…';
    }

    return 'Connecting to your desktop…';
  }

  @Builder
  private buildConnectView(): void {
    Scroll() {
      Column({ space: 16 }) {
        Text('Connect ContextGo')
          .fontSize(24)
          .fontWeight(FontWeight.Medium)
          .width('100%')
          .textAlign(TextAlign.Start)

        Text('ContextGo opens Official Remote by default. Use a custom WebUI host only when you want to connect directly to your own desktop or a self-hosted gateway.')
          .fontSize(14)
          .fontColor('#666666')
          .width('100%')
          .textAlign(TextAlign.Start)

        Button('Use Official Remote')
          .width('100%')
          .onClick(() => {
            this.openOfficialRemote();
          })

        Text('Open https://remote.contextgo.io/remote/devices')
          .fontSize(12)
          .fontColor('#888888')
          .width('100%')
          .textAlign(TextAlign.Start)

        Text('Custom host')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .width('100%')
          .textAlign(TextAlign.Start)

        Text('Paste a base WebUI URL like http://192.168.1.10:3000 or a /qr-login?token=... link generated by ContextGo.')
          .fontSize(14)
          .fontColor('#666666')
          .width('100%')
          .textAlign(TextAlign.Start)

        TextInput({ text: this.inputUrl, placeholder: 'http://192.168.1.10:3000' })
          .width('100%')
          .onChange((value: string) => {
            this.inputUrl = value;
          })

        if (this.errorText.length > 0) {
          Text(this.errorText)
            .fontSize(12)
            .fontColor('#D9485F')
            .width('100%')
            .textAlign(TextAlign.Start)
        }

        Button('Open Custom Host')
          .width('100%')
          .onClick(() => {
            this.connect();
          })

        Text('The app stores the last successful endpoint locally and reopens it next time.')
          .fontSize(12)
          .fontColor('#888888')
          .width('100%')
          .textAlign(TextAlign.Start)
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
      .padding(24)
    }
    .width('100%')
    .height('100%')
  }

  @Builder
  private buildWebView(): void {
    Column() {
      Row({ space: 12 }) {
        Button('Refresh')
          .onClick(() => {
            this.controller.refresh();
          })

        Button('Change Host')
          .onClick(() => {
            this.showConnectionSettings();
          })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 12, bottom: 12 })
      .backgroundColor('#F5F7FA')

      Stack({ alignContent: Alignment.Center }) {
        Web({ src: this.activeUrl, controller: this.controller })
          .javaScriptAccess(true)
          .domStorageAccess(true)
          .fileAccess(true)
          .javaScriptProxy({
            object: this.startupBridge,
            name: STARTUP_BRIDGE_NAME,
            methodList: ['notifyReady'],
            controller: this.controller,
          })
          .onControllerAttached(() => {
            web_webview.WebCookieManager.putAcceptCookieEnabled(true);
            web_webview.WebCookieManager.putAcceptThirdPartyCookieEnabled(true);
            const userAgent = this.controller.getUserAgent();
            this.controller.setCustomUserAgent(`${userAgent} ${MOBILE_SHELL_RUNTIME_TOKEN}`.trim());
          })
          .onPageBegin((event) => {
            this.startupOverlayMessage = this.resolveStartupOverlayMessage(event.url);
          })
          .onPageEnd((event) => {
            this.startupNavigationFinished = true;
            this.startupOverlayMessage = this.resolveStartupOverlayMessage(event.url);
            this.dismissStartupOverlayIfReady();
            void this.controller.runJavaScript(STARTUP_READY_OBSERVER_SCRIPT).catch((error: Error) => {
              console.error(`Failed to inject startup-ready observer: ${JSON.stringify(error)}`);
            });
            setTimeout(() => {
              this.startupOverlayVisible = false;
            }, STARTUP_OVERLAY_FALLBACK_DELAY_MS);
          })
          .onOverrideUrlLoading((event) => {
            const targetUrl = event.getRequestUrl();
            const schemeSeparatorIndex = targetUrl.indexOf('://');
            if (schemeSeparatorIndex <= 0) {
              return false;
            }

            const scheme = targetUrl.substring(0, schemeSeparatorIndex).toLowerCase();
            if (scheme === 'http' || scheme === 'https') {
              return false;
            }

            const resolvedIncomingUrl = resolveTarget(targetUrl);
            if (resolvedIncomingUrl) {
              this.openTarget(resolvedIncomingUrl);
            }
            return true;
          })
          .onShowFileSelector((_event) => {
            return false;
          })
          .width('100%')
          .height('100%')

        if (this.startupOverlayVisible) {
          Column({ space: 16 }) {
            Text('ContextGo')
              .fontSize(26)
              .fontWeight(FontWeight.Bold)

            LoadingProgress()

            Text(this.startupOverlayMessage)
              .fontSize(14)
              .fontColor('#666666')
          }
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
          .width('100%')
          .height('100%')
          .backgroundColor('#F5F7FA')
        }
      }
      .width('100%')
      .layoutWeight(1)
    }
    .width('100%')
    .height('100%')
  }

  build() {
    Column() {
      if (this.activeUrl.length > 0) {
        this.buildWebView();
      } else {
        this.buildConnectView();
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F5F7FA')
  }
}

import Foundation
import UIKit
import UniformTypeIdentifiers
import WebKit

@MainActor
final class WebViewStore: NSObject, ObservableObject {
  private static let officialRemoteHost = "remote.contextgo.io"
  private static let themeColorMessageHandlerName = "contextGoThemeColor"
  private static let startupReadyMessageHandlerName = "contextGoStartupReady"
  private static let defaultChromeColorHex = "#f7f8fb"

  enum LaunchOverlayPhase {
    case brand
    case connecting
  }

  private static var themeColorObserverScript: String {
    """
    (() => {
      if (window.__contextGoThemeColorObserverInstalled) {
        return;
      }

      window.__contextGoThemeColorObserverInstalled = true;
      const handler = window.webkit?.messageHandlers?.\(themeColorMessageHandlerName);
      if (!handler) {
        return;
      }

      let queued = false;
      const postThemeColor = () => {
        queued = false;
        const themeColor = document.querySelector('meta[name="theme-color"]')?.content?.trim() ?? '';
        handler.postMessage(themeColor);
      };

      const schedulePostThemeColor = () => {
        if (queued) {
          return;
        }

        queued = true;
        window.setTimeout(postThemeColor, 0);
      };

      const hookHistoryMethod = (methodName) => {
        const original = history[methodName];
        if (typeof original !== 'function') {
          return;
        }

        history[methodName] = function() {
          const result = original.apply(this, arguments);
          schedulePostThemeColor();
          return result;
        };
      };

      hookHistoryMethod('pushState');
      hookHistoryMethod('replaceState');

      const startObserving = () => {
        if (!document.head) {
          return;
        }

        new MutationObserver(schedulePostThemeColor).observe(document.head, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['content'],
        });
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          startObserving();
          schedulePostThemeColor();
        }, { once: true });
      } else {
        startObserving();
        schedulePostThemeColor();
      }

      window.addEventListener('popstate', schedulePostThemeColor);
      window.addEventListener('hashchange', schedulePostThemeColor);
      window.addEventListener('load', schedulePostThemeColor);
    })();
    """
  }

  private static var startupReadyObserverScript: String {
    """
    (() => {
      if (window.__contextGoStartupReadyObserverInstalled) {
        return;
      }

      window.__contextGoStartupReadyObserverInstalled = true;
      const handler = window.webkit?.messageHandlers?.\(startupReadyMessageHandlerName);
      if (!handler) {
        return;
      }

      let posted = false;
      const postReady = () => {
        if (posted) {
          return;
        }

        posted = true;
        handler.postMessage('ready');
      };

      const maybePostReady = () => {
        if (
          window.__CONTEXTGO_STARTUP_READY === true ||
          document.documentElement?.dataset?.contextgoStartupReady === 'true'
        ) {
          postReady();
        }
      };

      window.addEventListener('contextgo:startup-ready', postReady, { once: true });
      window.addEventListener('load', maybePostReady, { once: true });

      if (document.documentElement) {
        new MutationObserver(maybePostReady).observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-contextgo-startup-ready'],
        });
      }

      maybePostReady();
    })();
    """
  }

  let webView: WKWebView
  @Published private(set) var isPageLoading = false
  @Published private(set) var hasCommittedNavigation = false
  @Published private(set) var hasFinishedNavigation = false
  @Published private(set) var hasReceivedStartupReadySignal = false
  @Published private(set) var isLaunchOverlayVisible = true
  @Published private(set) var launchOverlayPhase: LaunchOverlayPhase = .brand
  @Published private(set) var chromeColor = UIColor(contextGoHex: WebViewStore.defaultChromeColorHex) ?? .systemBackground

  var shouldShowLaunchOverlay: Bool {
    isLaunchOverlayVisible
  }

  private let loginSessionStore: LoginSessionStore

  private var openPanelCompletionHandler: (([URL]?) -> Void)?
  private var authenticationHandler: ((URL) -> Void)?
  private var recoveryHandler: ((String?) -> Void)?
  private var requestedURL: String?
  private var overlayFallbackTask: Task<Void, Never>?
  private var keyboardWillShowObserver: NSObjectProtocol?

  override init() {
    let configuration = WKWebViewConfiguration()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = true
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
    configuration.applicationNameForUserAgent = "ContextGoMobileShell/1.0"

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.allowsBackForwardNavigationGestures = true
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    webView.isOpaque = false
    webView.backgroundColor = .clear
    webView.scrollView.backgroundColor = .clear
    self.webView = webView
    self.loginSessionStore = LoginSessionStore(cookieStore: webView.configuration.websiteDataStore.httpCookieStore)

    super.init()

    webView.configuration.userContentController.add(self, name: Self.themeColorMessageHandlerName)
    webView.configuration.userContentController.add(self, name: Self.startupReadyMessageHandlerName)
    webView.configuration.userContentController.addUserScript(
      WKUserScript(source: Self.themeColorObserverScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    )
    webView.configuration.userContentController.addUserScript(
      WKUserScript(source: Self.startupReadyObserverScript, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    )
    webView.navigationDelegate = self
    webView.uiDelegate = self
    keyboardWillShowObserver = NotificationCenter.default.addObserver(
      forName: UIResponder.keyboardWillShowNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.scheduleInputAssistantSuppression()
    }
    scheduleInputAssistantSuppression()
  }

  deinit {
    if let keyboardWillShowObserver {
      NotificationCenter.default.removeObserver(keyboardWillShowObserver)
    }
  }

  func load(url: URL, force: Bool = false, headers: [String: String] = [:]) {
    if !force && headers.isEmpty && requestedURL == url.absoluteString {
      return
    }

    requestedURL = url.absoluteString
    isPageLoading = true
    hasCommittedNavigation = false
    hasFinishedNavigation = false
    hasReceivedStartupReadySignal = false
    isLaunchOverlayVisible = true
    launchOverlayPhase = .brand
    overlayFallbackTask?.cancel()
    overlayFallbackTask = nil

    var request = URLRequest(
      url: url,
      cachePolicy: force ? .reloadIgnoringLocalCacheData : .useProtocolCachePolicy
    )
    for (field, value) in headers {
      request.setValue(value, forHTTPHeaderField: field)
    }

    webView.load(request)
  }

  func completeLoginIfNeeded(payload: LoginCompletionPayload) async -> String? {
    print("[MobileShell] Completing login for target:", payload.targetURL.absoluteString, "code:", payload.loginCode ?? "nil", "error:", payload.errorCode ?? "nil")

    var bootstrapHeaders: [String: String] = [:]
    if let code = payload.loginCode {
      do {
        let cookies = try await loginSessionStore.consumeLoginCode(code, targetURL: payload.targetURL)
        bootstrapHeaders = loginSessionStore.bootstrapHeaders(for: payload.targetURL, cookies: cookies)
      } catch {
        print("[MobileShell] Failed to consume login code:", error)
        return "consume_failed"
      }
    }

    if Self.isOfficialRemoteDevicesURL(payload.targetURL) {
      print("[MobileShell] Login attached successfully. Staying on native device list.")
      return nil
    }

    load(url: payload.targetURL, force: true, headers: bootstrapHeaders)
    return nil
  }

  func setAuthenticationHandler(_ handler: @escaping (URL) -> Void) {
    authenticationHandler = handler
  }

  func setRecoveryHandler(_ handler: @escaping (String?) -> Void) {
    recoveryHandler = handler
  }

  func reload() {
    webView.reload()
  }

  func goBack() {
    guard webView.canGoBack else { return }
    webView.goBack()
  }

  private func scheduleInputAssistantSuppression() {
    clearInputAssistantBar()
    DispatchQueue.main.async { [weak self] in
      self?.clearInputAssistantBar()
    }
  }

  private func clearInputAssistantBar() {
    clearInputAssistantItem(for: webView)
    clearInputAssistantItem(for: webView.scrollView)

    if let firstResponder = webView.findFirstResponder() {
      clearInputAssistantItem(for: firstResponder)
    }
  }

  private func clearInputAssistantItem(for responder: UIResponder) {
    let assistantItem = responder.inputAssistantItem
    assistantItem.leadingBarButtonGroups = []
    assistantItem.trailingBarButtonGroups = []
  }

  private func updateChromeColor(_ cssColor: String?) {
    guard let normalizedColor = cssColor?.trimmingCharacters(in: .whitespacesAndNewlines),
          !normalizedColor.isEmpty,
          let parsedColor = UIColor(contextGoHex: normalizedColor)
    else {
      return
    }

    chromeColor = parsedColor
  }

  private func dismissLaunchOverlayIfReady() {
    guard hasFinishedNavigation && hasReceivedStartupReadySignal else {
      return
    }

    overlayFallbackTask?.cancel()
    overlayFallbackTask = nil
    isLaunchOverlayVisible = false
  }

  private func scheduleLaunchOverlayFallbackDismissal() {
    overlayFallbackTask?.cancel()
    overlayFallbackTask = Task { @MainActor in
      try? await Task.sleep(nanoseconds: 500_000_000)
      guard !Task.isCancelled else {
        return
      }

      isLaunchOverlayVisible = false
      overlayFallbackTask = nil
    }
  }

  private func topViewController(startingFrom rootViewController: UIViewController?) -> UIViewController? {
    guard let rootViewController else { return nil }

    if let navigationController = rootViewController as? UINavigationController {
      return topViewController(startingFrom: navigationController.visibleViewController)
    }

    if let tabBarController = rootViewController as? UITabBarController {
      return topViewController(startingFrom: tabBarController.selectedViewController)
    }

    if let presentedViewController = rootViewController.presentedViewController {
      return topViewController(startingFrom: presentedViewController)
    }

    return rootViewController
  }

  private static func isOfficialRemoteDevicesURL(_ url: URL) -> Bool {
    guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
          components.host?.lowercased() == officialRemoteHost
    else {
      return false
    }

    let normalizedPath = components.path.isEmpty ? "/" : components.path.lowercased()
    return normalizedPath == "/remote/devices"
  }

  private func shouldRouteThroughSystemBrowser(_ url: URL) -> Bool {
    guard let host = url.host?.lowercased(), host == Self.officialRemoteHost else {
      return false
    }

    let path = url.path.lowercased()
    return path.hasPrefix("/api/auth/oauth/")
  }

  private func loginRecoveryErrorCode(for url: URL) -> String? {
    guard let host = url.host?.lowercased(), host == Self.officialRemoteHost else {
      return nil
    }

    let path = url.path.lowercased()
    guard path == "/login" else {
      return nil
    }

    let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    let errorCode = components?.queryItems?.first(where: { item in
      item.name == "oauthError" || item.name == "error"
    })?.value

    let trimmed = errorCode?.trimmingCharacters(in: .whitespacesAndNewlines)
    return (trimmed?.isEmpty == false) ? trimmed : "login_required"
  }

  private func recoverIfNeeded(for url: URL) -> Bool {
    guard let recoveryHandler,
          let errorCode = loginRecoveryErrorCode(for: url)
    else {
      return false
    }

    print("[MobileShell] Intercepted hosted login page. Recovering natively with error:", errorCode)
    recoveryHandler(errorCode)
    return true
  }

  private func startAuthenticationIfNeeded(for url: URL) -> Bool {
    guard shouldRouteThroughSystemBrowser(url), let authenticationHandler else {
      return false
    }

    authenticationHandler(url)
    return true
  }
}

extension WebViewStore: WKNavigationDelegate {
  func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
    isPageLoading = true
    hasCommittedNavigation = false
    scheduleInputAssistantSuppression()
  }

  func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
    hasCommittedNavigation = true
    launchOverlayPhase = .connecting
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    hasCommittedNavigation = true
    hasFinishedNavigation = true
    isPageLoading = false
    scheduleInputAssistantSuppression()
    dismissLaunchOverlayIfReady()
    scheduleLaunchOverlayFallbackDismissal()
  }

  func webView(
    _ webView: WKWebView,
    didFailProvisionalNavigation navigation: WKNavigation!,
    withError error: Error
  ) {
    hasCommittedNavigation = false
    hasFinishedNavigation = false
    isPageLoading = false
    scheduleLaunchOverlayFallbackDismissal()
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    isPageLoading = false
    scheduleLaunchOverlayFallbackDismissal()
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    guard let targetURL = navigationAction.request.url else {
      decisionHandler(.allow)
      return
    }

    if recoverIfNeeded(for: targetURL) {
      decisionHandler(.cancel)
      return
    }

    if startAuthenticationIfNeeded(for: targetURL) {
      decisionHandler(.cancel)
      return
    }

    let scheme = targetURL.scheme?.lowercased() ?? ""
    if scheme == "http" || scheme == "https" {
      decisionHandler(.allow)
      return
    }

    UIApplication.shared.open(targetURL)
    decisionHandler(.cancel)
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationResponse: WKNavigationResponse,
    decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
  ) {
    guard let responseURL = navigationResponse.response.url else {
      decisionHandler(.allow)
      return
    }

    if recoverIfNeeded(for: responseURL) {
      decisionHandler(.cancel)
      return
    }

    if startAuthenticationIfNeeded(for: responseURL) {
      decisionHandler(.cancel)
      return
    }

    decisionHandler(.allow)
  }
}

extension WebViewStore: WKScriptMessageHandler {
  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    if message.name == Self.themeColorMessageHandlerName,
       let cssColor = message.body as? String
    {
      updateChromeColor(cssColor)
      return
    }

    guard message.name == Self.startupReadyMessageHandlerName else {
      return
    }

    hasReceivedStartupReadySignal = true
    launchOverlayPhase = .connecting
    dismissLaunchOverlayIfReady()
  }
}

extension WebViewStore: WKUIDelegate {
  @available(iOS 18.4, *)
  func webView(
    _ webView: WKWebView,
    runOpenPanelWith parameters: WKOpenPanelParameters,
    initiatedByFrame frame: WKFrameInfo,
    completionHandler: @escaping ([URL]?) -> Void
  ) {
    openPanelCompletionHandler?(nil)
    openPanelCompletionHandler = completionHandler

    let picker = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.item], asCopy: true)
    picker.delegate = self
    picker.allowsMultipleSelection = parameters.allowsMultipleSelection

    guard let presenter = topViewController(startingFrom: webView.window?.rootViewController) else {
      openPanelCompletionHandler?(nil)
      openPanelCompletionHandler = nil
      return
    }

    presenter.present(picker, animated: true)
  }
}

extension WebViewStore: UIDocumentPickerDelegate {
  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    openPanelCompletionHandler?(urls)
    openPanelCompletionHandler = nil
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    openPanelCompletionHandler?(nil)
    openPanelCompletionHandler = nil
  }
}

private extension UIView {
  func findFirstResponder() -> UIResponder? {
    if isFirstResponder {
      return self
    }

    for subview in subviews {
      if let firstResponder = subview.findFirstResponder() {
        return firstResponder
      }
    }

    return nil
  }
}

private extension UIColor {
  convenience init?(contextGoHex hex: String) {
    let normalized = hex
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .replacingOccurrences(of: "#", with: "")

    let expandedHex: String
    switch normalized.count {
    case 3:
      expandedHex = normalized.map { "\($0)\($0)" }.joined()
    case 6:
      expandedHex = normalized
    default:
      return nil
    }

    guard let hexValue = Int(expandedHex, radix: 16) else {
      return nil
    }

    let red = CGFloat((hexValue >> 16) & 0xFF) / 255
    let green = CGFloat((hexValue >> 8) & 0xFF) / 255
    let blue = CGFloat(hexValue & 0xFF) / 255
    self.init(red: red, green: green, blue: blue, alpha: 1)
  }
}

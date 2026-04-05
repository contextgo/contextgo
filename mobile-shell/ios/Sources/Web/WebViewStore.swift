import Foundation
import UIKit
import UniformTypeIdentifiers
import WebKit

@MainActor
final class WebViewStore: NSObject, ObservableObject {
  private static let officialRemoteHost = "remote.contextgo.io"

  let webView: WKWebView
  @Published private(set) var isPageLoading = false
  @Published private(set) var hasCommittedNavigation = false

  var shouldShowLaunchOverlay: Bool {
    isPageLoading && !hasCommittedNavigation
  }

  private let loginSessionStore: LoginSessionStore

  private var openPanelCompletionHandler: (([URL]?) -> Void)?
  private var authenticationHandler: ((URL) -> Void)?
  private var recoveryHandler: ((String?) -> Void)?
  private var requestedURL: String?

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

    webView.navigationDelegate = self
    webView.uiDelegate = self
  }

  func load(url: URL, force: Bool = false, headers: [String: String] = [:]) {
    if !force && headers.isEmpty && requestedURL == url.absoluteString {
      return
    }

    requestedURL = url.absoluteString
    isPageLoading = true
    hasCommittedNavigation = false

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
  }

  func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
    hasCommittedNavigation = true
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    hasCommittedNavigation = true
    isPageLoading = false
  }

  func webView(
    _ webView: WKWebView,
    didFailProvisionalNavigation navigation: WKNavigation!,
    withError error: Error
  ) {
    hasCommittedNavigation = false
    isPageLoading = false
  }

  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    isPageLoading = false
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

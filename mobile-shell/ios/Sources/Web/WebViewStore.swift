import AuthenticationServices
import Foundation
import UIKit
import UniformTypeIdentifiers
import WebKit

@MainActor
final class WebViewStore: NSObject, ObservableObject {
  let webView: WKWebView
  var onOpenURL: ((URL) -> Void)?

  private var authenticationSession: ASWebAuthenticationSession?
  private var openPanelCompletionHandler: (([URL]?) -> Void)?

  override init() {
    let configuration = WKWebViewConfiguration()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = true
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
    configuration.applicationNameForUserAgent = "ContextGoMobileShell/1.0"

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.allowsBackForwardNavigationGestures = true
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    self.webView = webView

    super.init()

    webView.navigationDelegate = self
    webView.uiDelegate = self
  }

  func load(url: URL) {
    if webView.url?.absoluteString == url.absoluteString {
      return
    }

    webView.load(URLRequest(url: url))
  }

  func reload() {
    webView.reload()
  }

  func goBack() {
    guard webView.canGoBack else { return }
    webView.goBack()
  }

  private func startAuthenticationSession(url: URL) {
    authenticationSession?.cancel()

    let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "contextgo-remote") { [weak self] callbackURL, _error in
      Task { @MainActor in
        self?.authenticationSession = nil
        guard let callbackURL else { return }
        self?.onOpenURL?(callbackURL)
      }
    }
    session.presentationContextProvider = self
    session.prefersEphemeralWebBrowserSession = false

    if session.start() {
      authenticationSession = session
      return
    }

    webView.load(URLRequest(url: url))
  }

  private func shouldUseExternalAuthenticationSession(for url: URL) -> Bool {
    guard let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" else {
      return false
    }

    guard let host = url.host?.lowercased(), host == "auth.contextgo.io" || host == "remote.contextgo.io" else {
      return false
    }

    return url.path.starts(with: "/api/auth/oauth/")
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
}

extension WebViewStore: ASWebAuthenticationPresentationContextProviding {
  func presentationAnchor(for _session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    webView.window ?? ASPresentationAnchor()
  }
}

extension WebViewStore: WKNavigationDelegate {
  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    guard let targetURL = navigationAction.request.url else {
      decisionHandler(.allow)
      return
    }

    if shouldUseExternalAuthenticationSession(for: targetURL) {
      startAuthenticationSession(url: targetURL)
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

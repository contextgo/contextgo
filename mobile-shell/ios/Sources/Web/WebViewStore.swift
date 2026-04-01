import Foundation
import UIKit
import UniformTypeIdentifiers
import WebKit

@MainActor
final class WebViewStore: NSObject, ObservableObject {
  let webView: WKWebView

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

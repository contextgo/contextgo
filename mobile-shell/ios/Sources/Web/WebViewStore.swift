import Foundation
import WebKit

@MainActor
final class WebViewStore: NSObject, ObservableObject {
  let webView: WKWebView

  override init() {
    let configuration = WKWebViewConfiguration()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = true
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = true

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.allowsBackForwardNavigationGestures = true
    webView.scrollView.contentInsetAdjustmentBehavior = .never
    self.webView = webView

    super.init()
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
}

import SwiftUI
import WebKit

struct ShellWebView: UIViewRepresentable {
  @ObservedObject var store: WebViewStore
  let url: URL

  func makeUIView(context: Context) -> WKWebView {
    store.webView
  }

  func updateUIView(_ uiView: WKWebView, context: Context) {
    store.load(url: url)
  }
}

import AuthenticationServices
import Foundation
import UIKit

@MainActor
final class OAuthSessionController: NSObject, ObservableObject {
  private var session: ASWebAuthenticationSession?
  private var completionHandler: ((URL?) -> Void)?
  private(set) var isAuthenticating = false

  func setCompletionHandler(_ handler: @escaping (URL?) -> Void) {
    completionHandler = handler
  }

  func start(url: URL) {
    guard session == nil else {
      return
    }

    isAuthenticating = true
    let session = ASWebAuthenticationSession(
      url: url,
      callbackURLScheme: "contextgo-remote"
    ) { [weak self] callbackURL, error in
      Task { @MainActor in
        self?.session = nil
        self?.isAuthenticating = false
      }

      if let error {
        print("[MobileShell] OAuth session finished with error:", error)
      }

      self?.completionHandler?(callbackURL)

      if let callbackURL {
        UIApplication.shared.open(callbackURL)
      }
    }
    session.prefersEphemeralWebBrowserSession = false
    session.presentationContextProvider = self
    self.session = session
    session.start()
  }
}

extension OAuthSessionController: ASWebAuthenticationPresentationContextProviding {
  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
  }
}

import Foundation

@MainActor
final class ConnectionStore: ObservableObject {
  @Published var inputText: String = ""
  @Published var targetURL: URL?
  @Published var validationMessage: String?

  private let defaultsKey = "aionui.shell.ios.targetURL"

  init() {
    restore()
  }

  func restore() {
    guard let storedValue = UserDefaults.standard.string(forKey: defaultsKey), let restoredURL = URL(string: storedValue) else {
      return
    }

    inputText = storedValue
    targetURL = restoredURL
    validationMessage = nil
  }

  @discardableResult
  func connect() -> Bool {
    guard let resolvedURL = ShellTargetResolver.resolve(rawInput: inputText) else {
      validationMessage = "Enter a valid http(s) AionUi WebUI URL or a /qr-login link."
      return false
    }

    let resolvedText = resolvedURL.absoluteString
    inputText = resolvedText
    targetURL = resolvedURL
    validationMessage = nil
    UserDefaults.standard.set(resolvedText, forKey: defaultsKey)
    return true
  }

  func reset() {
    targetURL = nil
    inputText = ""
    validationMessage = nil
    UserDefaults.standard.removeObject(forKey: defaultsKey)
  }
}

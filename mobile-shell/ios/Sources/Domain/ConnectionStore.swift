import Foundation

@MainActor
final class ConnectionStore: ObservableObject {
  static let officialRemoteURL = "https://remote.contextgo.io/"

  @Published var inputText: String = ""
  @Published var targetURL: URL?
  @Published var validationMessage: String?

  private let defaultsKey = "contextgo.shell.ios.targetURL"

  init() {
    restore()
  }

  func restore() {
    guard let storedValue = UserDefaults.standard.string(forKey: defaultsKey), let restoredURL = URL(string: storedValue) else {
      connectToOfficialRemote(persist: false)
      return
    }

    inputText = storedValue
    targetURL = restoredURL
    validationMessage = nil
  }

  @discardableResult
  func connect() -> Bool {
    guard let resolvedURL = ShellTargetResolver.resolve(rawInput: inputText) else {
      validationMessage = String(localized: "connection.validation.invalid")
      return false
    }

    applyTarget(resolvedURL)
    return true
  }

  func connectToOfficialRemote(persist: Bool = true) {
    guard let resolvedURL = ShellTargetResolver.resolve(rawInput: Self.officialRemoteURL) else {
      return
    }

    applyTarget(resolvedURL, persist: persist)
  }

  func prepareCustomHostInput() {
    inputText = targetURL?.absoluteString ?? ""
    validationMessage = nil
  }

  private func applyTarget(_ url: URL, persist: Bool = true) {
    let resolvedText = url.absoluteString
    inputText = resolvedText
    targetURL = url
    validationMessage = nil

    guard persist else { return }
    UserDefaults.standard.set(resolvedText, forKey: defaultsKey)
  }
}

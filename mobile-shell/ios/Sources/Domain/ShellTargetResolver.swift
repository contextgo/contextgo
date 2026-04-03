import Foundation

enum ShellTargetResolver {
  private static let officialRemoteHost = "remote.contextgo.io"
  private static let officialRemoteDevicesURL = "https://remote.contextgo.io/remote/devices"
  private static let remoteShellScheme = "contextgo-remote"

  static func resolve(rawInput: String) -> URL? {
    resolvePayload(rawInput: rawInput)?.targetURL
  }

  static func resolvePayload(rawInput: String) -> LoginCompletionPayload? {
    let trimmed = rawInput.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty,
          let components = makeComponents(from: trimmed),
          let scheme = components.scheme?.lowercased()
    else {
      return nil
    }

    if scheme == remoteShellScheme {
      let loginCode = sanitizedQueryValue(named: "code", in: components)
      let explicitError = sanitizedQueryValue(named: "error", in: components)
      let wrappedTarget = sanitizedQueryValue(named: "target", in: components) ?? officialRemoteDevicesURL
      let loginFallbackError = loginFallbackErrorCode(for: wrappedTarget, hasLoginCode: loginCode != nil)
      let resolvedTarget = loginFallbackError == nil
        ? resolveOfficialTarget(rawInput: wrappedTarget)
        : URL(string: officialRemoteDevicesURL)

      guard let targetURL = resolvedTarget else {
        return nil
      }

      return LoginCompletionPayload(
        targetURL: targetURL,
        loginCode: loginCode,
        errorCode: explicitError ?? loginFallbackError
      )
    }

    guard let targetURL = resolveOfficialTarget(rawInput: trimmed) else {
      return nil
    }

    return LoginCompletionPayload(targetURL: targetURL, loginCode: nil, errorCode: nil)
  }

  private static func resolveOfficialTarget(rawInput: String) -> URL? {
    guard var components = makeComponents(from: rawInput),
          let scheme = components.scheme?.lowercased(),
          ["http", "https"].contains(scheme),
          let host = components.host?.lowercased(),
          host == officialRemoteHost
    else {
      return nil
    }

    let path = components.percentEncodedPath.isEmpty ? "/" : components.percentEncodedPath
    if path == "/" || path == "/login" {
      components.percentEncodedPath = "/remote/devices"
    }

    return components.url
  }

  private static func loginFallbackErrorCode(for rawTarget: String, hasLoginCode: Bool) -> String? {
    guard !hasLoginCode,
          let components = makeComponents(from: rawTarget),
          let host = components.host?.lowercased(),
          host == officialRemoteHost
    else {
      return nil
    }

    let path = components.percentEncodedPath.isEmpty ? "/" : components.percentEncodedPath
    guard path == "/login" else {
      return nil
    }

    return sanitizedQueryValue(named: "oauthError", in: components)
      ?? sanitizedQueryValue(named: "error", in: components)
      ?? "login_required"
  }

  private static func sanitizedQueryValue(named name: String, in components: URLComponents) -> String? {
    let value = components.queryItems?.first(where: { $0.name == name })?.value
    let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let trimmed, !trimmed.isEmpty else {
      return nil
    }

    return trimmed
  }

  private static func makeComponents(from rawInput: String) -> URLComponents? {
    let normalizedInput = rawInput.contains("://") ? rawInput : "http://" + rawInput
    return URLComponents(string: normalizedInput)
  }
}

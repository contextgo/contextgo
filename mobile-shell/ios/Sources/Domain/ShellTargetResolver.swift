import Foundation

enum ShellTargetResolver {
  private static let officialRemoteHost = "remote.contextgo.io"
  private static let remoteShellScheme = "contextgo-remote"

  static func resolve(rawInput: String) -> URL? {
    let trimmed = rawInput.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }

    let normalizedInput = trimmed.contains("://") ? trimmed : "http://" + trimmed
    guard var components = URLComponents(string: normalizedInput),
          let scheme = components.scheme?.lowercased()
    else {
      return nil
    }

    if scheme == remoteShellScheme {
      guard let wrappedTarget = components.queryItems?.first(where: { $0.name == "target" })?.value else {
        return nil
      }

      return resolve(rawInput: wrappedTarget)
    }

    guard ["http", "https"].contains(scheme), components.host?.isEmpty == false else {
      return nil
    }

    let isOfficialRemoteHost = components.host?.lowercased() == officialRemoteHost
    let path = components.percentEncodedPath.isEmpty ? "/" : components.percentEncodedPath
    if isOfficialRemoteHost {
      if path == "/" || path == "/login" {
        components.percentEncodedPath = "/remote/devices"
      }
      return components.url
    }

    if path == "/" {
      components.percentEncodedPath = "/login"
    }

    return components.url
  }
}

import Foundation

enum ShellTargetResolver {
  static func resolve(rawInput: String) -> URL? {
    let trimmed = rawInput.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }

    let normalizedInput = trimmed.contains("://") ? trimmed : "http://" + trimmed
    guard var components = URLComponents(string: normalizedInput),
          let scheme = components.scheme?.lowercased(),
          ["http", "https"].contains(scheme),
          components.host?.isEmpty == false
    else {
      return nil
    }

    let path = components.percentEncodedPath.isEmpty ? "/" : components.percentEncodedPath
    if path == "/" {
      components.percentEncodedPath = "/login"
    }

    return components.url
  }
}

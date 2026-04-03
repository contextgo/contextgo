import Foundation
import WebKit

@MainActor
final class LoginSessionStore {
  private let session: URLSession
  private let cookieStore: WKHTTPCookieStore

  init(cookieStore: WKHTTPCookieStore) {
    let configuration = URLSessionConfiguration.default
    configuration.httpShouldSetCookies = true
    configuration.httpCookieAcceptPolicy = .always
    configuration.httpCookieStorage = HTTPCookieStorage.shared

    session = URLSession(configuration: configuration)
    self.cookieStore = cookieStore
  }

  func consumeLoginCode(_ code: String, targetURL: URL) async throws -> [HTTPCookie] {
    guard let endpoint = Self.consumeEndpoint(for: targetURL) else {
      throw LoginSessionError.invalidEndpoint
    }

    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode(ConsumeLoginCodeRequest(code: code))

    let (_, response) = try await session.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse else {
      throw LoginSessionError.invalidResponse
    }

    guard (200 ... 299).contains(httpResponse.statusCode) else {
      throw LoginSessionError.requestFailed(statusCode: httpResponse.statusCode)
    }

    let responseCookies = Self.responseCookies(from: httpResponse, endpoint: endpoint)
    let storedCookies = HTTPCookieStorage.shared.cookies ?? []
    let cookies = Self.mergeCookies(responseCookies + storedCookies)

    for cookie in cookies {
      await cookieStore.setCookie(cookie)
    }

    return cookies
  }

  func bootstrapHeaders(for targetURL: URL, cookies: [HTTPCookie]) -> [String: String] {
    let matchedCookies = Self.cookies(matching: targetURL, from: cookies)
    guard !matchedCookies.isEmpty else {
      print("[MobileShell] No bootstrap cookies matched target:", targetURL.absoluteString)
      return [:]
    }

    let cookieHeader = matchedCookies
      .map { "\($0.name)=\($0.value)" }
      .joined(separator: "; ")
    return ["Cookie": cookieHeader]
  }

  private static func consumeEndpoint(for targetURL: URL) -> URL? {
    guard var components = URLComponents(url: targetURL, resolvingAgainstBaseURL: false) else {
      return nil
    }

    components.path = "/api/auth/desktop/consume"
    components.query = nil
    components.fragment = nil
    return components.url
  }

  private static func responseCookies(from response: HTTPURLResponse, endpoint: URL) -> [HTTPCookie] {
    var headerFields: [String: String] = [:]
    for (key, value) in response.allHeaderFields {
      guard let headerKey = key as? String, let headerValue = value as? String else {
        continue
      }

      headerFields[headerKey] = headerValue
    }

    return HTTPCookie.cookies(withResponseHeaderFields: headerFields, for: endpoint)
  }

  private static func mergeCookies(_ cookies: [HTTPCookie]) -> [HTTPCookie] {
    var uniqueCookies: [String: HTTPCookie] = [:]
    for cookie in cookies {
      let key = "\(cookie.domain)|\(cookie.path)|\(cookie.name)"
      uniqueCookies[key] = cookie
    }

    return Array(uniqueCookies.values)
  }

  private static func cookies(matching url: URL, from cookies: [HTTPCookie]) -> [HTTPCookie] {
    guard let host = url.host?.lowercased() else {
      return []
    }

    let path = url.path.isEmpty ? "/" : url.path
    let isSecureRequest = url.scheme?.lowercased() == "https"
    return cookies.filter { cookie in
      guard domainMatches(cookie.domain, host: host) else {
        return false
      }

      guard path.hasPrefix(cookie.path) else {
        return false
      }

      return !cookie.isSecure || isSecureRequest
    }
  }

  private static func domainMatches(_ cookieDomain: String, host: String) -> Bool {
    let normalizedDomain = cookieDomain.lowercased()
    if normalizedDomain.hasPrefix(".") {
      let suffix = String(normalizedDomain.dropFirst())
      return host == suffix || host.hasSuffix("." + suffix)
    }

    return host == normalizedDomain
  }
}

private struct ConsumeLoginCodeRequest: Encodable {
  let code: String
}

enum LoginSessionError: Error {
  case invalidEndpoint
  case invalidResponse
  case requestFailed(statusCode: Int)
}

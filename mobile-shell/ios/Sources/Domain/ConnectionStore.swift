import Foundation

@MainActor
final class ConnectionStore: ObservableObject {
  enum LandingRoute {
    case home
    case remote
  }

  static let officialRemoteURL = "https://remote.contextgo.io/remote/devices"
  private static let officialRemoteBaseURL = "https://remote.contextgo.io"
  private static let officialAuthBaseURL = "https://auth.contextgo.io"

  @Published private(set) var landingRoute: LandingRoute = .home
  @Published var targetURL: URL?
  @Published private(set) var loginCompletionRevision = 0
  @Published private(set) var loginErrorCode: String?

  private let defaultsKey = "contextgo.shell.ios.targetURL"
  private var pendingLoginPayload: LoginCompletionPayload?
  private var awaitingAuthenticationHandoff = false

  init() {
    restore()
  }

  func restore() {
    landingRoute = .home
    targetURL = nil
    loginErrorCode = nil
    awaitingAuthenticationHandoff = false
  }

  func connectToOfficialRemote(persist: Bool = true) {
    guard let resolvedURL = Self.officialRemoteDevicesURL else {
      return
    }

    landingRoute = .remote
    applyTarget(resolvedURL, persist: persist)
  }

  func connectToOfficialDevice(deviceID: String, persist: Bool = true) {
    guard let resolvedURL = Self.officialDeviceURL(for: deviceID) else {
      return
    }

    landingRoute = .remote
    applyTarget(resolvedURL, persist: persist)
  }

  func returnToHome() {
    landingRoute = .home
    targetURL = nil
    awaitingAuthenticationHandoff = false
    UserDefaults.standard.removeObject(forKey: defaultsKey)
  }

  func dismissLoginError() {
    loginErrorCode = nil
  }

  func beginAuthenticationHandoff() {
    awaitingAuthenticationHandoff = true
  }

  func cancelAuthenticationHandoff() {
    awaitingAuthenticationHandoff = false
  }

  func recoverFromLoginError(_ errorCode: String?) {
    landingRoute = .home
    targetURL = nil
    pendingLoginPayload = nil
    loginErrorCode = errorCode
    awaitingAuthenticationHandoff = false
    UserDefaults.standard.removeObject(forKey: defaultsKey)
  }

  func handleIncomingURL(_ incomingURL: URL) {
    guard let payload = ShellTargetResolver.resolvePayload(rawInput: incomingURL.absoluteString) else {
      print("[MobileShell] Ignored incoming URL:", incomingURL.absoluteString)
      return
    }

    let awaitingAuthenticationHandoff = awaitingAuthenticationHandoff
    self.awaitingAuthenticationHandoff = false

    print("[MobileShell] Incoming callback URL:", incomingURL.absoluteString)
    print("[MobileShell] Callback target:", payload.targetURL.absoluteString, "code:", payload.loginCode ?? "nil", "error:", payload.errorCode ?? "nil")

    if payload.shouldRecoverNatively {
      recoverFromLoginError(payload.errorCode)
      return
    }

    if awaitingAuthenticationHandoff, payload.loginCode == nil {
      print("[MobileShell] Authentication handoff returned without login code. Staying on native home.")
      recoverFromLoginError(payload.errorCode ?? "missing_session")
      return
    }

    loginErrorCode = nil
    pendingLoginPayload = payload
    loginCompletionRevision += 1
  }

  func completeIncomingPayload(_ payload: LoginCompletionPayload) {
    applyTarget(payload.targetURL)
  }

  func takePendingLoginPayload() -> LoginCompletionPayload? {
    let payload = pendingLoginPayload
    pendingLoginPayload = nil
    return payload
  }

  func hasOfficialSession() async -> Bool {
    let session = makeCookieSession()
    return await fetchSessionState(using: session)
  }

  func fetchOfficialProviders() async -> [AuthProvider] {
    guard let providersURL = URL(string: Self.officialAuthBaseURL + "/api/auth/providers") else {
      return AuthProvider.allCases
    }

    do {
      let (data, response) = try await URLSession.shared.data(from: providersURL)
      guard let httpResponse = response as? HTTPURLResponse,
            (200 ... 299).contains(httpResponse.statusCode)
      else {
        return AuthProvider.allCases
      }

      let payload = try JSONDecoder().decode(AuthProvidersResponse.self, from: data)
      let providers = payload.providers.compactMap(AuthProvider.init(rawValue:))
      return providers.isEmpty ? AuthProvider.allCases : providers
    } catch {
      return AuthProvider.allCases
    }
  }

  func fetchOfficialHomeSnapshot() async -> OfficialHomeSnapshot {
    let session = makeCookieSession()
    let authenticated = await fetchSessionState(using: session)
    guard authenticated else {
      return .unauthenticated
    }

    async let user = fetchOfficialUser(using: session)
    async let devices = fetchOfficialRemoteDevices(using: session)

    return OfficialHomeSnapshot(
      isAuthenticated: true,
      user: await user,
      devices: sortDevices(await devices)
    )
  }

  func buildOfficialAuthenticationURL(for provider: AuthProvider) -> URL? {
    guard let authBaseURL = URL(string: Self.officialAuthBaseURL),
          let targetURL = Self.officialRemoteDevicesURL
    else {
      return nil
    }

    let callbackPath = "/mobile-shell-login-complete"
    let startPath = "/api/auth/oauth/\(provider.rawValue)/start"

    guard var completionComponents = URLComponents(
      url: authBaseURL.appending(path: callbackPath),
      resolvingAgainstBaseURL: false
    ) else {
      return nil
    }
    completionComponents.queryItems = [
      URLQueryItem(name: "target", value: targetURL.absoluteString),
      URLQueryItem(name: "provider", value: provider.rawValue),
    ]

    guard let completionURL = completionComponents.url,
          var startComponents = URLComponents(
            url: authBaseURL.appending(path: startPath),
            resolvingAgainstBaseURL: false
          )
    else {
      return nil
    }

    startComponents.queryItems = [URLQueryItem(name: "next", value: completionURL.absoluteString)]
    return startComponents.url
  }

  private func makeCookieSession() -> URLSession {
    let configuration = URLSessionConfiguration.default
    configuration.httpShouldSetCookies = true
    configuration.httpCookieAcceptPolicy = .always
    configuration.httpCookieStorage = HTTPCookieStorage.shared
    return URLSession(configuration: configuration)
  }

  private func fetchSessionState(using session: URLSession) async -> Bool {
    guard let sessionURL = URL(string: Self.officialRemoteBaseURL + "/api/auth/session") else {
      return false
    }

    do {
      let (data, response) = try await session.data(from: sessionURL)
      guard let httpResponse = response as? HTTPURLResponse,
            (200 ... 299).contains(httpResponse.statusCode)
      else {
        return false
      }

      let payload = try JSONDecoder().decode(AuthSessionResponse.self, from: data)
      return payload.authenticated
    } catch {
      return false
    }
  }

  private func fetchOfficialUser(using session: URLSession) async -> OfficialUser? {
    guard let userURL = URL(string: Self.officialRemoteBaseURL + "/api/auth/user") else {
      return nil
    }

    do {
      let (data, response) = try await session.data(from: userURL)
      guard let httpResponse = response as? HTTPURLResponse,
            (200 ... 299).contains(httpResponse.statusCode)
      else {
        return nil
      }

      let payload = try JSONDecoder().decode(AuthCurrentUserResponse.self, from: data)
      return payload.user
    } catch {
      return nil
    }
  }

  private func fetchOfficialRemoteDevices(using session: URLSession) async -> [OfficialRemoteDevice] {
    guard let devicesURL = URL(string: Self.officialRemoteBaseURL + "/api/remote/devices") else {
      return []
    }

    do {
      let (data, response) = try await session.data(from: devicesURL)
      guard let httpResponse = response as? HTTPURLResponse,
            (200 ... 299).contains(httpResponse.statusCode)
      else {
        return []
      }

      let payload = try JSONDecoder().decode(OfficialRemoteDevicesResponse.self, from: data)
      return payload.devices
    } catch {
      return []
    }
  }

  private func sortDevices(_ devices: [OfficialRemoteDevice]) -> [OfficialRemoteDevice] {
    devices.sorted { lhs, rhs in
      if lhs.sortPriority != rhs.sortPriority {
        return lhs.sortPriority > rhs.sortPriority
      }

      if lhs.lastActivityKey != rhs.lastActivityKey {
        return lhs.lastActivityKey > rhs.lastActivityKey
      }

      return lhs.deviceName.localizedCaseInsensitiveCompare(rhs.deviceName) == .orderedAscending
    }
  }

  private func applyTarget(_ url: URL, persist: Bool = true) {
    let resolvedText = url.absoluteString
    landingRoute = .remote
    targetURL = url

    guard persist else { return }
    UserDefaults.standard.set(resolvedText, forKey: defaultsKey)
  }

  private static var officialRemoteDevicesURL: URL? {
    URL(string: officialRemoteURL)
  }

  private static func officialDeviceURL(for deviceID: String) -> URL? {
    URL(string: officialRemoteBaseURL + "/device/\(deviceID)")
  }
}

struct OfficialHomeSnapshot {
  let isAuthenticated: Bool
  let user: OfficialUser?
  let devices: [OfficialRemoteDevice]

  static let unauthenticated = OfficialHomeSnapshot(
    isAuthenticated: false,
    user: nil,
    devices: []
  )

  var deviceCount: Int {
    devices.count
  }

  var readyDeviceCount: Int {
    devices.filter(\.isAvailable).count
  }

  var liveSessionCount: Int {
    devices.filter(\.isLiveSession).count
  }

  var previewDevices: [OfficialRemoteDevice] {
    Array(devices.prefix(3))
  }
}

struct OfficialUser: Decodable {
  let id: String
  let username: String?
  let displayName: String?
  let email: String?
  let avatarURL: URL?
  let authSource: String?

  enum CodingKeys: String, CodingKey {
    case id
    case username
    case displayName
    case email
    case avatarURL = "avatarUrl"
    case authSource
  }

  var preferredName: String {
    if let displayName, !displayName.isEmpty {
      return displayName
    }

    if let username, !username.isEmpty {
      return username
    }

    if let email, !email.isEmpty {
      return email
    }

    return "ContextGo"
  }

  var secondaryLine: String? {
    if let email, !email.isEmpty {
      return email
    }

    if let username, !username.isEmpty, username != preferredName {
      return username
    }

    return nil
  }

  var initials: String {
    let letters = preferredName
      .split(separator: " ")
      .prefix(2)
      .compactMap { $0.first }

    if !letters.isEmpty {
      return String(letters).uppercased()
    }

    return String(preferredName.prefix(1)).uppercased()
  }
}

struct OfficialRemoteDevice: Decodable, Identifiable {
  let id: String
  let deviceName: String
  let platform: String
  let deviceKind: String
  let status: String
  let updatedAt: String?
  let lastSeenAt: String?
  let remoteStatus: OfficialRemoteDeviceStatus

  var isAvailable: Bool {
    remoteStatus.connected && remoteStatus.browserEntryReady && !remoteStatus.clientConnected
  }

  var isLiveSession: Bool {
    remoteStatus.connected && remoteStatus.clientConnected
  }

  var canOpen: Bool {
    remoteStatus.connected && remoteStatus.browserEntryReady
  }

  var sortPriority: Int {
    if isAvailable {
      return 3
    }

    if isLiveSession {
      return 2
    }

    if remoteStatus.connected {
      return 1
    }

    return 0
  }

  var platformLabel: String {
    platform.replacingOccurrences(of: "_", with: " ").capitalized
  }

  var lastActivityKey: String {
    updatedAt ?? lastSeenAt ?? ""
  }
}

struct OfficialRemoteDeviceStatus: Decodable {
  let connected: Bool
  let clientConnected: Bool
  let transport: String?
  let browserEntryReady: Bool
}

private struct AuthSessionResponse: Decodable {
  let authenticated: Bool
}

private struct AuthProvidersResponse: Decodable {
  let providers: [String]
}

private struct AuthCurrentUserResponse: Decodable {
  let user: OfficialUser?
}

private struct OfficialRemoteDevicesResponse: Decodable {
  let devices: [OfficialRemoteDevice]
}

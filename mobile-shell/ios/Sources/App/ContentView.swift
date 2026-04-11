import SwiftUI
import UIKit

private enum RemoteBrand {
  static let pageGradientTop = Color(red: 0.769, green: 0.871, blue: 0.996)
  static let pageGradientMid = Color(red: 0.902, green: 0.949, blue: 0.996)
  static let pageGradientBottom = Color(red: 0.957, green: 0.969, blue: 0.988)
  static let shellChrome = Color(red: 0.890, green: 0.937, blue: 0.992)
  static let shellChromeTop = Color(red: 0.741, green: 0.851, blue: 0.992)
  static let shellChromeBottom = Color(red: 0.882, green: 0.937, blue: 0.992)

  static let orbStrong = Color.black.opacity(0.06)
  static let orbSoft = Color(red: 0.545, green: 0.584, blue: 0.655).opacity(0.16)

  static let cardBackground = Color.white.opacity(0.92)
  static let cardBackgroundSoft = Color.white.opacity(0.84)
  static let mutedSurface = Color(red: 0.973, green: 0.980, blue: 0.988)
  static let subtleSurface = Color(red: 0.961, green: 0.969, blue: 0.980)
  static let cardBorder = Color(red: 0.898, green: 0.906, blue: 0.922)

  static let textPrimary = Color(red: 0.067, green: 0.067, blue: 0.067)
  static let textSecondary = Color(red: 0.373, green: 0.408, blue: 0.467)
  static let textTertiary = Color(red: 0.545, green: 0.584, blue: 0.655)

  static let accent = Color(red: 0.067, green: 0.067, blue: 0.067)
  static let accentMuted = Color(red: 0.122, green: 0.161, blue: 0.216)
  static let accentSoft = Color(red: 0.373, green: 0.408, blue: 0.467)
  static let accentFaint = Color(red: 0.663, green: 0.702, blue: 0.765)
}

private struct BrandLockupView: View {
  var body: some View {
    if let brandImage = UIImage(named: "BrandLogo") {
      Image(uiImage: brandImage)
        .renderingMode(.original)
        .resizable()
        .scaledToFit()
        .frame(width: 160, height: 44)
        .accessibilityLabel(Text("ContextGo"))
    } else {
      Text("ContextGo")
        .font(.system(size: 28, weight: .black, design: .rounded))
        .foregroundStyle(RemoteBrand.textPrimary)
        .accessibilityLabel(Text("ContextGo"))
    }
  }
}

struct ContentView: View {
  @EnvironmentObject private var connectionStore: ConnectionStore
  @EnvironmentObject private var oauthSessionController: OAuthSessionController
  @StateObject private var webViewStore = WebViewStore()

  var body: some View {
    Group {
      switch connectionStore.landingRoute {
      case .home:
        HomeView()
          .environmentObject(connectionStore)
          .environmentObject(oauthSessionController)
      case .remote:
        if let targetURL = connectionStore.targetURL {
          ShellBrowserView(targetURL: targetURL)
            .environmentObject(connectionStore)
            .environmentObject(webViewStore)
        } else {
          ProgressView()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
      }
    }
    .task {
      webViewStore.setAuthenticationHandler { loginURL in
        connectionStore.beginAuthenticationHandoff()
        oauthSessionController.start(url: loginURL)
      }
      webViewStore.setRecoveryHandler { errorCode in
        connectionStore.recoverFromLoginError(errorCode)
      }
      oauthSessionController.setCompletionHandler { callbackURL in
        if callbackURL == nil {
          connectionStore.cancelAuthenticationHandoff()
        }
      }
    }
    .task(id: connectionStore.loginCompletionRevision) {
      guard let pendingPayload = connectionStore.takePendingLoginPayload() else {
        return
      }

      if let loginErrorCode = await webViewStore.completeLoginIfNeeded(payload: pendingPayload) {
        connectionStore.recoverFromLoginError(loginErrorCode)
        return
      }

      connectionStore.completeIncomingPayload(pendingPayload)
    }
  }
}

private struct HomeView: View {
  @Environment(\.scenePhase) private var scenePhase
  @EnvironmentObject private var connectionStore: ConnectionStore
  @EnvironmentObject private var oauthSessionController: OAuthSessionController

  @State private var isCheckingSession = false
  @State private var isRefreshingSnapshot = true
  @State private var isPresentingProviderSheet = false
  @State private var availableProviders: [AuthProvider] = AuthProvider.allCases
  @State private var homeSnapshot = OfficialHomeSnapshot.unauthenticated

  var body: some View {
    ZStack {
      backgroundView

      ScrollView(showsIndicators: false) {
        VStack(alignment: .leading, spacing: 18) {
          heroView

          if let loginErrorBanner {
            loginRecoveryBanner(title: loginErrorBanner.title, detail: loginErrorBanner.detail)
          }

          if homeSnapshot.isAuthenticated {
            statusBoard

            if let user = homeSnapshot.user {
              accountPanel(user: user)
            }

            recentDevicesPanel
          } else {
            highlightsView
            previewPanel
            ctaPanel
          }

          Text(String(localized: "home.footnote"))
            .font(.system(size: 12, weight: .medium, design: .rounded))
            .foregroundStyle(RemoteBrand.textTertiary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 4)
        }
        .padding(.horizontal, 18)
        .padding(.top, 18)
        .padding(.bottom, 24)
      }
      .refreshable {
        await refreshHomeSnapshot(showSpinner: false)
      }
    }
    .task {
      availableProviders = await connectionStore.fetchOfficialProviders()
      await refreshHomeSnapshot(showSpinner: true)
    }
    .onChange(of: scenePhase) { newPhase in
      guard newPhase == .active else {
        return
      }

      Task {
        await refreshHomeSnapshot(showSpinner: false)
      }
    }
    .onChange(of: connectionStore.homeRefreshRevision) { _ in
      Task {
        await refreshHomeSnapshot(showSpinner: true)
      }
    }
    .sheet(isPresented: $isPresentingProviderSheet) {
      LoginProviderSheet(providers: availableProviders) { provider in
        guard let loginURL = connectionStore.buildOfficialAuthenticationURL(for: provider) else {
          return
        }

        connectionStore.dismissLoginError()
        connectionStore.beginAuthenticationHandoff()
        isPresentingProviderSheet = false
        oauthSessionController.start(url: loginURL)
      }
      .presentationDetents([.height(396)])
      .presentationDragIndicator(.visible)
    }
  }

  private var backgroundView: some View {
    ZStack(alignment: .top) {
      LinearGradient(
        colors: [RemoteBrand.pageGradientTop, RemoteBrand.pageGradientMid, RemoteBrand.pageGradientBottom],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .ignoresSafeArea()

      Rectangle()
        .fill(
          LinearGradient(
            colors: [RemoteBrand.shellChromeTop, RemoteBrand.pageGradientMid],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          )
        )
        .frame(height: 164)
        .ignoresSafeArea(edges: .top)

      Circle()
        .fill(RemoteBrand.orbStrong)
        .frame(width: 260, height: 260)
        .blur(radius: 22)
        .offset(x: 134, y: -260)

      Circle()
        .fill(RemoteBrand.orbSoft)
        .frame(width: 300, height: 300)
        .blur(radius: 32)
        .offset(x: -160, y: 300)

      RoundedRectangle(cornerRadius: 80, style: .continuous)
        .fill(Color.white.opacity(0.32))
        .frame(width: 280, height: 220)
        .rotationEffect(.degrees(18))
        .offset(x: 140, y: 120)
        .blur(radius: 10)
    }
  }

  private var heroView: some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack(alignment: .top, spacing: 14) {
        brandLockup

        Spacer(minLength: 0)

        VStack(alignment: .trailing, spacing: 8) {
          Text(heroBadgeText)
            .font(.system(size: 12, weight: .bold, design: .rounded))
            .tracking(1.2)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(RemoteBrand.subtleSurface)
            .foregroundStyle(RemoteBrand.accent)
            .clipShape(Capsule())

          if isRefreshingSnapshot {
            ProgressView()
              .controlSize(.small)
              .tint(RemoteBrand.accent)
          }
        }
      }

      Text(heroHeadline)
        .font(.system(size: 40, weight: .black, design: .rounded))
        .foregroundStyle(RemoteBrand.textPrimary)
        .fixedSize(horizontal: false, vertical: true)

      Text(heroSubtitle)
        .font(.system(size: 16, weight: .medium, design: .rounded))
        .foregroundStyle(RemoteBrand.textSecondary)
        .lineSpacing(4)
        .fixedSize(horizontal: false, vertical: true)

      featureSection
    }
    .padding(24)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(
      LinearGradient(
        colors: [Color.white.opacity(0.98), RemoteBrand.subtleSurface],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    )
    .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 32, style: .continuous)
        .stroke(RemoteBrand.cardBorder.opacity(0.9), lineWidth: 1)
    )
    .shadow(color: Color.black.opacity(0.08), radius: 30, x: 0, y: 18)
  }

  private var featureSection: some View {
    VStack(alignment: .leading, spacing: 10) {
      ViewThatFits {
        HStack(spacing: 10) {
          featurePill(icon: "desktopcomputer", text: String(localized: "home.feature.devices"))
          featurePill(icon: "arrow.up.doc", text: String(localized: "home.feature.files"))
        }

        VStack(alignment: .leading, spacing: 10) {
          featurePill(icon: "desktopcomputer", text: String(localized: "home.feature.devices"))
          featurePill(icon: "arrow.up.doc", text: String(localized: "home.feature.files"))
        }
      }

      ViewThatFits {
        HStack(spacing: 10) {
          featurePill(icon: "bolt.horizontal.circle", text: String(localized: "home.feature.sessions"))
          featurePill(icon: "lock.shield", text: String(localized: "home.feature.auth"))
        }

        VStack(alignment: .leading, spacing: 10) {
          featurePill(icon: "bolt.horizontal.circle", text: String(localized: "home.feature.sessions"))
          featurePill(icon: "lock.shield", text: String(localized: "home.feature.auth"))
        }
      }
    }
  }

  private var statusBoard: some View {
    ViewThatFits {
      HStack(spacing: 12) {
        summaryMetricCard(
          value: homeSnapshot.deviceCount.formatted(),
          title: String(localized: "home.metric.devices"),
          tint: RemoteBrand.accent,
          symbol: "display.2"
        )
        summaryMetricCard(
          value: homeSnapshot.readyDeviceCount.formatted(),
          title: String(localized: "home.metric.ready"),
          tint: RemoteBrand.accentMuted,
          symbol: "dot.radiowaves.left.and.right"
        )
        summaryMetricCard(
          value: homeSnapshot.liveSessionCount.formatted(),
          title: String(localized: "home.metric.live"),
          tint: RemoteBrand.accentSoft,
          symbol: "waveform.path.ecg.rectangle"
        )
      }

      VStack(spacing: 12) {
        summaryMetricCard(
          value: homeSnapshot.deviceCount.formatted(),
          title: String(localized: "home.metric.devices"),
          tint: RemoteBrand.accent,
          symbol: "display.2"
        )
        summaryMetricCard(
          value: homeSnapshot.readyDeviceCount.formatted(),
          title: String(localized: "home.metric.ready"),
          tint: RemoteBrand.accentMuted,
          symbol: "dot.radiowaves.left.and.right"
        )
        summaryMetricCard(
          value: homeSnapshot.liveSessionCount.formatted(),
          title: String(localized: "home.metric.live"),
          tint: RemoteBrand.accentSoft,
          symbol: "waveform.path.ecg.rectangle"
        )
      }
    }
  }

  private func accountPanel(user: OfficialUser) -> some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack(alignment: .center, spacing: 14) {
        avatarView(for: user)

        VStack(alignment: .leading, spacing: 4) {
          Text(String(localized: "home.account.title"))
            .font(.system(size: 14, weight: .bold, design: .rounded))
            .foregroundStyle(RemoteBrand.textSecondary)

          Text(user.preferredName)
            .font(.system(size: 24, weight: .black, design: .rounded))
            .foregroundStyle(RemoteBrand.textPrimary)
            .lineLimit(2)

          if let secondaryLine = user.secondaryLine {
            Text(secondaryLine)
              .font(.system(size: 14, weight: .medium, design: .rounded))
              .foregroundStyle(RemoteBrand.textSecondary)
              .lineLimit(2)
          }
        }

        Spacer(minLength: 0)
      }

      Text(String(localized: "home.account.detail"))
        .font(.system(size: 14, weight: .medium, design: .rounded))
        .foregroundStyle(RemoteBrand.textSecondary)
        .fixedSize(horizontal: false, vertical: true)
    }
    .padding(22)
    .background(RemoteBrand.cardBackground)
    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 28, style: .continuous)
        .stroke(RemoteBrand.cardBorder, lineWidth: 1)
    )
  }

  private var recentDevicesPanel: some View {
    VStack(alignment: .leading, spacing: 18) {
      Text(String(localized: "home.recent.title"))
        .font(.system(size: 18, weight: .bold, design: .rounded))
        .foregroundStyle(RemoteBrand.textPrimary)

      Text(String(localized: "home.recent.subtitle"))
        .font(.system(size: 14, weight: .medium, design: .rounded))
        .foregroundStyle(RemoteBrand.textSecondary)
        .fixedSize(horizontal: false, vertical: true)

      if homeSnapshot.devices.isEmpty {
        emptyDevicesView
      } else {
        VStack(spacing: 12) {
          ForEach(homeSnapshot.devices) { device in
            deviceRow(device)
          }
        }
      }
    }
    .padding(22)
    .background(RemoteBrand.cardBackground)
    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 28, style: .continuous)
        .stroke(RemoteBrand.cardBorder, lineWidth: 1)
    )
  }

  private var emptyDevicesView: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(String(localized: "home.recent.empty.title"))
        .font(.system(size: 16, weight: .bold, design: .rounded))
        .foregroundStyle(RemoteBrand.textPrimary)

      Text(String(localized: "home.recent.empty.detail"))
        .font(.system(size: 14, weight: .medium, design: .rounded))
        .foregroundStyle(RemoteBrand.textSecondary)
        .fixedSize(horizontal: false, vertical: true)
    }
    .padding(18)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RemoteBrand.mutedSurface)
    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
  }

  private var highlightsView: some View {
    VStack(spacing: 14) {
      homeMetricCard(
        title: String(localized: "home.card.devices.title"),
        detail: String(localized: "home.card.devices.detail"),
        symbol: "display.2"
      )
      homeMetricCard(
        title: String(localized: "home.card.uploads.title"),
        detail: String(localized: "home.card.uploads.detail"),
        symbol: "square.and.arrow.up.badge.clock"
      )
      homeMetricCard(
        title: String(localized: "home.card.sessions.title"),
        detail: String(localized: "home.card.sessions.detail"),
        symbol: "link.circle"
      )
    }
  }

  private var previewPanel: some View {
    VStack(alignment: .leading, spacing: 18) {
      Text(String(localized: "home.preview.title"))
        .font(.system(size: 16, weight: .bold, design: .rounded))
        .foregroundStyle(RemoteBrand.textPrimary)

      VStack(spacing: 14) {
        previewRow(
          title: String(localized: "home.preview.devices.title"),
          detail: String(localized: "home.preview.devices.detail"),
          accent: RemoteBrand.accent
        )
        previewRow(
          title: String(localized: "home.preview.open.title"),
          detail: String(localized: "home.preview.open.detail"),
          accent: RemoteBrand.accentSoft
        )
      }
    }
    .padding(22)
    .background(RemoteBrand.cardBackgroundSoft)
    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 28, style: .continuous)
        .stroke(RemoteBrand.cardBorder, lineWidth: 1)
    )
  }

  private var ctaPanel: some View {
    VStack(alignment: .leading, spacing: 14) {
      Button(action: {
        Task {
          await openOfficialRemote()
        }
      }) {
        HStack {
          if isCheckingSession {
            ProgressView()
              .tint(.white)
          } else {
            Image(systemName: "arrow.up.right.square")
          }

          Text(String(localized: "home.openRemote"))
          Spacer(minLength: 0)
          Image(systemName: "arrow.right")
        }
        .font(.system(size: 17, weight: .bold, design: .rounded))
        .padding(.horizontal, 20)
        .padding(.vertical, 18)
        .frame(maxWidth: .infinity)
        .background(
          LinearGradient(
            colors: [RemoteBrand.accent, RemoteBrand.accentMuted],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
          )
        )
        .foregroundStyle(.white)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
      }
      .buttonStyle(.plain)
      .disabled(isCheckingSession)

      Text(openRemoteHintText)
        .font(.system(size: 13, weight: .medium, design: .rounded))
        .foregroundStyle(RemoteBrand.textSecondary)
        .fixedSize(horizontal: false, vertical: true)
    }
    .padding(22)
    .background(RemoteBrand.cardBackground)
    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 28, style: .continuous)
        .stroke(RemoteBrand.cardBorder, lineWidth: 1)
    )
  }

  private var heroBadgeText: String {
    homeSnapshot.isAuthenticated
      ? String(localized: "home.badge.authenticated")
      : String(localized: "home.badge")
  }

  private var heroHeadline: String {
    homeSnapshot.isAuthenticated
      ? String(localized: "home.headline.ready")
      : String(localized: "home.headline")
  }

  private var heroSubtitle: String {
    homeSnapshot.isAuthenticated
      ? String(localized: "home.subtitle.ready")
      : String(localized: "home.subtitle")
  }

  private var openRemoteHintText: String {
    homeSnapshot.isAuthenticated
      ? String(localized: "home.openRemoteHint.loggedIn")
      : String(localized: "home.openRemoteHint")
  }

  private var loginErrorBanner: (title: String, detail: String)? {
    guard let errorCode = connectionStore.loginErrorCode else {
      return nil
    }

    switch errorCode {
    case "missing_session", "login_required":
      return (
        String(localized: "home.loginError.session.title"),
        String(localized: "home.loginError.session.detail")
      )
    case "consume_failed":
      return (
        String(localized: "home.loginError.consume.title"),
        String(localized: "home.loginError.consume.detail")
      )
    default:
      return (
        String(localized: "home.loginError.generic.title"),
        String(localized: "home.loginError.generic.detail")
      )
    }
  }

  private func refreshHomeSnapshot(showSpinner: Bool) async {
    if showSpinner {
      isRefreshingSnapshot = true
    }

    let snapshot = await connectionStore.fetchOfficialHomeSnapshot()
    homeSnapshot = snapshot
    isRefreshingSnapshot = false
  }

  private func openOfficialRemote() async {
    connectionStore.dismissLoginError()
    isCheckingSession = true
    let hasSession = await connectionStore.hasOfficialSession()
    isCheckingSession = false

    if hasSession {
      await refreshHomeSnapshot(showSpinner: true)
      return
    }

    isPresentingProviderSheet = true
  }

  @ViewBuilder
  private var brandLockup: some View {
    BrandLockupView()
  }

  private func loginRecoveryBanner(title: String, detail: String) -> some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .top, spacing: 12) {
        Image(systemName: "exclamationmark.shield")
          .font(.system(size: 18, weight: .bold))
          .foregroundStyle(RemoteBrand.accentMuted)
          .frame(width: 42, height: 42)
          .background(RemoteBrand.subtleSurface)
          .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

        VStack(alignment: .leading, spacing: 4) {
          Text(title)
            .font(.system(size: 16, weight: .bold, design: .rounded))
            .foregroundStyle(RemoteBrand.textPrimary)

          Text(detail)
            .font(.system(size: 14, weight: .medium, design: .rounded))
            .foregroundStyle(RemoteBrand.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
        }
      }

      Button(action: {
        connectionStore.dismissLoginError()
        isPresentingProviderSheet = true
      }) {
        HStack(spacing: 10) {
          Image(systemName: "person.crop.circle.badge.checkmark")
          Text(String(localized: "home.loginError.retry"))
          Spacer(minLength: 0)
          Image(systemName: "arrow.right")
        }
        .font(.system(size: 15, weight: .bold, design: .rounded))
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity)
        .background(RemoteBrand.accentMuted)
        .foregroundStyle(.white)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
      }
      .buttonStyle(.plain)
    }
    .padding(20)
    .background(RemoteBrand.cardBackground)
    .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 26, style: .continuous)
        .stroke(RemoteBrand.cardBorder, lineWidth: 1)
    )
  }

  private func featurePill(icon: String, text: String) -> some View {
    HStack(spacing: 8) {
      Image(systemName: icon)
      Text(text)
        .lineLimit(2)
        .multilineTextAlignment(.leading)
    }
    .font(.system(size: 13, weight: .semibold, design: .rounded))
    .padding(.horizontal, 12)
    .padding(.vertical, 10)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RemoteBrand.subtleSurface)
    .foregroundStyle(RemoteBrand.accentMuted)
    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
  }

  private func summaryMetricCard(value: String, title: String, tint: Color, symbol: String) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      Image(systemName: symbol)
        .font(.system(size: 18, weight: .semibold))
        .foregroundStyle(tint)
        .frame(width: 38, height: 38)
        .background(tint.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

      Text(value)
        .font(.system(size: 28, weight: .black, design: .rounded))
        .foregroundStyle(RemoteBrand.textPrimary)
        .lineLimit(1)
        .minimumScaleFactor(0.7)

      Text(title)
        .font(.system(size: 12, weight: .bold, design: .rounded))
        .foregroundStyle(RemoteBrand.textSecondary)
        .fixedSize(horizontal: false, vertical: true)
    }
    .padding(18)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RemoteBrand.cardBackground)
    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 24, style: .continuous)
        .stroke(RemoteBrand.cardBorder, lineWidth: 1)
    )
  }

  private func homeMetricCard(title: String, detail: String, symbol: String) -> some View {
    HStack(alignment: .top, spacing: 14) {
      Image(systemName: symbol)
        .font(.system(size: 20, weight: .semibold))
        .foregroundStyle(RemoteBrand.accent)
        .frame(width: 42, height: 42)
        .background(RemoteBrand.subtleSurface)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

      VStack(alignment: .leading, spacing: 6) {
        Text(title)
          .font(.system(size: 17, weight: .bold, design: .rounded))
          .foregroundStyle(RemoteBrand.textPrimary)

        Text(detail)
          .font(.system(size: 14, weight: .medium, design: .rounded))
          .foregroundStyle(RemoteBrand.textSecondary)
          .fixedSize(horizontal: false, vertical: true)
      }

      Spacer(minLength: 0)
    }
    .padding(20)
    .background(RemoteBrand.cardBackgroundSoft)
    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 24, style: .continuous)
        .stroke(RemoteBrand.cardBorder, lineWidth: 1)
    )
  }

  private func previewRow(title: String, detail: String, accent: Color) -> some View {
    HStack(spacing: 14) {
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .fill(accent.opacity(0.10))
        .frame(width: 54, height: 54)
        .overlay(
          Image(systemName: "sparkles.rectangle.stack")
            .font(.system(size: 22, weight: .semibold))
            .foregroundStyle(accent)
        )

      VStack(alignment: .leading, spacing: 4) {
        Text(title)
          .font(.system(size: 15, weight: .bold, design: .rounded))
          .foregroundStyle(RemoteBrand.textPrimary)

        Text(detail)
          .font(.system(size: 13, weight: .medium, design: .rounded))
          .foregroundStyle(RemoteBrand.textSecondary)
          .fixedSize(horizontal: false, vertical: true)
      }

      Spacer(minLength: 0)
    }
    .padding(16)
    .background(RemoteBrand.mutedSurface)
    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
  }

  private func avatarView(for user: OfficialUser) -> some View {
    Group {
      if let avatarURL = user.avatarURL {
        AsyncImage(url: avatarURL) { phase in
          switch phase {
          case .success(let image):
            image
              .resizable()
              .scaledToFill()
          default:
            initialsAvatar(text: user.initials)
          }
        }
      } else {
        initialsAvatar(text: user.initials)
      }
    }
    .frame(width: 68, height: 68)
    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
  }

  private func initialsAvatar(text: String) -> some View {
    ZStack {
      LinearGradient(
        colors: [RemoteBrand.accentMuted, RemoteBrand.accentSoft],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )

      Text(text)
        .font(.system(size: 22, weight: .black, design: .rounded))
        .foregroundStyle(.white)
    }
  }

  private func deviceRow(_ device: OfficialRemoteDevice) -> some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .top, spacing: 12) {
        RoundedRectangle(cornerRadius: 18, style: .continuous)
          .fill(deviceStatusColor(for: device).opacity(0.10))
          .frame(width: 54, height: 54)
          .overlay(
            Image(systemName: deviceSymbol(for: device))
              .font(.system(size: 22, weight: .semibold))
              .foregroundStyle(deviceStatusColor(for: device))
          )

        VStack(alignment: .leading, spacing: 6) {
          Text(device.deviceName)
            .font(.system(size: 16, weight: .bold, design: .rounded))
            .foregroundStyle(RemoteBrand.textPrimary)
            .fixedSize(horizontal: false, vertical: true)

          Text(device.platformLabel)
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundStyle(RemoteBrand.textSecondary)

          Text(deviceStatusTitle(for: device))
            .font(.system(size: 13, weight: .bold, design: .rounded))
            .foregroundStyle(deviceStatusColor(for: device))
        }

        Spacer(minLength: 0)
      }

      Text(deviceStatusDetail(for: device))
        .font(.system(size: 13, weight: .medium, design: .rounded))
        .foregroundStyle(RemoteBrand.textSecondary)
        .fixedSize(horizontal: false, vertical: true)

      Button(action: {
        connectionStore.connectToOfficialDevice(deviceID: device.id)
      }) {
        HStack(spacing: 10) {
          Text(device.canOpen
            ? String(localized: "home.device.action.open")
            : String(localized: "home.device.action.unavailable"))
          Spacer(minLength: 0)
          Image(systemName: device.canOpen ? "arrow.up.right.square" : "clock.arrow.circlepath")
        }
        .font(.system(size: 14, weight: .bold, design: .rounded))
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity)
        .background(device.canOpen ? deviceStatusColor(for: device) : RemoteBrand.accentFaint)
        .foregroundStyle(.white)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
      }
      .buttonStyle(.plain)
      .disabled(!device.canOpen)
      .opacity(device.canOpen ? 1 : 0.82)
    }
    .padding(18)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RemoteBrand.mutedSurface)
    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 24, style: .continuous)
        .stroke(RemoteBrand.cardBorder, lineWidth: 1)
    )
  }

  private func deviceSymbol(for device: OfficialRemoteDevice) -> String {
    if device.isAvailable {
      return "desktopcomputer.and.arrow.down"
    }

    if device.isLiveSession {
      return "waveform.path.ecg.rectangle"
    }

    if device.remoteStatus.connected {
      return "desktopcomputer.trianglebadge.exclamationmark"
    }

    return "desktopcomputer"
  }

  private func deviceStatusColor(for device: OfficialRemoteDevice) -> Color {
    if device.isAvailable {
      return RemoteBrand.accent
    }

    if device.isLiveSession {
      return RemoteBrand.accentMuted
    }

    if device.remoteStatus.connected {
      return RemoteBrand.accentSoft
    }

    return RemoteBrand.accentFaint
  }

  private func deviceStatusTitle(for device: OfficialRemoteDevice) -> String {
    if device.isAvailable {
      return String(localized: "home.device.status.available")
    }

    if device.isLiveSession {
      return String(localized: "home.device.status.live")
    }

    if device.remoteStatus.connected {
      return String(localized: "home.device.status.preparing")
    }

    return String(localized: "home.device.status.offline")
  }

  private func deviceStatusDetail(for device: OfficialRemoteDevice) -> String {
    if device.isAvailable {
      return String(localized: "home.device.status.available.detail")
    }

    if device.isLiveSession {
      return String(localized: "home.device.status.live.detail")
    }

    if device.remoteStatus.connected {
      return String(localized: "home.device.status.preparing.detail")
    }

    return String(localized: "home.device.status.offline.detail")
  }
}

private struct LoginProviderSheet: View {
  let providers: [AuthProvider]
  let onSelect: (AuthProvider) -> Void

  var body: some View {
    NavigationStack {
      ZStack {
        RemoteBrand.mutedSurface
          .ignoresSafeArea()

        ScrollView(showsIndicators: false) {
          VStack(alignment: .leading, spacing: 18) {
            Text(String(localized: "loginSheet.title"))
              .font(.system(size: 28, weight: .bold, design: .rounded))
              .foregroundStyle(RemoteBrand.textPrimary)

            Text(String(localized: "loginSheet.subtitle"))
              .font(.system(size: 15, weight: .medium, design: .rounded))
              .foregroundStyle(RemoteBrand.textSecondary)
              .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 12) {
              ForEach(providers) { provider in
                Button(action: {
                  onSelect(provider)
                }) {
                  HStack(alignment: .center, spacing: 12) {
                    providerIcon(for: provider)

                    VStack(alignment: .leading, spacing: 4) {
                      Text(provider.title)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)

                      Text(provider.subtitle)
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundStyle(RemoteBrand.textTertiary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .layoutPriority(1)

                    Spacer(minLength: 0)

                    Image(systemName: "arrow.right")
                      .font(.system(size: 14, weight: .bold))
                      .foregroundStyle(RemoteBrand.textTertiary)
                  }
                  .padding(16)
                  .frame(maxWidth: .infinity)
                  .background(Color.white)
                  .foregroundStyle(RemoteBrand.textPrimary)
                  .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                  .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                      .stroke(RemoteBrand.cardBorder, lineWidth: 1)
                  )
                }
                .buttonStyle(.plain)
              }
            }

            Text(String(localized: "loginSheet.caption"))
              .font(.system(size: 12, weight: .medium, design: .rounded))
              .foregroundStyle(RemoteBrand.textTertiary)
              .fixedSize(horizontal: false, vertical: true)
          }
          .padding(20)
        }
      }
    }
  }
}

private extension LoginProviderSheet {
  func providerIcon(for provider: AuthProvider) -> some View {
    ZStack {
      RoundedRectangle(cornerRadius: 14, style: .continuous)
        .fill(provider.tint.opacity(0.10))

      Image(provider.iconAssetName)
        .renderingMode(.original)
        .resizable()
        .scaledToFit()
        .frame(width: 20, height: 20)
    }
    .frame(width: 40, height: 40)
  }
}

private extension AuthProvider {
  var title: String {
    switch self {
    case .github:
      return String(localized: "loginSheet.provider.github.title")
    case .google:
      return String(localized: "loginSheet.provider.google.title")
    }
  }

  var subtitle: String {
    switch self {
    case .github:
      return String(localized: "loginSheet.provider.github.subtitle")
    case .google:
      return String(localized: "loginSheet.provider.google.subtitle")
    }
  }

  var iconAssetName: String {
    switch self {
    case .github:
      return "ProviderGitHub"
    case .google:
      return "ProviderGoogle"
    }
  }

  var tint: Color {
    switch self {
    case .github:
      return RemoteBrand.accentMuted
    case .google:
      return RemoteBrand.accent
    }
  }
}

private struct ShellBrowserView: View {
  @EnvironmentObject private var connectionStore: ConnectionStore
  @EnvironmentObject private var webViewStore: WebViewStore

  let targetURL: URL

  var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .top) {
        browserChromeColor.ignoresSafeArea()

        ShellWebView(store: webViewStore, url: targetURL)
          .ignoresSafeArea(.container, edges: .bottom)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)

        HStack(spacing: 0) {
          edgeBackGestureStrip
          Spacer(minLength: 0)
        }
        .ignoresSafeArea(.container, edges: .bottom)

        if webViewStore.shouldShowLaunchOverlay {
          shellLaunchOverlay(topInset: geometry.safeAreaInsets.top)
        }
      }
    }
    .background(browserChromeColor)
  }

  private var browserChromeColor: Color {
    Color(uiColor: webViewStore.chromeColor)
  }

  private var launchOverlayMessage: String {
    let normalizedPath = targetURL.path.lowercased()
    if normalizedPath == "/remote/devices" {
      return String(localized: "browser.loading.devices")
    }

    return String(localized: "browser.loading.desktop")
  }

  private var edgeBackGestureStrip: some View {
    Color.clear
      .frame(width: 28)
      .contentShape(Rectangle())
      .gesture(
        DragGesture(minimumDistance: 18, coordinateSpace: .local)
          .onEnded { value in
            guard value.startLocation.x <= 28,
                  value.translation.width >= 88,
                  abs(value.translation.height) <= 48
            else {
              return
            }

            connectionStore.returnToHome()
          }
      )
      .allowsHitTesting(true)
  }

  private func shellLaunchOverlay(topInset: CGFloat) -> some View {
    ZStack(alignment: .top) {
      browserChromeColor.ignoresSafeArea()

      VStack(spacing: 20) {
        Spacer(minLength: max(topInset, 0) + 48)

        BrandLockupView()

        VStack(spacing: 10) {
          ProgressView()
            .controlSize(.regular)
            .tint(RemoteBrand.accent)

          Text(launchOverlayMessage)
            .font(.system(size: 14, weight: .medium, design: .rounded))
            .foregroundStyle(RemoteBrand.textSecondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 32)
        }

        Spacer()
      }
    }
    .transition(.opacity)
    .allowsHitTesting(false)
  }
}

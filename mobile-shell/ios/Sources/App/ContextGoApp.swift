import SwiftUI

@main
struct ContextGoApp: App {
  @StateObject private var connectionStore = ConnectionStore()
  @StateObject private var oauthSessionController = OAuthSessionController()

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(connectionStore)
        .environmentObject(oauthSessionController)
        .onOpenURL { url in
          connectionStore.handleIncomingURL(url)
        }
    }
  }
}

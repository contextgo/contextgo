import SwiftUI

@main
struct AionUiShellApp: App {
  @StateObject private var connectionStore = ConnectionStore()

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(connectionStore)
    }
  }
}

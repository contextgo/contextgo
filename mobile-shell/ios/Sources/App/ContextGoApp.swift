import SwiftUI

@main
struct ContextGoApp: App {
  @StateObject private var connectionStore = ConnectionStore()

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(connectionStore)
    }
  }
}

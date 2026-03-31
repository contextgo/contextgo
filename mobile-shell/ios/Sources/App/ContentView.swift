import SwiftUI

struct ContentView: View {
  @EnvironmentObject private var connectionStore: ConnectionStore
  @StateObject private var webViewStore = WebViewStore()

  var body: some View {
    NavigationStack {
      Group {
        if let targetURL = connectionStore.targetURL {
          ShellBrowserView(targetURL: targetURL)
            .environmentObject(connectionStore)
            .environmentObject(webViewStore)
        } else {
          ConnectionView(isModal: false)
            .environmentObject(connectionStore)
        }
      }
      .navigationTitle("app.title")
      .navigationBarTitleDisplayMode(.inline)
      .onAppear {
        webViewStore.onOpenURL = { incomingURL in
          connectionStore.handleIncomingURL(incomingURL)
        }
      }
    }
  }
}

private struct ConnectionView: View {
  @Environment(\.dismiss) private var dismiss
  @EnvironmentObject private var connectionStore: ConnectionStore

  let isModal: Bool

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 20) {
        Text("connection.title")
          .font(.title2)
          .fontWeight(.semibold)

        Text("connection.description")
          .foregroundStyle(.secondary)

        Button(action: {
          connectionStore.connectToOfficialRemote()
          dismissIfNeeded()
        }) {
          VStack(alignment: .leading, spacing: 4) {
            Text("connection.officialRemote.action")
              .fontWeight(.semibold)
            Text("connection.officialRemote.detail")
              .font(.footnote)
              .foregroundStyle(.secondary)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.borderedProminent)

        Divider()

        Text("connection.custom.title")
          .font(.headline)

        Text("connection.custom.description")
          .foregroundStyle(.secondary)

        TextField(String(localized: "connection.custom.placeholder"), text: $connectionStore.inputText)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
          .keyboardType(.URL)
          .textFieldStyle(.roundedBorder)

        Button(action: {
          if connectionStore.connect() {
            dismissIfNeeded()
          }
        }) {
          Text("connection.custom.action")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)

        if let validationMessage = connectionStore.validationMessage {
          Text(validationMessage)
            .font(.footnote)
            .foregroundStyle(.red)
        }

        VStack(alignment: .leading, spacing: 8) {
          Text("connection.howItWorks.title")
            .font(.headline)

          Text("connection.howItWorks.step1")
          Text("connection.howItWorks.step2")
          Text("connection.howItWorks.step3")
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
      }
      .padding(24)
    }
    .background(Color(.systemGroupedBackground))
  }

  private func dismissIfNeeded() {
    guard isModal else { return }
    dismiss()
  }
}

private struct ShellBrowserView: View {
  @EnvironmentObject private var connectionStore: ConnectionStore
  @EnvironmentObject private var webViewStore: WebViewStore
  @State private var isShowingConnectionSettings = false

  let targetURL: URL

  var body: some View {
    VStack(spacing: 0) {
      HStack(spacing: 12) {
        Button("browser.back") {
          webViewStore.goBack()
        }
        .buttonStyle(.bordered)

        Button("browser.reload") {
          webViewStore.reload()
        }
        .buttonStyle(.bordered)

        Spacer(minLength: 12)

        Button("browser.changeHost") {
          connectionStore.prepareCustomHostInput()
          isShowingConnectionSettings = true
        }
        .buttonStyle(.borderedProminent)
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 12)
      .background(.thinMaterial)

      Divider()

      ShellWebView(store: webViewStore, url: targetURL)
        .ignoresSafeArea(edges: .bottom)
    }
    .sheet(isPresented: $isShowingConnectionSettings) {
      NavigationStack {
        ConnectionView(isModal: true)
          .environmentObject(connectionStore)
          .navigationTitle("browser.connection.title")
          .navigationBarTitleDisplayMode(.inline)
      }
    }
  }
}

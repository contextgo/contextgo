import Foundation

enum AuthProvider: String, CaseIterable, Identifiable {
  case github
  case google

  var id: String {
    rawValue
  }
}

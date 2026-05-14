import Foundation

struct LoginCompletionPayload {
  let targetURL: URL
  let loginCode: String?
  let errorCode: String?

  var shouldRecoverNatively: Bool {
    errorCode != nil && loginCode == nil
  }
}

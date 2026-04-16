package io.contextgo.mobileshell

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import androidx.documentfile.provider.DocumentFile
import io.contextgo.mobileshell.databinding.ActivityMainBinding
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import java.util.Locale

class MainActivity : AppCompatActivity() {
  private lateinit var binding: ActivityMainBinding
  private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
  private var pendingObsidianVaultSetupRequest: PendingObsidianVaultSetupRequest? = null
  private var startupOverlayActive = false
  private var startupNavigationFinished = false
  private var startupReadyReceived = false
  private var startupOverlayToken = 0

  private val preferences by lazy(LazyThreadSafetyMode.NONE) {
    getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE)
  }

  private val fileChooserLauncher =
    registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
      val callback = fileChooserCallback ?: return@registerForActivityResult
      val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
      callback.onReceiveValue(uris)
      fileChooserCallback = null
    }

  private val obsidianVaultSetupLauncher =
    registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
      handleObsidianVaultSetupResult(result.resultCode, result.data)
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    binding = ActivityMainBinding.inflate(layoutInflater)
    setContentView(binding.root)

    configureWebView()
    bindEvents()

    if (!openIntentTarget(intent)) {
      val storedTarget = preferences.getString(TARGET_URL_KEY, null)
      if (storedTarget.isNullOrBlank()) {
        openOfficialRemote(persist = false)
      } else {
        openTarget(storedTarget)
      }
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    openIntentTarget(intent)
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    if (binding.webContainer.isVisible && binding.webView.canGoBack()) {
      binding.webView.goBack()
      return
    }
    super.onBackPressed()
  }

  override fun onDestroy() {
    fileChooserCallback?.onReceiveValue(null)
    fileChooserCallback = null
    binding.webView.apply {
      stopLoading()
      webChromeClient = null
      destroy()
    }
    super.onDestroy()
  }

  private fun bindEvents() {
    binding.officialRemoteButton.setOnClickListener {
      openOfficialRemote()
    }

    binding.connectButton.setOnClickListener {
      connectUsingInput()
    }

    binding.backButton.setOnClickListener {
      if (binding.webView.canGoBack()) {
        binding.webView.goBack()
      }
    }

    binding.reloadButton.setOnClickListener {
      binding.webView.reload()
    }

    binding.reconnectButton.setOnClickListener {
      showConnectionSettings()
    }
  }

  @SuppressLint("SetJavaScriptEnabled")
  private fun configureWebView() {
    CookieManager.getInstance().setAcceptCookie(true)
    CookieManager.getInstance().setAcceptThirdPartyCookies(binding.webView, true)
    binding.webView.addJavascriptInterface(StartupBridge(), STARTUP_BRIDGE_NAME)

    binding.webView.settings.apply {
      javaScriptEnabled = true
      domStorageEnabled = true
      databaseEnabled = true
      allowFileAccess = true
      allowContentAccess = true
      useWideViewPort = true
      loadWithOverviewMode = true
      mediaPlaybackRequiresUserGesture = false
      builtInZoomControls = false
      displayZoomControls = false
      userAgentString = userAgentString + " ContextGoMobileShell/1.0"
    }

    binding.webView.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean {
        val target = request.url ?: return false
        val scheme = target.scheme?.lowercase(Locale.US).orEmpty()

        if (recoverIfNeeded(target)) {
          return true
        }

        if (shouldRouteThroughSystemBrowser(target)) {
          return runCatching {
            startActivity(Intent(Intent.ACTION_VIEW, target))
          }.isSuccess
        }

        if (scheme == "http" || scheme == "https") {
          return false
        }

        return runCatching {
          startActivity(Intent(Intent.ACTION_VIEW, target))
        }.isSuccess
      }

      override fun onPageCommitVisible(view: WebView?, url: String?) {
        super.onPageCommitVisible(view, url)
        if (startupOverlayActive) {
          updateStartupOverlayMessage(url)
        }
      }

      override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        if (!startupOverlayActive) {
          return
        }

        startupNavigationFinished = true
        injectStartupReadyObserver()
        dismissStartupOverlayIfReady()
        val overlayToken = startupOverlayToken
        binding.startupOverlay.postDelayed(
          {
            if (startupOverlayActive && startupOverlayToken == overlayToken) {
              hideStartupOverlay()
            }
          },
          STARTUP_OVERLAY_FALLBACK_DELAY_MS
        )
      }
    }

    binding.webView.webChromeClient = object : WebChromeClient() {
      override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?
      ): Boolean {
        this@MainActivity.fileChooserCallback?.onReceiveValue(null)
        this@MainActivity.fileChooserCallback = filePathCallback

        val intent = try {
          fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
          }
        } catch (_: ActivityNotFoundException) {
          null
        }

        if (intent == null) {
          this@MainActivity.fileChooserCallback?.onReceiveValue(null)
          this@MainActivity.fileChooserCallback = null
          showError(getString(R.string.no_file_picker))
          return false
        }

        return try {
          fileChooserLauncher.launch(intent)
          true
        } catch (_: ActivityNotFoundException) {
          this@MainActivity.fileChooserCallback?.onReceiveValue(null)
          this@MainActivity.fileChooserCallback = null
          showError(getString(R.string.no_file_picker))
          false
        }
      }
    }
  }

  private fun connectUsingInput() {
    val resolvedTarget = ShellTargetResolver.resolve(binding.urlInput.text?.toString().orEmpty())
    if (resolvedTarget == null) {
      showError(getString(R.string.invalid_url))
      return
    }

    openTarget(resolvedTarget)
  }

  private fun openOfficialRemote(persist: Boolean = true) {
    val resolvedTarget = ShellTargetResolver.resolve(OFFICIAL_REMOTE_URL) ?: return
    openTarget(resolvedTarget, persist)
  }

  private fun openIntentTarget(intent: Intent?): Boolean {
    val rawTarget = intent?.dataString ?: return false
    val payload = ShellTargetResolver.resolvePayload(rawTarget) ?: return false
    handleIntentPayload(payload)
    return true
  }

  private fun handleIntentPayload(payload: ShellLoginPayload) {
    if (payload.shouldRecoverNatively) {
      recoverFromLoginError(payload.errorCode)
      return
    }

    if (payload.loginCode != null) {
      completeLoginAndOpen(payload)
      return
    }

    openTarget(payload.targetUrl)
  }

  private fun openTarget(targetUrl: String, persist: Boolean = true) {
    if (persist) {
      preferences.edit().putString(TARGET_URL_KEY, targetUrl).apply()
    }
    binding.urlInput.setText(targetUrl)
    binding.errorText.isVisible = false
    binding.errorText.text = ""
    showStartupOverlay(targetUrl)
    showWebUi()
    binding.webView.loadUrl(targetUrl)
  }

  private fun showConnectionSettings() {
    binding.urlInput.setText(preferences.getString(TARGET_URL_KEY, null).orEmpty())
    binding.errorText.isVisible = false
    binding.errorText.text = ""
    showConnectUi()
  }

  private fun showConnectUi() {
    binding.connectContainer.isVisible = true
    binding.webContainer.isVisible = false
  }

  private fun showWebUi() {
    binding.connectContainer.isVisible = false
    binding.webContainer.isVisible = true
  }

  private fun showStartupOverlay(targetUrl: String) {
    startupOverlayToken += 1
    startupOverlayActive = true
    startupNavigationFinished = false
    startupReadyReceived = false
    binding.startupOverlayTitle.text = getString(R.string.app_name)
    binding.startupOverlayMessage.text = resolveStartupOverlayMessage(targetUrl)
    binding.startupOverlay.isVisible = true
  }

  private fun updateStartupOverlayMessage(url: String?) {
    binding.startupOverlayMessage.text = resolveStartupOverlayMessage(url)
  }

  private fun dismissStartupOverlayIfReady() {
    if (startupNavigationFinished && startupReadyReceived) {
      hideStartupOverlay()
    }
  }

  private fun hideStartupOverlay() {
    startupOverlayActive = false
    binding.startupOverlay.isVisible = false
  }

  private fun injectStartupReadyObserver() {
    binding.webView.evaluateJavascript(STARTUP_READY_OBSERVER_SCRIPT, null)
  }

  private fun resolveStartupOverlayMessage(targetUrl: String?): String {
    return if (targetUrl?.contains("/remote/devices") == true) {
      getString(R.string.browser_loading_devices)
    } else {
      getString(R.string.browser_loading_desktop)
    }
  }

  private fun shouldRouteThroughSystemBrowser(target: Uri): Boolean {
    val host = target.host?.lowercase(Locale.US) ?: return false
    if (host != OFFICIAL_REMOTE_HOST) {
      return false
    }

    return target.path?.lowercase(Locale.US)?.startsWith("/api/auth/oauth/") == true
  }

  private fun recoverIfNeeded(target: Uri): Boolean {
    val errorCode = loginRecoveryErrorCode(target) ?: return false
    recoverFromLoginError(errorCode)
    return true
  }

  private fun loginRecoveryErrorCode(target: Uri): String? {
    val host = target.host?.lowercase(Locale.US) ?: return null
    if (host != OFFICIAL_REMOTE_HOST) {
      return null
    }

    val path = target.path?.lowercase(Locale.US) ?: return null
    if (path != "/login") {
      return null
    }

    return target.getQueryParameter("oauthError")?.trim()?.takeIf { it.isNotEmpty() }
      ?: target.getQueryParameter("error")?.trim()?.takeIf { it.isNotEmpty() }
  }

  private fun recoverFromLoginError(errorCode: String?) {
    showConnectionSettings()
    showError(
      if (errorCode.isNullOrBlank()) {
        getString(R.string.login_callback_failed)
      } else {
        getString(R.string.login_failed, errorCode)
      }
    )
  }

  private fun completeLoginAndOpen(payload: ShellLoginPayload) {
    showStartupOverlay(payload.targetUrl)
    showWebUi()
    Thread {
      val succeeded = runCatching {
        consumeLoginCode(payload.loginCode ?: error("Missing login code"), payload.targetUrl)
      }.isSuccess

      runOnUiThread {
        if (!succeeded) {
          recoverFromLoginError("callback_failed")
          return@runOnUiThread
        }

        openTarget(payload.targetUrl)
      }
    }.start()
  }

  private fun consumeLoginCode(code: String, targetUrl: String) {
    val consumeEndpoint = buildConsumeEndpoint(targetUrl) ?: error("Invalid consume endpoint")
    val connection = (consumeEndpoint.openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      doOutput = true
      instanceFollowRedirects = false
      setRequestProperty("Accept", "application/json")
      setRequestProperty("Content-Type", "application/json")
      setRequestProperty("User-Agent", binding.webView.settings.userAgentString)
    }

    val requestBody = JSONObject()
      .put("code", code)
      .toString()
      .toByteArray(Charsets.UTF_8)
    connection.outputStream.use { output ->
      output.write(requestBody)
    }

    val responseCode = connection.responseCode
    if (responseCode !in 200..299) {
      connection.disconnect()
      error("Desktop login consume failed with status $responseCode")
    }

    val cookieManager = CookieManager.getInstance()
    val cookieOrigin = buildCookieOrigin(targetUrl) ?: error("Invalid cookie origin")
    connection.headerFields.forEach { (headerName, headerValues) ->
      if (!headerName.equals("Set-Cookie", ignoreCase = true)) {
        return@forEach
      }

      headerValues.orEmpty().forEach { cookieValue ->
        cookieManager.setCookie(cookieOrigin, cookieValue)
      }
    }
    cookieManager.flush()
    connection.inputStream.use { it.readBytes() }
    connection.disconnect()
  }

  private fun buildConsumeEndpoint(targetUrl: String): URL? {
    val target = Uri.parse(targetUrl)
    val scheme = target.scheme ?: return null
    val host = target.host ?: return null
    val portSegment = if (target.port != -1) ":${target.port}" else ""
    return URL("$scheme://$host$portSegment/api/auth/desktop/consume")
  }

  private fun buildCookieOrigin(targetUrl: String): String? {
    val target = Uri.parse(targetUrl)
    val scheme = target.scheme ?: return null
    val host = target.host ?: return null
    val portSegment = if (target.port != -1) ":${target.port}" else ""
    return "$scheme://$host$portSegment"
  }

  private fun showError(message: String) {
    binding.errorText.text = message
    binding.errorText.isVisible = true
  }

  private fun handleObsidianVaultSetupResult(resultCode: Int, data: Intent?) {
    val request = pendingObsidianVaultSetupRequest ?: return
    pendingObsidianVaultSetupRequest = null

    if (resultCode != RESULT_OK) {
      dispatchObsidianVaultSetupResult(
        JSONObject()
          .put("status", "cancelled")
          .put("spaceId", request.spaceId)
      )
      return
    }

    val treeUri = data?.data
    if (treeUri == null) {
      dispatchObsidianVaultSetupResult(
        JSONObject()
          .put("status", "error")
          .put("spaceId", request.spaceId)
          .put("message", "Android did not return a directory tree URI.")
      )
      return
    }

    val permissionFlags =
      (data.flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION))
        .takeIf { it != 0 }
        ?: (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)

    try {
      contentResolver.takePersistableUriPermission(treeUri, permissionFlags)
      val rootDirectory = DocumentFile.fromTreeUri(this, treeUri)
        ?: error("Selected Android directory tree is unavailable.")
      val contextGoRoot =
        rootDirectory.findDirectory(CONTEXTGO_VAULTS_DIRECTORY_NAME)
          ?: rootDirectory.createDirectory(CONTEXTGO_VAULTS_DIRECTORY_NAME)
          ?: error("Failed to create ContextGo root directory inside the selected tree.")
      val spaceDirectory =
        contextGoRoot.findDirectory(request.suggestedFolderName)
          ?: contextGoRoot.createDirectory(request.suggestedFolderName)
          ?: error("Failed to create the Space vault directory inside the selected tree.")

      val payload =
        JSONObject()
          .put("status", "prepared-directory")
          .put("spaceId", request.spaceId)
          .put("spaceName", request.spaceName)
          .put("vaultName", request.suggestedFolderName)
          .put("rootTreeUri", treeUri.toString())
          .put("spaceDirectoryUri", spaceDirectory.uri.toString())
          .put("vaultBindingId", request.vaultBindingId)
          .put("replicaId", buildAndroidReplicaId())
          .put("landingNotePath", request.landingNotePath)

      ensureObsidianVaultBootstrap(spaceDirectory, request)

      preferences.edit().putString(obsidianVaultSetupKey(request.spaceId), payload.toString()).apply()
      dispatchObsidianVaultSetupResult(payload)
    } catch (error: Exception) {
      dispatchObsidianVaultSetupResult(
        JSONObject()
          .put("status", "error")
          .put("spaceId", request.spaceId)
          .put("message", error.message ?: "Android vault setup failed.")
      )
    }
  }

  private fun dispatchObsidianVaultSetupResult(payload: JSONObject) {
    val escapedPayload = JSONObject.quote(payload.toString())
    binding.webView.evaluateJavascript(
      """
      (function() {
        window.dispatchEvent(new CustomEvent('$ANDROID_OBSIDIAN_VAULT_SETUP_EVENT', {
          detail: JSON.parse($escapedPayload)
        }));
      })();
      """.trimIndent(),
      null
    )
  }

  private fun readObsidianVaultSetupState(spaceId: String): String {
    val stored = preferences.getString(obsidianVaultSetupKey(spaceId), null)
    if (!stored.isNullOrBlank()) {
      return stored
    }

    return JSONObject()
      .put("status", "unprepared")
      .put("spaceId", spaceId)
      .toString()
  }

  private fun ensureObsidianVaultBootstrap(
    spaceDirectory: DocumentFile,
    request: PendingObsidianVaultSetupRequest,
  ) {
    val obsidianDir =
      spaceDirectory.findDirectory(".obsidian")
        ?: spaceDirectory.createDirectory(".obsidian")
        ?: error("Failed to create .obsidian directory in the Android vault.")
    obsidianDir.findDirectory("plugins") ?: obsidianDir.createDirectory("plugins")

    if (spaceDirectory.findFile(request.landingNotePath) == null) {
      val landingNote =
        spaceDirectory.createFile("text/markdown", request.landingNotePath)
          ?: error("Failed to create Android landing note inside the prepared vault.")
      contentResolver.openOutputStream(landingNote.uri)?.use { output ->
        output.write("# ${request.spaceName}\n".toByteArray())
      } ?: error("Failed to open Android landing note for writing.")
    }
  }

  private fun buildAndroidReplicaId(): String {
    val androidId =
      Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
        ?.takeIf { it.isNotBlank() }
        ?: "unknown"
    return "android_$androidId"
  }

  private inner class StartupBridge {
    @JavascriptInterface
    fun notifyReady() {
      runOnUiThread {
        startupReadyReceived = true
        dismissStartupOverlayIfReady()
      }
    }

    @JavascriptInterface
    fun getObsidianVaultSetupState(spaceId: String): String {
      return readObsidianVaultSetupState(spaceId)
    }

    @JavascriptInterface
    fun updateObsidianVaultSetupState(stateJson: String) {
      runOnUiThread {
        try {
          val payload = JSONObject(stateJson)
          val spaceId = payload.optString("spaceId").trim()
          if (spaceId.isBlank()) {
            return@runOnUiThread
          }

          preferences.edit().putString(obsidianVaultSetupKey(spaceId), payload.toString()).apply()
        } catch (_: Exception) {
          // Ignore malformed payloads from the WebView side and keep the previous state.
        }
      }
    }

    @JavascriptInterface
    fun requestObsidianVaultSetup(requestJson: String) {
      val request =
        try {
          val payload = JSONObject(requestJson)
          PendingObsidianVaultSetupRequest(
            spaceId = payload.optString("spaceId").ifBlank { return },
            spaceName = payload.optString("spaceName").ifBlank { "Space" },
            suggestedFolderName = payload.optString("suggestedFolderName").ifBlank { "contextgo-space" },
            vaultBindingId = payload.optString("vaultBindingId").ifBlank { "vault_default" },
            landingNotePath = payload.optString("landingNotePath").ifBlank { "Home.md" },
          )
        } catch (_: Exception) {
          null
        }

      if (request == null) {
        dispatchObsidianVaultSetupResult(
          JSONObject()
            .put("status", "error")
            .put("spaceId", "")
            .put("message", "Invalid Android vault setup request payload.")
        )
        return
      }

      pendingObsidianVaultSetupRequest = request
      runOnUiThread {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
          addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
          addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION)
        }

        try {
          obsidianVaultSetupLauncher.launch(intent)
        } catch (_: ActivityNotFoundException) {
          pendingObsidianVaultSetupRequest = null
          dispatchObsidianVaultSetupResult(
            JSONObject()
              .put("status", "error")
              .put("spaceId", request.spaceId)
              .put("message", getString(R.string.no_directory_picker))
          )
        }
      }
    }
  }

  private companion object {
    const val OFFICIAL_REMOTE_URL = "https://remote.contextgo.io/remote/devices"
    const val OFFICIAL_REMOTE_HOST = "remote.contextgo.io"
    const val PREFERENCES_NAME = "contextgo_mobile_shell"
    const val TARGET_URL_KEY = "target_url"
    const val STARTUP_BRIDGE_NAME = "ContextGoMobileShell"
    const val CONTEXTGO_VAULTS_DIRECTORY_NAME = "ContextGo"
    const val ANDROID_OBSIDIAN_VAULT_SETUP_EVENT = "contextgo:android-obsidian-vault-setup-result"
    const val STARTUP_OVERLAY_FALLBACK_DELAY_MS = 500L
    const val STARTUP_READY_OBSERVER_SCRIPT =
      """
      (function() {
        if (window.__contextGoMobileShellStartupReadyObserverInstalled) {
          return;
        }

        window.__contextGoMobileShellStartupReadyObserverInstalled = true;
        const notifyReady = function() {
          if (window.ContextGoMobileShell && typeof window.ContextGoMobileShell.notifyReady === 'function') {
            window.ContextGoMobileShell.notifyReady();
          }
        };

        const maybeNotifyReady = function() {
          if (
            window.__CONTEXTGO_STARTUP_READY === true ||
            (document.documentElement && document.documentElement.dataset.contextgoStartupReady === 'true')
          ) {
            notifyReady();
          }
        };

        window.addEventListener('contextgo:startup-ready', notifyReady, { once: true });

        if (document.documentElement) {
          new MutationObserver(maybeNotifyReady).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-contextgo-startup-ready']
          });
        }

        maybeNotifyReady();
      })();
      """
  }

  private data class PendingObsidianVaultSetupRequest(
    val spaceId: String,
    val spaceName: String,
    val suggestedFolderName: String,
    val vaultBindingId: String,
    val landingNotePath: String,
  )

  private fun obsidianVaultSetupKey(spaceId: String): String {
    return "obsidian_vault_setup_$spaceId"
  }
}

private fun DocumentFile.findDirectory(name: String): DocumentFile? {
  return listFiles().firstOrNull { it.isDirectory && it.name == name }
}

private data class ShellLoginPayload(
  val targetUrl: String,
  val loginCode: String?,
  val errorCode: String?
) {
  val shouldRecoverNatively: Boolean
    get() = !errorCode.isNullOrBlank() && loginCode.isNullOrBlank()
}

private object ShellTargetResolver {
  private const val OFFICIAL_REMOTE_HOST = "remote.contextgo.io"
  private const val REMOTE_SHELL_SCHEME = "contextgo-remote"
  private const val OFFICIAL_REMOTE_URL = "https://remote.contextgo.io/remote/devices"

  fun resolve(rawInput: String): String? {
    return resolvePayload(rawInput)?.targetUrl
  }

  fun resolvePayload(rawInput: String): ShellLoginPayload? {
    val trimmed = rawInput.trim()
    if (trimmed.isEmpty()) {
      return null
    }

    val normalized = if (trimmed.contains("://")) trimmed else "http://$trimmed"
    val parsed = Uri.parse(normalized)
    val scheme = parsed.scheme?.lowercase(Locale.US)
    if (scheme == REMOTE_SHELL_SCHEME) {
      val loginCode = parsed.getQueryParameter("code")?.trim()?.takeIf { it.isNotEmpty() }
      val explicitError = parsed.getQueryParameter("error")?.trim()?.takeIf { it.isNotEmpty() }
      val wrappedTarget = parsed.getQueryParameter("target") ?: OFFICIAL_REMOTE_URL
      val loginFallbackError = loginFallbackErrorCode(wrappedTarget, loginCode != null)
      val resolvedTarget = if (loginFallbackError == null) {
        resolveOfficialTarget(wrappedTarget)
      } else {
        OFFICIAL_REMOTE_URL
      } ?: return null

      return ShellLoginPayload(
        targetUrl = resolvedTarget,
        loginCode = loginCode,
        errorCode = explicitError ?: loginFallbackError
      )
    }

    val targetUrl = resolveOfficialTarget(trimmed) ?: return null
    return ShellLoginPayload(targetUrl = targetUrl, loginCode = null, errorCode = null)
  }

  private fun resolveOfficialTarget(rawInput: String): String? {
    val normalized = if (rawInput.contains("://")) rawInput else "http://$rawInput"
    val parsed = Uri.parse(normalized)
    val scheme = parsed.scheme?.lowercase(Locale.US)
    if ((scheme != "http" && scheme != "https") || parsed.host.isNullOrBlank()) {
      return null
    }

    if (parsed.host?.lowercase(Locale.US) == OFFICIAL_REMOTE_HOST) {
      val currentPath = parsed.encodedPath.orEmpty()
      if (currentPath.isEmpty() || currentPath == "/" || currentPath == "/login") {
        return parsed.buildUpon().encodedPath("/remote/devices").build().toString()
      }
      return parsed.toString()
    }

    val path = parsed.encodedPath.orEmpty()
    if (path.isEmpty() || path == "/") {
      return parsed.buildUpon().encodedPath("/login").build().toString()
    }

    return parsed.toString()
  }

  private fun loginFallbackErrorCode(rawTarget: String, hasLoginCode: Boolean): String? {
    if (hasLoginCode) {
      return null
    }

    val resolvedTarget = resolveOfficialTarget(rawTarget) ?: return null
    val parsed = Uri.parse(resolvedTarget)
    if (parsed.host?.lowercase(Locale.US) != OFFICIAL_REMOTE_HOST) {
      return null
    }

    val path = parsed.encodedPath.orEmpty()
    if (path != "/remote/devices") {
      return null
    }

    return Uri.parse(rawTarget).getQueryParameter("oauthError")?.trim()?.takeIf { it.isNotEmpty() }
      ?: Uri.parse(rawTarget).getQueryParameter("error")?.trim()?.takeIf { it.isNotEmpty() }
      ?: "login_required"
  }
}

package com.aionui.mobileshell

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import com.aionui.mobileshell.databinding.ActivityMainBinding
import java.util.Locale

class MainActivity : AppCompatActivity() {
  private lateinit var binding: ActivityMainBinding
  private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

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

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    binding = ActivityMainBinding.inflate(layoutInflater)
    setContentView(binding.root)

    configureWebView()
    bindEvents()

    val storedTarget = preferences.getString(TARGET_URL_KEY, null)
    if (storedTarget.isNullOrBlank()) {
      showConnectUi()
    } else {
      openTarget(storedTarget)
    }
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
      resetConnection()
    }
  }

  @SuppressLint("SetJavaScriptEnabled")
  private fun configureWebView() {
    CookieManager.getInstance().setAcceptCookie(true)
    CookieManager.getInstance().setAcceptThirdPartyCookies(binding.webView, true)

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
      userAgentString = userAgentString + " AionUiMobileShell/1.0"
    }

    binding.webView.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean {
        val target = request.url ?: return false
        val scheme = target.scheme?.lowercase(Locale.US).orEmpty()

        if (scheme == "http" || scheme == "https") {
          return false
        }

        return runCatching {
          startActivity(Intent(Intent.ACTION_VIEW, target))
        }.isSuccess
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

  private fun openTarget(targetUrl: String) {
    preferences.edit().putString(TARGET_URL_KEY, targetUrl).apply()
    binding.urlInput.setText(targetUrl)
    binding.errorText.isVisible = false
    binding.errorText.text = ""
    showWebUi()
    binding.webView.loadUrl(targetUrl)
  }

  private fun resetConnection() {
    preferences.edit().remove(TARGET_URL_KEY).apply()
    binding.webView.stopLoading()
    binding.webView.loadUrl("about:blank")
    binding.urlInput.text?.clear()
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

  private fun showError(message: String) {
    binding.errorText.text = message
    binding.errorText.isVisible = true
  }

  private companion object {
    const val PREFERENCES_NAME = "aionui_mobile_shell"
    const val TARGET_URL_KEY = "target_url"
  }
}

private object ShellTargetResolver {
  fun resolve(rawInput: String): String? {
    val trimmed = rawInput.trim()
    if (trimmed.isEmpty()) {
      return null
    }

    val normalized = if (trimmed.contains("://")) trimmed else "http://$trimmed"
    val parsed = Uri.parse(normalized)
    val scheme = parsed.scheme?.lowercase(Locale.US)
    if ((scheme != "http" && scheme != "https") || parsed.host.isNullOrBlank()) {
      return null
    }

    val path = parsed.encodedPath.orEmpty()
    if (path.isEmpty() || path == "/") {
      return parsed.buildUpon().encodedPath("/login").build().toString()
    }

    return parsed.toString()
  }
}

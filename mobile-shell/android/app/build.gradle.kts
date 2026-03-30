plugins {
  id("com.android.application")
  kotlin("android")
}

val releaseVersionName = providers.environmentVariable("CONTEXTGO_RELEASE_VERSION").orNull ?: "1.0.0"
val releaseVersionCode = providers.environmentVariable("CONTEXTGO_RELEASE_VERSION_CODE").orNull?.toIntOrNull() ?: 1
val releaseKeystorePath = providers.environmentVariable("ANDROID_KEYSTORE_PATH").orNull
val releaseKeystorePassword = providers.environmentVariable("ANDROID_KEYSTORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("ANDROID_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("ANDROID_KEY_PASSWORD").orNull
val hasReleaseSigning = listOf(
  releaseKeystorePath,
  releaseKeystorePassword,
  releaseKeyAlias,
  releaseKeyPassword,
).all { !it.isNullOrBlank() }

android {
  namespace = "io.contextgo.mobileshell"
  compileSdk = 35

  defaultConfig {
    applicationId = "io.contextgo.mobileshell"
    minSdk = 26
    targetSdk = 35
    versionCode = releaseVersionCode
    versionName = releaseVersionName
  }

  signingConfigs {
    if (hasReleaseSigning) {
      create("release") {
        keyAlias = releaseKeyAlias
        keyPassword = releaseKeyPassword
        storeFile = file(releaseKeystorePath!!)
        storePassword = releaseKeystorePassword
      }
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      signingConfig = signingConfigs.findByName("release")
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro"
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  buildFeatures {
    viewBinding = true
  }
}

dependencies {
  implementation("androidx.activity:activity-ktx:1.9.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.webkit:webkit:1.11.0")
  implementation("com.google.android.material:material:1.12.0")
}

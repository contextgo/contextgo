/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

export {
  prepareHostRuntimeForWebUiMode as prepareHostBrowserEntryForWebUiMode,
  prepareOfficialRemoteHostRuntimeAtStartup as prepareOfficialRemoteHostBrowserEntryAtStartup,
  restoreDesktopHostRuntimeFromPreferences as restoreDesktopHostBrowserEntryFromPreferences,
} from './hostRuntimeStartup';

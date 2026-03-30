/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getPlatformServices } from '@/common/platform';

/**
 * Returns baseName unchanged in release builds, or baseName + '-dev' in dev builds.
 * Used to isolate symlink and directory names between environments.
 *
 * @example
 * getEnvAwareName('.contextgo')        // release → '.contextgo',        dev → '.contextgo-dev'
 * getEnvAwareName('.contextgo-config') // release → '.contextgo-config', dev → '.contextgo-config-dev'
 */
export function getEnvAwareName(baseName: string): string {
  return getPlatformServices().paths.isPackaged() === true ? baseName : `${baseName}-dev`;
}

/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { CONTEXTGO_API_BASE_URL, CONTEXTGO_AUTH_BASE_URL } from '@/common/config/constants';
import type { CloudAuthProviderId } from '@/common/types/cloud';

export const CLOUD_AUTH_SESSION_PARTITION = 'persist:contextgo-cloud-auth';

export const CLOUD_AUTH_BASE_URL = CONTEXTGO_AUTH_BASE_URL.replace(/\/+$/, '');
export const CLOUD_API_BASE_URL = CONTEXTGO_API_BASE_URL.replace(/\/+$/, '');

export const CLOUD_AUTH_PROVIDERS: CloudAuthProviderId[] = ['github', 'google'];

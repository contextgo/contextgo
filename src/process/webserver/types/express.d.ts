/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AuthUser } from '@process/webserver/auth/repository/UserRepository';
import type { CloudUser } from '@/common/types/cloud';

declare global {
  namespace Express {
    interface Request {
      user?: Pick<AuthUser, 'id' | 'username'>;
      authSource?: 'local' | 'cloud';
      cloudUser?: CloudUser;
      cookies?: Record<string, string>;
      csrfToken?: () => string;
    }
  }
}

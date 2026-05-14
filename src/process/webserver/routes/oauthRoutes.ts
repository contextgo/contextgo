/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { AUTH_CONFIG, getCookieOptions } from '../config/constants';
import { apiRateLimiter, authRateLimiter } from '../middleware/security';
import { OAuthService } from '@process/webserver/auth/service/OAuthService';

type RedirectErrorCode =
  | 'access_denied'
  | 'callback_failed'
  | 'email_not_allowed'
  | 'email_required'
  | 'invalid_state'
  | 'missing_code'
  | 'provider_not_enabled';

function getOAuthStateCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  const sessionCookieOptions = getCookieOptions();

  return {
    httpOnly: true,
    secure: sessionCookieOptions.secure,
    sameSite: 'lax',
    path: OAuthService.STATE_COOKIE_PATH,
    maxAge: OAuthService.STATE_MAX_AGE_MS,
  };
}

function redirectToLogin(res: Response, code: RedirectErrorCode): void {
  res.redirect(`/login?oauthError=${encodeURIComponent(code)}`);
}

async function handleOAuthCallback(req: Request, res: Response): Promise<void> {
  const providerParam = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
  const providerId = OAuthService.parseProviderId(providerParam);
  const cookieOptions = getOAuthStateCookieOptions();

  if (!providerId || !OAuthService.isProviderEnabled(providerId)) {
    res.clearCookie(OAuthService.STATE_COOKIE_NAME, cookieOptions);
    redirectToLogin(res, 'provider_not_enabled');
    return;
  }

  const callbackError = typeof req.query.error === 'string' ? req.query.error : undefined;
  if (callbackError) {
    res.clearCookie(OAuthService.STATE_COOKIE_NAME, cookieOptions);
    redirectToLogin(res, callbackError === 'access_denied' ? 'access_denied' : 'callback_failed');
    return;
  }

  const expectedState = req.cookies?.[OAuthService.STATE_COOKIE_NAME];
  const returnedState = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';

  if (!expectedState || expectedState !== returnedState) {
    res.clearCookie(OAuthService.STATE_COOKIE_NAME, cookieOptions);
    redirectToLogin(res, 'invalid_state');
    return;
  }

  if (!code) {
    res.clearCookie(OAuthService.STATE_COOKIE_NAME, cookieOptions);
    redirectToLogin(res, 'missing_code');
    return;
  }

  const result = await OAuthService.completeAuthorizationCodeLogin(providerId, req, code);
  res.clearCookie(OAuthService.STATE_COOKIE_NAME, cookieOptions);

  if (result.success) {
    res.cookie(AUTH_CONFIG.COOKIE.NAME, result.data.sessionToken, {
      ...getCookieOptions(),
      maxAge: AUTH_CONFIG.TOKEN.COOKIE_MAX_AGE,
    });
    res.redirect('/guid');
    return;
  }

  if (!('error' in result)) {
    redirectToLogin(res, 'callback_failed');
    return;
  }

  const errorCode = result.error.code;
  if (
    errorCode === 'email_not_allowed' ||
    errorCode === 'email_required' ||
    errorCode === 'provider_not_enabled' ||
    errorCode === 'callback_failed'
  ) {
    redirectToLogin(res, errorCode);
    return;
  }

  redirectToLogin(res, 'callback_failed');
}

export function registerOAuthRoutes(app: Express): void {
  app.get('/api/auth/oauth/providers', apiRateLimiter, (_req: Request, res: Response) => {
    res.json({
      success: true,
      providers: OAuthService.getEnabledProviders(),
    });
  });

  app.get('/api/auth/oauth/:provider/start', authRateLimiter, (req: Request, res: Response) => {
    const providerParam = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
    const providerId = OAuthService.parseProviderId(providerParam);
    if (!providerId || !OAuthService.isProviderEnabled(providerId)) {
      redirectToLogin(res, 'provider_not_enabled');
      return;
    }

    try {
      const { authorizationUrl, state } = OAuthService.createAuthorizationRequest(providerId, req);
      res.cookie(OAuthService.STATE_COOKIE_NAME, state, getOAuthStateCookieOptions());
      res.redirect(authorizationUrl);
    } catch (error) {
      console.error(`[OAuth] Failed to start ${req.params.provider} login:`, error);
      redirectToLogin(res, 'callback_failed');
    }
  });

  app.get('/api/auth/oauth/:provider/callback', authRateLimiter, (req: Request, res: Response, next: NextFunction) => {
    void handleOAuthCallback(req, res).catch(next);
  });
}

export default registerOAuthRoutes;

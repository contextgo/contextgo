/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import type { Request } from 'express';
import { AuthService } from './AuthService';
import { UserRepository } from '../repository/UserRepository';
import { SERVER_CONFIG } from '../../config/constants';

const OAUTH_STATE_COOKIE_NAME = 'aionui-oauth-state';
const OAUTH_STATE_COOKIE_PATH = '/api/auth/oauth';
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const OAUTH_REQUEST_TIMEOUT_MS = 10 * 1000;
const OAUTH_USER_AGENT = 'AionUi';

const OAUTH_PROVIDER_IDS = ['github', 'google'] as const;

type GitHubProviderId = 'github';
type GoogleProviderId = 'google';

export type OAuthProviderId = (typeof OAUTH_PROVIDER_IDS)[number];

type OAuthProviderCredentials = {
  clientId: string;
  clientSecret: string;
};

type OAuthUserProfile = {
  email: string;
  emailVerified: boolean;
  usernameCandidate: string;
};

type OAuthCompletionResult =
  | {
      success: true;
      data: {
        sessionToken: string;
        user: {
          id: string;
          username: string;
        };
      };
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };

type GitHubTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GitHubUserResponse = {
  login?: string;
  email?: string | null;
};

type GitHubEmailEntry = {
  email: string;
  primary: boolean;
  verified: boolean;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfoResponse = {
  email?: string;
  email_verified?: boolean;
  name?: string;
};

const isOAuthProviderId = (value: string): value is OAuthProviderId =>
  (OAUTH_PROVIDER_IDS as readonly string[]).includes(value);

const normalizeBaseUrl = (rawUrl: string | undefined): string | null => {
  const trimmedUrl = rawUrl?.trim();
  if (!trimmedUrl) {
    return null;
  }
  return trimmedUrl.replace(/\/+$/, '');
};

const buildFailure = (code: string, message: string): OAuthCompletionResult => ({
  success: false,
  error: {
    code,
    message,
  },
});

const firstHeaderValue = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  return value.split(',')[0]?.trim().replace(/\/+$/, '');
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

function sanitizeUsernameCandidate(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');

  const base = normalized || 'user';
  const longEnough = base.length >= 3 ? base : `user-${base}`;
  const truncated = longEnough.slice(0, 32).replace(/^[-_]+|[-_]+$/g, '');
  return truncated || 'user';
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OAUTH_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const bodyText = await response.text();
  if (!bodyText) {
    return null;
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    return null;
  }
}

async function parseGitHubTokenResponse(response: Response): Promise<GitHubTokenResponse> {
  const bodyText = await response.text();
  if (!bodyText) {
    return {};
  }

  try {
    return JSON.parse(bodyText) as GitHubTokenResponse;
  } catch {
    const searchParams = new URLSearchParams(bodyText);
    return {
      access_token: searchParams.get('access_token') ?? undefined,
      error: searchParams.get('error') ?? undefined,
      error_description: searchParams.get('error_description') ?? undefined,
    };
  }
}

export class OAuthService {
  public static readonly STATE_COOKIE_NAME = OAUTH_STATE_COOKIE_NAME;
  public static readonly STATE_COOKIE_PATH = OAUTH_STATE_COOKIE_PATH;
  public static readonly STATE_MAX_AGE_MS = OAUTH_STATE_MAX_AGE_MS;

  public static parseProviderId(value: string): OAuthProviderId | null {
    if (!isOAuthProviderId(value)) {
      return null;
    }

    return value;
  }

  public static getEnabledProviders(): OAuthProviderId[] {
    return OAUTH_PROVIDER_IDS.filter((providerId) => this.getProviderCredentials(providerId) !== null);
  }

  public static isProviderEnabled(providerId: OAuthProviderId): boolean {
    return this.getProviderCredentials(providerId) !== null;
  }

  public static createAuthorizationRequest(
    providerId: OAuthProviderId,
    req: Request
  ): {
    authorizationUrl: string;
    state: string;
  } {
    const credentials = this.getProviderCredentials(providerId);
    if (!credentials) {
      throw new Error(`OAuth provider "${providerId}" is not configured`);
    }

    const state = `${providerId}.${AuthService.generateSessionId()}`;
    const callbackUrl = this.getCallbackUrl(req, providerId);

    if (providerId === 'github') {
      const searchParams = new URLSearchParams({
        client_id: credentials.clientId,
        redirect_uri: callbackUrl,
        scope: 'read:user user:email',
        state,
      });

      return {
        authorizationUrl: `https://github.com/login/oauth/authorize?${searchParams.toString()}`,
        state,
      };
    }

    const searchParams = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
      state,
    });

    return {
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${searchParams.toString()}`,
      state,
    };
  }

  public static async completeAuthorizationCodeLogin(
    providerId: OAuthProviderId,
    req: Request,
    code: string
  ): Promise<OAuthCompletionResult> {
    if (!this.isProviderEnabled(providerId)) {
      return buildFailure('provider_not_enabled', `OAuth provider "${providerId}" is not configured`);
    }

    try {
      const profile =
        providerId === 'github'
          ? await this.fetchGitHubProfile(req, providerId, code)
          : await this.fetchGoogleProfile(req, providerId, code);

      if (!profile.email || !profile.emailVerified) {
        return buildFailure('email_required', 'A verified email address is required for OAuth login');
      }

      if (!this.isEmailAllowed(profile.email)) {
        return buildFailure('email_not_allowed', 'This email address is not permitted to sign in');
      }

      const user = await this.findOrCreateUser(profile);
      await UserRepository.updateLastLogin(user.id);

      const sessionToken = await AuthService.generateToken({
        id: user.id,
        username: user.username,
      });

      return {
        success: true,
        data: {
          sessionToken,
          user: {
            id: user.id,
            username: user.username,
          },
        },
      };
    } catch (error) {
      console.error(`[OAuth] ${providerId} callback failed:`, error);
      return buildFailure('callback_failed', error instanceof Error ? error.message : 'OAuth callback failed');
    }
  }

  public static resolvePublicBaseUrl(req: Request): string {
    const explicitBaseUrl = normalizeBaseUrl(process.env.SERVER_BASE_URL);
    if (explicitBaseUrl) {
      return explicitBaseUrl;
    }

    const forwardedProto = firstHeaderValue(req.header('x-forwarded-proto'));
    const forwardedHost = firstHeaderValue(req.header('x-forwarded-host'));
    const host = forwardedHost ?? req.header('host')?.trim();
    const protocol = forwardedProto ?? (req.secure ? 'https' : 'http');

    if (host) {
      return `${protocol}://${host}`;
    }

    return SERVER_CONFIG.BASE_URL;
  }

  public static getCallbackUrl(req: Request, providerId: OAuthProviderId): string {
    return `${this.resolvePublicBaseUrl(req)}/api/auth/oauth/${providerId}/callback`;
  }

  private static getProviderCredentials(providerId: OAuthProviderId): OAuthProviderCredentials | null {
    const clientIdEnv =
      providerId === 'github' ? process.env.AIONUI_AUTH_GITHUB_CLIENT_ID : process.env.AIONUI_AUTH_GOOGLE_CLIENT_ID;
    const clientSecretEnv =
      providerId === 'github'
        ? process.env.AIONUI_AUTH_GITHUB_CLIENT_SECRET
        : process.env.AIONUI_AUTH_GOOGLE_CLIENT_SECRET;

    const clientId = clientIdEnv?.trim();
    const clientSecret = clientSecretEnv?.trim();
    if (!clientId || !clientSecret) {
      return null;
    }

    return {
      clientId,
      clientSecret,
    };
  }

  private static getAllowedEmails(): Set<string> {
    return new Set(
      (process.env.AIONUI_AUTH_ALLOWED_EMAILS || '')
        .split(',')
        .map((entry) => normalizeEmail(entry))
        .filter(Boolean)
    );
  }

  private static isEmailAllowed(email: string): boolean {
    const allowedEmails = this.getAllowedEmails();
    if (allowedEmails.size === 0) {
      return true;
    }

    return allowedEmails.has(normalizeEmail(email));
  }

  private static async exchangeGitHubCodeForAccessToken(
    req: Request,
    providerId: GitHubProviderId,
    code: string
  ): Promise<string> {
    const credentials = this.getProviderCredentials(providerId);
    if (!credentials) {
      throw new Error(`OAuth provider "${providerId}" is not configured`);
    }

    const response = await fetchWithTimeout('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': OAUTH_USER_AGENT,
      },
      body: JSON.stringify({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
        redirect_uri: this.getCallbackUrl(req, providerId),
      }),
    });

    const tokenResponse = await parseGitHubTokenResponse(response);
    if (!response.ok || !tokenResponse.access_token) {
      throw new Error(tokenResponse.error_description || tokenResponse.error || 'GitHub OAuth token exchange failed');
    }

    return tokenResponse.access_token;
  }

  private static async fetchGitHubProfile(
    req: Request,
    providerId: GitHubProviderId,
    code: string
  ): Promise<OAuthUserProfile> {
    const accessToken = await this.exchangeGitHubCodeForAccessToken(req, providerId, code);

    const commonHeaders = {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': OAUTH_USER_AGENT,
      'X-GitHub-Api-Version': '2022-11-28',
    };

    const [userResponse, emailResponse] = await Promise.all([
      fetchWithTimeout('https://api.github.com/user', {
        headers: commonHeaders,
      }),
      fetchWithTimeout('https://api.github.com/user/emails', {
        headers: commonHeaders,
      }),
    ]);

    const user = await parseJsonResponse<GitHubUserResponse>(userResponse);
    const emails = await parseJsonResponse<GitHubEmailEntry[]>(emailResponse);

    if (!userResponse.ok || !user?.login) {
      throw new Error('Failed to fetch GitHub user profile');
    }

    const verifiedEmail =
      emails?.find((entry) => entry.primary && entry.verified)?.email ??
      emails?.find((entry) => entry.verified)?.email ??
      user.email ??
      undefined;

    return {
      email: normalizeEmail(verifiedEmail ?? ''),
      emailVerified: Boolean(verifiedEmail),
      usernameCandidate: user.login,
    };
  }

  private static async exchangeGoogleCodeForAccessToken(
    req: Request,
    providerId: GoogleProviderId,
    code: string
  ): Promise<string> {
    const credentials = this.getProviderCredentials(providerId);
    if (!credentials) {
      throw new Error(`OAuth provider "${providerId}" is not configured`);
    }

    const response = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: this.getCallbackUrl(req, providerId),
        grant_type: 'authorization_code',
      }).toString(),
    });

    const tokenResponse = await parseJsonResponse<GoogleTokenResponse>(response);
    if (!response.ok || !tokenResponse?.access_token) {
      throw new Error(tokenResponse?.error_description || tokenResponse?.error || 'Google OAuth token exchange failed');
    }

    return tokenResponse.access_token;
  }

  private static async fetchGoogleProfile(
    req: Request,
    providerId: GoogleProviderId,
    code: string
  ): Promise<OAuthUserProfile> {
    const accessToken = await this.exchangeGoogleCodeForAccessToken(req, providerId, code);

    const response = await fetchWithTimeout('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userInfo = await parseJsonResponse<GoogleUserInfoResponse>(response);
    if (!response.ok || !userInfo?.email) {
      throw new Error('Failed to fetch Google user profile');
    }

    const usernameCandidate = userInfo.name || userInfo.email.split('@')[0] || 'google-user';

    return {
      email: normalizeEmail(userInfo.email),
      emailVerified: userInfo.email_verified === true,
      usernameCandidate,
    };
  }

  private static async findOrCreateUser(profile: OAuthUserProfile): Promise<{
    id: string;
    username: string;
  }> {
    const existingUser = await UserRepository.findByEmail(profile.email);
    if (existingUser) {
      return {
        id: existingUser.id,
        username: existingUser.username,
      };
    }

    const username = await this.allocateUsername(profile.usernameCandidate, profile.email);
    const passwordHash = await AuthService.hashPassword(AuthService.generateRandomPassword());
    const createdUser = await UserRepository.createUser(username, passwordHash, profile.email);

    return {
      id: createdUser.id,
      username: createdUser.username,
    };
  }

  private static async allocateUsername(seed: string, email: string): Promise<string> {
    const baseCandidate = sanitizeUsernameCandidate(seed || email.split('@')[0] || 'user');
    const availableBase = baseCandidate.slice(0, 32);

    for (let index = 0; index < 100; index++) {
      const suffix = index === 0 ? '' : `-${index + 1}`;
      const maxBaseLength = 32 - suffix.length;
      const candidateBase = availableBase.slice(0, maxBaseLength).replace(/^[-_]+|[-_]+$/g, '') || 'user';
      const candidate = `${candidateBase}${suffix}`;

      if (!AuthService.validateUsername(candidate).isValid) {
        continue;
      }

      const existingUser = await UserRepository.findByUsername(candidate);
      if (!existingUser) {
        return candidate;
      }
    }

    const randomFallback = `user-${crypto.randomInt(100000, 999999)}`;
    return randomFallback.slice(0, 32);
  }
}

export default OAuthService;

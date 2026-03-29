import type { Request } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

function clearOAuthEnv(): void {
  delete process.env.AIONUI_AUTH_GITHUB_CLIENT_ID;
  delete process.env.AIONUI_AUTH_GITHUB_CLIENT_SECRET;
  delete process.env.AIONUI_AUTH_GOOGLE_CLIENT_ID;
  delete process.env.AIONUI_AUTH_GOOGLE_CLIENT_SECRET;
  delete process.env.AIONUI_AUTH_ALLOWED_EMAILS;
  delete process.env.SERVER_BASE_URL;
}

function createRequest(headers: Record<string, string> = {}): Request {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  ) as Record<string, string>;

  return {
    secure: false,
    header(name: string) {
      return normalizedHeaders[name.toLowerCase()];
    },
  } as unknown as Request;
}

describe('OAuthService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    clearOAuthEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('returns only configured OAuth providers', async () => {
    process.env.AIONUI_AUTH_GITHUB_CLIENT_ID = 'github-client-id';
    process.env.AIONUI_AUTH_GITHUB_CLIENT_SECRET = 'github-client-secret';

    vi.doMock('@process/webserver/auth/repository/UserRepository', () => ({
      UserRepository: {},
    }));
    vi.doMock('@process/webserver/auth/service/AuthService', () => ({
      AuthService: {},
    }));

    const { OAuthService } = await import('@process/webserver/auth/service/OAuthService');
    expect(OAuthService.getEnabledProviders()).toEqual(['github']);
  });

  it('builds a GitHub authorization URL from forwarded public headers', async () => {
    process.env.AIONUI_AUTH_GITHUB_CLIENT_ID = 'github-client-id';
    process.env.AIONUI_AUTH_GITHUB_CLIENT_SECRET = 'github-client-secret';

    vi.doMock('@process/webserver/auth/repository/UserRepository', () => ({
      UserRepository: {},
    }));
    vi.doMock('@process/webserver/auth/service/AuthService', () => ({
      AuthService: {
        generateSessionId: () => 'generated-state',
      },
    }));

    const { OAuthService } = await import('@process/webserver/auth/service/OAuthService');
    const { authorizationUrl, state } = OAuthService.createAuthorizationRequest(
      'github',
      createRequest({
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'login.example.com',
      })
    );

    const parsedUrl = new URL(authorizationUrl);

    expect(state).toBe('github.generated-state');
    expect(`${parsedUrl.origin}${parsedUrl.pathname}`).toBe('https://github.com/login/oauth/authorize');
    expect(parsedUrl.searchParams.get('client_id')).toBe('github-client-id');
    expect(parsedUrl.searchParams.get('redirect_uri')).toBe('https://login.example.com/api/auth/oauth/github/callback');
    expect(parsedUrl.searchParams.get('scope')).toBe('read:user user:email');
    expect(parsedUrl.searchParams.get('state')).toBe(state);
  });

  it('creates a user from a verified GitHub email and returns a session token', async () => {
    process.env.AIONUI_AUTH_GITHUB_CLIENT_ID = 'github-client-id';
    process.env.AIONUI_AUTH_GITHUB_CLIENT_SECRET = 'github-client-secret';

    const createUser = vi.fn().mockResolvedValue({
      id: 'user_1',
      username: 'octocat',
      email: 'octocat@example.com',
      password_hash: 'hashed-password',
      jwt_secret: null,
      created_at: 0,
      updated_at: 0,
      last_login: null,
    });
    const findByEmail = vi.fn().mockResolvedValue(null);
    const findByUsername = vi.fn().mockResolvedValue(null);
    const updateLastLogin = vi.fn().mockResolvedValue(undefined);

    vi.doMock('@process/webserver/auth/repository/UserRepository', () => ({
      UserRepository: {
        createUser,
        findByEmail,
        findByUsername,
        updateLastLogin,
      },
    }));
    vi.doMock('@process/webserver/auth/service/AuthService', () => ({
      AuthService: {
        generateRandomPassword: () => 'TempPass!123',
        generateToken: vi.fn().mockResolvedValue('session-token'),
        hashPassword: vi.fn().mockResolvedValue('hashed-password'),
        validateUsername: vi.fn(() => ({ isValid: true, errors: [] })),
      },
    }));

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'github-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ login: 'OctoCat' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ email: 'OctoCat@example.com', primary: true, verified: true }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const { OAuthService } = await import('@process/webserver/auth/service/OAuthService');
    const result = await OAuthService.completeAuthorizationCodeLogin('github', createRequest(), 'oauth-code');

    expect(result).toEqual({
      success: true,
      data: {
        sessionToken: 'session-token',
        user: {
          id: 'user_1',
          username: 'octocat',
        },
      },
    });
    expect(findByEmail).toHaveBeenCalledWith('octocat@example.com');
    expect(createUser).toHaveBeenCalledWith('octocat', 'hashed-password', 'octocat@example.com');
    expect(updateLastLogin).toHaveBeenCalledWith('user_1');
  });

  it('rejects OAuth emails that are outside the allowlist', async () => {
    process.env.AIONUI_AUTH_GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.AIONUI_AUTH_GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.AIONUI_AUTH_ALLOWED_EMAILS = 'allowed@example.com';

    vi.doMock('@process/webserver/auth/repository/UserRepository', () => ({
      UserRepository: {
        createUser: vi.fn(),
        findByEmail: vi.fn(),
        findByUsername: vi.fn(),
        updateLastLogin: vi.fn(),
      },
    }));
    vi.doMock('@process/webserver/auth/service/AuthService', () => ({
      AuthService: {
        generateRandomPassword: () => 'TempPass!123',
        generateToken: vi.fn(),
        hashPassword: vi.fn(),
        validateUsername: vi.fn(() => ({ isValid: true, errors: [] })),
      },
    }));

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'google-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            email: 'blocked@example.com',
            email_verified: true,
            name: 'Blocked User',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const { OAuthService } = await import('@process/webserver/auth/service/OAuthService');
    const result = await OAuthService.completeAuthorizationCodeLogin('google', createRequest(), 'oauth-code');

    expect(result).toEqual({
      success: false,
      error: {
        code: 'email_not_allowed',
        message: 'This email address is not permitted to sign in',
      },
    });
  });
});

import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyToken = vi.fn();
const verifyWebSocketToken = vi.fn();
const findById = vi.fn();
const authenticateRequest = vi.fn();
const authenticateSessionToken = vi.fn();
const isCloudRequest = vi.fn();

vi.mock('../../../../src/process/webserver/auth/service/AuthService', () => ({
  AuthService: {
    verifyToken,
    verifyWebSocketToken,
  },
}));

vi.mock('../../../../src/process/webserver/auth/repository/UserRepository', () => ({
  UserRepository: {
    findById,
  },
}));

vi.mock('../../../../src/process/webserver/auth/service/CloudSessionService', () => ({
  CloudSessionService: {
    authenticateRequest,
    authenticateSessionToken,
    isCloudRequest,
  },
}));

function createRequest(partial: Partial<Request> = {}): Request {
  return {
    headers: {},
    cookies: {},
    ...partial,
  } as Request;
}

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
  };

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  return response as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe('createAuthMiddleware cloud fallback', () => {
  let createAuthMiddleware: typeof import('../../../../src/process/webserver/auth/middleware/TokenMiddleware').createAuthMiddleware;

  beforeEach(async () => {
    vi.resetModules();
    verifyToken.mockReset();
    verifyWebSocketToken.mockReset();
    findById.mockReset();
    authenticateRequest.mockReset();
    authenticateSessionToken.mockReset();
    isCloudRequest.mockReset();

    ({ createAuthMiddleware } = await import('../../../../src/process/webserver/auth/middleware/TokenMiddleware'));
  });

  it('accepts a bound cloud session when local token is missing', async () => {
    authenticateRequest.mockResolvedValue({
      id: 'cloud-user-1',
      email: 'yeyitech@gmail.com',
      username: 'yeyitech',
      displayName: 'yeyitech',
      avatarUrl: null,
    });

    const middleware = createAuthMiddleware('json');
    const req = createRequest({
      headers: { host: 'remote.contextgo.io' } as Request['headers'],
      cookies: { contextgo_session: 'cloud-token' },
    });
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(authenticateRequest).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({
      id: 'cloud-user-1',
      username: 'yeyitech',
    });
    expect(req.authSource).toBe('cloud');
  });

  it('falls back to cloud auth when a local bearer token is invalid', async () => {
    verifyToken.mockResolvedValue(null);
    authenticateRequest.mockResolvedValue({
      id: 'cloud-user-1',
      email: 'yeyitech@gmail.com',
      username: 'yeyitech',
      displayName: 'yeyitech',
      avatarUrl: null,
    });

    const middleware = createAuthMiddleware('json');
    const req = createRequest({
      headers: {
        authorization: 'Bearer expired-local-token',
        host: 'remote.contextgo.io',
      } as Request['headers'],
      cookies: { contextgo_session: 'cloud-token' },
    });
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(verifyToken).toHaveBeenCalledWith('expired-local-token');
    expect(authenticateRequest).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.authSource).toBe('cloud');
  });

  it('returns access denied when neither local nor cloud auth succeeds', async () => {
    verifyToken.mockResolvedValue(null);
    authenticateRequest.mockResolvedValue(null);

    const middleware = createAuthMiddleware('json');
    const req = createRequest({
      headers: { host: 'remote.contextgo.io' } as Request['headers'],
    });
    const res = createResponse();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Access denied. Please login first.',
    });
  });

  it('accepts a cloud session token for websocket connections when local JWT validation fails', async () => {
    verifyWebSocketToken.mockResolvedValue(null);
    authenticateSessionToken.mockResolvedValue({
      id: 'cloud-user-1',
      email: 'yeyitech@gmail.com',
      username: 'yeyitech',
      displayName: 'yeyitech',
      avatarUrl: null,
    });

    const { TokenMiddleware } = await import('../../../../src/process/webserver/auth/middleware/TokenMiddleware');

    await expect(TokenMiddleware.validateWebSocketToken('cloud-session-token')).resolves.toBe(true);
    expect(verifyWebSocketToken).toHaveBeenCalledWith('cloud-session-token');
    expect(authenticateSessionToken).toHaveBeenCalledWith('cloud-session-token');
  });
});

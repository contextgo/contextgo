import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/process/webserver/auth/repository/UserRepository', () => ({
  UserRepository: {
    getSystemUser: vi.fn(),
    updateJwtSecret: vi.fn(),
  },
}));

describe('AuthService token claims', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    vi.resetModules();
    process.env.JWT_SECRET = 'contextgo-test-secret';
  });

  afterEach(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('generates tokens with the contextgo issuer and webui audience', async () => {
    const { AuthService } = await import('../../src/process/webserver/auth/service/AuthService');

    const token = await AuthService.generateToken({
      id: 'user-1',
      username: 'alice',
    });

    const decoded = jwt.verify(token, 'contextgo-test-secret', {
      issuer: 'contextgo',
      audience: 'contextgo-webui',
    }) as jwt.JwtPayload;

    expect(decoded.userId).toBe('user-1');
    expect(decoded.username).toBe('alice');
    expect(decoded.iss).toBe('contextgo');
    expect(decoded.aud).toBe('contextgo-webui');
  });

  it('rejects tokens signed with a non-ContextGo issuer when verifying', async () => {
    const { AuthService } = await import('../../src/process/webserver/auth/service/AuthService');

    const legacyToken = jwt.sign(
      {
        userId: 'user-1',
        username: 'alice',
      },
      'contextgo-test-secret',
      {
        expiresIn: '24h',
        issuer: 'legacy-contextgo',
        audience: 'contextgo-webui',
      }
    );

    await expect(AuthService.verifyToken(legacyToken)).resolves.toBeNull();
    await expect(AuthService.verifyWebSocketToken(legacyToken)).resolves.toBeNull();
  });
});

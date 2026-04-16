import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetConversation = vi.fn();
const tempDirs: string[] = [];

vi.mock('@process/services/database', () => ({
  getDatabase: vi.fn(async () => ({
    getConversation: mockGetConversation,
  })),
}));

vi.mock('@process/utils/initStorage', () => ({
  getSystemDir: vi.fn(() => ({
    cacheDir: path.join(os.tmpdir(), 'contextgo-upload-cache'),
  })),
}));

vi.mock('@process/webserver/auth/middleware/TokenMiddleware', () => ({
  TokenMiddleware: {
    validateToken: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  },
}));

vi.mock('@process/extensions', () => ({
  ExtensionRegistry: {
    getInstance: () => ({
      getWebuiContributions: () => [],
      getLoadedExtensions: () => [],
    }),
  },
}));

vi.mock('../../../../src/process/webserver/directoryApi', () => ({
  default: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../../../src/process/webserver/middleware/security', () => ({
  apiRateLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../../../src/process/webserver/routes/browserActivityRoutes', () => ({
  registerBrowserActivityRoutes: vi.fn(),
}));

describe('api upload route', () => {
  let server: ReturnType<express.Express['listen']> | null = null;
  let baseUrl = '';

  beforeEach(async () => {
    vi.clearAllMocks();

    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'contextgo-upload-workspace-'));
    tempDirs.push(workspaceRoot);

    mockGetConversation.mockReturnValue({
      success: true,
      data: {
        extra: {
          workspace: workspaceRoot,
        },
      },
    });

    const { registerApiRoutes } = await import('../../../../src/process/webserver/routes/apiRoutes');
    const app = express();
    registerApiRoutes(app);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server?.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      server = null;
    }

    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('accepts a larger conversation-bound upload and stores it inside workspace/uploads', async () => {
    const file = new File([new Uint8Array(35 * 1024 * 1024)], 'large.bin', {
      type: 'application/octet-stream',
    });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversationId', 'conv-1');

    const response = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    const body = (await response.json()) as {
      success: boolean;
      data?: {
        path: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.path).toContain(`${path.sep}uploads${path.sep}`);
    expect(fs.existsSync(body.data?.path ?? '')).toBe(true);
  });

  it('rejects uploads when requested workspace does not match the stored conversation workspace', async () => {
    const file = new File([new Uint8Array(8)], 'small.txt', {
      type: 'text/plain',
    });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversationId', 'conv-1');
    formData.append('workspace', '/tmp/other-workspace');

    const response = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    const body = (await response.json()) as {
      success: boolean;
      msg?: string;
    };

    expect(response.status).toBe(403);
    expect(body).toEqual({
      success: false,
      msg: 'Workspace mismatch',
    });
  });
});

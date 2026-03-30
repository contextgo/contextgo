/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response, NextFunction } from 'express';
import type { IncomingMessage } from 'http';
import * as cookie from 'cookie';
import { AuthService } from '../service/AuthService';
import { UserRepository } from '../repository/UserRepository';
import { CloudSessionService } from '../service/CloudSessionService';
import { AUTH_CONFIG } from '../../config/constants';
import { CONTEXTGO_SESSION_COOKIE_NAME } from '@/common/utils';
import type { CloudUser } from '@/common/types/cloud';

/**
 * Token 负载接口
 * Token payload interface
 */
export interface TokenPayload {
  userId: string;
  username: string;
}

/**
 * Token 提取器 - 从请求中提取认证 token
 * Token Extractor - Extract authentication token from request
 *
 * 安全说明：不再支持从 URL query 参数提取 token，避免 token 通过日志、Referrer 等泄露
 * Security: URL query token is no longer supported to prevent token leakage via logs, Referrer, etc.
 */
class TokenExtractor {
  /**
   * 从请求中提取 token，支持以下来源：
   * 1. Authorization header (Bearer token)
   * 2. Cookie (contextgo-session)
   *
   * Extract token from request, supporting these sources:
   * 1. Authorization header (Bearer token)
   * 2. Cookie (contextgo-session)
   *
   * @param req - Express 请求对象 / Express request object
   * @returns Token 字符串或 null / Token string or null
   */
  static extract(req: Request): string | null {
    // 1. 尝试从 Authorization header 提取 / Try to extract from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 2. 尝试从 Cookie 提取 / Try to extract from Cookie
    if (typeof req.cookies === 'object' && req.cookies) {
      const cookieToken = req.cookies[AUTH_CONFIG.COOKIE.NAME];
      if (typeof cookieToken === 'string' && cookieToken.trim() !== '') {
        return cookieToken;
      }
    }

    // 不再支持从 URL query 参数提取 token（安全风险）
    // URL query token is no longer supported (security risk)

    return null;
  }
}

/**
 * 验证策略接口 - 定义未授权处理方式
 * Validation Strategy Interface - Define unauthorized handling
 */
interface ValidationStrategy {
  handleUnauthorized(res: Response): void;
}

type ResolvedRequestAuth = {
  source: 'local' | 'cloud';
  user: TokenPayload;
  cloudUser?: CloudUser;
};

async function resolveLocalRequestAuth(token: string): Promise<ResolvedRequestAuth | null> {
  const decoded = await AuthService.verifyToken(token);
  if (!decoded) {
    return null;
  }

  const user = await UserRepository.findById(decoded.userId);
  if (!user) {
    return null;
  }

  return {
    source: 'local',
    user: {
      userId: user.id,
      username: user.username,
    },
  };
}

async function resolveCloudRequestAuth(req: Request): Promise<ResolvedRequestAuth | null> {
  const cloudUser = await CloudSessionService.authenticateRequest(req);
  if (!cloudUser) {
    return null;
  }

  return {
    source: 'cloud',
    user: {
      userId: cloudUser.id,
      username: cloudUser.username,
    },
    cloudUser,
  };
}

async function resolveRequestAuth(req: Request): Promise<ResolvedRequestAuth | null> {
  const token = TokenExtractor.extract(req);
  if (token) {
    const localAuth = await resolveLocalRequestAuth(token);
    if (localAuth) {
      return localAuth;
    }
  }

  return resolveCloudRequestAuth(req);
}

/**
 * JSON 验证策略 - 返回 JSON 格式的错误响应
 * JSON Validation Strategy - Return JSON format error response
 */
class JsonValidationStrategy implements ValidationStrategy {
  handleUnauthorized(res: Response): void {
    res.status(403).json({ success: false, error: 'Access denied. Please login first.' });
  }
}

/**
 * HTML 验证策略 - 返回 HTML 格式的错误响应
 * HTML Validation Strategy - Return HTML format error response
 */
class HtmlValidationStrategy implements ValidationStrategy {
  handleUnauthorized(res: Response): void {
    res.status(403).send('Access Denied');
  }
}

function createValidationStrategy(type: 'json' | 'html'): ValidationStrategy {
  if (type === 'html') {
    return new HtmlValidationStrategy();
  }

  return new JsonValidationStrategy();
}

/**
 * 创建认证中间件
 * Create authentication middleware
 *
 * 该中间件执行以下步骤：
 * 1. 从请求中提取 token
 * 2. 验证 token 有效性
 * 3. 查找用户信息
 * 4. 将用户信息附加到请求对象
 *
 * This middleware performs the following steps:
 * 1. Extract token from request
 * 2. Verify token validity
 * 3. Find user information
 * 4. Attach user info to request object
 *
 * @param type - 响应类型 (json 或 html) / Response type (json or html)
 * @returns Express 中间件函数 / Express middleware function
 */
export const createAuthMiddleware = (type: 'json' | 'html' = 'json') => {
  const strategy = createValidationStrategy(type);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const resolvedAuth = await resolveRequestAuth(req);
    if (!resolvedAuth) {
      strategy.handleUnauthorized(res);
      return;
    }

    // 4. 附加用户信息到请求对象 / Attach user info to request object
    req.user = {
      id: resolvedAuth.user.userId,
      username: resolvedAuth.user.username,
    };
    req.authSource = resolvedAuth.source;
    req.cloudUser = resolvedAuth.cloudUser;

    next();
  };
};

/**
 * Token 工具类 - 提供 token 相关的辅助方法
 * Token Utils - Provide token related helper methods
 */
export const TokenUtils = {
  /**
   * 从请求中提取 token
   * Extract token from request
   * @param req - Express 请求对象 / Express request object
   * @returns Token 字符串或 null / Token string or null
   */
  extractFromRequest(req: Request): string | null {
    return TokenExtractor.extract(req);
  },
};

/**
 * TokenMiddleware 工具类 - 提供统一的 Token 认证接口
 * TokenMiddleware Utility - Provides unified token authentication interface
 */
export const TokenMiddleware = {
  /** 从请求中提取 token / Extract token from request */
  extractToken(req: Request): string | null {
    return TokenExtractor.extract(req);
  },

  /** 校验 token 是否有效 / Verify token validity */
  async isTokenValid(token: string | null): Promise<boolean> {
    return Boolean(token && (await AuthService.verifyToken(token)));
  },

  /** 返回认证中间件（默认为 JSON 响应）/ Return auth middleware (JSON response by default) */
  validateToken(options?: {
    responseType?: 'json' | 'html';
  }): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return createAuthMiddleware(options?.responseType ?? 'json');
  },

  /**
   * 从 WebSocket 请求中提取 token
   * Extract token from WebSocket request
   *
   * 安全说明：不再支持从 URL query 参数提取 token，避免 token 通过日志、Referrer 等泄露
   * Security: URL query token is no longer supported to prevent token leakage via logs, Referrer, etc.
   */
  extractWebSocketToken(req: IncomingMessage): string | null {
    // 1. 从 Authorization header 提取
    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 2. 从 Cookie 提取 (WebUI 模式)
    const cookieHeader = req.headers['cookie'];
    if (typeof cookieHeader === 'string') {
      const cookies = cookie.parse(cookieHeader);
      const preferCloudCookie = CloudSessionService.isCloudRequest({ headers: req.headers });
      const cloudCookieToken = cookies[CONTEXTGO_SESSION_COOKIE_NAME];
      const localCookieToken = cookies[AUTH_CONFIG.COOKIE.NAME];

      if (preferCloudCookie && cloudCookieToken) {
        return cloudCookieToken;
      }

      if (localCookieToken) {
        return localCookieToken;
      }

      if (cloudCookieToken) {
        return cloudCookieToken;
      }
    }

    // 3. 从 sec-websocket-protocol 提取（用于不支持 Cookie 的客户端）
    const protocolHeader = req.headers['sec-websocket-protocol'];
    if (typeof protocolHeader === 'string' && protocolHeader.trim() !== '') {
      return protocolHeader.split(',')[0]?.trim() ?? null;
    }

    // 不再支持从 URL query 参数提取 token（安全风险）
    // URL query token is no longer supported (security risk)

    return null;
  },

  /** 校验 WebSocket token 是否有效 / Validate WebSocket token */
  async validateWebSocketToken(token: string | null): Promise<boolean> {
    if (!token) {
      return false;
    }

    if (await AuthService.verifyWebSocketToken(token)) {
      return true;
    }

    return Boolean(await CloudSessionService.authenticateSessionToken(token));
  },
};

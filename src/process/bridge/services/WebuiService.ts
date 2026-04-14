/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { networkInterfaces } from 'os';
import type { IWebUIStatus } from '@/common/adapter/ipcBridge';
import { getHostBrowserEntryService } from '@process/services/host/HostBrowserEntryService';
import { AuthService } from '@process/webserver/auth/service/AuthService';
import { UserRepository } from '@process/webserver/auth/repository/UserRepository';
import { AUTH_CONFIG, SERVER_CONFIG } from '@process/webserver/config/constants';
import { ProcessConfig } from '@process/utils/initStorage';

const DESKTOP_WEBUI_ENABLED_KEY = 'webui.desktop.enabled';
const DESKTOP_WEBUI_ALLOW_REMOTE_KEY = 'webui.desktop.allowRemote';
const DESKTOP_WEBUI_PORT_KEY = 'webui.desktop.port';

type WebuiLocalAccessPreferences = {
  enabled?: boolean;
  allowRemote?: boolean;
  port?: number;
};

/**
 * WebUI 服务层 - 封装所有 WebUI 相关的业务逻辑
 * WebUI Service Layer - Encapsulates all WebUI-related business logic
 */
// eslint-disable-next-line typescript-eslint/no-extraneous-class
export class WebuiService {
  private static webServerFunctionsLoaded = false;
  private static _getInitialAdminPassword: (() => string | null) | null = null;
  private static _clearInitialAdminPassword: (() => void) | null = null;

  /**
   * 加载 webserver 函数（避免循环依赖）
   * Load webserver functions (avoid circular dependency)
   */
  private static async loadWebServerFunctions(): Promise<void> {
    if (this.webServerFunctionsLoaded) return;

    const webServer = await import('@process/webserver/index');
    this._getInitialAdminPassword = webServer.getInitialAdminPassword;
    this._clearInitialAdminPassword = webServer.clearInitialAdminPassword;
    this.webServerFunctionsLoaded = true;
  }

  /**
   * 获取初始管理员密码
   * Get initial admin password
   */
  private static getInitialAdminPassword(): string | null {
    return this._getInitialAdminPassword?.() ?? null;
  }

  /**
   * 清除初始管理员密码
   * Clear initial admin password
   */
  private static clearInitialAdminPassword(): void {
    this._clearInitialAdminPassword?.();
  }

  /**
   * 获取局域网 IP 地址
   * Get LAN IP address
   */
  static getLanIP(): string | null {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      const netInfo = nets[name];
      if (!netInfo) continue;

      for (const net of netInfo) {
        // Node.js 18.4+ returns number (4/6), older versions return string ('IPv4'/'IPv6')
        const isIPv4 = net.family === 'IPv4' || (net.family as unknown) === 4;
        const isNotInternal = !net.internal;
        if (isIPv4 && isNotInternal) {
          return net.address;
        }
      }
    }
    return null;
  }

  /**
   * 统一的异步错误处理包装器
   * Unified async error handling wrapper
   */
  static async handleAsync<T>(
    handler: () => Promise<{ success: boolean; data?: T; msg?: string }>,
    context = 'Operation'
  ): Promise<{ success: boolean; data?: T; msg?: string }> {
    try {
      return await handler();
    } catch (error) {
      console.error(`[WebUI Service] ${context} error:`, error);
      return {
        success: false,
        msg: error instanceof Error ? error.message : `${context} failed`,
      };
    }
  }

  /**
   * 获取管理员用户（带自动加载）
   * Get admin user (with auto-loading)
   */
  static async getAdminUser() {
    await this.loadWebServerFunctions();
    const adminUser = await UserRepository.getSystemUser();
    if (!adminUser) {
      throw new Error('WebUI user not found');
    }
    return adminUser;
  }

  /**
   * 获取 WebUI 状态
   * Get WebUI status
   */
  static async getStatus(): Promise<IWebUIStatus> {
    await this.loadWebServerFunctions();

    const [adminUser, runtimeStatus] = await Promise.all([
      UserRepository.getSystemUser(),
      Promise.resolve(getHostBrowserEntryService().getRuntimeStatus()),
    ]);
    const localClientDemand = getHostBrowserEntryService().getDemandState('local-client');
    const running = runtimeStatus.running;
    const port = runtimeStatus.port ?? SERVER_CONFIG.DEFAULT_PORT;
    const allowRemote = runtimeStatus.allowRemote;

    const localUrl = runtimeStatus.localUrl ?? `http://localhost:${port}`;
    const lanIP = this.getLanIP();
    const networkUrl = runtimeStatus.networkUrl ?? (allowRemote && lanIP ? `http://${lanIP}:${port}` : undefined);

    return {
      running,
      port,
      allowRemote,
      localUrl,
      networkUrl,
      lanIP: lanIP ?? undefined,
      adminUsername: adminUser?.username ?? AUTH_CONFIG.DEFAULT_USER.USERNAME,
      initialPassword: this.getInitialAdminPassword() ?? undefined,
      localAccessEnabled: localClientDemand.active,
      localAccessAllowRemote: localClientDemand.allowRemote,
    };
  }

  static async updateLocalAccessPreferences(preferences: WebuiLocalAccessPreferences): Promise<void> {
    const writes: Array<Promise<unknown>> = [];

    if (typeof preferences.enabled === 'boolean') {
      writes.push(ProcessConfig.set(DESKTOP_WEBUI_ENABLED_KEY, preferences.enabled));
    }
    if (typeof preferences.allowRemote === 'boolean') {
      writes.push(ProcessConfig.set(DESKTOP_WEBUI_ALLOW_REMOTE_KEY, preferences.allowRemote));
    }
    if (typeof preferences.port === 'number' && Number.isFinite(preferences.port) && preferences.port > 0) {
      writes.push(ProcessConfig.set(DESKTOP_WEBUI_PORT_KEY, preferences.port));
    }

    await Promise.all(writes);
  }

  /**
   * 修改密码（不需要当前密码验证）
   * Change password (no current password verification required)
   */
  static async changePassword(newPassword: string): Promise<void> {
    const adminUser = await this.getAdminUser();

    // 验证新密码强度 / Validate new password strength
    const passwordValidation = AuthService.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors.join('; '));
    }

    // 更新密码（密文存储）/ Update password (encrypted storage)
    const newPasswordHash = await AuthService.hashPassword(newPassword);
    await UserRepository.updatePassword(adminUser.id, newPasswordHash);

    // 使所有现有 token 失效 / Invalidate all existing tokens
    await AuthService.invalidateAllTokens();

    // 清除初始密码（用户已修改密码）/ Clear initial password (user has changed password)
    this.clearInitialAdminPassword();
  }

  static async changeUsername(newUsername: string): Promise<string> {
    const adminUser = await this.getAdminUser();
    const normalizedUsername = newUsername.trim();

    const usernameValidation = AuthService.validateUsername(normalizedUsername);
    if (!usernameValidation.isValid) {
      throw new Error(usernameValidation.errors.join('; '));
    }

    const existingUser = await UserRepository.findByUsername(normalizedUsername);
    if (existingUser && existingUser.id !== adminUser.id) {
      throw new Error('Username already exists');
    }

    if (normalizedUsername === adminUser.username) {
      return adminUser.username;
    }

    await UserRepository.updateUsername(adminUser.id, normalizedUsername);
    await AuthService.invalidateAllTokens();

    return normalizedUsername;
  }

  /**
   * 重置密码（生成新的随机密码）
   * Reset password (generate new random password)
   */
  static async resetPassword(): Promise<string> {
    const adminUser = await this.getAdminUser();

    // 生成新的随机密码 / Generate new random password
    const newPassword = AuthService.generateRandomPassword();
    const newPasswordHash = await AuthService.hashPassword(newPassword);

    // 更新密码 / Update password
    await UserRepository.updatePassword(adminUser.id, newPasswordHash);

    // 使所有现有 token 失效 / Invalidate all existing tokens
    await AuthService.invalidateAllTokens();

    // 清除旧的初始密码 / Clear old initial password
    this.clearInitialAdminPassword();

    return newPassword;
  }
}

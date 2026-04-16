/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { webui } from '@/common/adapter/ipcBridge';
import { WebuiService } from './services/WebuiService';
import { generateQRLoginUrlDirect, verifyQRTokenDirect } from './webuiQR';
import { getHostBrowserEntryService } from '@process/services/host/HostBrowserEntryService';
import type { WebServerInstance } from '@process/webserver';

export { generateQRLoginUrlDirect, verifyQRTokenDirect };

/**
 * 设置 WebUI 服务器实例
 * Set WebUI server instance (called from webserver/index.ts)
 */
export function setWebServerInstance(instance: WebServerInstance | null): void {
  getHostBrowserEntryService().setCurrentInstanceForLegacy(instance);
}

/**
 * 获取 WebUI 服务器实例
 * Get WebUI server instance
 */
export function getWebServerInstance(): WebServerInstance | null {
  return getHostBrowserEntryService().getCurrentInstance();
}

/**
 * 初始化 WebUI IPC 桥接
 * Initialize WebUI IPC bridge
 */
export function initWebuiBridge(): void {
  getHostBrowserEntryService().setStatusChangedEmitter((status) => {
    webui.statusChanged.emit(status);
  });

  // 获取 WebUI 状态 / Get WebUI status
  webui.getStatus.provider(async () => {
    return WebuiService.handleAsync(async () => {
      const status = await WebuiService.getStatus();
      return { success: true, data: status };
    }, 'Get status');
  });

  webui.updatePreferences.provider(async ({ allowRemote, port }) => {
    return WebuiService.handleAsync(async () => {
      await WebuiService.updateLocalAccessPreferences({ allowRemote, port });
      const status = await WebuiService.getStatus();
      return { success: true, data: status };
    }, 'Update preferences');
  });

  // 启动 WebUI / Start WebUI
  webui.start.provider(async ({ port: requestedPort, allowRemote }) => {
    return WebuiService.handleAsync(async () => {
      const data = await WebuiService.startLocalAccess({
        port: requestedPort,
        allowRemote,
      });
      return { success: true, data };
    }, 'Start WebUI');
  });

  // 停止 WebUI / Stop WebUI
  webui.stop.provider(async () => {
    return WebuiService.handleAsync(async () => {
      await WebuiService.stopLocalAccess();
      return { success: true };
    }, 'Stop WebUI');
  });

  // 修改密码（不需要当前密码）/ Change password (no current password required)
  webui.changePassword.provider(async ({ newPassword }) => {
    return WebuiService.handleAsync(async () => {
      await WebuiService.changePassword(newPassword);
      return { success: true };
    }, 'Change password');
  });

  webui.changeUsername.provider(async ({ newUsername }) => {
    return WebuiService.handleAsync(async () => {
      const username = await WebuiService.changeUsername(newUsername);
      return { success: true, data: { username } };
    }, 'Change username');
  });

  // 重置密码（生成新随机密码）/ Reset password (generate new random password)
  // 注意：由于 @office-ai/platform bridge 的 provider 模式不支持返回值，
  // 我们通过 emitter 发送结果，前端监听 resetPasswordResult 事件
  // Note: Since @office-ai/platform bridge provider doesn't support return values,
  // we emit the result via emitter, frontend listens to resetPasswordResult event
  webui.resetPassword.provider(async () => {
    const result = await WebuiService.handleAsync(async () => {
      const newPassword = await WebuiService.resetPassword();
      return { success: true, data: { newPassword } };
    }, 'Reset password');

    // 通过 emitter 发送结果 / Emit result via emitter
    if (result.success && result.data) {
      webui.resetPasswordResult.emit({ success: true, newPassword: result.data.newPassword });
    } else {
      webui.resetPasswordResult.emit({ success: false, msg: result.msg });
    }

    return result;
  });

  // 生成二维码登录 token / Generate QR login token
  webui.generateQRToken.provider(async () => {
    const webServerInstance = getHostBrowserEntryService().getCurrentInstance();
    // 检查 webServerInstance 状态
    if (!webServerInstance) {
      return {
        success: false,
        msg: 'WebUI is not running. Please start WebUI first.',
      };
    }

    try {
      const { port, allowRemote } = webServerInstance;
      const { qrUrl, expiresAt } = generateQRLoginUrlDirect(port, allowRemote);
      // Extract token from QR URL
      const token = new URL(qrUrl).searchParams.get('token') ?? '';

      return {
        success: true,
        data: {
          token,
          expiresAt,
          qrUrl,
        },
      };
    } catch (error) {
      console.error('[WebUI Bridge] Generate QR token error:', error);
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Failed to generate QR token',
      };
    }
  });

  // 验证二维码 token / Verify QR token
  webui.verifyQRToken.provider(async ({ qrToken }) => {
    return verifyQRTokenDirect(qrToken);
  });
}

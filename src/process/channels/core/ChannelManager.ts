/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { BUILTIN_CHANNEL_TYPES, getBuiltinChannelBotName, isBuiltinChannelType } from '@/common/config/builtinChannels';
import { uuid } from '@/common/utils';
import { getDatabase } from '@process/services/database';
import { ExtensionRegistry } from '@process/extensions';
import { getChannelMessageService } from '../agent/ChannelMessageService';
import { ActionExecutor } from '../gateway/ActionExecutor';
import { PluginManager, registerPlugin } from '../gateway/PluginManager';
import { PairingService } from '../pairing/PairingService';
import type { IChannelAccount, IChannelPluginConfig, PluginType } from '../types';
import { getChannelRouteResolver } from './ChannelRouteResolver';
import { BUILTIN_CHANNEL_RUNTIME } from './builtinChannelRuntime';
import { SessionManager } from './SessionManager';

function createChannelAccountId(): string {
  return `chacct_${uuid(24)}`;
}

/**
 * ChannelManager - Main orchestrator for the Channel subsystem
 *
 * Singleton pattern - manages the lifecycle of all assistant components:
 * - PluginManager: Platform plugin lifecycle (Telegram, Slack, Discord)
 * - SessionManager: User session management
 * - PairingService: Secure pairing code generation and validation
 *
 * @example
 * ```typescript
 * // Initialize on app startup
 * await ChannelManager.getInstance().initialize();
 *
 * // Shutdown on app close
 * await ChannelManager.getInstance().shutdown();
 * ```
 */
export class ChannelManager {
  private static instance: ChannelManager | null = null;

  private initialized = false;
  private pluginManager: PluginManager | null = null;
  private sessionManager: SessionManager | null = null;
  private pairingService: PairingService | null = null;
  private actionExecutor: ActionExecutor | null = null;

  private constructor() {
    // Private constructor for singleton pattern
    // Register built-in plugins
    for (const type of BUILTIN_CHANNEL_TYPES) {
      registerPlugin(type, BUILTIN_CHANNEL_RUNTIME[type].pluginClass);
    }
  }

  /**
   * Get the singleton instance of ChannelManager
   */
  static getInstance(): ChannelManager {
    if (!ChannelManager.instance) {
      ChannelManager.instance = new ChannelManager();
    }
    return ChannelManager.instance;
  }

  /**
   * Initialize the assistant subsystem
   * Called during app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[ChannelManager] Initializing...');

    try {
      // Register extension-contributed channel plugins (from ExtensionRegistry)
      this.registerExtensionChannelPlugins();

      // Initialize sub-components
      this.pairingService = new PairingService();
      this.sessionManager = new SessionManager();
      this.pluginManager = new PluginManager(this.sessionManager);

      // Create action executor and wire up message handling
      this.actionExecutor = new ActionExecutor(this.pluginManager, this.sessionManager, this.pairingService);
      this.pluginManager.setMessageHandler(this.actionExecutor.getMessageHandler());

      // Set confirm handler for tool confirmations
      // 设置工具确认处理器
      this.pluginManager.setConfirmHandler(
        async ({ userId, platform, pluginId, chatId, conversationId, callId, value }) => {
          if (conversationId) {
            try {
              await getChannelMessageService().confirm(conversationId, callId, value);
            } catch (error) {
              console.error('[ChannelManager] Tool confirmation failed:', error);
            }
            return;
          }

          if (!chatId) {
            console.error(`[ChannelManager] Missing chatId for tool confirmation: ${userId}@${platform}`);
            return;
          }

          try {
            const route = await getChannelRouteResolver().resolveAuthorizedRoute({
              platform: platform as PluginType,
              pluginId,
              platformUserId: userId,
              chatId,
            });
            await this.sessionManager?.storeSession(route.session);
            await getChannelMessageService().confirm(route.conversation.id, callId, value);
          } catch (error) {
            console.error('[ChannelManager] Tool confirmation failed:', error);
          }
        }
      );

      // Load and start enabled plugins from database
      await this.loadEnabledPlugins();

      this.initialized = true;
      console.log('[ChannelManager] Initialized successfully');
    } catch (error) {
      console.error('[ChannelManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Shutdown the assistant subsystem
   * Called during app close
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    console.log('[ChannelManager] Shutting down...');

    try {
      // Stop all plugins
      await this.pluginManager?.stopAll();

      // Stop pairing service cleanup interval
      this.pairingService?.stop();

      // Shutdown Gemini service
      await getChannelMessageService().shutdown();

      // Cleanup
      this.pluginManager = null;
      this.sessionManager = null;
      this.pairingService = null;
      this.actionExecutor = null;

      this.initialized = false;
      console.log('[ChannelManager] Shutdown complete');
    } catch (error) {
      console.error('[ChannelManager] Shutdown error:', error);
    }
  }

  /**
   * Check if the assistant subsystem is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Load and start enabled plugins from database
   */
  private async loadEnabledPlugins(): Promise<void> {
    const db = await getDatabase();
    const result = db.getChannelPlugins();

    if (!result.success || !result.data) {
      console.warn('[ChannelManager] Failed to load plugins:', result.error);
      return;
    }

    const enabledPlugins = result.data.filter((p) => p.enabled);
    const builtinStartableTypes = new Set<PluginType>(BUILTIN_CHANNEL_TYPES);
    const extensionRegistry = ExtensionRegistry.getInstance();

    for (const plugin of enabledPlugins) {
      const isBuiltinStartable = builtinStartableTypes.has(plugin.type);
      const hasExtensionPlugin = !!extensionRegistry.getChannelPluginMeta(plugin.type);
      const canStartInCurrentRuntime = isBuiltinStartable || hasExtensionPlugin;

      if (!canStartInCurrentRuntime) {
        console.warn(
          `[ChannelManager] Auto-disabling stale plugin ${plugin.id} (type=${plugin.type}) because it is not available in current runtime`
        );
        const nextConfig: IChannelPluginConfig = {
          ...plugin,
          enabled: false,
          status: 'stopped',
          updatedAt: Date.now(),
        };
        db.upsertChannelPlugin(nextConfig);
        continue;
      }

      try {
        await this.startPlugin(plugin);
      } catch (error) {
        console.error(`[ChannelManager] Failed to start plugin ${plugin.id}:`, error);
        // Update status to error
        db.updateChannelPluginStatus(plugin.id, 'error');
      }
    }
  }

  /**
   * Start a specific plugin
   */
  private async startPlugin(config: IChannelPluginConfig): Promise<void> {
    if (!this.pluginManager) {
      throw new Error('PluginManager not initialized');
    }
    await this.pluginManager.startPlugin(config);
  }

  async createChannelAccount(params: {
    platform: PluginType;
    name: string;
  }): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
    const db = await getDatabase();
    const now = Date.now();
    const accountId = createChannelAccountId();

    const result = db.upsertChannelAccount({
      id: accountId,
      platform: params.platform,
      name: params.name,
      enabled: false,
      status: 'stopped',
      legacyPluginId: accountId,
      createdAt: now,
      updatedAt: now,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: { id: accountId } };
  }

  private resolveChannelAccountFromRuntimeId(
    db: Awaited<ReturnType<typeof getDatabase>>,
    pluginId: string
  ): IChannelAccount | null {
    const direct = db.getChannelAccount(pluginId);
    if (direct.success && direct.data) {
      return direct.data;
    }

    const legacy = db.getChannelAccountByLegacyPluginId(pluginId);
    if (legacy.success && legacy.data) {
      return legacy.data;
    }

    return null;
  }

  /**
   * Enable and start a plugin.
   * Supports both built-in plugins and extension-contributed plugins.
   * For extension plugins, fields are extracted from manifest metadata.
   */
  async enablePlugin(pluginId: string, config: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    // Ensure manager is initialized
    if (!this.initialized || !this.pluginManager) {
      console.error('[ChannelManager] Cannot enable plugin: manager not initialized');
      return { success: false, error: 'Assistant manager not initialized' };
    }

    const db = await getDatabase();

    // Get existing plugin or create new one
    const existingResult = db.getChannelPlugin(pluginId);
    const existing = existingResult.data;
    const channelAccount = this.resolveChannelAccountFromRuntimeId(db, pluginId);
    const pluginType = (channelAccount?.platform ?? existing?.type ?? this.getPluginTypeFromId(pluginId)) as PluginType;
    let credentials = existing?.credentials;
    let pluginRuntimeConfig = existing?.config ? { ...existing.config } : {};

    if (isBuiltinChannelType(pluginType)) {
      const builtinResult = BUILTIN_CHANNEL_RUNTIME[pluginType].buildEnableResult(
        config,
        existing?.credentials,
        existing?.config
      );
      credentials = builtinResult.credentials;
      pluginRuntimeConfig = builtinResult.config;
    } else {
      // Extension or unknown plugin type:
      // - prefer manifest-declared credential/config fields
      // - preserve primitive types (string/number/boolean)
      const registry = ExtensionRegistry.getInstance();
      const meta = registry.getChannelPluginMeta(pluginType) as
        | {
            credentialFields?: Array<{ key: string }>;
            configFields?: Array<{ key: string }>;
          }
        | undefined;

      const nextCredentials: Record<string, string | number | boolean | undefined> = {
        ...credentials,
      };
      const nextRuntimeConfig: Record<string, string | number | boolean | undefined> = {
        ...pluginRuntimeConfig,
      };

      const primitiveEntries = Object.entries(config).filter(([, value]) => {
        const t = typeof value;
        return t === 'string' || t === 'number' || t === 'boolean';
      }) as Array<[string, string | number | boolean]>;

      const credentialKeys = new Set((meta?.credentialFields || []).map((f) => f.key));
      const configKeys = new Set((meta?.configFields || []).map((f) => f.key));

      if (credentialKeys.size === 0 && configKeys.size === 0) {
        // Legacy fallback: string values are credentials, non-strings go to config
        for (const [key, value] of primitiveEntries) {
          if (typeof value === 'string') {
            nextCredentials[key] = value;
          } else {
            nextRuntimeConfig[key] = value;
          }
        }
      } else {
        for (const [key, value] of primitiveEntries) {
          if (credentialKeys.has(key)) {
            nextCredentials[key] = value;
            continue;
          }
          if (configKeys.has(key)) {
            nextRuntimeConfig[key] = value;
            continue;
          }
          // Unknown field fallback: keep as runtime config to avoid losing data.
          nextRuntimeConfig[key] = value;
        }
      }

      credentials = nextCredentials;
      pluginRuntimeConfig = nextRuntimeConfig;
    }

    const pluginConfig: IChannelPluginConfig = {
      id: pluginId,
      type: pluginType,
      name: existing?.name || channelAccount?.name || this.getPluginNameFromType(pluginType),
      enabled: true,
      credentials,
      config: pluginRuntimeConfig,
      status: 'created',
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    const saveResult = db.upsertChannelPlugin(pluginConfig);
    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }

    try {
      await this.startPlugin(pluginConfig);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Disable and stop a plugin
   */
  async disablePlugin(pluginId: string): Promise<{ success: boolean; error?: string }> {
    const db = await getDatabase();

    try {
      // Stop the plugin
      await this.pluginManager?.stopPlugin(pluginId);

      // Update database
      const existingResult = db.getChannelPlugin(pluginId);
      if (existingResult.data) {
        const updated: IChannelPluginConfig = {
          ...existingResult.data,
          enabled: false,
          status: 'stopped',
          updatedAt: Date.now(),
        };
        db.upsertChannelPlugin(updated);
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Test a plugin connection without enabling it.
   * For extension plugins that don't have a static testConnection method,
   * returns a generic "not supported" response.
   */
  async testPlugin(
    pluginId: string,
    token: string,
    extraConfig?: Record<string, string | boolean | undefined>
  ): Promise<{ success: boolean; botUsername?: string; error?: string }> {
    const db = await getDatabase();
    const channelAccount = this.resolveChannelAccountFromRuntimeId(db, pluginId);
    const pluginType = channelAccount?.platform ?? this.getPluginTypeFromId(pluginId);

    if (isBuiltinChannelType(pluginType)) {
      const runtime = BUILTIN_CHANNEL_RUNTIME[pluginType];
      if (runtime.testConnection) {
        return await runtime.testConnection(token, extraConfig);
      }
    }

    // Extension plugins: test connection not supported yet (will be handled by the plugin itself on start)
    return { success: true, botUsername: undefined, error: undefined };
  }

  /**
   * Get plugin type from plugin ID.
   * For built-in plugins, derives from ID prefix. For others, returns the ID as type.
   */
  private getPluginTypeFromId(pluginId: string): PluginType {
    return pluginId;
  }

  /**
   * Get plugin name from channel type.
   * For extension plugins, tries to look up display name from registry.
   */
  private getPluginNameFromType(pluginType: PluginType): string {
    if (isBuiltinChannelType(pluginType)) {
      return getBuiltinChannelBotName(pluginType);
    }

    try {
      const registry = ExtensionRegistry.getInstance();
      const meta = registry.getChannelPluginMeta(pluginType);
      if (meta && typeof meta === 'object' && 'name' in meta) {
        return (meta as { name: string }).name;
      }
    } catch {
      // Registry may not be initialized, fall through
    }

    return pluginType.charAt(0).toUpperCase() + pluginType.slice(1) + ' Bot';
  }

  // ==================== Extension Channel Plugin Registration ====================

  /**
   * Register extension-contributed channel plugins into the plugin registry.
   * Called once during initialization after ExtensionRegistry is ready.
   * This is a synchronous, non-blocking operation (plugins are already loaded).
   */
  private registerExtensionChannelPlugins(): void {
    try {
      const registry = ExtensionRegistry.getInstance();
      const extPlugins = registry.getChannelPlugins();
      if (extPlugins.size === 0) return;

      for (const [type, entry] of extPlugins) {
        const Constructor = entry.constructor as new () => InstanceType<
          typeof import('../plugins/BasePlugin').BasePlugin
        >;
        registerPlugin(type as PluginType, Constructor as any);
        console.log(`[ChannelManager] Registered extension channel plugin: ${type}`);
      }
    } catch (error) {
      console.warn('[ChannelManager] Failed to register extension channel plugins:', error);
    }
  }

  // ==================== Conversation Cleanup ====================

  /**
   * Cleanup resources when a conversation is deleted
   * Called when a non-ContextGoUI conversation (e.g., telegram) is deleted
   *
   * 当会话被删除时清理相关资源（用于 telegram 等非 ContextGoUI 来源的会话）
   *
   * @param conversationId - The ID of the conversation being deleted
   * @returns true if cleanup was performed, false if no resources to clean
   */
  async cleanupConversation(conversationId: string): Promise<boolean> {
    if (!this.initialized) {
      console.warn('[ChannelManager] Not initialized, skipping cleanup');
      return false;
    }

    let cleanedUp = false;

    // 1. Clear session associated with this conversation
    const clearedSession = await this.sessionManager?.clearSessionByConversationId(conversationId);
    if (clearedSession) {
      cleanedUp = true;

      // 2. Clear AssistantGeminiService agent cache for this session
      try {
        const geminiService = getChannelMessageService();
        await geminiService.clearContext(clearedSession.id);
      } catch (error) {
        console.warn(`[ChannelManager] Failed to clear Gemini context:`, error);
      }
    }

    return cleanedUp;
  }

  // ==================== Accessors ====================

  getPluginManager(): PluginManager | null {
    return this.pluginManager;
  }

  getSessionManager(): SessionManager | null {
    return this.sessionManager;
  }

  getPairingService(): PairingService | null {
    return this.pairingService;
  }

  getActionExecutor(): ActionExecutor | null {
    return this.actionExecutor;
  }
}

// Export singleton getter for convenience
export function getChannelManager(): ChannelManager {
  return ChannelManager.getInstance();
}

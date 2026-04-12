/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TelemetryTarget, GeminiCLIExtension, SkillDefinition } from '@office-ai/aioncli-core';
import {
  ApprovalMode,
  Config,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_MEMORY_FILE_FILTERING_OPTIONS,
  FileDiscoveryService,
  getCurrentGeminiMdFilename,
  loadServerHierarchicalMemory,
  setGeminiMdFilename as setServerGeminiMdFilename,
  SimpleExtensionLoader,
  PREVIEW_GEMINI_MODEL_AUTO,
  loadSkillsFromDir,
} from '@office-ai/aioncli-core';
import process from 'node:process';
import path from 'node:path';
import type { Settings } from './settings';
import { annotateActiveExtensions } from './extension';

export interface CliArgs {
  model: string | undefined;
  sandbox: boolean | string | undefined;
  sandboxImage: string | undefined;
  debug: boolean | undefined;
  prompt: string | undefined;
  promptInteractive: string | undefined;
  allFiles: boolean | undefined;
  all_files: boolean | undefined;
  showMemoryUsage: boolean | undefined;
  show_memory_usage: boolean | undefined;
  yolo: boolean | undefined;
  telemetry: boolean | undefined;
  checkpointing: boolean | undefined;
  telemetryTarget: string | undefined;
  telemetryOtlpEndpoint: string | undefined;
  telemetryLogPrompts: boolean | undefined;
  telemetryOutfile: string | undefined;
  allowedMcpServerNames: string[] | undefined;
  experimentalAcp: boolean | undefined;
  extensions: string[] | undefined;
  listExtensions: boolean | undefined;
  ideModeFeature: boolean | undefined;
  openaiLogging: boolean | undefined;
  openaiApiKey: string | undefined;
  openaiBaseUrl: string | undefined;
  proxy: string | undefined;
  includeDirectories: string[] | undefined;
}

import type { ConversationToolConfig } from './tools/conversation-tool-config';

export interface LoadCliConfigOptions {
  workspace: string;
  settings: Settings;
  extensions: GeminiCLIExtension[];
  sessionId: string;
  proxy?: string;
  model?: string;
  conversationToolConfig: ConversationToolConfig;
  yoloMode?: boolean;
  /** 内置 skills 目录路径 / Builtin skills directory path */
  skillsDir?: string;
  /** 启用的 skills 列表，用于过滤加载的 skills / Enabled skills list for filtering loaded skills */
  enabledSkills?: string[];
}

export async function loadCliConfig({
  workspace,
  settings,
  extensions,
  sessionId,
  proxy,
  model,
  conversationToolConfig,
  yoloMode,
  skillsDir,
  enabledSkills,
}: LoadCliConfigOptions): Promise<Config> {
  const argv: Partial<CliArgs> = {
    yolo: yoloMode,
  };

  // Map 'auto' to the correct aioncli-core model alias
  // aioncli-core expects 'auto-gemini-3' or 'auto-gemini-2.5', not plain 'auto'
  // Config internally calls resolveModel(model, getGemini31LaunchedSync()) to resolve to gemini-3.1-pro-preview
  // 将 'auto' 映射到正确的 aioncli-core 模型别名
  // aioncli-core 需要 'auto-gemini-3' 或 'auto-gemini-2.5'，而不是纯 'auto'
  // Config 内部会调用 resolveModel(model, getGemini31LaunchedSync()) 解析为 gemini-3.1-pro-preview
  const resolvedModel = model === 'auto' ? PREVIEW_GEMINI_MODEL_AUTO : model;

  const debugMode =
    argv.debug || [process.env.DEBUG, process.env.DEBUG_MODE].some((v) => v === 'true' || v === '1') || false;
  const memoryImportFormat = settings.memoryImportFormat || 'tree';
  const ideMode = settings.ideMode ?? false;

  const _ideModeFeature = (argv.ideModeFeature ?? settings.ideModeFeature ?? false) && !process.env.SANDBOX;

  // 加载内置 skills 并创建虚拟 extension
  // Load builtin skills and create a virtual extension
  // 仅在指定 enabledSkills 时加载，非 preset agent 不加载任何可选 skills
  // Only load when enabledSkills is specified; non-preset agents get no optional skills
  let builtinSkills: SkillDefinition[] = [];
  if (skillsDir && enabledSkills && enabledSkills.length > 0) {
    try {
      // Load skills from both top-level and _builtin/ subdirectory
      // loadSkillsFromDir only scans direct children, so _builtin/schedule is not found by default
      const topLevelSkills = await loadSkillsFromDir(skillsDir);
      const builtinDir = path.join(skillsDir, '_builtin');
      let builtinDirSkills: SkillDefinition[] = [];
      try {
        builtinDirSkills = await loadSkillsFromDir(builtinDir);
      } catch (e) {
        // Only ignore "not found" errors; warn on unexpected failures
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(`[Config] Failed to load skills from ${builtinDir}:`, e);
        }
      }
      const allSkills = [...topLevelSkills, ...builtinDirSkills];
      const enabledSet = new Set(enabledSkills);
      const originalCount = allSkills.length;
      builtinSkills = allSkills.filter((skill) => enabledSet.has(skill.name));
      console.log(
        `[Config] Filtered skills: ${builtinSkills.length}/${originalCount} enabled (${enabledSkills.join(', ')})`
      );
    } catch (error) {
      console.warn(`[Config] Failed to load builtin skills from ${skillsDir}:`, error);
    }
  }

  // 创建虚拟 extension 来承载内置 skills
  // Create a virtual extension to hold builtin skills
  const builtinSkillsExtension: GeminiCLIExtension = {
    name: 'contextgo-builtin-skills',
    version: '1.0.0',
    isActive: true,
    path: skillsDir || '',
    contextFiles: [],
    id: 'contextgo-builtin-skills',
    skills: builtinSkills,
  };

  const allExtensions = annotateActiveExtensions([builtinSkillsExtension, ...extensions], argv.extensions || []);
  const activeExtensions = allExtensions.filter((ext) => ext.isActive);
  // Handle OpenAI API key from command line
  if (argv.openaiApiKey) {
    process.env.OPENAI_API_KEY = argv.openaiApiKey;
  }

  // Handle OpenAI base URL from command line
  if (argv.openaiBaseUrl) {
    process.env.OPENAI_BASE_URL = argv.openaiBaseUrl;
  }

  // Set the context filename in the server's memoryTool module BEFORE loading memory
  // TODO(b/343434939): This is a bit of a hack. The contextFileName should ideally be passed
  // directly to the Config constructor in core, and have core handle setGeminiMdFilename.
  // However, loadHierarchicalGeminiMemory is called *before* createServerConfig.
  if (settings.contextFileName) {
    setServerGeminiMdFilename(settings.contextFileName);
  } else {
    // Reset to default if not provided in settings.
    setServerGeminiMdFilename(getCurrentGeminiMdFilename());
  }

  const fileService = new FileDiscoveryService(workspace);

  const fileFiltering = {
    ...DEFAULT_MEMORY_FILE_FILTERING_OPTIONS,
    ...settings.fileFiltering,
  };

  // 直接使用 aioncli-core 的 loadServerHierarchicalMemory，传入 ExtensionLoader
  // Directly use aioncli-core's loadServerHierarchicalMemory with ExtensionLoader
  const extensionLoader = new SimpleExtensionLoader(allExtensions);
  const folderTrust = true; // 默认信任工作区 / Default to trusting the workspace
  const { memoryContent, fileCount } = await loadServerHierarchicalMemory(
    workspace,
    [],
    debugMode,
    fileService,
    extensionLoader,
    folderTrust,
    memoryImportFormat,
    fileFiltering,
    settings.memoryDiscoveryMaxDirs
  );

  // 使用对话级别的工具配置
  const toolConfig = conversationToolConfig.getConfig();
  const excludeTools = mergeExcludeTools(settings, activeExtensions).concat(toolConfig.excludeTools);

  // extensionLoader 已在上方创建，复用于 Config 初始化
  // extensionLoader was created above, reuse for Config initialization

  const config = new Config({
    sessionId,
    embeddingModel: DEFAULT_GEMINI_EMBEDDING_MODEL,
    // sandbox: sandboxConfig,
    targetDir: workspace,
    includeDirectories: argv.includeDirectories,
    debugMode,
    question: argv.promptInteractive || argv.prompt || '',
    // fullContext 参数在 aioncli-core v0.18.4 中已移除 / parameter was removed in aioncli-core v0.18.4
    coreTools: settings.coreTools || undefined,
    excludeTools,
    toolDiscoveryCommand: settings.toolDiscoveryCommand,
    toolCallCommand: settings.toolCallCommand,
    mcpServerCommand: undefined,
    mcpServers: {},
    userMemory: memoryContent,
    geminiMdFileCount: fileCount,
    approvalMode: argv.yolo || false ? ApprovalMode.YOLO : ApprovalMode.DEFAULT,
    // ContextGo 是桌面应用，支持用户交互确认，需要设置 interactive: true
    // ContextGo is a desktop app with user interaction support, needs interactive: true
    interactive: true,
    showMemoryUsage: argv.showMemoryUsage || argv.show_memory_usage || settings.showMemoryUsage || false,
    accessibility: settings.accessibility,
    telemetry: {
      enabled: argv.telemetry ?? settings.telemetry?.enabled,
      target: (argv.telemetryTarget ?? settings.telemetry?.target) as TelemetryTarget,
      otlpEndpoint:
        argv.telemetryOtlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? settings.telemetry?.otlpEndpoint,
      logPrompts: argv.telemetryLogPrompts ?? settings.telemetry?.logPrompts,
      outfile: argv.telemetryOutfile ?? settings.telemetry?.outfile,
    },
    usageStatisticsEnabled: settings.usageStatisticsEnabled ?? true,
    // Git-aware file filtering settings
    fileFiltering: {
      respectGitIgnore: settings.fileFiltering?.respectGitIgnore,
      respectGeminiIgnore: settings.fileFiltering?.respectGeminiIgnore,
      enableRecursiveFileSearch: settings.fileFiltering?.enableRecursiveFileSearch,
    },
    checkpointing: argv.checkpointing || settings.checkpointing?.enabled,
    proxy: proxy,
    cwd: workspace,
    fileDiscoveryService: fileService,
    bugCommand: settings.bugCommand,
    model: resolvedModel || DEFAULT_GEMINI_MODEL,
    // 使用 extensionLoader 替代已废弃的 extensionContextFilePaths 和 extensions 参数
    // Use extensionLoader instead of deprecated extensionContextFilePaths and extensions parameters
    extensionLoader,
    maxSessionTurns: settings.maxSessionTurns ?? -1,
    listExtensions: argv.listExtensions || false,
    noBrowser: !!process.env.NO_BROWSER,
    summarizeToolOutput: settings.summarizeToolOutput,
    ideMode,
    // Enable native SkillManager for workspace-based skill discovery
    // Skills are symlinked into workspace .gemini/skills/ by setupAssistantWorkspace()
    // Native activate_skill tool handles: body injection + folder structure + directory permission
    skillsSupport: true,
    // 启用 fetch 错误重试，处理 "exception TypeError: fetch failed sending request" 错误
    // Enable retry on fetch errors to handle "exception TypeError: fetch failed sending request"
    // 这通常是由网络不稳定或代理问题导致的临时错误
    // This is usually a transient error caused by network instability or proxy issues
    retryFetchErrors: true,
  });

  return config;
}
function mergeExcludeTools(settings: Settings, extensions: GeminiCLIExtension[]): string[] {
  const allExcludeTools = new Set(settings.excludeTools || []);
  for (const extension of extensions) {
    for (const tool of extension.excludeTools || []) {
      allExcludeTools.add(tool);
    }
  }
  return [...allExcludeTools];
}

/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ICreateConversationParams } from '@/common/adapter/ipcBridge';
import type {
  GroupParticipant,
  GroupOrchestration,
  TChatConversation,
  TProviderWithModel,
  WorkflowGroupRunState,
} from '@/common/config/storage';
import type { PresetAgentType } from '@/common/types/acpTypes';
import { resolveBuiltinAssistantWorkspaceSkillNames } from '@/common/config/presets/builtinAssistantDefaults';
import { resolveBundledAgentPackageSourceRelativeRoots } from '@/common/config/presets/bundledAgentPackageRegistry';
import { getPlatformServices } from '@/common/platform';
import { uuid } from '@/common/utils';
import fs from 'fs/promises';
import path from 'path';
import { getAutoSkillsDir, getSkillsDir, getBuiltinSkillsCopyDir, getSystemDir } from './initStorage';
import { discoverSkillDirectories, resolveSkillDirectory } from './skillDiscovery';

/**
 * Agent 类型/backend 到原生 skills 目录的映射
 * Mapping from agent type/backend to native skills directory
 *
 * 只有在此映射中的 CLI 才支持原生 skill 发现（CLI 自动扫描目录中的 SKILL.md）
 * Only CLIs listed here support native skill discovery (CLI auto-scans directory for SKILL.md)
 *
 * 不在此映射中的 backend 将 fallback 到首条消息注入（prompt injection）方案
 * Backends NOT in this map will fallback to first-message injection (prompt injection)
 */
const AGENT_SKILLS_DIRS: Record<string, string[]> = {
  // Verified native skill discovery support:
  gemini: ['.gemini/skills'],
  claude: ['.claude/skills'],
  codex: ['.codex/skills'],
  opencode: ['.opencode/skills'],
};

const AGENT_INSTRUCTION_FILES: Partial<Record<string, string>> = {
  claude: 'CLAUDE.md',
  gemini: 'GEMINI.md',
};

const WORKSPACE_MANAGED_SKILLS_DIR = path.join('.contextgo', 'skills');
const WORKSPACE_CONNECTOR_SKILLS_DIR = path.join('.connector', 'skills');

const getWorkspaceManagedSkillsDir = (workspace: string): string => path.join(workspace, WORKSPACE_MANAGED_SKILLS_DIR);
const getWorkspaceConnectorSkillsDir = (workspace: string): string =>
  path.join(workspace, WORKSPACE_CONNECTOR_SKILLS_DIR);

type RuntimeSkillsProjectionMode = 'shared-dir' | 'per-skill';

const resolveBundledResourcePath = (resourcePath: string): string => {
  const platform = getPlatformServices().paths;
  const appPath = platform.getAppPath() || process.cwd();
  const resourcesPrefix = 'src/process/resources/';

  if (platform.isPackaged()) {
    const prodPath = resourcePath.startsWith(resourcesPrefix)
      ? resourcePath.slice(resourcesPrefix.length)
      : resourcePath;
    return path.join(appPath, prodPath);
  }

  return path.join(appPath, resourcePath);
};

const ensureRuntimeSkillsProjection = async (
  workspace: string,
  runtimeSkillsRelDir: string,
  managedSkillsDir: string
): Promise<RuntimeSkillsProjectionMode> => {
  const runtimeSkillsDir = path.join(workspace, runtimeSkillsRelDir);
  const runtimeRootDir = path.dirname(runtimeSkillsDir);

  await fs.mkdir(runtimeRootDir, { recursive: true });

  try {
    const stat = await fs.lstat(runtimeSkillsDir);
    return typeof stat.isSymbolicLink === 'function' && stat.isSymbolicLink() ? 'shared-dir' : 'per-skill';
  } catch {
    await fs.symlink(managedSkillsDir, runtimeSkillsDir, 'junction');
    console.log(`[setupAssistantWorkspace] Linked runtime skills dir: ${runtimeSkillsDir} -> ${managedSkillsDir}`);
    return 'shared-dir';
  }
};

const ensureManagedSkillLink = async (
  sourceSkillDir: string,
  managedSkillDir: string,
  skillName: string
): Promise<boolean> => {
  try {
    await fs.stat(sourceSkillDir);
  } catch {
    console.warn(`[setupAssistantWorkspace] Skill directory not found: ${sourceSkillDir}`);
    return false;
  }

  try {
    await fs.lstat(managedSkillDir);
  } catch {
    await fs.symlink(sourceSkillDir, managedSkillDir, 'junction');
    console.log(`[setupAssistantWorkspace] Managed skill: ${skillName} -> ${managedSkillDir}`);
  }

  return true;
};

const ensureRuntimeSkillProjection = async (
  workspace: string,
  runtimeSkillsRelDir: string,
  managedSkillDir: string,
  skillName: string,
  projectionMode: RuntimeSkillsProjectionMode
): Promise<void> => {
  if (projectionMode !== 'per-skill') {
    return;
  }

  const runtimeSkillDir = path.join(workspace, runtimeSkillsRelDir, skillName);
  try {
    await fs.lstat(runtimeSkillDir);
  } catch {
    await fs.symlink(managedSkillDir, runtimeSkillDir, 'junction');
    console.log(`[setupAssistantWorkspace] Projected skill: ${skillName} -> ${runtimeSkillDir}`);
  }
};

const ensureWorkspaceSkill = async (
  workspace: string,
  skillName: string,
  sourceSkillDir: string,
  managedSkillsDir: string,
  skillsDirs: string[],
  projectionModes: Map<string, RuntimeSkillsProjectionMode>
): Promise<void> => {
  const managedSkillDir = path.join(managedSkillsDir, skillName);
  const linked = await ensureManagedSkillLink(sourceSkillDir, managedSkillDir, skillName);
  if (!linked) {
    return;
  }

  for (const skillsRelDir of skillsDirs) {
    await ensureRuntimeSkillProjection(
      workspace,
      skillsRelDir,
      managedSkillDir,
      skillName,
      projectionModes.get(skillsRelDir) ?? 'shared-dir'
    );
  }
};

/**
 * 为 assistant 设置 workspace skill 结构
 * Set up workspace skill structure for assistant
 *
 * `.contextgo/skills` 是项目内统一管理入口，CLI 原生目录只做投影
 * `.contextgo/skills` is the project-level source of truth, native CLI dirs are projections only
 *
 * 默认仅在 temp workspace 执行；显式启用 nativeWorkspaceBootstrap 时也会初始化用户项目目录
 * By default this only runs for temp workspaces; nativeWorkspaceBootstrap can opt in for user workspaces
 *
 * 注意：Rules/人格设定通过 system prompt 注入，不写 context file
 * Note: Rules/personality are injected via system prompt, NOT written to context files
 */
/**
 * Check if a given agent type/backend supports native skill discovery.
 * When false, callers should fallback to prompt injection for skills.
 */
export function hasNativeSkillSupport(agentTypeOrBackend: string | undefined): boolean {
  return !!agentTypeOrBackend && agentTypeOrBackend in AGENT_SKILLS_DIRS;
}

export async function setupAssistantWorkspace(
  workspace: string,
  options: {
    agentType?: PresetAgentType | string;
    backend?: string;
    enabledSkills?: string[];
    presetAssistantId?: string;
  }
): Promise<void> {
  // Determine skills directories based on agent type or backend
  const key = options.backend || options.agentType || '';
  const skillsDirs = AGENT_SKILLS_DIRS[key];

  // If no native skill directory is known for this CLI, skip symlink setup.
  // The caller should use prompt injection as fallback.
  if (!skillsDirs) return;

  const userSkillsDir = getSkillsDir();
  const autoSkillsDir = getAutoSkillsDir();
  const managedSkillsDir = getWorkspaceManagedSkillsDir(workspace);

  await fs.mkdir(managedSkillsDir, { recursive: true });

  const projectionModes = new Map<string, RuntimeSkillsProjectionMode>();
  for (const skillsRelDir of skillsDirs) {
    projectionModes.set(skillsRelDir, await ensureRuntimeSkillsProjection(workspace, skillsRelDir, managedSkillsDir));
  }

  const skillSources = new Map<string, string>();
  const autoSkillEntries = await fs
    .readdir(autoSkillsDir, { withFileTypes: true })
    .catch((): Array<{ name: string; isDirectory: () => boolean }> => []);
  for (const entry of autoSkillEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    skillSources.set(entry.name, path.join(autoSkillsDir, entry.name));
  }

  const manifestSkillRoots = options.presetAssistantId
    ? resolveBundledAgentPackageSourceRelativeRoots(options.presetAssistantId, 'skills')
    : [];
  const presetSkillRoots = manifestSkillRoots;

  for (const presetSkillRoot of presetSkillRoots) {
    const absoluteRoot = resolveBundledResourcePath(presetSkillRoot);
    const presetSkills: Awaited<ReturnType<typeof discoverSkillDirectories>> = await discoverSkillDirectories(
      absoluteRoot
    ).catch((): Awaited<ReturnType<typeof discoverSkillDirectories>> => []);
    for (const skill of presetSkills) {
      skillSources.set(skill.name, skill.dirPath);
    }
  }

  const workspaceBootstrapSkillNames = options.presetAssistantId
    ? resolveBuiltinAssistantWorkspaceSkillNames(options.presetAssistantId, options.enabledSkills)
    : options.enabledSkills;

  const workspaceConnectorSkillsRoot = getWorkspaceConnectorSkillsDir(workspace);
  const workspaceConnectorSkills = await discoverSkillDirectories(workspaceConnectorSkillsRoot).catch(
    (): Awaited<ReturnType<typeof discoverSkillDirectories>> => []
  );
  for (const skill of workspaceConnectorSkills) {
    if (!skillSources.has(skill.name)) {
      skillSources.set(skill.name, skill.dirPath);
    }
  }

  for (const skillName of workspaceBootstrapSkillNames ?? []) {
    if (skillSources.has(skillName)) {
      continue;
    }

    // Try bundled skills first, then user skills. Both roots support nested skill packs.
    const builtinCandidate = await resolveSkillDirectory(getBuiltinSkillsCopyDir(), skillName, {
      excludeTopLevelNames: ['_builtin'],
    });
    const userCandidate = await resolveSkillDirectory(userSkillsDir, skillName);
    skillSources.set(
      skillName,
      builtinCandidate?.dirPath || userCandidate?.dirPath || path.join(userSkillsDir, skillName)
    );
  }

  for (const [skillName, sourceSkillDir] of skillSources) {
    await ensureWorkspaceSkill(workspace, skillName, sourceSkillDir, managedSkillsDir, skillsDirs, projectionModes);
  }

  // Runtime instruction projections:
  // - AGENTS.md is the canonical project entry file (ContextGo-owned).
  // - CLAUDE.md / GEMINI.md are runtime-native convention files and must remain derived.
  // We only project when AGENTS.md exists to avoid clobbering legacy workspaces that
  // haven't adopted the canonical entry point yet.
  const instructionFile = AGENT_INSTRUCTION_FILES[key];
  if (instructionFile) {
    const agentsPath = path.join(workspace, 'AGENTS.md');
    try {
      const agentsContent = await fs.readFile(agentsPath, 'utf-8');
      const targetPath = path.join(workspace, instructionFile);

      const header =
        `<!--\n` +
        `  Generated by ContextGo.\n` +
        `  Source of truth: AGENTS.md\n` +
        `  Do not edit this file directly.\n` +
        `-->\n\n`;

      // Always overwrite: this is a projection, not an editable source.
      await fs.writeFile(targetPath, header + agentsContent, 'utf-8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      // Missing AGENTS.md is expected for some workspaces; skip projection quietly.
      if (code !== 'ENOENT') {
        console.warn('[setupAssistantWorkspace] Failed to project AGENTS.md instruction file:', error);
      }
    }
  }
}

export async function ensureConversationWorkspaceBootstrap(conversation: TChatConversation): Promise<void> {
  const extra = conversation.extra as
    | {
        workspace?: string;
        workingDirectory?: string;
        customWorkspace?: boolean;
        nativeWorkspaceBootstrap?: boolean;
        enabledSkills?: string[];
        backend?: string;
        presetAssistantId?: string;
      }
    | undefined;

  const workspace = extra?.workingDirectory || extra?.workspace;
  if (!workspace) {
    return;
  }

  const shouldSetupNativeWorkspace = !extra?.customWorkspace || extra?.nativeWorkspaceBootstrap === true;
  if (!shouldSetupNativeWorkspace) {
    return;
  }

  switch (conversation.type) {
    case 'gemini':
      await setupAssistantWorkspace(workspace, {
        agentType: 'gemini',
        enabledSkills: extra?.enabledSkills,
        presetAssistantId: extra?.presetAssistantId,
      });
      return;
    case 'acp':
      await setupAssistantWorkspace(workspace, {
        backend: extra?.backend,
        enabledSkills: extra?.enabledSkills,
        presetAssistantId: extra?.presetAssistantId,
      });
      return;
    case 'codex':
      await setupAssistantWorkspace(workspace, {
        agentType: 'codex',
        enabledSkills: extra?.enabledSkills,
        presetAssistantId: extra?.presetAssistantId,
      });
      return;
    default:
      return;
  }
}

/**
 * 创建工作空间目录（不复制文件）
 * Create workspace directory (without copying files)
 *
 * 注意：文件复制统一由 sendMessage 时的 copyFilesToDirectory 处理
 * 避免文件被复制两次（一次在创建会话时，一次在发送消息时）
 * Note: File copying is handled by copyFilesToDirectory in sendMessage
 * This avoids files being copied twice
 */
const buildWorkspaceWidthFiles = async (
  defaultWorkspaceName: string,
  workspace?: string,
  _defaultFiles?: string[],
  providedCustomWorkspace?: boolean
): Promise<{ workspace: string; customWorkspace: boolean }> => {
  // 使用前端提供的customWorkspace标志，如果没有则根据workspace参数判断
  const customWorkspace = providedCustomWorkspace !== undefined ? providedCustomWorkspace : !!workspace;

  let resolvedWorkspace: string;

  if (!workspace) {
    const tempPath = getSystemDir().workDir;
    resolvedWorkspace = path.join(tempPath, defaultWorkspaceName);
    await fs.mkdir(resolvedWorkspace, { recursive: true });
  } else {
    // 规范化路径：去除末尾斜杠，解析为绝对路径
    resolvedWorkspace = path.resolve(workspace);
  }

  return { workspace: resolvedWorkspace, customWorkspace };
};

const mergeResolvedConversationExtra = <TExtra extends Record<string, unknown>>(
  extra: TExtra,
  resolvedWorkspace: string,
  resolvedCustomWorkspace: boolean,
  overrides: Partial<TExtra> = {}
): TExtra => {
  return {
    ...extra,
    ...overrides,
    workingDirectory: resolvedWorkspace,
    workspace: resolvedWorkspace,
    customWorkspace: resolvedCustomWorkspace,
  };
};

const resolveRequestedWorkingDirectory = (workingDirectory?: string, workspace?: string): string | undefined =>
  workingDirectory || workspace;

export const createGeminiAgent = async (
  model: TProviderWithModel,
  workspace?: string,
  defaultFiles?: string[],
  webSearchEngine?: 'google' | 'default',
  customWorkspace?: boolean,
  contextFileName?: string,
  presetRules?: string,
  enabledSkills?: string[],
  enabledHooks?: string[],
  presetAssistantId?: string,
  nativeWorkspaceBootstrap?: boolean,
  sessionMode?: string,
  isHealthCheck?: boolean,
  spaceId?: string,
  mountId?: string,
  workingDirectory?: string
): Promise<TChatConversation> => {
  const { workspace: newWorkspace, customWorkspace: finalCustomWorkspace } = await buildWorkspaceWidthFiles(
    `gemini-temp-${Date.now()}`,
    resolveRequestedWorkingDirectory(workingDirectory, workspace),
    defaultFiles,
    customWorkspace
  );

  const shouldSetupNativeWorkspace = !finalCustomWorkspace || nativeWorkspaceBootstrap === true;

  // 对 temp workspace 或显式允许 bootstrap 的用户 workspace 设置原生 skills 目录
  // Set up native skills directories for temp workspaces or explicitly bootstrapped user workspaces
  if (shouldSetupNativeWorkspace) {
    await setupAssistantWorkspace(newWorkspace, {
      agentType: 'gemini',
      enabledSkills,
      presetAssistantId,
    });
  }

  return {
    type: 'gemini',
    model,
    extra: mergeResolvedConversationExtra(
      {
        spaceId,
        mountId,
        workingDirectory,
        webSearchEngine,
        contextFileName,
        // 系统规则 / System rules
        presetRules,
        // 向后兼容：contextContent 保存 rules / Backward compatible: contextContent stores rules
        contextContent: presetRules,
        // 启用的 skills 列表（通过 SkillManager 加载）/ Enabled skills list (loaded via SkillManager)
        enabledSkills,
        // 启用的 hooks 列表（由后续 HookRuntime 或原生 projection 消费）
        enabledHooks,
        // 预设助手 ID，用于在会话面板显示助手名称和头像
        // Preset assistant ID for displaying name and avatar in conversation panel
        presetAssistantId,
        nativeWorkspaceBootstrap,
        // Initial session mode from Guid page mode selector
        sessionMode,
        // Explicit marker for temporary health-check conversations
        isHealthCheck,
      },
      newWorkspace,
      finalCustomWorkspace
    ) as Extract<TChatConversation, { type: 'gemini' }>['extra'],
    desc: finalCustomWorkspace ? newWorkspace : '',
    createTime: Date.now(),
    modifyTime: Date.now(),
    name: newWorkspace,
    id: uuid(),
  };
};

export const createGroupConversation = async (options: {
  id?: string;
  name?: string;
  model: TProviderWithModel;
  spaceId?: string;
  mountId?: string;
  workingDirectory?: string;
  workspace?: string;
  customWorkspace?: boolean;
  participants: GroupParticipant[];
  orchestration: GroupOrchestration;
  runState?: WorkflowGroupRunState;
}): Promise<TChatConversation> => {
  const { workspace, customWorkspace } = await buildWorkspaceWidthFiles(
    `group-temp-${Date.now()}`,
    resolveRequestedWorkingDirectory(options.workingDirectory, options.workspace),
    undefined,
    options.customWorkspace
  );

  return {
    type: 'group',
    model: options.model,
    extra: mergeResolvedConversationExtra(
      {
        spaceId: options.spaceId,
        mountId: options.mountId,
        workingDirectory: options.workingDirectory,
        participants: options.participants,
        orchestration: options.orchestration,
        runState: options.runState,
      },
      workspace,
      customWorkspace
    ) as Extract<TChatConversation, { type: 'group' }>['extra'],
    desc: customWorkspace ? workspace : '',
    createTime: Date.now(),
    modifyTime: Date.now(),
    name: options.name || 'Group',
    id: options.id || uuid(),
  };
};

export const createAcpAgent = async (options: ICreateConversationParams): Promise<TChatConversation> => {
  const { extra } = options;
  if (!extra.backend) {
    throw new Error('ACP backend is required');
  }
  const { workspace, customWorkspace } = await buildWorkspaceWidthFiles(
    `${extra.backend}-temp-${Date.now()}`,
    resolveRequestedWorkingDirectory(extra.workingDirectory, extra.workspace),
    extra.defaultFiles,
    extra.customWorkspace
  );

  const shouldSetupNativeWorkspace = !customWorkspace || extra.nativeWorkspaceBootstrap === true;

  // 对 temp workspace 或显式允许 bootstrap 的用户 workspace 设置原生 skills 目录
  if (shouldSetupNativeWorkspace) {
    await setupAssistantWorkspace(workspace, {
      backend: extra.backend,
      enabledSkills: extra.enabledSkills,
      presetAssistantId: extra.presetAssistantId,
    });
  }

  return {
    type: 'acp',
    extra: mergeResolvedConversationExtra(extra as Record<string, unknown>, workspace, customWorkspace, {
      backend: extra.backend,
      cliPath: extra.cliPath,
      agentName: extra.agentName,
      customAgentId: extra.customAgentId, // 同时用于标识预设助手 / Also used to identify preset assistant
      presetContext: extra.presetContext, // 智能助手的预设规则/提示词
      // 启用的 skills 列表（通过 SkillManager 加载）/ Enabled skills list (loaded via SkillManager)
      enabledSkills: extra.enabledSkills,
      // 启用的 hooks 列表（由后续 HookRuntime 或原生 projection 消费）
      enabledHooks: extra.enabledHooks,
      // 预设助手 ID，用于在会话面板显示助手名称和头像
      // Preset assistant ID for displaying name and avatar in conversation panel
      presetAssistantId: extra.presetAssistantId,
      nativeWorkspaceBootstrap: extra.nativeWorkspaceBootstrap === true,
      // Initial session mode selected on Guid page (from AgentModeSelector)
      sessionMode: extra.sessionMode,
      // Pre-selected model from Guid page (cached model list)
      currentModelId: extra.currentModelId,
      // Persisted ACP session handle for resume/import
      acpSessionId: typeof extra.acpSessionId === 'string' ? extra.acpSessionId : undefined,
      acpSessionUpdatedAt: typeof extra.acpSessionUpdatedAt === 'number' ? extra.acpSessionUpdatedAt : undefined,
      externalSessionImported: extra.externalSessionImported === true,
      externalWorkspaceInspection:
        extra.externalWorkspaceInspection && typeof extra.externalWorkspaceInspection === 'object'
          ? extra.externalWorkspaceInspection
          : undefined,
      deferInitialWorkspaceLoad: extra.deferInitialWorkspaceLoad === true,
      // Explicit marker for temporary health-check conversations
      isHealthCheck: extra.isHealthCheck,
    }) as Extract<TChatConversation, { type: 'acp' }>['extra'],
    createTime: Date.now(),
    modifyTime: Date.now(),
    name: workspace,
    id: uuid(),
  };
};

/** @deprecated Legacy Codex creation. New Codex conversations use ACP protocol via createAcpAgent. */
export const createCodexAgent = async (options: ICreateConversationParams): Promise<TChatConversation> => {
  const { extra } = options;
  const { workspace, customWorkspace } = await buildWorkspaceWidthFiles(
    `codex-temp-${Date.now()}`,
    resolveRequestedWorkingDirectory(extra.workingDirectory, extra.workspace),
    extra.defaultFiles,
    extra.customWorkspace
  );

  const shouldSetupNativeWorkspace = !customWorkspace || extra.nativeWorkspaceBootstrap === true;

  // 对 temp workspace 或显式允许 bootstrap 的用户 workspace 设置原生 skills 目录
  if (shouldSetupNativeWorkspace) {
    await setupAssistantWorkspace(workspace, {
      agentType: 'codex',
      enabledSkills: extra.enabledSkills,
      presetAssistantId: extra.presetAssistantId,
    });
  }

  return {
    type: 'codex',
    extra: mergeResolvedConversationExtra(extra as Record<string, unknown>, workspace, customWorkspace, {
      cliPath: extra.cliPath,
      sandboxMode: 'workspace-write', // 默认为读写权限 / Default to read-write permission
      presetContext: extra.presetContext, // 智能助手的预设规则/提示词
      // 启用的 skills 列表（通过 SkillManager 加载）/ Enabled skills list (loaded via SkillManager)
      enabledSkills: extra.enabledSkills,
      enabledHooks: extra.enabledHooks,
      // 预设助手 ID，用于在会话面板显示助手名称和头像
      // Preset assistant ID for displaying name and avatar in conversation panel
      presetAssistantId: extra.presetAssistantId,
      nativeWorkspaceBootstrap: extra.nativeWorkspaceBootstrap === true,
      // Initial session mode selected on Guid page (from AgentModeSelector)
      sessionMode: extra.sessionMode,
      // User-selected Codex model from Guid page
      codexModel: extra.codexModel,
      // Explicit marker for temporary health-check conversations
      isHealthCheck: extra.isHealthCheck,
    }) as Extract<TChatConversation, { type: 'codex' }>['extra'],
    createTime: Date.now(),
    modifyTime: Date.now(),
    name: workspace,
    id: uuid(),
  };
};

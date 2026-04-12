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
import { uuid } from '@/common/utils';
import fs from 'fs/promises';
import path from 'path';
import { getSkillsDir, getBuiltinSkillsCopyDir, getSystemDir } from './initStorage';
import { computeOpenClawIdentityHash } from './openclawUtils';
import { resolveSkillDirectory } from './skillDiscovery';

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
  codebuddy: ['.codebuddy/skills'],
  codex: ['.codex/skills'],
  qwen: ['.qwen/skills'],
  iflow: ['.iflow/skills'],
  goose: ['.goose/skills'],
  droid: ['.factory/skills'],
  kimi: ['.kimi/skills'],
  vibe: ['.vibe/skills'],
  cursor: ['.cursor/skills'],
  // NOT supported (fallback to prompt injection):
  // opencode, auggie, copilot, nanobot, qoder
};

const WORKSPACE_MANAGED_SKILLS_DIR = path.join('.contextgo', 'skills');

const getWorkspaceManagedSkillsDir = (workspace: string): string => path.join(workspace, WORKSPACE_MANAGED_SKILLS_DIR);

type RuntimeSkillsProjectionMode = 'shared-dir' | 'per-skill';

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
  }
): Promise<void> {
  if (!options.enabledSkills || options.enabledSkills.length === 0) return;

  // Determine skills directories based on agent type or backend
  const key = options.backend || options.agentType || '';
  const skillsDirs = AGENT_SKILLS_DIRS[key];

  // If no native skill directory is known for this CLI, skip symlink setup.
  // The caller should use prompt injection as fallback.
  if (!skillsDirs) return;

  const userSkillsDir = getSkillsDir();
  const managedSkillsDir = getWorkspaceManagedSkillsDir(workspace);

  await fs.mkdir(managedSkillsDir, { recursive: true });

  const projectionModes = new Map<string, RuntimeSkillsProjectionMode>();
  for (const skillsRelDir of skillsDirs) {
    projectionModes.set(skillsRelDir, await ensureRuntimeSkillsProjection(workspace, skillsRelDir, managedSkillsDir));
  }

  for (const skillName of options.enabledSkills) {
    // Skip builtin skills (auto-injected via SkillManager / virtual extension)
    if (skillName === 'schedule') continue;

    // Try bundled skills first, then user skills. Both roots support nested skill packs.
    const builtinCandidate = await resolveSkillDirectory(getBuiltinSkillsCopyDir(), skillName, {
      excludeTopLevelNames: ['_builtin'],
    });
    const userCandidate = await resolveSkillDirectory(userSkillsDir, skillName);
    const sourceSkillDir = builtinCandidate?.dirPath || userCandidate?.dirPath || path.join(userSkillsDir, skillName);
    const managedSkillDir = path.join(managedSkillsDir, skillName);

    try {
      await fs.stat(sourceSkillDir);
      try {
        await fs.lstat(managedSkillDir);
      } catch {
        await fs.symlink(sourceSkillDir, managedSkillDir, 'junction');
        console.log(`[setupAssistantWorkspace] Managed skill: ${skillName} -> ${managedSkillDir}`);
      }
    } catch {
      console.warn(`[setupAssistantWorkspace] Skill directory not found: ${sourceSkillDir}`);
      continue;
    }

    for (const skillsRelDir of skillsDirs) {
      if (projectionModes.get(skillsRelDir) !== 'per-skill') {
        continue;
      }

      const runtimeSkillDir = path.join(workspace, skillsRelDir, skillName);
      try {
        await fs.lstat(runtimeSkillDir);
      } catch {
        await fs.symlink(managedSkillDir, runtimeSkillDir, 'junction');
        console.log(`[setupAssistantWorkspace] Projected skill: ${skillName} -> ${runtimeSkillDir}`);
      }
    }
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

export const createNanobotAgent = async (options: ICreateConversationParams): Promise<TChatConversation> => {
  const { extra } = options;
  const { workspace, customWorkspace } = await buildWorkspaceWidthFiles(
    `nanobot-temp-${Date.now()}`,
    resolveRequestedWorkingDirectory(extra.workingDirectory, extra.workspace),
    extra.defaultFiles,
    extra.customWorkspace
  );

  const shouldSetupNativeWorkspace = !customWorkspace || extra.nativeWorkspaceBootstrap === true;

  // 对 temp workspace 或显式允许 bootstrap 的用户 workspace 设置原生 skills 目录
  if (shouldSetupNativeWorkspace) {
    await setupAssistantWorkspace(workspace, {
      agentType: 'nanobot',
      enabledSkills: extra.enabledSkills,
    });
  }

  return {
    type: 'nanobot',
    extra: mergeResolvedConversationExtra(extra as Record<string, unknown>, workspace, customWorkspace, {
      enabledSkills: extra.enabledSkills,
      enabledHooks: extra.enabledHooks,
      presetAssistantId: extra.presetAssistantId,
      nativeWorkspaceBootstrap: extra.nativeWorkspaceBootstrap === true,
    }) as Extract<TChatConversation, { type: 'nanobot' }>['extra'],
    createTime: Date.now(),
    modifyTime: Date.now(),
    name: workspace,
    id: uuid(),
  };
};

export const createOpenClawAgent = async (options: ICreateConversationParams): Promise<TChatConversation> => {
  const { extra } = options;
  const { workspace, customWorkspace } = await buildWorkspaceWidthFiles(
    `openclaw-temp-${Date.now()}`,
    resolveRequestedWorkingDirectory(extra.workingDirectory, extra.workspace),
    extra.defaultFiles,
    extra.customWorkspace
  );

  const shouldSetupNativeWorkspace = !customWorkspace || extra.nativeWorkspaceBootstrap === true;

  // 对 temp workspace 或显式允许 bootstrap 的用户 workspace 设置原生 skills 目录
  if (shouldSetupNativeWorkspace) {
    await setupAssistantWorkspace(workspace, {
      enabledSkills: extra.enabledSkills,
    });
  }

  const expectedIdentityHash = await computeOpenClawIdentityHash(workspace);
  return {
    type: 'openclaw-gateway',
    extra: mergeResolvedConversationExtra(extra as Record<string, unknown>, workspace, customWorkspace, {
      backend: extra.backend,
      agentName: extra.agentName,
      openclawAgentId: extra.openclawAgentId,
      gateway: {
        cliPath: extra.cliPath,
      },
      runtimeValidation: {
        expectedSpaceId: extra.runtimeValidation?.expectedSpaceId ?? extra.spaceId,
        expectedMountId: extra.runtimeValidation?.expectedMountId ?? extra.mountId,
        expectedWorkingDirectory: workspace,
        expectedWorkspace: workspace,
        expectedBackend: extra.backend,
        expectedAgentName: extra.agentName,
        expectedOpenClawAgentId: extra.openclawAgentId,
        expectedCliPath: extra.cliPath,
        expectedModel: extra.runtimeValidation?.expectedModel,
        expectedIdentityHash,
        switchedAt: extra.runtimeValidation?.switchedAt ?? Date.now(),
      },
      sessionKey: typeof extra.sessionKey === 'string' ? extra.sessionKey : undefined,
      // Enabled skills list (loaded via SkillManager)
      enabledSkills: extra.enabledSkills,
      // Enabled hooks list (reserved for future HookRuntime / native projection)
      enabledHooks: extra.enabledHooks,
      // Preset assistant ID for displaying name and avatar in conversation panel
      presetAssistantId: extra.presetAssistantId,
      nativeWorkspaceBootstrap: extra.nativeWorkspaceBootstrap === true,
    }) as Extract<TChatConversation, { type: 'openclaw-gateway' }>['extra'],
    createTime: Date.now(),
    modifyTime: Date.now(),
    name: workspace,
    id: uuid(),
  };
};

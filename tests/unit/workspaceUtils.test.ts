import { describe, expect, it } from 'vitest';

import {
  getConversationWorkspacePath,
  getLastDirectoryName,
  getWorkspaceAutomationPaths,
  getWorkspaceDisplayName,
  isTemporaryWorkspace,
} from '@/renderer/utils/workspace/workspace';

describe('workspace utils', () => {
  it('shows only the last directory for Unix-style workspace paths', () => {
    expect(getWorkspaceDisplayName('/Users/demo/projects/ContextGo')).toBe('ContextGo');
  });

  it('shows only the last directory for Windows-style workspace paths', () => {
    expect(getWorkspaceDisplayName('E:\\code\\taichuCode\\ContextGo')).toBe('ContextGo');
  });

  it('detects temporary workspaces on Windows-style paths', () => {
    expect(isTemporaryWorkspace('C:\\Users\\demo\\codex-temp-1741680000000')).toBe(true);
  });

  it('extracts the last directory name from Windows-style paths', () => {
    expect(getLastDirectoryName('D:\\workspace\\feature-demo')).toBe('feature-demo');
  });

  it('builds automation file paths for Unix-style workspaces', () => {
    expect(getWorkspaceAutomationPaths('/Users/demo/project')).toEqual({
      rootDir: '/Users/demo/project/.contextgo',
      skillsDir: '/Users/demo/project/.contextgo/skills',
      hooksDir: '/Users/demo/project/.contextgo/hooks',
      hooksFile: '/Users/demo/project/.contextgo/hooks.json',
      commandsFile: '/Users/demo/project/.contextgo/commands.json',
      schedulesFile: '/Users/demo/project/.contextgo/schedules.json',
      runtimePolicyFile: '/Users/demo/project/.contextgo/runtime.json',
    });
  });

  it('builds automation file paths for Windows-style workspaces', () => {
    expect(getWorkspaceAutomationPaths('D:\\workspace\\project')).toEqual({
      rootDir: 'D:\\workspace\\project\\.contextgo',
      skillsDir: 'D:\\workspace\\project\\.contextgo\\skills',
      hooksDir: 'D:\\workspace\\project\\.contextgo\\hooks',
      hooksFile: 'D:\\workspace\\project\\.contextgo\\hooks.json',
      commandsFile: 'D:\\workspace\\project\\.contextgo\\commands.json',
      schedulesFile: 'D:\\workspace\\project\\.contextgo\\schedules.json',
      runtimePolicyFile: 'D:\\workspace\\project\\.contextgo\\runtime.json',
    });
  });

  it('resolves the workspace path from conversation extras', () => {
    expect(
      getConversationWorkspacePath({
        id: 'conv-1',
        type: 'gemini',
        name: 'Conversation',
        extra: {
          workspace: '/workspace/demo',
        },
      } as never)
    ).toBe('/workspace/demo');
  });

  it('prefers workingDirectory over legacy workspace when resolving conversation paths', () => {
    expect(
      getConversationWorkspacePath({
        id: 'conv-2',
        type: 'gemini',
        name: 'Conversation',
        extra: {
          workspace: '/workspace/legacy',
          workingDirectory: '/workspace/current',
        },
      } as never)
    ).toBe('/workspace/current');
  });
});

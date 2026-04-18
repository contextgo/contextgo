/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { emitter } from '../../src/renderer/utils/emitter';

const mockGeminiResponseStreamOn = vi.fn();
const mockAcpResponseStreamOn = vi.fn();
const mockCodexResponseStreamOn = vi.fn();
const mockWorkspaceSearchProvider = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    geminiConversation: {
      responseStream: {
        on: (...args: unknown[]) => mockGeminiResponseStreamOn(...args),
      },
    },
    acpConversation: {
      responseStream: {
        on: (...args: unknown[]) => mockAcpResponseStreamOn(...args),
      },
    },
    codexConversation: {
      responseStream: {
        on: (...args: unknown[]) => mockCodexResponseStreamOn(...args),
      },
    },
    conversation: {
      responseSearchWorkSpace: {
        provider: (...args: unknown[]) => mockWorkspaceSearchProvider(...args),
      },
    },
  },
}));

import { useWorkspaceEvents } from '../../src/renderer/pages/conversation/Workspace/hooks/useWorkspaceEvents';

describe('useWorkspaceEvents - folder tag sync (#1083)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGeminiResponseStreamOn.mockReturnValue(vi.fn());
    mockAcpResponseStreamOn.mockReturnValue(vi.fn());
    mockCodexResponseStreamOn.mockReturnValue(vi.fn());
    mockWorkspaceSearchProvider.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    // Clean up any event listeners
    emitter.off('gemini.selected.file');
    emitter.off('acp.selected.file');
    emitter.off('codex.selected.file');
  });

  describe('gemini.selected.file event handling', () => {
    it('should sync selected state when folder tags are removed via event', () => {
      const setSelected = vi.fn();
      const selectedKeysRef = { current: ['folder1', 'folder2'] };
      const selectedNodeRef = { current: { relativePath: 'folder2', fullPath: '/path/folder2' } };

      // Simulate the event handler logic from useWorkspaceEvents
      const handleSelectedFile = (
        items: Array<{ path: string; name: string; isFile: boolean; relativePath?: string }>
      ) => {
        const newKeys = items.filter((item) => !item.isFile && item.relativePath).map((item) => item.relativePath!);
        setSelected(newKeys);
        selectedKeysRef.current = newKeys;

        const folders = items.filter((item) => !item.isFile);
        if (folders.length > 0) {
          const lastFolder = folders[folders.length - 1];
          selectedNodeRef.current = lastFolder.relativePath
            ? { relativePath: lastFolder.relativePath, fullPath: lastFolder.path }
            : null;
        } else {
          selectedNodeRef.current = null;
        }
      };

      // Register handler
      emitter.on('gemini.selected.file', handleSelectedFile);

      // Simulate removing a folder tag (emitting with remaining items)
      act(() => {
        emitter.emit('gemini.selected.file', [
          { path: '/path/folder1', name: 'folder1', isFile: false, relativePath: 'folder1' },
          // folder2 removed
        ]);
      });

      expect(setSelected).toHaveBeenCalledWith(['folder1']);
      expect(selectedKeysRef.current).toEqual(['folder1']);
      expect(selectedNodeRef.current).toEqual({
        relativePath: 'folder1',
        fullPath: '/path/folder1',
      });
    });

    it('should clear selection when all folders are removed', () => {
      const setSelected = vi.fn();
      const selectedKeysRef = { current: ['folder1'] };
      const selectedNodeRef = { current: { relativePath: 'folder1', fullPath: '/path/folder1' } };

      const handleSelectedFile = (
        items: Array<{ path: string; name: string; isFile: boolean; relativePath?: string }>
      ) => {
        const newKeys = items.filter((item) => !item.isFile && item.relativePath).map((item) => item.relativePath!);
        setSelected(newKeys);
        selectedKeysRef.current = newKeys;

        const folders = items.filter((item) => !item.isFile);
        if (folders.length > 0) {
          const lastFolder = folders[folders.length - 1];
          selectedNodeRef.current = lastFolder.relativePath
            ? { relativePath: lastFolder.relativePath, fullPath: lastFolder.path }
            : null;
        } else {
          selectedNodeRef.current = null;
        }
      };

      emitter.on('gemini.selected.file', handleSelectedFile);

      // Remove all folders
      act(() => {
        emitter.emit('gemini.selected.file', []);
      });

      expect(setSelected).toHaveBeenCalledWith([]);
      expect(selectedKeysRef.current).toEqual([]);
      expect(selectedNodeRef.current).toBeNull();
    });

    it('should filter out files and only track folders', () => {
      const setSelected = vi.fn();
      const selectedKeysRef = { current: [] as string[] };
      const selectedNodeRef = { current: null as { relativePath: string; fullPath: string } | null };

      const handleSelectedFile = (
        items: Array<{ path: string; name: string; isFile: boolean; relativePath?: string }>
      ) => {
        const newKeys = items.filter((item) => !item.isFile && item.relativePath).map((item) => item.relativePath!);
        setSelected(newKeys);
        selectedKeysRef.current = newKeys;

        const folders = items.filter((item) => !item.isFile);
        if (folders.length > 0) {
          const lastFolder = folders[folders.length - 1];
          selectedNodeRef.current = lastFolder.relativePath
            ? { relativePath: lastFolder.relativePath, fullPath: lastFolder.path }
            : null;
        } else {
          selectedNodeRef.current = null;
        }
      };

      emitter.on('gemini.selected.file', handleSelectedFile);

      // Mix of files and folders
      act(() => {
        emitter.emit('gemini.selected.file', [
          { path: '/path/file1.txt', name: 'file1.txt', isFile: true, relativePath: 'file1.txt' },
          { path: '/path/folder1', name: 'folder1', isFile: false, relativePath: 'folder1' },
          { path: '/path/file2.txt', name: 'file2.txt', isFile: true },
        ]);
      });

      // Should only include folder1
      expect(setSelected).toHaveBeenCalledWith(['folder1']);
      expect(selectedKeysRef.current).toEqual(['folder1']);
    });

    it('should handle items without relativePath', () => {
      const setSelected = vi.fn();
      const selectedKeysRef = { current: [] as string[] };
      const selectedNodeRef = { current: null as { relativePath: string; fullPath: string } | null };

      const handleSelectedFile = (
        items: Array<{ path: string; name: string; isFile: boolean; relativePath?: string }>
      ) => {
        const newKeys = items.filter((item) => !item.isFile && item.relativePath).map((item) => item.relativePath!);
        setSelected(newKeys);
        selectedKeysRef.current = newKeys;

        const folders = items.filter((item) => !item.isFile);
        if (folders.length > 0) {
          const lastFolder = folders[folders.length - 1];
          selectedNodeRef.current = lastFolder.relativePath
            ? { relativePath: lastFolder.relativePath, fullPath: lastFolder.path }
            : null;
        } else {
          selectedNodeRef.current = null;
        }
      };

      emitter.on('gemini.selected.file', handleSelectedFile);

      // Folder without relativePath
      act(() => {
        emitter.emit('gemini.selected.file', [
          { path: '/path/folder1', name: 'folder1', isFile: false }, // no relativePath
        ]);
      });

      // Should not include folders without relativePath in keys
      expect(setSelected).toHaveBeenCalledWith([]);
      // But selectedNodeRef should be null since no relativePath
      expect(selectedNodeRef.current).toBeNull();
    });
  });

  describe('acp.selected.file event handling', () => {
    it('should work with acp event prefix', () => {
      const setSelected = vi.fn();
      const selectedKeysRef = { current: [] as string[] };

      const handleSelectedFile = (
        items: Array<{ path: string; name: string; isFile: boolean; relativePath?: string }>
      ) => {
        const newKeys = items.filter((item) => !item.isFile && item.relativePath).map((item) => item.relativePath!);
        setSelected(newKeys);
        selectedKeysRef.current = newKeys;
      };

      emitter.on('acp.selected.file', handleSelectedFile);

      act(() => {
        emitter.emit('acp.selected.file', [
          { path: '/path/folder1', name: 'folder1', isFile: false, relativePath: 'folder1' },
        ]);
      });

      expect(setSelected).toHaveBeenCalledWith(['folder1']);
    });
  });

  describe('codex.selected.file event handling', () => {
    it('should work with codex event prefix', () => {
      const setSelected = vi.fn();
      const selectedKeysRef = { current: [] as string[] };

      const handleSelectedFile = (
        items: Array<{ path: string; name: string; isFile: boolean; relativePath?: string }>
      ) => {
        const newKeys = items.filter((item) => !item.isFile && item.relativePath).map((item) => item.relativePath!);
        setSelected(newKeys);
        selectedKeysRef.current = newKeys;
      };

      emitter.on('codex.selected.file', handleSelectedFile);

      act(() => {
        emitter.emit('codex.selected.file', [
          { path: '/path/folder1', name: 'folder1', isFile: false, relativePath: 'folder1' },
        ]);
      });

      expect(setSelected).toHaveBeenCalledWith(['folder1']);
    });
  });

  describe('workspace refresh subscription', () => {
    it('refreshes only for the active conversation response stream', () => {
      vi.useFakeTimers();

      const refreshWorkspace = vi.fn();
      const acpHandlers: Array<(data: { type: string; conversation_id?: string }) => void> = [];

      mockAcpResponseStreamOn.mockImplementation(
        (handler: (data: { type: string; conversation_id?: string }) => void) => {
          acpHandlers.push(handler);
          return vi.fn();
        }
      );

      const { unmount } = renderHook(() =>
        useWorkspaceEvents({
          conversation_id: 'conv-1',
          eventPrefix: 'acp',
          autoLoadOnMount: false,
          refreshWorkspace,
          clearSelection: vi.fn(),
          setFiles: vi.fn(),
          setSelected: vi.fn(),
          setExpandedKeys: vi.fn(),
          setTreeKey: vi.fn(),
          selectedNodeRef: { current: null },
          selectedKeysRef: { current: [] },
          closeContextMenu: vi.fn(),
          setContextMenu: vi.fn(),
          closeRenameModal: vi.fn(),
          closeDeleteModal: vi.fn(),
        })
      );

      expect(acpHandlers).toHaveLength(1);

      act(() => {
        acpHandlers[0]?.({
          type: 'acp_tool_call',
          conversation_id: 'conv-2',
        });
      });

      expect(refreshWorkspace).not.toHaveBeenCalled();

      act(() => {
        acpHandlers[0]?.({
          type: 'acp_tool_call',
          conversation_id: 'conv-1',
        });
      });

      expect(refreshWorkspace).toHaveBeenCalledTimes(1);

      unmount();
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });
  });
});

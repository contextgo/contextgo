/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tests for the mtime-based file polling feature in PreviewContext:
 * - checkFileUpdate skips read when mtime is unchanged
 * - checkFileUpdate updates tab content when mtime changes
 * - checkFileUpdate skips update when tab isDirty
 * - checkFileUpdate uses getImageBase64 for image content type
 * - checkFileUpdate handles file read errors without breaking state
 * - closeTab clears fileMtimeRef entry for the closed tab
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import React from 'react';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockGetFileMetadata = vi.fn();
const mockReadFile = vi.fn();
const mockGetImageBase64 = vi.fn();
const mockWriteFile = vi.fn();
let capturedContentUpdateListener:
  | ((payload: { filePath: string; content: string; operation?: 'write' | 'delete' }) => void)
  | null = null;
const mockContentUpdateOn = vi.fn(
  (listener: (payload: { filePath: string; content: string; operation?: 'write' | 'delete' }) => void) => {
    capturedContentUpdateListener = listener;
    return () => {
      capturedContentUpdateListener = null;
    };
  }
);
const mockPreviewOpenOn = vi.fn(() => vi.fn());

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      getFileMetadata: { invoke: (...args: unknown[]) => mockGetFileMetadata(...args) },
      readFile: { invoke: (...args: unknown[]) => mockReadFile(...args) },
      getImageBase64: { invoke: (...args: unknown[]) => mockGetImageBase64(...args) },
      writeFile: { invoke: (...args: unknown[]) => mockWriteFile(...args) },
    },
    fileStream: {
      contentUpdate: { on: (...args: unknown[]) => mockContentUpdateOn(...args) },
    },
    preview: {
      open: { on: (...args: unknown[]) => mockPreviewOpenOn(...args) },
    },
  },
}));

vi.mock('@/renderer/utils/emitter', () => ({
  emitter: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
}));

// Import after mocks
import {
  usePreviewComposer,
  PreviewProvider,
  usePreviewActions,
  usePreviewContext,
  usePreviewSurface,
} from '../../src/renderer/pages/conversation/Preview/context/PreviewContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(PreviewProvider, null, children);

/** Advance timers by `ms` and flush pending microtasks/promises. */
async function tickPoll(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('PreviewContext — mtime file polling (checkFileUpdate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();

    // Default mock behaviour: return mtime 1000 and file content
    mockGetFileMetadata.mockResolvedValue({ lastModified: 1000 });
    mockReadFile.mockResolvedValue('file content');
    mockGetImageBase64.mockResolvedValue('base64data');
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('calls getFileMetadata for the active tab immediately on tab switch', async () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper });

    act(() => {
      result.current.openPreview('initial', 'code', {
        filePath: '/workspace/file.ts',
        language: 'typescript',
      });
    });

    // Flush the immediate checkFileUpdate call triggered by the effect
    await act(async () => {
      await tickPoll();
    });

    expect(mockGetFileMetadata).toHaveBeenCalledWith({ path: '/workspace/file.ts' });
  });

  it('does not read file content when mtime is unchanged between polls', async () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper });

    act(() => {
      result.current.openPreview('initial', 'code', {
        filePath: '/workspace/file.ts',
        language: 'typescript',
      });
    });

    // First immediate call: sets prevMtime = undefined → stores 1000; no content read yet
    await act(async () => {
      await tickPoll();
    });

    vi.clearAllMocks();
    mockGetFileMetadata.mockResolvedValue({ lastModified: 1000 }); // same mtime

    // Next poll at 1s
    await act(async () => {
      await tickPoll(1000);
    });

    expect(mockGetFileMetadata).toHaveBeenCalled();
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('reads file content and updates the tab when mtime changes', async () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper });

    act(() => {
      result.current.openPreview('initial', 'code', {
        filePath: '/workspace/file.ts',
        language: 'typescript',
      });
    });

    // First immediate call: record initial mtime 1000
    await act(async () => {
      await tickPoll();
    });

    vi.clearAllMocks();
    mockGetFileMetadata.mockResolvedValue({ lastModified: 2000 }); // mtime changed
    mockReadFile.mockResolvedValue('updated content');

    await act(async () => {
      await tickPoll(1000);
    });

    expect(mockReadFile).toHaveBeenCalledWith({ path: '/workspace/file.ts' });
    expect(result.current.activeTab?.content).toBe('updated content');
  });

  it('skips update when the active tab has isDirty = true', async () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper });

    act(() => {
      result.current.openPreview('initial', 'code', {
        filePath: '/workspace/file.ts',
        language: 'typescript',
      });
    });

    // First immediate call: record initial mtime
    await act(async () => {
      await tickPoll();
    });

    // Dirty the tab by editing its content
    act(() => {
      result.current.updateContent('user edits');
    });

    expect(result.current.activeTab?.isDirty).toBe(true);

    vi.clearAllMocks();
    mockGetFileMetadata.mockResolvedValue({ lastModified: 2000 });
    mockReadFile.mockResolvedValue('external update');

    await act(async () => {
      await tickPoll(1000);
    });

    // Tab is dirty — external update must be ignored
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(result.current.activeTab?.content).toBe('user edits');
  });

  it('uses getImageBase64 instead of readFile for image tabs', async () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper });

    act(() => {
      result.current.openPreview('initial-base64', 'image', {
        filePath: '/workspace/photo.png',
      });
    });

    // First immediate call: record initial mtime
    await act(async () => {
      await tickPoll();
    });

    vi.clearAllMocks();
    mockGetFileMetadata.mockResolvedValue({ lastModified: 2000 });
    mockGetImageBase64.mockResolvedValue('new-base64data');

    await act(async () => {
      await tickPoll(1000);
    });

    expect(mockGetImageBase64).toHaveBeenCalledWith({ path: '/workspace/photo.png' });
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(result.current.activeTab?.content).toBe('new-base64data');
  });

  it('does not corrupt tab state when file read rejects', async () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper });

    act(() => {
      result.current.openPreview('stable content', 'code', {
        filePath: '/workspace/file.ts',
        language: 'typescript',
      });
    });

    // First immediate call: record initial mtime
    await act(async () => {
      await tickPoll();
    });

    vi.clearAllMocks();
    mockGetFileMetadata.mockResolvedValue({ lastModified: 2000 });
    mockReadFile.mockRejectedValue(new Error('ENOENT: file not found'));

    await act(async () => {
      await tickPoll(1000);
    });

    // Content must remain unchanged despite read failure
    expect(result.current.activeTab?.content).toBe('stable content');
  });

  it('does not update tab content when getFileMetadata rejects', async () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper });

    act(() => {
      result.current.openPreview('stable content', 'code', {
        filePath: '/workspace/file.ts',
        language: 'typescript',
      });
    });

    // First immediate call: record initial mtime
    await act(async () => {
      await tickPoll();
    });

    vi.clearAllMocks();
    mockGetFileMetadata.mockRejectedValue(new Error('IPC error'));

    await act(async () => {
      await tickPoll(1000);
    });

    expect(mockReadFile).not.toHaveBeenCalled();
    expect(result.current.activeTab?.content).toBe('stable content');
  });
});

describe('PreviewContext — closeTab clears fileMtimeRef', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();

    mockGetFileMetadata.mockResolvedValue({ lastModified: 1000 });
    mockReadFile.mockResolvedValue('file content');
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('resets mtime tracking after closeTab so reopening treats file as fresh', async () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper });

    // Open a tab and run two polls so last-known mtime is 2000
    act(() => {
      result.current.openPreview('initial', 'code', {
        filePath: '/workspace/file.ts',
        language: 'typescript',
      });
    });

    // Poll 1: prevMtime=undefined → store 1000, no read
    await act(async () => {
      await tickPoll();
    });

    mockGetFileMetadata.mockResolvedValue({ lastModified: 2000 });
    mockReadFile.mockResolvedValue('updated content');

    // Poll 2 (1s interval): prevMtime=1000, new=2000 → read file; last-known is now 2000
    await act(async () => {
      await tickPoll(1000);
    });

    expect(mockReadFile).toHaveBeenCalledTimes(1);

    const tabId = result.current.activeTabId!;

    // Close the tab — must clear fileMtimeRef entry so last-known mtime is forgotten
    act(() => {
      result.current.closeTab(tabId);
    });

    vi.clearAllMocks();
    // Return a mtime LOWER than last-known (2000 → 500).
    // If closeTab did NOT clear the ref: prevMtime=2000, new=500 → 500≠2000 → read triggered (WRONG).
    // If closeTab DID clear the ref:    prevMtime=undefined → store 500 → no read (CORRECT).
    mockGetFileMetadata.mockResolvedValue({ lastModified: 500 });
    mockReadFile.mockResolvedValue('should-not-appear');

    act(() => {
      result.current.openPreview('initial', 'code', {
        filePath: '/workspace/file.ts',
        language: 'typescript',
      });
    });

    // Advance time to let the immediate check and the first interval fire
    await act(async () => {
      await tickPoll(1000);
    });

    // If mtime was properly cleared, prevMtime was undefined on the first post-reopen check,
    // so the "backward mtime" does NOT trigger a spurious read.
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});

describe('PreviewContext — persisted preview tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    capturedContentUpdateListener = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('ignores persisted html tabs during restore', () => {
    localStorage.setItem(
      'contextgo_preview_tabs',
      JSON.stringify([
        {
          id: 'html-tab',
          title: 'HTML Preview',
          content: '<html><body>preview</body></html>',
          contentType: 'html',
        },
        {
          id: 'code-tab',
          title: 'index.ts',
          content: 'export const ready = true;',
          contentType: 'code',
        },
      ])
    );
    localStorage.setItem('contextgo_preview_active_tab_id', 'html-tab');

    const { result } = renderHook(() => usePreviewContext(), { wrapper });

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0]?.id).toBe('code-tab');
    expect(result.current.tabs[0]?.contentType).toBe('code');
    expect(result.current.activeTabId).toBe('code-tab');
  });

  it('does not persist html preview tabs back to localStorage', async () => {
    const { result } = renderHook(() => usePreviewContext(), { wrapper });

    act(() => {
      result.current.openPreview('<html><body>preview</body></html>', 'html', {
        title: 'HTML Preview',
      });
      result.current.openPreview('export const ready = true;', 'code', {
        title: 'index.ts',
        language: 'typescript',
      });
    });

    await act(async () => {
      await tickPoll(200);
    });

    const persistedTabs = JSON.parse(localStorage.getItem('contextgo_preview_tabs') || '[]') as Array<{
      id: string;
      contentType: string;
    }>;

    expect(persistedTabs).toHaveLength(1);
    expect(persistedTabs[0]?.contentType).toBe('code');
  });

  it('does not start background file polling for restored tabs while the preview surface is closed', async () => {
    localStorage.setItem(
      'contextgo_preview_tabs',
      JSON.stringify([
        {
          id: 'code-tab',
          title: 'index.ts',
          content: 'export const ready = true;',
          contentType: 'code',
          metadata: {
            filePath: '/workspace/index.ts',
            language: 'typescript',
          },
        },
      ])
    );
    localStorage.setItem('contextgo_preview_active_tab_id', 'code-tab');
    mockGetFileMetadata.mockResolvedValue({ lastModified: 2000 });

    renderHook(() => usePreviewContext(), { wrapper });

    await act(async () => {
      await tickPoll(1200);
    });

    expect(mockGetFileMetadata).not.toHaveBeenCalled();
  });

  it('ignores hidden file stream updates for restored tabs until the preview surface is reopened', async () => {
    localStorage.setItem(
      'contextgo_preview_tabs',
      JSON.stringify([
        {
          id: 'code-tab',
          title: 'index.ts',
          content: 'export const ready = true;',
          contentType: 'code',
          metadata: {
            filePath: '/workspace/index.ts',
            language: 'typescript',
          },
        },
      ])
    );
    localStorage.setItem('contextgo_preview_active_tab_id', 'code-tab');

    const { result } = renderHook(() => usePreviewContext(), { wrapper });

    act(() => {
      capturedContentUpdateListener?.({
        filePath: '/workspace/index.ts',
        content: 'export const ready = false;',
        operation: 'write',
      });
    });

    await act(async () => {
      await tickPoll(600);
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.activeTab?.content).toBe('export const ready = true;');
  });
});

describe('PreviewContext — lightweight surface and action hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();

    mockGetFileMetadata.mockResolvedValue({ lastModified: 1000 });
    mockReadFile.mockResolvedValue('file content');
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('does not rerender lightweight consumers when active tab content changes without surface changes', async () => {
    const surfaceRenderSpy = vi.fn();
    const actionsRenderSpy = vi.fn();
    const composerRenderSpy = vi.fn();
    const latestActions: { current: ReturnType<typeof usePreviewActions> | null } = {
      current: null,
    };

    const SurfaceProbe = () => {
      const surface = usePreviewSurface();
      surfaceRenderSpy({
        isOpen: surface.isOpen,
        activeTabId: surface.activeTabId,
        title: surface.activeTab?.title ?? null,
      });
      return null;
    };

    const ActionsProbe = () => {
      const actions = usePreviewActions();
      latestActions.current = actions;
      actionsRenderSpy();
      return null;
    };

    const ComposerProbe = () => {
      const composer = usePreviewComposer();
      composerRenderSpy({
        domSnippetCount: composer.domSnippets.length,
      });
      return null;
    };

    render(
      React.createElement(
        PreviewProvider,
        null,
        React.createElement(SurfaceProbe),
        React.createElement(ActionsProbe),
        React.createElement(ComposerProbe)
      )
    );

    expect(latestActions.current).not.toBeNull();

    act(() => {
      latestActions.current?.openPreview('initial', 'code', {
        filePath: '/workspace/file.ts',
        title: 'file.ts',
        language: 'typescript',
      });
    });

    await act(async () => {
      await tickPoll();
    });

    surfaceRenderSpy.mockClear();
    actionsRenderSpy.mockClear();
    composerRenderSpy.mockClear();
    mockGetFileMetadata.mockResolvedValue({ lastModified: 2000 });
    mockReadFile.mockResolvedValue('updated content');

    await act(async () => {
      await tickPoll(1000);
    });

    expect(mockReadFile).toHaveBeenCalledWith({ path: '/workspace/file.ts' });
    expect(surfaceRenderSpy).not.toHaveBeenCalled();
    expect(actionsRenderSpy).not.toHaveBeenCalled();
    expect(composerRenderSpy).not.toHaveBeenCalled();
  });
});

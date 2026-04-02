import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPathInvokeMock = vi.fn();
const getFileMetadataInvokeMock = vi.fn();
const readFileInvokeMock = vi.fn();
const getImageBase64InvokeMock = vi.fn();
const openPreviewMock = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    application: {
      getPath: { invoke: (...args: unknown[]) => getPathInvokeMock(...args) },
    },
    fs: {
      getFileMetadata: { invoke: (...args: unknown[]) => getFileMetadataInvokeMock(...args) },
      readFile: { invoke: (...args: unknown[]) => readFileInvokeMock(...args) },
      getImageBase64: { invoke: (...args: unknown[]) => getImageBase64InvokeMock(...args) },
    },
  },
}));

vi.mock('@/renderer/hooks/context/ConversationContext', () => ({
  useConversationContextSafe: () => null,
}));

vi.mock('@/renderer/pages/conversation/Preview', () => ({
  usePreviewContext: () => ({
    openPreview: (...args: unknown[]) => openPreviewMock(...args),
  }),
}));

import { useFilePreviewOpener } from '@/renderer/hooks/file/useFilePreviewOpener';

describe('useFilePreviewOpener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPathInvokeMock.mockResolvedValue('/Users/tester');
    getFileMetadataInvokeMock.mockResolvedValue({
      name: 'config.toml',
      path: '/Users/tester/.codex/config.toml',
      size: 128,
      type: '',
      lastModified: 1,
      isDirectory: false,
    });
    readFileInvokeMock.mockResolvedValue('model = "gpt-5"');
    getImageBase64InvokeMock.mockResolvedValue('base64data');
  });

  it('returns true when the shared preview mounts readable file content', async () => {
    const { result } = renderHook(() => useFilePreviewOpener());

    let opened = false;
    await act(async () => {
      opened = await result.current.openFilePreview({ path: '~/.codex/config.toml' });
    });

    expect(opened).toBe(true);
    expect(readFileInvokeMock).toHaveBeenCalledWith({ path: '/Users/tester/.codex/config.toml' });
    expect(openPreviewMock).toHaveBeenCalledWith(
      'model = "gpt-5"',
      'code',
      expect.objectContaining({
        fileName: 'config.toml',
        filePath: '/Users/tester/.codex/config.toml',
        language: 'toml',
        title: 'config.toml',
      })
    );
  });

  it('returns false when the file cannot be read and no preview content is available', async () => {
    readFileInvokeMock.mockRejectedValueOnce(new Error('read failed'));

    const { result } = renderHook(() => useFilePreviewOpener());

    let opened = false;
    await act(async () => {
      opened = await result.current.openFilePreview({ path: '~/.codex/config.toml' });
    });

    expect(opened).toBe(false);
    expect(openPreviewMock).not.toHaveBeenCalled();
  });

  it('opens an empty draft preview for a missing text config file', async () => {
    getFileMetadataInvokeMock.mockResolvedValueOnce({
      name: 'settings.json',
      path: '/Users/tester/.claude/settings.json',
      size: -1,
      type: '',
      lastModified: 0,
      isDirectory: false,
    });
    readFileInvokeMock.mockRejectedValueOnce(new Error('read failed'));

    const { result } = renderHook(() => useFilePreviewOpener());

    let opened = false;
    await act(async () => {
      opened = await result.current.openFilePreview({ path: '~/.claude/settings.json' });
    });

    expect(opened).toBe(true);
    expect(openPreviewMock).toHaveBeenCalledWith(
      '',
      'code',
      expect.objectContaining({
        fileName: 'settings.json',
        filePath: '/Users/tester/.claude/settings.json',
        language: 'json',
        title: 'settings.json',
      })
    );
  });

  it('returns false for directories so callers can fall back to the system opener', async () => {
    getFileMetadataInvokeMock.mockResolvedValueOnce({
      name: '.opencode',
      path: '/Users/tester/.opencode',
      size: 0,
      type: '',
      lastModified: 1,
      isDirectory: true,
    });

    const { result } = renderHook(() => useFilePreviewOpener());

    let opened = false;
    await act(async () => {
      opened = await result.current.openFilePreview({ path: '~/.opencode' });
    });

    expect(opened).toBe(false);
    expect(readFileInvokeMock).not.toHaveBeenCalled();
    expect(openPreviewMock).not.toHaveBeenCalled();
  });
});

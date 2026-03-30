import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutoUpdateStatus } from '@/common/update/updateTypes';

const autoUpdateCheckInvoke = vi.fn();
const manualUpdateCheckInvoke = vi.fn();
const updateOpenOn = vi.fn();
const autoUpdateStatusOn = vi.fn();
const downloadProgressOn = vi.fn();
const autoUpdateDownloadInvoke = vi.fn();
const autoUpdateQuitAndInstallInvoke = vi.fn();
const manualUpdateDownloadInvoke = vi.fn();
const openExternalInvoke = vi.fn();
const openFileInvoke = vi.fn();
const showItemInFolderInvoke = vi.fn();
const messageError = vi.fn();

let openUpdateModalHandler: (() => void) | undefined;
let autoUpdateStatusHandler: ((evt: AutoUpdateStatus) => void) | undefined;

const translations: Record<string, string> = {
  'update.modalTitle': 'Software update',
  'update.checking': 'Checking for updates...',
  'update.checkFailed': 'Failed to check for updates',
  'update.upToDateTitle': "You're up to date",
  'update.currentVersion': 'Current version: {{version}}',
  'update.availableTitle': 'Update available',
  'update.noReleaseNotes': 'No release notes provided.',
  'update.downloadingTitle': 'Downloading update...',
  'update.downloadButton': 'Download',
  'update.downloadAndInstall': 'Download & Install',
  'update.downloadStartFailed': 'Failed to start download',
  'update.downloadFailed': 'Download failed',
  'update.noCompatibleAssetManual': 'No package matches your current system architecture.',
  'update.goToRelease': 'Open Releases',
  'update.downloadCompleteTitle': 'Download complete',
  'update.readyToInstall': 'Ready to install',
  'update.readyToInstallDesc': 'Update has been downloaded.',
  'update.installNow': 'Install and restart',
  'update.showInFolder': 'Show in folder',
  'update.openFile': 'Open file',
  'update.errorTitle': 'Update failed',
  'common.retry': 'Retry',
};

vi.mock('@/common', () => ({
  ipcBridge: {
    update: {
      open: {
        on: (handler: () => void) => {
          openUpdateModalHandler = handler;
          updateOpenOn(handler);
          return () => undefined;
        },
      },
      check: {
        invoke: (...args: unknown[]) => manualUpdateCheckInvoke(...args),
      },
      download: {
        invoke: (...args: unknown[]) => manualUpdateDownloadInvoke(...args),
      },
      downloadProgress: {
        on: (handler: (...args: unknown[]) => void) => {
          downloadProgressOn(handler);
          return () => undefined;
        },
      },
    },
    autoUpdate: {
      check: {
        invoke: (...args: unknown[]) => autoUpdateCheckInvoke(...args),
      },
      status: {
        on: (handler: (evt: AutoUpdateStatus) => void) => {
          autoUpdateStatusHandler = handler;
          autoUpdateStatusOn(handler);
          return () => undefined;
        },
      },
      download: {
        invoke: (...args: unknown[]) => autoUpdateDownloadInvoke(...args),
      },
      quitAndInstall: {
        invoke: (...args: unknown[]) => autoUpdateQuitAndInstallInvoke(...args),
      },
    },
    shell: {
      openExternal: {
        invoke: (...args: unknown[]) => openExternalInvoke(...args),
      },
      openFile: {
        invoke: (...args: unknown[]) => openFileInvoke(...args),
      },
      showItemInFolder: {
        invoke: (...args: unknown[]) => showItemInFolderInvoke(...args),
      },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'update.currentVersion') {
        return `Current version: ${options?.version ?? ''}`;
      }
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('@/renderer/components/base/AionModal', () => ({
  default: ({
    visible,
    children,
    header,
  }: {
    visible?: boolean;
    children?: React.ReactNode;
    header?: { title?: React.ReactNode } | React.ReactNode;
  }) => {
    if (!visible) {
      return null;
    }

    const title = typeof header === 'object' && header !== null && 'title' in header ? header.title : header;

    return (
      <div data-testid='update-modal'>
        <div>{title}</div>
        {children}
      </div>
    );
  },
}));

vi.mock('@/renderer/components/Markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
  Progress: ({ percent }: { percent: number }) => <div>{percent}</div>,
  Message: {
    error: (...args: unknown[]) => messageError(...args),
  },
}));

vi.mock('@icon-park/react', () => ({
  CheckOne: () => <span>check-icon</span>,
  Download: () => <span>download-icon</span>,
  FolderOpen: () => <span>folder-icon</span>,
  Refresh: () => <span>refresh-icon</span>,
  CloseOne: () => <span>close-icon</span>,
  Install: () => <span>install-icon</span>,
}));

const latestRelease = {
  tagName: 'v1.1.0',
  version: '1.1.0',
  name: 'ContextGo 1.1.0',
  body: 'Release notes',
  htmlUrl: 'https://github.com/contextgo/contextgo-releases/releases/tag/v1.1.0',
  prerelease: false,
  draft: false,
  assets: [],
};

const openModal = async () => {
  await act(async () => {
    openUpdateModalHandler?.();
    await Promise.resolve();
  });
};

describe('UpdateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    openUpdateModalHandler = undefined;
    autoUpdateStatusHandler = undefined;
    updateOpenOn.mockReset();
    autoUpdateStatusOn.mockReset();
    downloadProgressOn.mockReset();
    autoUpdateDownloadInvoke.mockResolvedValue(undefined);
    autoUpdateQuitAndInstallInvoke.mockResolvedValue(undefined);
    manualUpdateDownloadInvoke.mockResolvedValue(undefined);
    openExternalInvoke.mockResolvedValue(undefined);
    openFileInvoke.mockResolvedValue(undefined);
    showItemInFolderInvoke.mockResolvedValue(undefined);
  });

  it('keeps the modal in the final success state when auto-update emits a transient error during manual fallback', async () => {
    autoUpdateCheckInvoke.mockImplementation(async () => {
      autoUpdateStatusHandler?.({
        status: 'error',
        error: 'Transient auto updater failure',
      });

      return {
        success: false,
        msg: 'Transient auto updater failure',
      };
    });
    manualUpdateCheckInvoke.mockResolvedValue({
      success: true,
      data: {
        currentVersion: '1.0.0',
        updateAvailable: false,
        latest: latestRelease,
      },
    });

    const { default: UpdateModal } = await import('@/renderer/components/settings/UpdateModal');

    render(<UpdateModal />);
    await openModal();

    expect(await screen.findByText("You're up to date")).toBeInTheDocument();
    expect(screen.getByText('Current version: 1.0.0')).toBeInTheDocument();
    expect(screen.queryByText('Update failed')).not.toBeInTheDocument();
    expect(screen.queryByText('Transient auto updater failure')).not.toBeInTheDocument();
  });

  it('shows the final manual fallback error when the release check also fails', async () => {
    autoUpdateCheckInvoke.mockImplementation(async () => {
      autoUpdateStatusHandler?.({
        status: 'error',
        error: 'Transient auto updater failure',
      });

      return {
        success: false,
        msg: 'Transient auto updater failure',
      };
    });
    manualUpdateCheckInvoke.mockResolvedValue({
      success: false,
      msg: 'Manual release check failed',
    });

    const { default: UpdateModal } = await import('@/renderer/components/settings/UpdateModal');

    render(<UpdateModal />);
    await openModal();

    expect(await screen.findByText('Update failed')).toBeInTheDocument();
    expect(screen.getByText('Manual release check failed')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Transient auto updater failure')).not.toBeInTheDocument();
    });
  });
});

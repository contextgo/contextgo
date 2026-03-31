/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const convertInvokeMock = vi.fn();
const openFileInvokeMock = vi.fn();
const showItemInFolderInvokeMock = vi.fn();
const infoMessageMock = vi.fn();
const errorMessageMock = vi.fn();
const isElectronDesktopMock = vi.fn(() => true);

vi.mock('@/common', () => ({
  ipcBridge: {
    document: {
      convert: {
        invoke: (...args: any[]) => convertInvokeMock(...args),
      },
    },
    shell: {
      openFile: {
        invoke: (...args: any[]) => openFileInvokeMock(...args),
      },
      showItemInFolder: {
        invoke: (...args: any[]) => showItemInFolderInvokeMock(...args),
      },
    },
  },
}));

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => isElectronDesktopMock(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick} type='button'>
      {children}
    </button>
  ),
  Message: {
    useMessage: () => [
      {
        info: infoMessageMock,
        error: errorMessageMock,
      },
      <div data-testid='message-holder' key='message-holder' />,
    ],
  },
  Spin: ({ size }: { size?: number }) => (
    <div data-testid='spin' data-size={size}>
      loading...
    </div>
  ),
}));

vi.mock('../../src/renderer/pages/conversation/Preview/components/viewers/PDFViewer', () => ({
  default: ({ filePath, hideToolbar }: { filePath: string; hideToolbar?: boolean }) => (
    <div data-testid='pdf-preview' data-file-path={filePath} data-hide-toolbar={String(Boolean(hideToolbar))} />
  ),
}));

import PptViewer from '../../src/renderer/pages/conversation/Preview/components/viewers/PptViewer';

describe('PptViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isElectronDesktopMock.mockReturnValue(true);
    openFileInvokeMock.mockResolvedValue(undefined);
    showItemInFolderInvokeMock.mockResolvedValue(undefined);
  });

  it('shows loading spinner while conversion is pending', () => {
    convertInvokeMock.mockReturnValue(new Promise(() => {}));

    render(<PptViewer filePath='/test/file.pptx' />);

    expect(screen.getByTestId('spin')).toBeInTheDocument();
    expect(screen.getByText('preview.ppt.loading')).toBeInTheDocument();
  });

  it('shows error when file path is missing', () => {
    render(<PptViewer />);

    expect(screen.getByText('preview.errors.missingFilePath')).toBeInTheDocument();
    expect(screen.getByText('preview.ppt.installHint')).toBeInTheDocument();
  });

  it('renders PDF preview after successful conversion in desktop mode', async () => {
    convertInvokeMock.mockResolvedValue({
      to: 'ppt-pdf',
      result: {
        success: true,
        data: {
          pdfPath: '/cache/preview.pdf',
        },
      },
    });

    render(<PptViewer filePath='/test/file.pptx' />);

    const preview = await screen.findByTestId('pdf-preview');
    expect(preview).toHaveAttribute('data-file-path', '/cache/preview.pdf');
    expect(preview).toHaveAttribute('data-hide-toolbar', 'true');
    await waitFor(() => {
      expect(convertInvokeMock).toHaveBeenCalledWith({
        filePath: '/test/file.pptx',
        to: 'ppt-pdf',
      });
    });
  });

  it('renders iframe after successful conversion in web mode', async () => {
    isElectronDesktopMock.mockReturnValue(false);
    convertInvokeMock.mockResolvedValue({
      to: 'ppt-pdf',
      result: {
        success: true,
        data: {
          pdfPath: '/cache/generated preview.pdf',
        },
      },
    });

    render(<PptViewer filePath='/test/file.pptx' />);

    const iframe = await screen.findByTitle('preview.pptTitle');
    expect(iframe).toHaveAttribute('src', '/api/preview-file?path=%2Fcache%2Fgenerated%20preview.pdf');
  });

  it('shows conversion error and fallback actions when conversion fails', async () => {
    convertInvokeMock.mockResolvedValue({
      to: 'ppt-pdf',
      result: {
        success: false,
        error: 'LibreOffice conversion failed',
      },
    });

    render(<PptViewer filePath='/test/file.pptx' />);

    expect(await screen.findByText('LibreOffice conversion failed')).toBeInTheDocument();
    expect(screen.getByText('preview.ppt.installHint')).toBeInTheDocument();
    expect(screen.getByText('preview.pptOpenFile')).toBeInTheDocument();
    expect(screen.getByText('preview.pptShowLocation')).toBeInTheDocument();
  });

  it('opens the original file and reveals it in folder from fallback actions', async () => {
    convertInvokeMock.mockResolvedValue({
      to: 'ppt-pdf',
      result: {
        success: false,
        error: 'LibreOffice conversion failed',
      },
    });

    render(<PptViewer filePath='/test/file.pptx' />);

    await screen.findByText('LibreOffice conversion failed');

    fireEvent.click(screen.getByText('preview.pptOpenFile'));
    fireEvent.click(screen.getByText('preview.pptShowLocation'));

    expect(openFileInvokeMock).toHaveBeenCalledWith('/test/file.pptx');
    expect(showItemInFolderInvokeMock).toHaveBeenCalledWith('/test/file.pptx');
  });
});

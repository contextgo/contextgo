import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openFileInvokeMock = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    shell: {
      openFile: {
        invoke: (...args: unknown[]) => openFileInvokeMock(...args),
      },
    },
  },
}));

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => false,
}));

vi.mock('@/renderer/pages/conversation/Preview/context/PreviewToolbarExtrasContext', () => ({
  usePreviewToolbarExtras: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'preview.loading': 'Loading preview',
          'preview.pdf.title': 'PDF Preview',
          'preview.readOnlyLabel': 'Read only',
          'preview.pdf.pathMissing': 'PDF path is required',
          'preview.pdf.unableDisplay': 'Unable to display this PDF',
          'preview.pdf.loadFailed': 'Failed to load PDF',
          'preview.openInSystemApp': 'Open in system app',
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) => (
    <button type='button' onClick={onClick} title={title}>
      {children}
    </button>
  ),
  Message: {
    useMessage: () => [
      {
        error: vi.fn(),
        success: vi.fn(),
      },
      <div key='message-holder' data-testid='message-holder' />,
    ],
  },
}));

import PDFViewer from '@/renderer/pages/conversation/Preview/components/viewers/PDFViewer';

describe('PDFViewer browser fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an iframe and finishes loading outside Electron', async () => {
    render(<PDFViewer content='https://example.com/sample.pdf' />);

    const iframe = screen.getByTitle('PDF Preview');
    expect(iframe).toHaveAttribute('src', 'https://example.com/sample.pdf');

    fireEvent.load(iframe);

    await waitFor(() => {
      expect(screen.queryByText('Loading preview')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Open in system app' })).not.toBeInTheDocument();
  });

  it('rejects desktop-only file paths outside Electron', () => {
    render(<PDFViewer filePath='/tmp/report.pdf' />);

    expect(screen.queryByText('PDF path is required')).not.toBeInTheDocument();
    expect(screen.getByText('Unable to display this PDF')).toBeInTheDocument();
    expect(screen.queryByTitle('PDF Preview')).not.toBeInTheDocument();
  });
});

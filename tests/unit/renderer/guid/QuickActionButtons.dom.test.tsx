import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const listExternalSessionsInvokeMock = vi.fn(async () => ({
  success: true,
  data: {
    sessions: [{ sessionId: 's-1' }, { sessionId: 's-2' }],
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      (
        ({
          'guid.externalSessions.title': 'Continue external sessions',
          'guid.externalSessions.loading': 'Scanning external sessions...',
          'guid.externalSessions.loadingShort': 'Scanning',
          'guid.externalSessions.loadFailed': 'Failed to scan external sessions.',
          'guid.externalSessions.loadFailedShort': 'Scan failed',
          'guid.externalSessions.import': 'Take over',
          'guid.externalSessions.open': 'Open',
          'guid.externalSessions.emptyState': 'No external sessions are waiting yet.',
          'guid.externalSessions.emptyStateShort': 'None yet',
          'guid.externalSessions.readyCount': String(options?.count ?? '0') + ' sessions ready',
          'guid.externalSessions.readyCountShort': String(options?.count ?? '0') + ' ready',
        }) as Record<string, string>
      )[key] ?? String(options?.defaultValue ?? key),
  }),
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  acpConversation: {
    listExternalSessions: {
      invoke: (...args: unknown[]) => listExternalSessionsInvokeMock(...args),
    },
  },
}));

vi.mock('@icon-park/react', () => ({
  Download: () => <span data-testid='download-icon' />,
  Right: () => <span data-testid='right-icon' />,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick, className }: React.PropsWithChildren<{ onClick?: () => void; className?: string }>) => (
    <button type='button' className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

import { LayoutContext, type LayoutContextValue } from '@/renderer/hooks/context/LayoutContext';
import QuickActionButtons from '@/renderer/pages/guid/components/QuickActionButtons';

const mobileLayoutValue: LayoutContextValue = {
  isMobile: true,
  siderCollapsed: false,
  setSiderCollapsed: vi.fn(),
};

const desktopLayoutValue: LayoutContextValue = {
  isMobile: false,
  siderCollapsed: false,
  setSiderCollapsed: vi.fn(),
};

describe('QuickActionButtons', () => {
  it('renders mobile quick actions for external sessions only', async () => {
    const openExternalSessionsMock = vi.fn();

    render(
      <LayoutContext.Provider value={mobileLayoutValue}>
        <QuickActionButtons
          onOpenExternalSessions={openExternalSessionsMock}
          inactiveBorderColor='var(--border-base)'
          activeShadow='none'
        />
      </LayoutContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('2 ready')).toBeInTheDocument();
    });
    expect(screen.queryByText('Official Remote')).not.toBeInTheDocument();
    expect(screen.getByText('Continue external sessions')).toBeInTheDocument();
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Continue external sessions/i }));
    expect(openExternalSessionsMock).toHaveBeenCalledTimes(1);
    expect(listExternalSessionsInvokeMock).toHaveBeenCalledTimes(1);
  });

  it('uses the compact status copy for the desktop hover pill', async () => {
    const openExternalSessionsMock = vi.fn();

    render(
      <LayoutContext.Provider value={desktopLayoutValue}>
        <QuickActionButtons
          onOpenExternalSessions={openExternalSessionsMock}
          inactiveBorderColor='var(--border-base)'
          activeShadow='none'
        />
      </LayoutContext.Provider>
    );

    await waitFor(() => {
      expect(listExternalSessionsInvokeMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Continue external sessions · 2 ready')).toBeInTheDocument();
    expect(screen.queryByText('Continue external sessions · 2 sessions ready')).not.toBeInTheDocument();
  });
});

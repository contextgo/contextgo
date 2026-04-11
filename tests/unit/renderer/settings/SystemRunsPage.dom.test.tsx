import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-US' },
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.defaultValue) {
        return String(options.defaultValue);
      }

      if (key === 'settings.systemRunsLastChecked') {
        return 'Last checked: ' + String(options?.time ?? '--');
      }

      return key;
    },
  }),
}));

vi.mock('@/renderer/hooks/agent/useContextEngineActivity', () => ({
  useContextEngineActivity: () => ({
    status: 'idle',
    systemRuns: [],
    activeMaintenanceCount: 0,
    maintenanceAgents: [],
    lastCheckedAt: new Date('2026-04-11T06:08:00Z').getTime(),
  }),
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
  Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
  Tag: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Typography: {
    Title: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Paragraph: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className}>{children}</div>
    ),
  },
}));

vi.mock('@icon-park/react', () => ({
  Right: () => <span>right-icon</span>,
  Robot: () => <span>robot-icon</span>,
}));

import SystemRunsPage from '@/renderer/pages/settings/AgentSettings/SystemRunsPage';

describe('SystemRunsPage', () => {
  it('shows registered system agent definitions when there is no run history', () => {
    render(<SystemRunsPage />);

    expect(screen.getByText('No run history yet.')).toBeInTheDocument();
    expect(screen.getByText('Registered system agents')).toBeInTheDocument();
    expect(screen.getByText('Session Context Keeper')).toBeInTheDocument();
    expect(screen.getByText('Project Knowledge Promoter')).toBeInTheDocument();
    expect(screen.getAllByText(/Last checked:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Trigger:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Boundary:/).length).toBeGreaterThan(0);
  });
});

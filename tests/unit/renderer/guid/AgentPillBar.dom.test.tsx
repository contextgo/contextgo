import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
    className,
    'aria-label': ariaLabel,
  }: React.PropsWithChildren<{
    onClick?: () => void;
    className?: string;
    'aria-label'?: string;
  }>) => (
    <button type='button' className={className} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

vi.mock('@/renderer/utils/model/agentLogo', () => ({
  getAgentLogo: (backend: string) => `/logos/${backend}.svg`,
}));

vi.mock('@/renderer/utils/platform', () => ({
  resolveExtensionAssetUrl: () => undefined,
}));

import { LayoutContext, type LayoutContextValue } from '@/renderer/hooks/context/LayoutContext';
import AgentPillBar from '@/renderer/pages/guid/components/AgentPillBar';
import type { AvailableAgent } from '@/renderer/pages/guid/types';

const mobileLayoutValue: LayoutContextValue = {
  isMobile: true,
  siderCollapsed: false,
  setSiderCollapsed: vi.fn(),
};

const availableAgents: AvailableAgent[] = [
  {
    backend: 'codex',
    name: 'Codex',
  },
  {
    backend: 'gemini',
    name: 'Gemini',
  },
];

describe('AgentPillBar', () => {
  it('keeps mobile chips compact for unselected agents', () => {
    const onSelectAgent = vi.fn();

    render(
      <LayoutContext.Provider value={mobileLayoutValue}>
        <AgentPillBar
          availableAgents={availableAgents}
          selectedAgentKey='codex'
          getAgentKey={(agent) => agent.backend}
          onSelectAgent={onSelectAgent}
        />
      </LayoutContext.Provider>
    );

    expect(screen.getByText('Codex')).toBeInTheDocument();
    expect(screen.queryByText('Gemini')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Gemini' }));
    expect(onSelectAgent).toHaveBeenCalledWith('gemini');
  });
});

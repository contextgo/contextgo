import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/renderer/pages/settings/AgentSettings/Workspace', () => ({
  default: () => <div data-testid='agent-workspace'>workspace</div>,
}));

import AgentsPage from '@/renderer/pages/agents';

describe('AgentsPage', () => {
  it('wraps the workspace in the shared secondary page shell so content keeps page padding', () => {
    const { container } = render(<AgentsPage />);

    expect(container.firstElementChild).toHaveClass('secondary-page-frame');
    expect(container.querySelector('.secondary-page-inner')).toBeTruthy();
    expect(screen.getByTestId('agent-workspace')).toBeInTheDocument();
  });
});

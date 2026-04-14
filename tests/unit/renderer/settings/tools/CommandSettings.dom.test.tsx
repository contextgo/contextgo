import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'settings.commands.title': 'Commands',
        'settings.commands.description':
          'Commands are scoped to each workspace. Manage project commands from the workspace automation panel instead of a global settings library.',
        'settings.commands.usageHint':
          'Open a conversation that is bound to a workspace, then edit Commands there to save them into .contextgo/commands.json for that project.',
        'settings.commands.emptyState': 'No global command library is used anymore.',
      };

      return map[key] ?? key;
    },
  }),
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid='settings-page-wrapper'>{children}</div>,
}));

vi.mock('@arco-design/web-react', () => ({
  Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
  Typography: {
    Title: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
    Paragraph: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  },
}));

import CommandSettings from '@/renderer/pages/settings/ToolsSettings/CommandSettings';

describe('CommandSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains that commands are managed per workspace instead of globally', () => {
    render(<CommandSettings />);

    expect(screen.getByText('Commands')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Commands are scoped to each workspace. Manage project commands from the workspace automation panel instead of a global settings library.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Open a conversation that is bound to a workspace, then edit Commands there to save them into .contextgo/commands.json for that project.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('No global command library is used anymore.')).toBeInTheDocument();
  });
});

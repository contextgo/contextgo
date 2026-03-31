import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

function MockMenu({ children }: React.PropsWithChildren) {
  return <div>{children}</div>;
}

MockMenu.Item = ({ children, disabled, ...rest }: React.PropsWithChildren<Record<string, unknown>>) => (
  <div aria-disabled={disabled ? 'true' : undefined} {...rest}>
    {children}
  </div>
);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      (
        ({
          'guid.openclaw.defaultAgent': 'Default',
          'conversation.welcome.none': 'None',
        }) as Record<string, string>
      )[key] ?? String(options?.defaultValue ?? key),
  }),
}));

vi.mock('@/renderer/utils/platform', () => ({
  resolveExtensionAssetUrl: (value?: string) => value,
}));

vi.mock('@icon-park/react', () => ({
  Down: () => <span data-testid='down-icon' />,
  Robot: () => <span data-testid='robot-icon' />,
}));

vi.mock('@arco-design/web-react', () => {
  return {
    Dropdown: ({ children, droplist }: React.PropsWithChildren<{ droplist?: React.ReactNode }>) => (
      <div>
        {children}
        {droplist}
      </div>
    ),
    Menu: MockMenu,
  };
});

import MentionDropdown, { MentionSelectorBadge } from '@/renderer/pages/guid/components/MentionDropdown';

describe('MentionDropdown', () => {
  it('shows default badge and workspace description for OpenClaw agents', () => {
    render(
      <MentionDropdown
        menuRef={React.createRef<HTMLDivElement>()}
        selectedKey='openclaw:main'
        onSelect={vi.fn()}
        options={[
          {
            key: 'openclaw:main',
            label: 'OpenClaw',
            tokens: new Set(['openclaw']),
            avatar: undefined,
            avatarImage: undefined,
            logo: undefined,
            description: '/tmp/openclaw-default',
            isDefault: true,
          },
        ]}
      />
    );

    expect(screen.getByText('OpenClaw')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('/tmp/openclaw-default')).toBeInTheDocument();
  });

  it('renders an empty-state row when no agents are available', () => {
    render(
      <MentionDropdown menuRef={React.createRef<HTMLDivElement>()} selectedKey='' onSelect={vi.fn()} options={[]} />
    );

    expect(screen.getByText('None')).toBeInTheDocument();
  });
});

describe('MentionSelectorBadge', () => {
  it('shows helper text with default marker and workspace', () => {
    render(
      <MentionSelectorBadge
        visible
        open={false}
        onOpenChange={vi.fn()}
        agentLabel='OpenClaw'
        agentDescription='/tmp/openclaw-default'
        isDefault
        mentionMenu={<div>menu</div>}
        onResetQuery={vi.fn()}
      />
    );

    expect(screen.getByText('@OpenClaw')).toBeInTheDocument();
    expect(screen.getByText('Default · /tmp/openclaw-default')).toBeInTheDocument();
  });

  it('does not render when the selector is hidden', () => {
    const { container } = render(
      <MentionSelectorBadge
        visible={false}
        open={false}
        onOpenChange={vi.fn()}
        agentLabel='OpenClaw'
        mentionMenu={<div>menu</div>}
        onResetQuery={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});

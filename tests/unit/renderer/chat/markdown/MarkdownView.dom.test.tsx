/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MarkdownView from '../../../../../src/renderer/components/Markdown';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    icon,
    ...props
  }: { children?: React.ReactNode; icon?: React.ReactNode } & Record<string, unknown>) => (
    <button type='button' {...props}>
      {icon}
      {children}
    </button>
  ),
  Message: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@icon-park/react', () => ({
  Copy: () => <span>copy</span>,
}));

vi.mock('@/renderer/utils/ui/clipboard', () => ({
  copyText: vi.fn(async () => undefined),
}));

vi.mock('react-syntax-highlighter', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-syntax-highlighter/dist/esm/styles/hljs', () => ({
  vs: {},
  vs2015: {},
}));

vi.mock('@/renderer/utils/platform', () => ({
  openExternalUrl: vi.fn(async () => undefined),
}));

vi.mock('@renderer/components/media/LocalImageView', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt || ''} />,
}));

vi.mock('../../../../../src/renderer/components/Markdown/ShadowView', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@renderer/utils/chat/latexDelimiters', () => ({
  convertLatexDelimiters: (text: string) => text,
}));

describe('MarkdownView', () => {
  it('renders single-line fenced code blocks from skill markdown with full block chrome', () => {
    render(<MarkdownView>{'# Workflow\n\n```bash\nnpm run ops -- auth cloudflare newapi\n```\n'}</MarkdownView>);

    expect(screen.getByText('Workflow')).toBeInTheDocument();
    expect(screen.getByText('preview.code')).toBeInTheDocument();
    expect(screen.getByText('BASH')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.copy' })).toBeInTheDocument();
    expect(screen.getByText('npm run ops -- auth cloudflare newapi')).toBeInTheDocument();
  });
});

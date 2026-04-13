/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CodeBlock from '../../../../../src/renderer/components/Markdown/CodeBlock';

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
  Down: () => <span>down</span>,
  Up: () => <span>up</span>,
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

describe('CodeBlock', () => {
  it('renders default multi-line code blocks with the unified card chrome', () => {
    const { container } = render(<CodeBlock className='language-ts'>{'const a = 1;\nconst b = 2;'}</CodeBlock>);

    expect(screen.getByText('preview.code')).toBeInTheDocument();
    expect(screen.getByText('TS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.expandMore' })).toBeInTheDocument();
    expect(container.querySelector('.not-prose')).not.toBeNull();
    expect(screen.queryByText('<ts>')).not.toBeInTheDocument();
  });

  it('keeps result-card variant on the same card structure without fallback class', () => {
    const { container } = render(
      <CodeBlock className='language-json' codeVariant='result-card'>
        {'{"ok":true}\n{"count":1}'}
      </CodeBlock>
    );

    expect(screen.getByText('preview.code')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(container.querySelector('.not-prose')).toBeNull();
  });

  it('renders single-line plain text blocks without the code chrome', () => {
    render(
      <CodeBlock className='language-text'>
        {'https://newapi-admin.infermesh.org/cdn-cgi/access/cli?aud=9daf5065b09d0d7cc3e2750fa6b\n'}
      </CodeBlock>
    );

    expect(screen.queryByText('preview.code')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.expandMore' })).not.toBeInTheDocument();
    expect(
      screen.getByText('https://newapi-admin.infermesh.org/cdn-cgi/access/cli?aud=9daf5065b09d0d7cc3e2750fa6b')
    ).toBeInTheDocument();
  });

  it('renders single-line bash blocks without the code chrome', () => {
    render(<CodeBlock className='language-bash'>{'npm run ops -- auth cloudflare newapi\n'}</CodeBlock>);

    expect(screen.queryByText('preview.code')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.expandMore' })).not.toBeInTheDocument();
    expect(screen.getByText('npm run ops -- auth cloudflare newapi')).toBeInTheDocument();
  });
});

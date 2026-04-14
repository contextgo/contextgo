/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CodeBlock from '../../../../../src/renderer/components/Markdown/CodeBlock';

const syntaxHighlighterMock = vi.fn();

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
  default: (props: { children?: React.ReactNode; wrapLongLines?: boolean }) => {
    syntaxHighlighterMock(props);
    return <div>{props.children}</div>;
  },
}));

vi.mock('react-syntax-highlighter/dist/esm/styles/hljs', () => ({
  vs: {},
  vs2015: {},
}));

describe('CodeBlock', () => {
  beforeEach(() => {
    syntaxHighlighterMock.mockClear();
  });

  it('renders default multi-line code blocks expanded without the collapse toggle for short snippets', () => {
    const { container } = render(<CodeBlock className='language-ts'>{'const a = 1;\nconst b = 2;'}</CodeBlock>);

    expect(screen.getByText('preview.code')).toBeInTheDocument();
    expect(screen.getByText('TS')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.copy' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.expandMore' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.collapse' })).not.toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes('const a = 1;') && content.includes('const b = 2;'))
    ).toBeInTheDocument();
    expect(container.querySelector('.not-prose')).not.toBeNull();
    expect(screen.queryByText('<ts>')).not.toBeInTheDocument();
  });

  it('keeps long multi-line code blocks expanded by default and exposes a collapse toggle', () => {
    const longSnippet = Array.from({ length: 28 }, (_, index) => `line ${index + 1}`).join('\n');

    render(<CodeBlock className='language-text'>{longSnippet}</CodeBlock>);

    expect(screen.getByRole('button', { name: 'common.collapse' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'common.expandMore' })).not.toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes('line 1') && content.includes('line 28'))
    ).toBeInTheDocument();
  });

  it('enables soft wrapping for text code blocks so long prompt templates do not stay on a single visual line', () => {
    render(
      <CodeBlock className='language-text'>
        {
          'Restate the task, identify the main constraints and risks, then propose a clear step-by-step implementation plan.\nWrap this long line for reading.'
        }
      </CodeBlock>
    );

    expect(syntaxHighlighterMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        wrapLongLines: true,
      })
    );
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

  it('renders single-line plain text blocks as standard code blocks when markdown treats them as fenced blocks', () => {
    render(
      <CodeBlock className='language-text'>
        {'https://newapi-admin.infermesh.org/cdn-cgi/access/cli?aud=9daf5065b09d0d7cc3e2750fa6b\n'}
      </CodeBlock>
    );

    expect(screen.getByText('preview.code')).toBeInTheDocument();
    expect(screen.getByText('TEXT')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.copy' })).toBeInTheDocument();
    expect(
      screen.getByText('https://newapi-admin.infermesh.org/cdn-cgi/access/cli?aud=9daf5065b09d0d7cc3e2750fa6b')
    ).toBeInTheDocument();
  });

  it('renders single-line bash blocks as standard code blocks when markdown treats them as fenced blocks', () => {
    render(<CodeBlock className='language-bash'>{'npm run ops -- auth cloudflare newapi\n'}</CodeBlock>);

    expect(screen.getByText('preview.code')).toBeInTheDocument();
    expect(screen.getByText('BASH')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.copy' })).toBeInTheDocument();
    expect(screen.getByText('npm run ops -- auth cloudflare newapi')).toBeInTheDocument();
  });

  it('does not enable soft wrapping for non-text code blocks', () => {
    render(<CodeBlock className='language-bash'>{'echo hello\necho world'}</CodeBlock>);

    expect(syntaxHighlighterMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        wrapLongLines: false,
      })
    );
  });
});

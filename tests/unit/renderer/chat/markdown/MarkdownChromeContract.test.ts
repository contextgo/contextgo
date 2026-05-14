import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const codeBlockSource = readFileSync(resolve(process.cwd(), 'src/renderer/components/Markdown/CodeBlock.tsx'), 'utf8');
const shadowViewSource = readFileSync(
  resolve(process.cwd(), 'src/renderer/components/Markdown/ShadowView.tsx'),
  'utf8'
);
const codeBlockCssSource = readFileSync(
  resolve(process.cwd(), 'src/renderer/components/Markdown/code-block.css'),
  'utf8'
);

describe('Markdown code chrome contract', () => {
  it('uses dedicated markdown code block classes instead of relying on external utility or arco styles', () => {
    expect(codeBlockSource).toContain('markdown-code-block');
    expect(codeBlockSource).toContain('markdown-code-block__header');
    expect(codeBlockSource).toContain('markdown-code-block__copy');
    expect(codeBlockSource).toContain('markdown-code-block__toggle');
  });

  it('injects markdown code block chrome styles into the shadow root stylesheet', () => {
    expect(shadowViewSource).toContain("from './code-block.css?raw'");
    expect(shadowViewSource).toContain('${codeBlockCss}');
    expect(codeBlockCssSource).toContain('.markdown-code-block');
    expect(codeBlockCssSource).toContain('.markdown-code-block__header');
    expect(codeBlockCssSource).toContain('.markdown-code-block__body');
    expect(codeBlockCssSource).toContain('.markdown-code-block__language');
    expect(codeBlockCssSource).toContain('.markdown-code-block__action');
  });
});

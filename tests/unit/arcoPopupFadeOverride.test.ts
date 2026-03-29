import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('arco popup fade override', () => {
  it('keeps popup enter states fully opaque in global overrides', () => {
    const cssPath = resolve(process.cwd(), 'src/renderer/styles/arco-override.css');
    const css = readFileSync(cssPath, 'utf8');

    expect(css).toContain('.arco-trigger-popup.fadeIn-appear');
    expect(css).toContain('.arco-trigger-popup.fadeIn-enter');
    expect(css).toContain('.arco-select-popup.fadeIn-appear');
    expect(css).toContain('.arco-picker-container.fadeIn-appear');
    expect(css).toContain('opacity: 1 !important;');
    expect(css).toContain('transition: none !important;');
  });
});

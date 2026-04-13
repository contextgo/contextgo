/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import FlexFullContainer from '@/renderer/components/layout/FlexFullContainer';

describe('FlexFullContainer', () => {
  it('renders a full-size flex column container so nested flex-1 scroll areas can size correctly', () => {
    const { container } = render(
      <FlexFullContainer className='outer-shell' containerClassName='inner-shell'>
        <div>workspace-scroll-content</div>
      </FlexFullContainer>
    );

    expect(screen.getByText('workspace-scroll-content')).toBeInTheDocument();

    const outer = container.querySelector('.outer-shell');
    const inner = container.querySelector('.inner-shell');

    expect(outer?.className).toContain('flex-1');
    expect(outer?.className).toContain('relative');
    expect(outer?.className).toContain('min-h-0');
    expect(inner?.className).toContain('absolute');
    expect(inner?.className).toContain('size-full');
    expect(inner?.className).toContain('min-h-0');
    expect(inner?.className).toContain('flex');
    expect(inner?.className).toContain('flex-col');
  });
});

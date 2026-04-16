import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import WorkbenchHost from '@/renderer/pages/WorkbenchHost';
import { useWorkbenchHostContext } from '@/renderer/pages/WorkbenchHost/context';
import { conversationCoworkWorkbench } from '@/renderer/pages/WorkbenchHost/definitions';

const WorkbenchProbe: React.FC = () => {
  const context = useWorkbenchHostContext();

  return (
    <>
      <div data-testid='workbench-kind'>{context?.definition.kind}</div>
      <div data-testid='workbench-capabilities'>{context?.definition.capabilities.join(',')}</div>
      <div data-testid='workbench-shell-style'>{context?.definition.shellContract.shellStyle}</div>
    </>
  );
};

describe('WorkbenchHost', () => {
  it('provides the full workbench definition through context', () => {
    render(
      <WorkbenchHost definition={conversationCoworkWorkbench}>
        <WorkbenchProbe />
      </WorkbenchHost>
    );

    expect(screen.getByTestId('workbench-kind')).toHaveTextContent('conversation-cowork');
    expect(screen.getByTestId('workbench-capabilities')).toHaveTextContent('chat,preview,workspace,browser');
    expect(screen.getByTestId('workbench-shell-style')).toHaveTextContent('conversation');
  });
});

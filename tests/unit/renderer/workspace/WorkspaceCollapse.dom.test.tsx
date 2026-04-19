/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import WorkspaceCollapse from '@/renderer/pages/conversation/components/WorkspaceCollapse';

describe('WorkspaceCollapse', () => {
  it('toggles from header clicks and lets header actions handle their own clicks', () => {
    const onToggle = vi.fn();

    render(
      <WorkspaceCollapse
        expanded={true}
        onToggle={onToggle}
        header={<span>Project Alpha</span>}
        headerActions={
          <button
            type='button'
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            Create
          </button>
        }
      >
        <div>Workspace child</div>
      </WorkspaceCollapse>
    );

    fireEvent.click(screen.getByText('Project Alpha'));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Workspace child')).toBeInTheDocument();
  });

  it('keeps content visible and hides the header when the sider is collapsed', () => {
    render(
      <WorkspaceCollapse expanded={false} onToggle={vi.fn()} header={<span>Project Beta</span>} siderCollapsed={true}>
        <div>Collapsed child</div>
      </WorkspaceCollapse>
    );

    expect(screen.queryByText('Project Beta')).toBeNull();
    expect(screen.getByText('Collapsed child')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/renderer/components/base', () => ({
  ContextGoModal: ({ visible, children }: { visible?: boolean; children?: React.ReactNode }) =>
    visible ? <div data-testid='paste-confirm-modal'>{children}</div> : null,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
  Checkbox: ({
    checked,
    children,
    onChange,
  }: {
    checked?: boolean;
    children: React.ReactNode;
    onChange?: (value: boolean) => void;
  }) => (
    <label>
      <input type='checkbox' checked={checked} onChange={(event) => onChange?.(event.target.checked)} />
      {children}
    </label>
  ),
}));

vi.mock('@icon-park/react', () => ({
  FileText: ({ className }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid='file-text-icon' className={className}>
      file
    </span>
  ),
  FolderOpen: ({ className }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span data-testid='folder-open-icon' className={className}>
      folder
    </span>
  ),
}));

import PasteConfirmModal from '@/renderer/pages/conversation/Workspace/components/PasteConfirmModal';

const defaultProps = {
  pasteConfirm: {
    visible: true,
    fileName: 'README.md',
    filesToPaste: ['README.md'],
    doNotAsk: false,
  },
  setPasteConfirm: vi.fn(),
  closePasteConfirm: vi.fn(),
  handlePasteConfirm: vi.fn(async () => {}),
  targetFolderPath: {
    fullPath: '/workspace/docs',
  },
  t: ((key: string) => key) as never,
};

describe('PasteConfirmModal', () => {
  it('uses shared icon slots instead of inline offset tweaks in the visible state', () => {
    const { container } = render(<PasteConfirmModal {...defaultProps} />);

    const slots = container.querySelectorAll('.app-icon-slot');
    const fileIcons = screen.getAllByTestId('file-text-icon');

    expect(screen.getByTestId('paste-confirm-modal')).toBeInTheDocument();
    expect(slots).toHaveLength(3);
    expect(slots[0]).toHaveClass('app-icon-slot--xl');
    expect(slots[1]).toHaveClass('app-icon-slot--lg');
    expect(slots[2]).toHaveClass('app-icon-slot--lg');
    expect(fileIcons[0]).toHaveClass('app-icon');
    expect(fileIcons[0]).not.toHaveAttribute('style');
  });

  it('does not render modal content when the modal is hidden', () => {
    render(
      <PasteConfirmModal
        {...defaultProps}
        pasteConfirm={{
          ...defaultProps.pasteConfirm,
          visible: false,
        }}
      />
    );

    expect(screen.queryByTestId('paste-confirm-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('file-text-icon')).not.toBeInTheDocument();
  });
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const modalSpy = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
    className,
    type,
    loading,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    type?: string;
    loading?: boolean;
    disabled?: boolean;
  }) => (
    <button
      type='button'
      data-button-type={type}
      data-loading={loading ? 'true' : 'false'}
      className={className}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/renderer/components/base', () => ({
  ContextGoModal: (props: Record<string, unknown>) => {
    modalSpy(props);

    const header = props.header as { title?: React.ReactNode } | undefined;
    const footer = props.footer as { render?: () => React.ReactNode } | null | undefined;

    return (
      <div data-testid='settings-sub-modal-root' className={props.className as string | undefined}>
        <div data-testid='modal-title'>{header?.title}</div>
        <div data-testid='modal-body'>{props.children as React.ReactNode}</div>
        <div data-testid='modal-footer'>
          {footer && typeof footer === 'object' && 'render' in footer ? footer.render?.() : null}
        </div>
      </div>
    );
  },
}));

import SettingsSubModal from '@/renderer/components/settings/SettingsSubModal';

describe('SettingsSubModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides the shared settings modal shell by default', () => {
    const handleCancel = vi.fn();
    const handleOk = vi.fn();

    render(
      <SettingsSubModal visible onCancel={handleCancel} onOk={handleOk} title='Shared Title'>
        <div>Body Content</div>
      </SettingsSubModal>
    );

    expect(screen.getByTestId('settings-sub-modal-root')).toHaveClass('settings-sub-modal');
    expect(screen.getByTestId('modal-title')).toHaveTextContent('Shared Title');

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });

    expect(cancelButton).toHaveClass('min-w-88px');
    expect(confirmButton).toHaveClass('min-w-104px');

    fireEvent.click(cancelButton);
    fireEvent.click(confirmButton);

    expect(handleCancel).toHaveBeenCalledTimes(1);
    expect(handleOk).toHaveBeenCalledTimes(1);

    const props = modalSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(props.contentStyle).toMatchObject({ padding: '12px 24px 24px' });
  });

  it('preserves explicit custom footer and merges shared classes', () => {
    render(
      <SettingsSubModal
        visible
        onCancel={() => undefined}
        title='Custom Footer'
        footer={{
          className: 'custom-footer',
          render: () => <div>Footer Content</div>,
        }}
      >
        <div>Body</div>
      </SettingsSubModal>
    );

    expect(screen.getByText('Footer Content')).toBeInTheDocument();

    const props = modalSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    const footer = props.footer as { className?: string };
    expect(footer.className).toContain('px-24px pb-20px');
    expect(footer.className).toContain('custom-footer');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@icon-park/react', () => ({
  Close: ({
    className,
    size,
    fill: _fill,
    theme: _theme,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement> & {
    fill?: string;
    size?: number | string;
    theme?: string;
  }) => (
    <span data-testid='preview-tabs-close-icon' data-size={String(size)} className={className} {...props}>
      close
    </span>
  ),
}));

vi.mock('@arco-design/web-react/icon', () => ({
  IconShrink: ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <span
      data-testid='preview-tabs-collapse-icon'
      data-font-size={style?.fontSize ? String(style.fontSize) : ''}
      className={className}
    >
      shrink
    </span>
  ),
}));

import PreviewTabs, {
  type PreviewTab,
} from '@/renderer/pages/conversation/Preview/components/PreviewPanel/PreviewTabs';

const createTab = (overrides?: Partial<PreviewTab>): PreviewTab => ({
  id: 'tab-1',
  title: 'README.md',
  ...overrides,
});

const renderPreviewTabs = (tabs: PreviewTab[], onClosePanel?: () => void) => {
  const onSwitchTab = vi.fn();
  const onCloseTab = vi.fn();
  const onContextMenu = vi.fn();
  const handleClosePanel = onClosePanel ?? vi.fn();

  render(
    <PreviewTabs
      tabs={tabs}
      activeTabId={tabs[0]?.id ?? null}
      tabFadeState={{ left: false, right: false }}
      tabsContainerRef={React.createRef<HTMLDivElement>()}
      onSwitchTab={onSwitchTab}
      onCloseTab={onCloseTab}
      onContextMenu={onContextMenu}
      onClosePanel={handleClosePanel}
    />
  );

  return {
    onSwitchTab,
    onCloseTab,
    onContextMenu,
    onClosePanel: handleClosePanel,
  };
};

describe('PreviewTabs', () => {
  it('keeps the tab title and close control in the same aligned container with compact icon sizing', () => {
    renderPreviewTabs([createTab({ isDirty: true })]);

    const title = screen.getByText('README.md');
    const tab = title.closest('.preview-tabs__tab');
    const closeButton = screen.getByTitle('common.close');
    const closeIcon = screen.getByTestId('preview-tabs-close-icon');

    expect(tab).not.toBeNull();
    expect(tab).toContainElement(closeButton);
    expect(closeButton).toHaveClass('preview-tabs__close');
    expect(closeIcon).toHaveAttribute('data-size', '12');
  });

  it('closes the tab without switching when the close control is clicked and keeps collapse icon compact', () => {
    const { onCloseTab, onSwitchTab, onClosePanel } = renderPreviewTabs([createTab()]);

    const closeButton = screen.getByTitle('common.close');
    const collapseButton = screen.getByTitle('preview.collapsePanel');
    const collapseIcon = screen.getByTestId('preview-tabs-collapse-icon');

    fireEvent.click(closeButton);
    fireEvent.click(collapseButton);

    expect(onCloseTab).toHaveBeenCalledWith('tab-1');
    expect(onSwitchTab).not.toHaveBeenCalled();
    expect(onClosePanel).toHaveBeenCalledTimes(1);
    expect(collapseButton).toHaveClass('preview-tabs__collapse-button');
    expect(collapseIcon).toHaveAttribute('data-font-size', '12');
  });

  it('renders the empty state when no preview tabs are open', () => {
    renderPreviewTabs([], undefined);

    expect(screen.getByText('preview.noTabs')).toBeInTheDocument();
    expect(screen.queryByTitle('common.close')).not.toBeInTheDocument();
  });
});

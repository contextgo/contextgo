import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ButtonHTMLAttributes } from 'react';

const mockUseLayoutContext = vi.fn(() => ({ isMobile: true }));
const dialogShowOpenInvokeMock = vi.fn();
const messageErrorMock = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    dialog: {
      showOpen: {
        invoke: (...args: unknown[]) => dialogShowOpenInvokeMock(...args),
      },
    },
  },
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => mockUseLayoutContext(),
}));

vi.mock('@/renderer/services/FileService', () => ({
  FileService: {
    processDroppedFiles: vi.fn(),
  },
  getCleanFileNames: (files: string[]) => files,
  MAX_UPLOAD_SIZE_MB: 50,
}));

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => false,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
  }),
}));

vi.mock('@icon-park/react', () => ({
  ArrowUp: () => <span>ArrowUp</span>,
  Down: () => <span>Down</span>,
  FolderOpen: () => <span>FolderOpen</span>,
  Plus: () => <span>Plus</span>,
  Shield: () => <span>Shield</span>,
  UploadOne: () => <span>UploadOne</span>,
  Robot: () => <span>Robot</span>,
}));

vi.mock('@arco-design/web-react/icon', () => ({
  IconClose: () => <span>Close</span>,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
    icon,
    className,
    disabled,
    loading,
    type,
    shape,
    style,
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: React.ReactNode;
    loading?: boolean;
    shape?: string;
  }) => (
    <button
      type='button'
      className={className}
      disabled={disabled}
      data-loading={loading ? 'true' : 'false'}
      data-button-type={type}
      data-button-shape={shape}
      style={style}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  ),
  Dropdown: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Menu: Object.assign(
    ({ children }: React.PropsWithChildren<{ onClickMenuItem?: (key: string) => void }>) => <div>{children}</div>,
    {
      Item: ({ children }: React.PropsWithChildren<{ key?: string }>) => <div>{children}</div>,
      ItemGroup: ({ children }: React.PropsWithChildren<{ title?: string }>) => <div>{children}</div>,
      SubMenu: ({ children }: React.PropsWithChildren<{ key?: string; title?: React.ReactNode }>) => <div>{children}</div>,
    }
  ),
  Message: {
    error: (...args: unknown[]) => messageErrorMock(...args),
  },
  Tooltip: ({ children }: React.PropsWithChildren<{ content?: React.ReactNode }>) => <>{children}</>,
}));

import GuidActionRow from '@/renderer/pages/guid/components/GuidActionRow';
import type { AvailableAgent } from '@/renderer/pages/guid/types';

const baseProps = {
  files: [],
  onFilesUploaded: vi.fn(),
  onSelectWorkspace: vi.fn(),
  modelSelectorNode: <button type='button'>Model</button>,
  selectedAgent: 'gemini' as const,
  effectiveModeAgent: 'gemini',
  selectedMode: 'default',
  onModeSelect: vi.fn(),
  isPresetAgent: false,
  selectedAssistantInfo: undefined,
  customAgents: [],
  localeKey: 'en-US',
  onClosePresetTag: vi.fn(),
  loading: false,
  isButtonDisabled: false,
  onSend: vi.fn(),
};

const presetAgentInfo: AvailableAgent = {
  backend: 'gemini',
  name: 'Preset Agent',
  avatar: '',
};

describe('GuidActionRow mobile layout', () => {
  it('keeps action controls and submit button as separate mobile regions without creating a full-width submit row', () => {
    render(<GuidActionRow {...baseProps} />);

    const row = screen.getByTestId('guid-action-row');
    const tools = screen.getByTestId('guid-action-tools');
    const controls = screen.getByTestId('guid-action-controls');
    const submit = screen.getByTestId('guid-action-submit');

    expect(row).toBeInTheDocument();
    expect(tools).toBeInTheDocument();
    expect(controls).toBeInTheDocument();
    expect(submit).toBeInTheDocument();
    expect(controls.parentElement).toBe(tools);
    expect(submit.parentElement).toBe(row);
  });

  it('renders preset agent metadata in a secondary row instead of mixing it into the control cluster', () => {
    render(
      <GuidActionRow
        {...baseProps}
        isPresetAgent
        selectedAssistantInfo={presetAgentInfo}
      />
    );

    const tools = screen.getByTestId('guid-action-tools');
    const meta = screen.getByTestId('guid-action-meta');

    expect(meta).toBeInTheDocument();
    expect(meta.parentElement).toBe(tools);
  });

  it('uses the send button callback from the action row', () => {
    const onSend = vi.fn();

    render(<GuidActionRow {...baseProps} onSend={onSend} />);

    const submitButton = screen.getByTestId('guid-action-submit').querySelector('button');
    expect(submitButton).toBeTruthy();

    fireEvent.click(submitButton as HTMLButtonElement);
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import type { SlashCommandItem } from '@/common/chat/slash/types';
import type { FileOrFolderItem } from '@/renderer/utils/file/fileTypes';

let capturedSlashOptions:
  | {
      onSelectTemplate?: (command: SlashCommandItem) => void;
    }
  | undefined;
let _capturedDragUploadOptions:
  | {
      onUploadStateChange?: (state: { isUploading: boolean; pendingCount: number }) => void;
    }
  | undefined;
let capturedPasteOptions:
  | {
      onUploadStateChange?: (state: { isUploading: boolean; pendingCount: number }) => void;
    }
  | undefined;

const mockUseConversationContextSafe = vi.fn(() => ({ conversationId: 'test-conv-1' }));
const mockUseLayoutContext = vi.fn(() => ({ isMobile: false }));
const mockUsePreviewContext = vi.fn(() => ({
  setSendBoxHandler: vi.fn(),
  domSnippets: [],
  removeDomSnippet: vi.fn(),
  clearDomSnippets: vi.fn(),
}));
const mockUseInputFocusRing = vi.fn(() => ({
  activeBorderColor: '#000',
  inactiveBorderColor: '#ccc',
  activeShadow: '0 0 0 2px rgba(0,0,0,0.1)',
}));
const mockUseCompositionInput = vi.fn(() => ({
  compositionHandlers: {},
  createKeyDownHandler: vi.fn(() => vi.fn()),
}));
const mockUseDragUpload = vi.fn(() => ({
  isFileDragging: false,
  dragHandlers: {},
}));
const mockUsePasteService = vi.fn(() => ({
  onPaste: vi.fn(),
  onFocus: vi.fn(),
}));
const mockListWorkspaceFileItems = vi.fn();
const messageWarningMock = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      warmup: {
        invoke: vi.fn().mockResolvedValue(undefined),
      },
    },
  },
}));

vi.mock('@/renderer/hooks/context/ConversationContext', () => ({
  useConversationContextSafe: () => mockUseConversationContextSafe(),
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => mockUseLayoutContext(),
}));

vi.mock('@/renderer/pages/conversation/Preview', () => ({
  usePreviewContext: () => mockUsePreviewContext(),
  usePreviewComposer: () => mockUsePreviewContext(),
}));

vi.mock('@/renderer/hooks/chat/useInputFocusRing', () => ({
  useInputFocusRing: () => mockUseInputFocusRing(),
}));

vi.mock('@/renderer/hooks/chat/useCompositionInput', () => ({
  useCompositionInput: () => mockUseCompositionInput(),
}));

vi.mock('@/renderer/hooks/file/useDragUpload', () => ({
  useDragUpload: (options: unknown) => {
    _capturedDragUploadOptions = options as {
      onUploadStateChange?: (state: { isUploading: boolean; pendingCount: number }) => void;
    };
    return mockUseDragUpload();
  },
}));

vi.mock('@/renderer/hooks/file/usePasteService', () => ({
  usePasteService: (options: unknown) => {
    capturedPasteOptions = options as {
      onUploadStateChange?: (state: { isUploading: boolean; pendingCount: number }) => void;
    };
    return mockUsePasteService();
  },
}));

vi.mock('@/renderer/utils/file/workspaceFs', () => ({
  listWorkspaceFileItems: (...args: unknown[]) => mockListWorkspaceFileItems(...args),
}));

vi.mock('@renderer/hooks/ui/useLatestRef', () => ({
  useLatestRef: (value: unknown) => ({ current: value }),
}));

vi.mock('@renderer/services/FileService', () => ({
  allSupportedExts: [],
}));

vi.mock('@/renderer/components/chat/SlashCommandMenu', () => ({
  __esModule: true,
  default: () => React.createElement('div', {}, 'SlashCommandMenu'),
}));

vi.mock('@/renderer/hooks/chat/useSlashCommandController', () => ({
  useSlashCommandController: (options: { onSelectTemplate?: (command: SlashCommandItem) => void }) => {
    capturedSlashOptions = options;
    return {
      isOpen: false,
      filteredCommands: [],
      activeIndex: 0,
      setActiveIndex: vi.fn(),
      onSelectByIndex: vi.fn(),
      onKeyDown: vi.fn(),
    };
  },
}));

vi.mock('@/renderer/utils/ui/focus', () => ({
  blurActiveElement: vi.fn(),
  shouldBlockMobileInputFocus: vi.fn(() => false),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ onClick, children, icon, ...props }: React.ComponentProps<'button'>) =>
    React.createElement('button', { onClick, ...props }, icon ?? children),
  Input: {
    TextArea: ({
      value,
      onChange,
      ...props
    }: React.ComponentProps<'textarea'> & {
      onChange?: (value: string, event?: React.ChangeEvent<HTMLTextAreaElement>) => void;
    }) =>
      React.createElement('textarea', {
        value,
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value, event),
        ...props,
      }),
  },
  Message: {
    useMessage: () => [{ warning: (...args: unknown[]) => messageWarningMock(...args) }, null],
  },
  Tag: ({ children }: { children: React.ReactNode }) => React.createElement('div', {}, children),
}));

vi.mock('@icon-park/react', () => ({
  ArrowUp: () => React.createElement('span', {}, 'ArrowUp'),
  CloseSmall: () => React.createElement('span', {}, 'CloseSmall'),
  SquareSmall: () => React.createElement('span', {}, 'SquareSmall'),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import SendBox from '@/renderer/components/chat/sendbox';

const SendBoxHarness: React.FC<{ slashCommands?: SlashCommandItem[] }> = ({ slashCommands = [] }) => {
  const [value, setValue] = React.useState('/pla');

  return (
    <SendBox
      value={value}
      onChange={setValue}
      onSend={vi.fn().mockResolvedValue(undefined)}
      slashCommands={slashCommands}
    />
  );
};

const MentionHarness: React.FC<{
  initialValue?: string;
  pendingUploadCount?: number;
  onSend?: (message: string) => Promise<void>;
  onSelectionChange?: (items: Array<string | FileOrFolderItem>) => void;
}> = ({
  initialValue = '',
  onSelectionChange,
  pendingUploadCount = 0,
  onSend = vi.fn().mockResolvedValue(undefined),
}) => {
  const [value, setValue] = React.useState(initialValue);
  const [selectedWorkspaceItems, setSelectedWorkspaceItems] = React.useState<Array<string | FileOrFolderItem>>([]);

  React.useEffect(() => {
    onSelectionChange?.(selectedWorkspaceItems);
  }, [onSelectionChange, selectedWorkspaceItems]);

  return (
    <SendBox
      value={value}
      onChange={setValue}
      onSend={onSend}
      pendingUploadCount={pendingUploadCount}
      selectedWorkspaceItems={selectedWorkspaceItems}
      onSelectedWorkspaceItemsChange={setSelectedWorkspaceItems}
    />
  );
};

describe('SendBox command expansion', () => {
  beforeEach(() => {
    capturedSlashOptions = undefined;
    _capturedDragUploadOptions = undefined;
    capturedPasteOptions = undefined;
    vi.clearAllMocks();
    mockUseConversationContextSafe.mockReturnValue({ conversationId: 'test-conv-1' });
  });

  it('expands managed commands into their template body', () => {
    const { container } = render(
      <SendBoxHarness
        slashCommands={[
          {
            name: 'plan',
            description: 'Plan first',
            kind: 'template',
            source: 'custom',
            template: 'Restate the task first.',
          },
        ]}
      />
    );

    act(() => {
      capturedSlashOptions?.onSelectTemplate?.({
        name: 'plan',
        description: 'Plan first',
        kind: 'template',
        source: 'custom',
        template: 'Restate the task first.',
      });
    });

    const textarea = container.querySelector('textarea');
    expect(textarea?.value).toBe('Restate the task first.');
  });

  it('keeps agent slash commands in slash form when no local template exists', () => {
    const { container } = render(
      <SendBoxHarness
        slashCommands={[
          {
            name: 'review',
            description: 'Agent provided review command',
            kind: 'template',
            source: 'acp',
          },
        ]}
      />
    );

    act(() => {
      capturedSlashOptions?.onSelectTemplate?.({
        name: 'review',
        description: 'Agent provided review command',
        kind: 'template',
        source: 'acp',
      });
    });

    const textarea = container.querySelector('textarea');
    expect(textarea?.value).toBe('/review ');
  });

  it('opens workspace mention suggestions and inserts the selected file', async () => {
    mockUseConversationContextSafe.mockReturnValue({
      conversationId: 'test-conv-1',
      workspace: '/tmp/project',
    });
    mockListWorkspaceFileItems.mockResolvedValue([
      {
        path: '/tmp/project/src/readme.md',
        name: 'readme.md',
        isFile: true,
        relativePath: 'src/readme.md',
      },
    ]);
    const onSelectionChange = vi.fn();

    const { container } = render(<MentionHarness onSelectionChange={onSelectionChange} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    fireEvent.focus(textarea);
    fireEvent.change(textarea, {
      target: { value: '@rea', selectionStart: 4, selectionEnd: 4 },
    });

    await screen.findByText('readme.md');

    fireEvent.mouseDown(screen.getByText('readme.md'));

    await waitFor(() => {
      expect(textarea.value).toBe('@workspace/src/readme.md ');
    });
    expect(onSelectionChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        path: '/tmp/project/src/readme.md',
        relativePath: 'src/readme.md',
      }),
    ]);
  });

  it('syncs manually typed workspace mentions into selected workspace items', async () => {
    mockUseConversationContextSafe.mockReturnValue({
      conversationId: 'test-conv-1',
      workspace: '/tmp/project',
    });
    mockListWorkspaceFileItems.mockResolvedValue([
      {
        path: '/tmp/project/src/readme.md',
        name: 'readme.md',
        isFile: true,
        relativePath: 'src/readme.md',
      },
    ]);
    const onSelectionChange = vi.fn();

    const { container } = render(<MentionHarness onSelectionChange={onSelectionChange} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    fireEvent.focus(textarea);
    fireEvent.change(textarea, {
      target: {
        value: '@workspace/src/readme.md ',
        selectionStart: 25,
        selectionEnd: 25,
      },
    });

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenLastCalledWith([
        expect.objectContaining({
          path: '/tmp/project/src/readme.md',
          relativePath: 'src/readme.md',
        }),
      ]);
    });
  });

  it('removes mention-owned selections after the mention text is deleted', async () => {
    mockUseConversationContextSafe.mockReturnValue({
      conversationId: 'test-conv-1',
      workspace: '/tmp/project',
    });
    mockListWorkspaceFileItems.mockResolvedValue([
      {
        path: '/tmp/project/src/readme.md',
        name: 'readme.md',
        isFile: true,
        relativePath: 'src/readme.md',
      },
    ]);
    const onSelectionChange = vi.fn();

    const { container } = render(<MentionHarness onSelectionChange={onSelectionChange} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    fireEvent.focus(textarea);
    fireEvent.change(textarea, {
      target: {
        value: '@workspace/src/readme.md ',
        selectionStart: 25,
        selectionEnd: 25,
      },
    });

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenLastCalledWith([
        expect.objectContaining({
          path: '/tmp/project/src/readme.md',
        }),
      ]);
    });

    fireEvent.change(textarea, {
      target: { value: '', selectionStart: 0, selectionEnd: 0 },
    });

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenLastCalledWith([]);
    });
  });

  it('matches workspace files by basename even when only the leaf filename is typed', async () => {
    mockUseConversationContextSafe.mockReturnValue({
      conversationId: 'test-conv-1',
      workspace: '/tmp/project',
    });
    mockListWorkspaceFileItems.mockResolvedValue([
      {
        path: '/tmp/project/docs/architecture-notes.md',
        name: 'architecture-notes.md',
        isFile: true,
        relativePath: 'docs/architecture-notes.md',
      },
      {
        path: '/tmp/project/src/architecture.ts',
        name: 'architecture.ts',
        isFile: true,
        relativePath: 'src/architecture.ts',
      },
    ]);

    const { container } = render(<MentionHarness />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    fireEvent.focus(textarea);
    fireEvent.change(textarea, {
      target: { value: '@notes', selectionStart: 6, selectionEnd: 6 },
    });

    await screen.findByText('architecture-notes.md');
    expect(screen.queryByText('architecture.ts')).toBeNull();
  });

  it('matches workspace files by relative path when the query includes directories', async () => {
    mockUseConversationContextSafe.mockReturnValue({
      conversationId: 'test-conv-1',
      workspace: '/tmp/project',
    });
    mockListWorkspaceFileItems.mockResolvedValue([
      {
        path: '/tmp/project/docs/setup/install.md',
        name: 'install.md',
        isFile: true,
        relativePath: 'docs/setup/install.md',
      },
      {
        path: '/tmp/project/src/install.ts',
        name: 'install.ts',
        isFile: true,
        relativePath: 'src/install.ts',
      },
    ]);

    const { container } = render(<MentionHarness />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    fireEvent.focus(textarea);
    fireEvent.change(textarea, {
      target: { value: '@workspace/docs/setup', selectionStart: 21, selectionEnd: 21 },
    });

    await screen.findByText('install.md');
    expect(screen.queryByText('install.ts')).toBeNull();
  });

  it('keeps send blocked while internal uploads are still pending after external uploads clear', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = render(<MentionHarness pendingUploadCount={1} onSend={onSend} />);
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;

    fireEvent.change(textarea, {
      target: { value: 'Ship this change.', selectionStart: 17, selectionEnd: 17 },
    });

    act(() => {
      capturedPasteOptions?.onUploadStateChange?.({
        isUploading: true,
        pendingCount: 1,
      });
    });

    rerender(<MentionHarness pendingUploadCount={0} onSend={onSend} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onSend).not.toHaveBeenCalled();
    expect(messageWarningMock).toHaveBeenCalledWith('messages.conversationInProgress');

    act(() => {
      capturedPasteOptions?.onUploadStateChange?.({
        isUploading: false,
        pendingCount: 0,
      });
    });

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('Ship this change.');
    });
  });
});

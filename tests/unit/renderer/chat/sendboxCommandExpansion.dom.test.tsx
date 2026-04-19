import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import React from 'react';
import type { SlashCommandItem } from '@/common/chat/slash/types';

let capturedSlashOptions:
  | {
      onSelectTemplate?: (command: SlashCommandItem) => void;
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
  useDragUpload: () => mockUseDragUpload(),
}));

vi.mock('@/renderer/hooks/file/usePasteService', () => ({
  usePasteService: () => mockUsePasteService(),
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
    }: React.ComponentProps<'textarea'> & { onChange?: (value: string) => void }) =>
      React.createElement('textarea', {
        value,
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value),
        ...props,
      }),
  },
  Message: {
    useMessage: () => [{ warning: vi.fn() }, null],
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

const SendBoxHarness: React.FC<{
  slashCommands?: SlashCommandItem[];
  initialValue?: string;
  onSend?: (message: string) => Promise<void>;
}> = ({ slashCommands = [], initialValue = '/pla', onSend = vi.fn().mockResolvedValue(undefined) }) => {
  const [value, setValue] = React.useState(initialValue);

  return (
    <SendBox
      value={value}
      onChange={setValue}
      onSend={onSend}
      slashCommands={slashCommands}
    />
  );
};

describe('SendBox command expansion', () => {
  beforeEach(() => {
    capturedSlashOptions = undefined;
  });

  it('keeps managed commands in slash form when selecting from the menu', () => {
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
    expect(textarea?.value).toBe('/plan ');
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

  it('expands a typed managed slash command into its template when sending', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <SendBoxHarness
        initialValue='/sttsc a cinematic product poster'
        onSend={onSend}
        slashCommands={[
          {
            name: 'sttsc',
            description: 'Prompt engineer',
            kind: 'template',
            source: 'custom',
            template: 'Turn the user request into a high-quality image prompt.',
          },
        ]}
      />
    );

    const sendButton = container.querySelector('button');
    expect(sendButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(sendButton as HTMLButtonElement);
    });

    expect(onSend).toHaveBeenCalledWith(
      'Turn the user request into a high-quality image prompt.\n\na cinematic product poster'
    );
  });
});

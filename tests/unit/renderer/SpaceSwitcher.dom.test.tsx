import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

const ipcBridgeMocks = vi.hoisted(() => ({
  invokeList: vi.fn(),
  invokeEnsureDefault: vi.fn(),
  invokeCreate: vi.fn(),
  invokeGetConversation: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/guid' }),
  useNavigate: () => routerMocks.navigate,
}));

vi.mock('../../../src/common/adapter/ipcBridge', () => ({
  space: {
    list: { invoke: ipcBridgeMocks.invokeList },
    ensureDefault: { invoke: ipcBridgeMocks.invokeEnsureDefault },
    create: { invoke: ipcBridgeMocks.invokeCreate },
  },
  conversation: {
    get: { invoke: ipcBridgeMocks.invokeGetConversation },
  },
  ipcBridge: {
    space: {
      list: { invoke: ipcBridgeMocks.invokeList },
      ensureDefault: { invoke: ipcBridgeMocks.invokeEnsureDefault },
      create: { invoke: ipcBridgeMocks.invokeCreate },
    },
    conversation: {
      get: { invoke: ipcBridgeMocks.invokeGetConversation },
    },
  },
}));

vi.mock('@arco-design/web-react', async () => {
  const React = await import('react');
  const Menu = ({ children, onClickMenuItem }: any) => (
    <div>
      {React.Children.map(children, (child: any) =>
        React.cloneElement(child, {
          onClick: () => onClickMenuItem?.(child.key),
        })
      )}
    </div>
  );
  Menu.Item = (props: any) => <button onClick={props.onClick}>{props.children}</button>;
  return {
    Dropdown: (props: any) => (
      <div>
        {props.children}
        <div>{props.droplist}</div>
      </div>
    ),
    Menu,
    Message: {
      useMessage: () => [
        {
          success: vi.fn(async () => undefined),
        },
        null,
      ],
    },
  };
});

vi.mock('@icon-park/react', () => ({
  Down: () => <span>down</span>,
  Plus: () => <span>plus</span>,
}));

const { default: SpaceSwitcher } = await import('../../../src/renderer/components/layout/Titlebar/SpaceSwitcher');

describe('SpaceSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipcBridgeMocks.invokeList.mockResolvedValue([
      { id: 'space-1', name: 'My Space', engine: 'affine', isDefault: true, createTime: 1, modifyTime: 1 },
    ]);
    ipcBridgeMocks.invokeEnsureDefault.mockResolvedValue({ id: 'space-1', name: 'My Space' });
    ipcBridgeMocks.invokeCreate.mockResolvedValue({
      id: 'space-2',
      name: 'Space 2',
      engine: 'affine',
      createTime: 1,
      modifyTime: 1,
    });
    ipcBridgeMocks.invokeGetConversation.mockResolvedValue(undefined);
  });

  it('loads and renders current space name', async () => {
    render(<SpaceSwitcher />);

    await waitFor(() => {
      expect(screen.getByText('My Space')).toBeInTheDocument();
    });
  });

  it('creates a new space and navigates to it', async () => {
    render(<SpaceSwitcher />);

    await waitFor(() => {
      expect(screen.getByText('New Space')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New Space'));

    await waitFor(() => {
      expect(ipcBridgeMocks.invokeCreate).toHaveBeenCalledWith({ name: 'Space 2' });
      expect(routerMocks.navigate).toHaveBeenCalledWith('/space/space-2');
    });
  });
});

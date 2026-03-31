import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
const invokeList = vi.fn();
const invokeEnsureDefault = vi.fn();
const invokeCreate = vi.fn();
const invokeGetConversation = vi.fn();

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/guid' }),
  useNavigate: () => navigate,
}));

vi.mock('../../../src/common/adapter/ipcBridge', () => ({
  ipcBridge: {
    space: {
      list: { invoke: invokeList },
      ensureDefault: { invoke: invokeEnsureDefault },
      create: { invoke: invokeCreate },
    },
    conversation: {
      get: { invoke: invokeGetConversation },
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
    invokeList.mockResolvedValue([
      { id: 'space-1', name: 'My Space', engine: 'affine', isDefault: true, createTime: 1, modifyTime: 1 },
    ]);
    invokeEnsureDefault.mockResolvedValue({ id: 'space-1', name: 'My Space' });
    invokeCreate.mockResolvedValue({ id: 'space-2', name: 'Space 2', engine: 'affine', createTime: 1, modifyTime: 1 });
    invokeGetConversation.mockResolvedValue(undefined);
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
      expect(invokeCreate).toHaveBeenCalledWith({ name: 'Space 2' });
      expect(navigate).toHaveBeenCalledWith('/space/space-2');
    });
  });
});

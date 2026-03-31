import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const ipcBridgeMocks = vi.hoisted(() => ({
  space: {
    list: {
      invoke: vi.fn(async () => [
        { id: 'space-1', name: 'My Space', engine: 'affine', createTime: 1, modifyTime: 1 },
      ]),
    },
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ spaceId: 'space-1' }),
}));

vi.mock('../../../src/common/adapter/ipcBridge', () => ({
  space: ipcBridgeMocks.space,
  ipcBridge: { space: ipcBridgeMocks.space },
}));

vi.mock('@arco-design/web-react', () => ({
  Message: {
    useMessage: () => [
      {
        error: vi.fn(async () => undefined),
      },
      null,
    ],
  },
  Spin: () => <div>loading</div>,
}));

vi.mock('../../../src/renderer/pages/space/SpaceShell', () => ({
  default: (props: { spaceId: string; spaceName: string }) => (
    <div data-testid='space-shell'>
      {props.spaceId}:{props.spaceName}
    </div>
  ),
}));

const { default: SpacePage } = await import('../../../src/renderer/pages/space/SpacePage');

describe('SpacePage', () => {
  it('loads the space name from space bridge and renders SpaceShell', async () => {
    render(<SpacePage />);

    await waitFor(() => {
      expect(screen.getByTestId('space-shell')).toHaveTextContent('space-1:My Space');
    });
  });
});

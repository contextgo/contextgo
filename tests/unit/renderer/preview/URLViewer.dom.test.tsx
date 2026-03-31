import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const webviewHostPropsMock = vi.fn();

vi.mock('@/renderer/components/media/WebviewHost', () => ({
  __esModule: true,
  default: (props: unknown) => {
    webviewHostPropsMock(props);
    return <div data-testid='webview-host' />;
  },
}));

import URLViewer from '@/renderer/pages/conversation/Preview/components/viewers/URLViewer';

describe('URLViewer', () => {
  it('passes a persistent browser partition when a browser context asset is bound', () => {
    render(<URLViewer url='https://example.com' browserContextAssetId='asset-42' />);

    expect(webviewHostPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com',
        showNavBar: true,
        partition: 'persist:browser-context-asset-42',
        className: 'bg-bg-1',
      })
    );
  });

  it('omits the browser partition when no browser context asset is bound', () => {
    render(<URLViewer url='https://example.com' />);

    expect(webviewHostPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com',
        partition: undefined,
      })
    );
  });
});

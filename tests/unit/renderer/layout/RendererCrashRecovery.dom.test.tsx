import { act, cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reportRendererErrorInvoke = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    application: {
      reportRendererError: {
        invoke: (...args: unknown[]) => Promise.resolve(reportRendererErrorInvoke(...args)),
      },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'common.error': 'Error',
        'common.reload': 'Reload',
        'common.copy': 'Copy',
        'common.copySuccess': 'Copied',
        'common.copyFailed': 'Copy failed',
        'common.hide': 'Hide',
        'common.error_details': 'Error Details',
        'common.rendererCrash.title': 'This page crashed before it finished rendering.',
        'common.rendererCrash.description':
          'A renderer error interrupted the current view. Reload the page, or copy the diagnostics for troubleshooting.',
        'common.rendererCrash.type': 'Error Type',
        'common.rendererCrash.route': 'Route',
        'common.rendererCrash.time': 'Occurred At',
      };

      return labels[key] || key;
    },
  }),
}));

import RendererCrashBoundary from '@/renderer/components/layout/RendererCrashBoundary';
import {
  mountRendererCrashOverlay,
  unmountRendererCrashOverlay,
} from '@/renderer/components/layout/RendererCrashOverlay';
import {
  registerRendererCrashReporting,
  unregisterRendererCrashReporting,
} from '@/renderer/utils/ui/rendererCrashReporting';

const ThrowOnRender: React.FC = () => {
  throw new Error('Boundary boom');
};

describe('Renderer crash recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mountRendererCrashOverlay();
    registerRendererCrashReporting();
  });

  afterEach(() => {
    cleanup();
    unregisterRendererCrashReporting();
    unmountRendererCrashOverlay();
  });

  it('shows a recovery overlay when an error boundary catches a render failure', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      render(
        <RendererCrashBoundary>
          <ThrowOnRender />
        </RendererCrashBoundary>
      );
    });

    expect(await screen.findByText('This page crashed before it finished rendering.')).toBeInTheDocument();
    expect(screen.getByText(/Boundary boom/i)).toBeInTheDocument();
    expect(reportRendererErrorInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'react-error-boundary',
        message: 'Boundary boom',
      })
    );

    consoleErrorSpy.mockRestore();
  });

  it('shows the same recovery overlay for global window errors', async () => {
    await act(async () => {
      window.dispatchEvent(
        new ErrorEvent('error', {
          message: 'Global boom',
          error: new Error('Global boom'),
        })
      );
    });

    expect(await screen.findByText('This page crashed before it finished rendering.')).toBeInTheDocument();
    expect(screen.getByText(/Global boom/i)).toBeInTheDocument();
    expect(reportRendererErrorInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Global boom',
      })
    );
  });

  it('ignores non-fatal image resource errors', async () => {
    const image = document.createElement('img');
    image.src = 'file:///missing-connector-logo.svg';
    document.body.appendChild(image);

    await act(async () => {
      image.dispatchEvent(new Event('error'));
    });

    expect(screen.queryByText('This page crashed before it finished rendering.')).not.toBeInTheDocument();
    expect(reportRendererErrorInvoke).not.toHaveBeenCalled();

    image.remove();
  });

  it('reports script resource errors with resource details', async () => {
    const script = document.createElement('script');
    script.src = 'file:///broken-connectors-chunk.js';
    document.body.appendChild(script);

    await act(async () => {
      script.dispatchEvent(new Event('error'));
    });

    expect(await screen.findByText('This page crashed before it finished rendering.')).toBeInTheDocument();
    expect(screen.getByText(/Failed to load script resource/i)).toBeInTheDocument();
    expect(reportRendererErrorInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'Failed to load script resource',
        stack: expect.stringContaining('resource: file:///broken-connectors-chunk.js'),
      })
    );

    script.remove();
  });

  it('ignores empty window error events that have no actionable diagnostics', async () => {
    await act(async () => {
      window.dispatchEvent(new ErrorEvent('error'));
    });

    expect(screen.queryByText('This page crashed before it finished rendering.')).not.toBeInTheDocument();
    expect(reportRendererErrorInvoke).not.toHaveBeenCalled();
  });
});

/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from '@arco-design/web-react';
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { copyText } from '@renderer/utils/ui/clipboard';
import { requestRendererCrashBoundaryReset } from './RendererCrashBoundary';
import { getLastStableHashRoute } from './routerLocation';
import {
  clearRendererCrash,
  getRendererCrash,
  subscribeRendererCrash,
  type RendererCrashRecord,
} from '@renderer/utils/ui/rendererCrashStore';

const OVERLAY_ROOT_ID = 'renderer-crash-overlay-root';

let overlayRoot: Root | null = null;
let overlayContainer: HTMLDivElement | null = null;

const getRouteLabel = (href?: string): string => {
  if (!href) {
    return '-';
  }

  try {
    const url = new URL(href);
    return url.hash || url.pathname || href;
  } catch {
    return href;
  }
};

const buildCrashDetails = (crash: RendererCrashRecord): string =>
  [
    `type: ${crash.type}`,
    `time: ${crash.timestamp}`,
    `route: ${getRouteLabel(crash.href)}`,
    `message: ${crash.message}`,
    crash.stack ? `stack:\n${crash.stack}` : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');

const isDynamicImportFailureMessage = (message: string): boolean =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    message
  );

const getCrashTypeLabel = (
  translate: (key: string, options?: { defaultValue?: string }) => string,
  type: RendererCrashRecord['type']
): string => {
  if (type === 'react-error-boundary') {
    return translate('common.rendererCrash.reactBoundaryValue', { defaultValue: type });
  }

  if (type === 'unhandledrejection') {
    return translate('common.rendererCrash.unhandledRejectionValue', { defaultValue: type });
  }

  return translate('common.rendererCrash.errorValue', { defaultValue: type });
};

const RendererCrashOverlay: React.FC = () => {
  const crash = useSyncExternalStore(subscribeRendererCrash, getRendererCrash, getRendererCrash);
  const { t } = useTranslation();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    setCopyStatus('idle');
  }, [crash?.timestamp]);

  const detailsText = useMemo(() => (crash ? buildCrashDetails(crash) : ''), [crash]);

  if (!crash) {
    return null;
  }

  const routeLabel = getRouteLabel(crash.href);
  const isDynamicImportFailure = isDynamicImportFailureMessage(crash.message);
  const lastStableRoute = getLastStableHashRoute();
  const canReturnToStableRoute = Boolean(lastStableRoute && lastStableRoute !== routeLabel);
  const copyLabel =
    copyStatus === 'success'
      ? t('common.copySuccess')
      : copyStatus === 'error'
        ? t('common.copyFailed')
        : t('common.copy');
  const resetUi = () => {
    clearRendererCrash();
    if (!requestRendererCrashBoundaryReset()) {
      window.location.reload();
    }
  };
  const recoverToRoute = (routePath: string) => {
    window.location.hash = routePath;
    resetUi();
  };

  return (
    <div className='renderer-crash-overlay' role='alertdialog' aria-modal='true' aria-labelledby='renderer-crash-title'>
      <div className='renderer-crash-overlay__backdrop' />
      <div className='renderer-crash-overlay__panel'>
        <div className='renderer-crash-overlay__hero'>
          <div className='renderer-crash-overlay__eyebrow'>{t('common.error')}</div>
          <h1 id='renderer-crash-title' className='renderer-crash-overlay__title'>
            {t('common.rendererCrash.title')}
          </h1>
          <p className='renderer-crash-overlay__description'>{t('common.rendererCrash.description')}</p>
          {isDynamicImportFailure ? (
            <div className='renderer-crash-overlay__dev-hint'>{t('common.rendererCrash.dynamicImportHint')}</div>
          ) : null}
          <div className='renderer-crash-overlay__message-card'>
            <div className='renderer-crash-overlay__message-label'>{t('common.error_details')}</div>
            <div className='renderer-crash-overlay__message-body'>{crash.message}</div>
          </div>
        </div>

        <div className='renderer-crash-overlay__main'>
          <div className='renderer-crash-overlay__column'>
            <dl className='renderer-crash-overlay__meta'>
              <div className='renderer-crash-overlay__meta-row'>
                <dt>{t('common.rendererCrash.type')}</dt>
                <dd>{getCrashTypeLabel(t, crash.type)}</dd>
              </div>
              <div className='renderer-crash-overlay__meta-row'>
                <dt>{t('common.rendererCrash.route')}</dt>
                <dd title={routeLabel}>{routeLabel}</dd>
              </div>
              <div className='renderer-crash-overlay__meta-row'>
                <dt>{t('common.rendererCrash.time')}</dt>
                <dd>{new Date(crash.timestamp).toLocaleString()}</dd>
              </div>
              {canReturnToStableRoute ? (
                <div className='renderer-crash-overlay__meta-row'>
                  <dt>{t('common.rendererCrash.lastSafeRoute')}</dt>
                  <dd title={lastStableRoute}>{lastStableRoute}</dd>
                </div>
              ) : null}
            </dl>

            <div className='renderer-crash-overlay__actions'>
              <Button type='primary' onClick={resetUi}>
                {t('common.rendererCrash.resetUi')}
              </Button>
              {canReturnToStableRoute ? (
                <Button
                  type='outline'
                  onClick={() => {
                    recoverToRoute(lastStableRoute);
                  }}
                >
                  {t('common.rendererCrash.backToLastSafeRoute')}
                </Button>
              ) : null}
              <Button
                type='outline'
                onClick={() => {
                  window.location.reload();
                }}
              >
                {t('common.rendererCrash.reloadApp')}
              </Button>
              <Button
                type='outline'
                onClick={() => {
                  recoverToRoute('/settings/system');
                }}
              >
                {t('common.rendererCrash.openSystemSettings')}
              </Button>
              <Button
                type='outline'
                onClick={() => {
                  void copyText(detailsText)
                    .then(() => {
                      setCopyStatus('success');
                    })
                    .catch(() => {
                      setCopyStatus('error');
                    });
                }}
              >
                {copyLabel}
              </Button>
            </div>
          </div>

          <div className='renderer-crash-overlay__details'>
            <div className='renderer-crash-overlay__details-title'>{t('common.rendererCrash.diagnostics')}</div>
            <pre className='renderer-crash-overlay__details-body'>{detailsText}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export const mountRendererCrashOverlay = (): void => {
  if (typeof document === 'undefined' || overlayRoot) {
    return;
  }

  overlayContainer = document.createElement('div');
  overlayContainer.id = OVERLAY_ROOT_ID;
  document.body.appendChild(overlayContainer);

  overlayRoot = createRoot(overlayContainer);
  overlayRoot.render(<RendererCrashOverlay />);
};

export const unmountRendererCrashOverlay = (): void => {
  clearRendererCrash();
  overlayRoot?.unmount();
  overlayRoot = null;
  overlayContainer?.remove();
  overlayContainer = null;
};

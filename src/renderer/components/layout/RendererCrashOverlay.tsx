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
  const copyLabel =
    copyStatus === 'success'
      ? t('common.copySuccess')
      : copyStatus === 'error'
        ? t('common.copyFailed')
        : t('common.copy');

  return (
    <div className='renderer-crash-overlay' role='alertdialog' aria-modal='true' aria-labelledby='renderer-crash-title'>
      <div className='renderer-crash-overlay__backdrop' />
      <div className='renderer-crash-overlay__panel'>
        <div className='renderer-crash-overlay__eyebrow'>{t('common.error')}</div>
        <h1 id='renderer-crash-title' className='renderer-crash-overlay__title'>
          {t('common.rendererCrash.title')}
        </h1>
        <p className='renderer-crash-overlay__description'>{t('common.rendererCrash.description')}</p>

        <dl className='renderer-crash-overlay__meta'>
          <div className='renderer-crash-overlay__meta-row'>
            <dt>{t('common.rendererCrash.type')}</dt>
            <dd>{crash.type}</dd>
          </div>
          <div className='renderer-crash-overlay__meta-row'>
            <dt>{t('common.rendererCrash.route')}</dt>
            <dd title={routeLabel}>{routeLabel}</dd>
          </div>
          <div className='renderer-crash-overlay__meta-row'>
            <dt>{t('common.rendererCrash.time')}</dt>
            <dd>{new Date(crash.timestamp).toLocaleString()}</dd>
          </div>
        </dl>

        <div className='renderer-crash-overlay__actions'>
          <Button
            type='primary'
            onClick={() => {
              window.location.reload();
            }}
          >
            {t('common.reload')}
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
          <Button
            type='text'
            onClick={() => {
              clearRendererCrash();
            }}
          >
            {t('common.hide')}
          </Button>
        </div>

        <div className='renderer-crash-overlay__details'>
          <div className='renderer-crash-overlay__details-title'>{t('common.error_details')}</div>
          <pre className='renderer-crash-overlay__details-body'>{detailsText}</pre>
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

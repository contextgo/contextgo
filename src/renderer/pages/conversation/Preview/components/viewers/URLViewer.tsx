/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import WebviewHost from '@/renderer/components/media/WebviewHost';

interface URLViewerProps {
  /** URL to display */
  url: string;
  /** Optional title for the page */
  title?: string;
  /** Optional browser context asset binding for session partition isolation */
  browserContextAssetId?: string;
}

/**
 * URL 预览组件 - 用于在应用内预览网页（对话框预览面板）
 * URL Preview component - for previewing web pages within the app (conversation preview panel)
 *
 * Delegates to the shared WebviewHost with navigation bar enabled.
 */
const URLViewer: React.FC<URLViewerProps> = ({ url, browserContextAssetId }) => {
  const partition = browserContextAssetId ? `persist:browser-context-${browserContextAssetId}` : undefined;

  return <WebviewHost url={url} showNavBar partition={partition} className='bg-bg-1' />;
};

export default URLViewer;

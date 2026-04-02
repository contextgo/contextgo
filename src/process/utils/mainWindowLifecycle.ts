/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { dialog, type BrowserWindow, type MessageBoxOptions, type RenderProcessGoneDetails } from 'electron';
import i18n from '@process/services/i18n';
import { setApplicationMainWindow } from '../bridge/applicationBridge';
import { setDeepLinkMainWindow } from './deepLink';
import { setTrayMainWindow } from './tray';

export type MainWindowRecoveryAction = 'wait' | 'reload';

type RecoveryDialogButton = {
  action: MainWindowRecoveryAction;
  labelKey: string;
  defaultValue: string;
};

type RecoveryDialogOptions = {
  window: BrowserWindow;
  type?: MessageBoxOptions['type'];
  titleKey: string;
  titleDefaultValue: string;
  messageKey: string;
  messageDefaultValue: string;
  detail?: string;
  buttons: [RecoveryDialogButton, RecoveryDialogButton];
  defaultAction: MainWindowRecoveryAction;
  cancelAction: MainWindowRecoveryAction;
};

let isMainWindowRecoveryDialogOpen = false;

const translate = (key: string, defaultValue: string): string => i18n.t(key, { defaultValue });

const getDialogParentWindow = (window: BrowserWindow): BrowserWindow | undefined => {
  if (window.isDestroyed()) {
    return undefined;
  }

  return window;
};

const formatRecoveryDetail = (details: Record<string, unknown>): string | undefined => {
  const entries = Object.entries(details).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return undefined;
  }

  return JSON.stringify(Object.fromEntries(entries), null, 2);
};

const getWindowUrlSafely = (window: BrowserWindow): string | undefined => {
  if (window.isDestroyed()) {
    return undefined;
  }

  try {
    return window.webContents.getURL() || undefined;
  } catch {
    return undefined;
  }
};

const showRecoveryDialog = async ({
  window,
  type = 'error',
  titleKey,
  titleDefaultValue,
  messageKey,
  messageDefaultValue,
  detail,
  buttons,
  defaultAction,
  cancelAction,
}: RecoveryDialogOptions): Promise<MainWindowRecoveryAction | null> => {
  if (isMainWindowRecoveryDialogOpen) {
    return null;
  }

  isMainWindowRecoveryDialogOpen = true;

  try {
    const defaultId = buttons.findIndex((button) => button.action === defaultAction);
    const cancelId = buttons.findIndex((button) => button.action === cancelAction);
    const options: MessageBoxOptions = {
      type,
      title: translate(titleKey, titleDefaultValue),
      message: translate(messageKey, messageDefaultValue),
      detail,
      buttons: buttons.map((button) => translate(button.labelKey, button.defaultValue)),
      defaultId: defaultId === -1 ? 0 : defaultId,
      cancelId: cancelId === -1 ? 0 : cancelId,
      noLink: true,
      normalizeAccessKeys: true,
    };
    const parentWindow = getDialogParentWindow(window);
    const result = parentWindow
      ? await dialog.showMessageBox(parentWindow, options)
      : await dialog.showMessageBox(options);

    return buttons[result.response]?.action ?? cancelAction;
  } finally {
    isMainWindowRecoveryDialogOpen = false;
  }
};

export const bindMainWindowReferences = (window: BrowserWindow): void => {
  setTrayMainWindow(window);
  setDeepLinkMainWindow(window);
  setApplicationMainWindow(window);
};

export const showAndFocusMainWindow = (window: BrowserWindow): void => {
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
};

export const showOrCreateMainWindow = ({
  mainWindow,
  createWindow,
}: {
  mainWindow: BrowserWindow | null | undefined;
  createWindow: () => void;
}): void => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showAndFocusMainWindow(mainWindow);
    return;
  }

  createWindow();
};

export const promptMainWindowUnresponsive = (window: BrowserWindow): Promise<MainWindowRecoveryAction | null> => {
  return showRecoveryDialog({
    window,
    type: 'warning',
    titleKey: 'common.rendererCrash.windowUnresponsiveTitle',
    titleDefaultValue: 'Renderer stopped responding',
    messageKey: 'common.rendererCrash.windowUnresponsiveDescription',
    messageDefaultValue: 'The current window is no longer responding. Wait a bit longer, or reload the UI to recover.',
    detail: formatRecoveryDetail({
      url: getWindowUrlSafely(window),
    }),
    buttons: [
      {
        action: 'wait',
        labelKey: 'common.wait',
        defaultValue: 'Wait',
      },
      {
        action: 'reload',
        labelKey: 'common.reload',
        defaultValue: 'Reload',
      },
    ],
    defaultAction: 'wait',
    cancelAction: 'wait',
  });
};

export const promptMainWindowLoadFailure = (
  window: BrowserWindow,
  details: {
    errorCode: number;
    errorDescription: string;
    validatedURL: string;
    isMainFrame: boolean;
  }
): Promise<MainWindowRecoveryAction | null> => {
  if (!details.isMainFrame || details.errorCode === -3) {
    return Promise.resolve(null);
  }

  return showRecoveryDialog({
    window,
    titleKey: 'common.rendererCrash.windowLoadFailedTitle',
    titleDefaultValue: 'Renderer failed to load',
    messageKey: 'common.rendererCrash.windowLoadFailedDescription',
    messageDefaultValue: 'The main window failed to load. Retry the renderer to recover the application shell.',
    detail: formatRecoveryDetail(details),
    buttons: [
      {
        action: 'wait',
        labelKey: 'common.wait',
        defaultValue: 'Wait',
      },
      {
        action: 'reload',
        labelKey: 'common.retry',
        defaultValue: 'Retry',
      },
    ],
    defaultAction: 'reload',
    cancelAction: 'wait',
  });
};

export const promptMainWindowRenderProcessGone = (
  window: BrowserWindow,
  details: RenderProcessGoneDetails
): Promise<MainWindowRecoveryAction | null> => {
  return showRecoveryDialog({
    window,
    titleKey: 'common.rendererCrash.renderProcessGoneTitle',
    titleDefaultValue: 'Renderer process crashed',
    messageKey: 'common.rendererCrash.renderProcessGoneDescription',
    messageDefaultValue: 'The renderer process exited unexpectedly. Reload the window to restore the UI shell.',
    detail: formatRecoveryDetail({
      reason: details.reason,
      exitCode: details.exitCode,
    }),
    buttons: [
      {
        action: 'wait',
        labelKey: 'common.wait',
        defaultValue: 'Wait',
      },
      {
        action: 'reload',
        labelKey: 'common.reload',
        defaultValue: 'Reload',
      },
    ],
    defaultAction: 'reload',
    cancelAction: 'wait',
  });
};

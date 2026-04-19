/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  IWorkspaceGitChange,
  IWorkspaceGitChangesPayload,
  IWorkspaceRecentFile,
} from '@/common/adapter/ipcBridge';
import type { PreviewContentType } from '@/common/types/preview';
import type { PreviewMetadata } from '@/renderer/pages/conversation/Preview/context/PreviewContext';

export type WorkspaceChangesProps = {
  workspace: string;
  reloadToken: number;
  openPreview: (content: string, type: PreviewContentType, metadata?: PreviewMetadata) => void;
};

export type WorkspaceChangesState = {
  loading: boolean;
  mode: 'git' | 'recent';
  repository: IWorkspaceGitChangesPayload['repository'];
  changes: IWorkspaceGitChange[];
  files: IWorkspaceRecentFile[];
};

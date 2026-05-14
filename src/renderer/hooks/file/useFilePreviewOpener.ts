/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { getFileTypeInfo } from '@/renderer/utils/file/fileType';
import { useCallback, useState } from 'react';
import { usePreviewLauncher } from './usePreviewLauncher';

type OpenFilePreviewOptions = {
  path: string;
  title?: string;
  fileName?: string;
};

const expandUserPath = async (input: string): Promise<string> => {
  const trimmed = input.trim();
  if (!trimmed.startsWith('~')) {
    return trimmed;
  }

  try {
    const homeDir = await ipcBridge.application.getPath.invoke({ name: 'home' });
    if (homeDir) {
      return `${homeDir}${trimmed.slice(1)}`;
    }
  } catch {
    // Fall back to the raw path and let the caller decide whether to use system open.
  }

  return trimmed;
};

const getFallbackFileName = (filePath: string): string => {
  const normalized = filePath.replace(/\\+$/, '');
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] || normalized;
};

/**
 * Open an arbitrary local file path in the shared preview panel.
 * Falls back to `false` when the path is a directory, missing, or unsupported.
 */
export const useFilePreviewOpener = () => {
  const { launchPreview, loading: previewLoading } = usePreviewLauncher();
  const [resolving, setResolving] = useState(false);

  const openFilePreview = useCallback(
    async ({ path, title, fileName }: OpenFilePreviewOptions): Promise<boolean> => {
      const trimmedPath = path.trim();
      if (!trimmedPath) {
        return false;
      }

      setResolving(true);
      try {
        const resolvedPath = await expandUserPath(trimmedPath);
        const metadata = await ipcBridge.fs.getFileMetadata.invoke({ path: resolvedPath });

        if (metadata?.isDirectory) {
          return false;
        }

        const resolvedFileName = fileName || metadata?.name || getFallbackFileName(resolvedPath);
        const { contentType, editable, language } = getFileTypeInfo(resolvedFileName);
        const isMissingFile = metadata?.size === -1 && metadata?.lastModified === 0;
        const canCreateDraftPreview =
          /\.[^./\\]+$/.test(resolvedFileName) && !['pdf', 'ppt', 'word', 'excel', 'image'].includes(contentType);

        if (isMissingFile && !canCreateDraftPreview) {
          return false;
        }

        return await launchPreview({
          originalPath: resolvedPath,
          fileName: resolvedFileName,
          title: title || resolvedFileName,
          language,
          contentType,
          editable,
          fallbackContent: isMissingFile ? '' : undefined,
        });
      } catch (error) {
        console.error('[useFilePreviewOpener] Failed to open file preview:', error);
        return false;
      } finally {
        setResolving(false);
      }
    },
    [launchPreview]
  );

  return {
    openFilePreview,
    loading: resolving || previewLoading,
  };
};

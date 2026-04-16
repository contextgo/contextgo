import path from 'node:path';
import type { FileOrFolderItem } from './fileTypes';

const WORKSPACE_REFERENCE_PREFIX = '@workspace';

const normalizeReferencePath = (value: string): string => {
  return value.replace(/\\/g, '/').replace(/^\/+/, '');
};

export const buildWorkspaceReferenceLabel = (item: string | FileOrFolderItem): string => {
  if (typeof item === 'string') {
    return `${WORKSPACE_REFERENCE_PREFIX}/${path.basename(item)}`;
  }

  const displayPath = item.relativePath?.trim() ? item.relativePath : item.name;
  return `${WORKSPACE_REFERENCE_PREFIX}/${normalizeReferencePath(displayPath)}`;
};

export const buildWorkspaceReferenceLabels = (items: Array<string | FileOrFolderItem>): string[] => {
  return Array.from(new Set(items.map((item) => buildWorkspaceReferenceLabel(item))));
};

import path from 'node:path';

export const resolveGoogleWorkspaceOAuthDir = async (): Promise<string> => {
  const { ensureDirectory, getDataPath } = await import('@process/utils');
  const dir = path.join(getDataPath(), 'store', 'connectors', 'google-workspace', 'oauth');
  ensureDirectory(dir);
  return dir;
};

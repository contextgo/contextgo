export type SpaceContentRuntimeConfig = {
  localSourcePath?: string;
  webAppUrl?: string;
};

export function getSpaceContentRuntimeConfig(): SpaceContentRuntimeConfig {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};
  const rawLocalSourcePath = env.CONTEXTGO_SPACE_CONTENT_SOURCE?.trim();
  const rawUrl = env.CONTEXTGO_SPACE_CONTENT_URL?.trim() || env.CONTEXTGO_AFFINE_WEB_URL?.trim();

  return {
    localSourcePath: rawLocalSourcePath && rawLocalSourcePath.length > 0 ? rawLocalSourcePath : '../affine',
    webAppUrl: rawUrl && rawUrl.length > 0 ? rawUrl : undefined,
  };
}

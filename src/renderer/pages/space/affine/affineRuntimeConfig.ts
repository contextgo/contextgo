export type AffineRuntimeConfig = {
  webAppUrl?: string;
};

export function getAffineRuntimeConfig(): AffineRuntimeConfig {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};
  const rawUrl = env.CONTEXTGO_AFFINE_WEB_URL?.trim();

  return {
    webAppUrl: rawUrl && rawUrl.length > 0 ? rawUrl : undefined,
  };
}

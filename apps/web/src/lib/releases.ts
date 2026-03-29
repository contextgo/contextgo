import 'server-only';

const DEFAULT_REPOSITORY = 'contextgo/contextgo';
const GITHUB_API_BASE = 'https://api.github.com';
const RELEASE_MANIFEST_NAME = 'release-manifest.json';

type Locale = 'en' | 'zh';
type PlatformId = 'macos' | 'windows' | 'linux' | 'android' | 'ios' | 'harmony';
type DirectPlatformId = Exclude<PlatformId, 'ios'>;

type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
  size: number;
  download_count: number;
  content_type: string;
};

type GitHubRelease = {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  assets: GitHubReleaseAsset[];
};

type GitHubTag = {
  name: string;
};

type ReleaseManifestAsset = {
  fileName: string;
  platform: DirectPlatformId;
  arch: string | null;
  extension: string;
  size: number;
  sha256: string;
};

type ReleaseManifest = {
  schemaVersion: 1;
  generatedAt: string;
  product: string;
  version: string | null;
  checksumAlgorithm: 'sha256';
  assets: ReleaseManifestAsset[];
};

type ResolvedAsset = {
  arch: string | null;
  extension: string;
  fileName: string;
  href: string;
  platform: DirectPlatformId;
  sha256: string | null;
  size: number | null;
};

export type DownloadEntryAction = {
  href: string;
  label: string;
  emphasis: 'primary' | 'secondary';
  external?: boolean;
};

export type DownloadEntryAsset = {
  fileName: string;
  href: string;
  label: string;
  sha256: string | null;
  sizeBytes: number | null;
};

export type DownloadEntry = {
  id: PlatformId;
  title: string;
  channel: string;
  summary: string;
  status: 'direct' | 'official' | 'pending';
  actions: DownloadEntryAction[];
  assets: DownloadEntryAsset[];
  permissions: string[];
  systemRequirements: string[];
};

export type ReleaseSnapshot = {
  repository: string;
  releaseUrl: string;
  version: string | null;
  publishedAt: string | null;
  manifestGeneratedAt: string | null;
  checksumsAvailable: boolean;
  source: 'release' | 'tag' | 'none';
  entries: DownloadEntry[];
};

type ReleaseConfig = {
  repository: string;
  githubToken?: string;
  iosUrl?: string;
  iosLabel?: string;
  harmonyUrl?: string;
  harmonyLabel?: string;
  androidUrl?: string;
};

type LocalizedText = {
  en: string;
  zh: string;
};

const releaseConfig: ReleaseConfig = {
  repository: process.env.CONTEXTGO_RELEASE_REPO || DEFAULT_REPOSITORY,
  githubToken: process.env.CONTEXTGO_GITHUB_TOKEN,
  iosUrl: process.env.CONTEXTGO_IOS_URL,
  iosLabel: process.env.CONTEXTGO_IOS_LABEL,
  harmonyUrl: process.env.CONTEXTGO_HARMONY_URL,
  harmonyLabel: process.env.CONTEXTGO_HARMONY_LABEL,
  androidUrl: process.env.CONTEXTGO_ANDROID_URL,
};

const releasePageUrl = `https://github.com/${releaseConfig.repository}/releases/latest`;

const localized = (locale: Locale, text: LocalizedText): string => {
  return locale === 'zh' ? text.zh : text.en;
};

const createHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
  };

  if (releaseConfig.githubToken) {
    headers.Authorization = `Bearer ${releaseConfig.githubToken}`;
  }

  return headers;
};

const fetchGitHubJson = async <T>(path: string): Promise<T | null> => {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: createHeaders(),
    next: { revalidate: 300 },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
};

const getLatestRelease = async (): Promise<GitHubRelease | null> => {
  const [owner, repo] = releaseConfig.repository.split('/');
  const latest = await fetchGitHubJson<GitHubRelease>(`/repos/${owner}/${repo}/releases/latest`);
  if (latest) {
    return latest;
  }

  const releases = await fetchGitHubJson<GitHubRelease[]>(`/repos/${owner}/${repo}/releases?per_page=1`);
  if (!releases || releases.length === 0) {
    return null;
  }

  return releases[0];
};

const getLatestTag = async (): Promise<GitHubTag | null> => {
  const [owner, repo] = releaseConfig.repository.split('/');
  const tags = await fetchGitHubJson<GitHubTag[]>(`/repos/${owner}/${repo}/tags?per_page=1`);
  if (!tags || tags.length === 0) {
    return null;
  }

  return tags[0];
};

const fetchReleaseManifest = async (release: GitHubRelease | null): Promise<ReleaseManifest | null> => {
  if (!release) {
    return null;
  }

  const manifestAsset = release.assets.find((asset) => asset.name === RELEASE_MANIFEST_NAME);
  if (!manifestAsset) {
    return null;
  }

  const response = await fetch(manifestAsset.browser_download_url, {
    headers: releaseConfig.githubToken
      ? {
          Authorization: `Bearer ${releaseConfig.githubToken}`,
        }
      : undefined,
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Release manifest request failed: ${response.status} ${response.statusText}`);
  }

  const manifest = (await response.json()) as ReleaseManifest;
  if (!Array.isArray(manifest.assets) || manifest.schemaVersion !== 1) {
    throw new Error('Invalid release manifest schema');
  }

  return manifest;
};

const getExtension = (value: string): string => {
  const lowerValue = value.toLowerCase();
  const lastDot = lowerValue.lastIndexOf('.');
  return lastDot === -1 ? '' : lowerValue.slice(lastDot + 1);
};

const mapPlatformToken = (value: string): DirectPlatformId | null => {
  switch (value.toLowerCase()) {
    case 'mac':
    case 'macos':
      return 'macos';
    case 'win':
    case 'windows':
      return 'windows';
    case 'linux':
      return 'linux';
    case 'android':
      return 'android';
    case 'harmony':
    case 'harmonyos':
      return 'harmony';
    default:
      return null;
  }
};

const parseReleaseFileName = (
  fileName: string
): {
  arch: string | null;
  extension: string;
  platform: DirectPlatformId;
} | null => {
  const match = fileName.match(
    /^.+-\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?-(mac|macos|win|windows|linux|android|harmony|harmonyos)-([A-Za-z0-9._-]+)\.([A-Za-z0-9]+)$/i
  );

  if (match) {
    const platform = mapPlatformToken(match[1]);
    if (platform) {
      return {
        arch: match[2].toLowerCase(),
        extension: match[3].toLowerCase(),
        platform,
      };
    }
  }

  const extension = getExtension(fileName);
  if (extension === 'apk' || extension === 'aab') {
    return {
      arch: null,
      extension,
      platform: 'android',
    };
  }

  if (extension === 'hap') {
    return {
      arch: null,
      extension,
      platform: 'harmony',
    };
  }

  if (extension === 'app' && /harmony/i.test(fileName)) {
    return {
      arch: null,
      extension,
      platform: 'harmony',
    };
  }

  if (extension === 'deb') {
    return {
      arch: /arm64|aarch64/i.test(fileName) ? 'arm64' : /x64|amd64/i.test(fileName) ? 'x64' : null,
      extension,
      platform: 'linux',
    };
  }

  if ((extension === 'dmg' || extension === 'zip') && /mac/i.test(fileName)) {
    return {
      arch: /arm64|aarch64|apple\s*silicon/i.test(fileName)
        ? 'arm64'
        : /x64|intel/i.test(fileName)
          ? 'x64'
          : 'universal',
      extension,
      platform: 'macos',
    };
  }

  if ((extension === 'exe' || extension === 'msi' || extension === 'zip') && /win/i.test(fileName)) {
    return {
      arch: /arm64/i.test(fileName) ? 'arm64' : /x64|amd64/i.test(fileName) ? 'x64' : null,
      extension,
      platform: 'windows',
    };
  }

  return null;
};

const normalizeReleaseAssets = (release: GitHubRelease | null, manifest: ReleaseManifest | null): ResolvedAsset[] => {
  if (!release) {
    return [];
  }

  const releaseAssets = release.assets.filter((asset) => asset.name !== RELEASE_MANIFEST_NAME);
  const releaseAssetMap = new Map(releaseAssets.map((asset) => [asset.name, asset]));

  if (manifest) {
    const manifestAssets = manifest.assets
      .map((asset): ResolvedAsset | null => {
        const releaseAsset = releaseAssetMap.get(asset.fileName);
        if (!releaseAsset) {
          return null;
        }

        return {
          arch: asset.arch,
          extension: asset.extension.toLowerCase(),
          fileName: asset.fileName,
          href: releaseAsset.browser_download_url,
          platform: asset.platform,
          sha256: asset.sha256,
          size: asset.size,
        } satisfies ResolvedAsset;
      })
      .filter((asset): asset is ResolvedAsset => asset !== null);

    return manifestAssets;
  }

  const fallbackAssets = releaseAssets
    .map((asset): ResolvedAsset | null => {
      const parsed = parseReleaseFileName(asset.name);
      if (!parsed) {
        return null;
      }

      return {
        arch: parsed.arch,
        extension: parsed.extension,
        fileName: asset.name,
        href: asset.browser_download_url,
        platform: parsed.platform,
        sha256: null,
        size: asset.size,
      } satisfies ResolvedAsset;
    })
    .filter((asset): asset is ResolvedAsset => asset !== null);

  return fallbackAssets;
};

const matchesArch = (asset: ResolvedAsset, archMatchers: RegExp[]): boolean => {
  const { arch } = asset;
  if (!arch) {
    return false;
  }

  return archMatchers.some((matcher) => matcher.test(arch));
};

const pickAsset = (
  assets: ResolvedAsset[],
  matcher: (asset: ResolvedAsset) => boolean,
  preferredExtensions: string[]
): ResolvedAsset | null => {
  const matches = assets.filter(matcher);
  if (matches.length === 0) {
    return null;
  }

  for (const extension of preferredExtensions) {
    const preferred = matches.find((asset) => asset.extension === extension);
    if (preferred) {
      return preferred;
    }
  }

  return matches[0];
};

const buildAssetDescriptor = (asset: ResolvedAsset, label: string): DownloadEntryAsset => {
  return {
    fileName: asset.fileName,
    href: asset.href,
    label,
    sha256: asset.sha256,
    sizeBytes: asset.size,
  };
};

const getPlatformRequirements = (locale: Locale): Record<PlatformId, string[]> => {
  return {
    macos: [
      localized(locale, { en: 'macOS 12 or later', zh: 'macOS 12 或更高版本' }),
      localized(locale, { en: 'Apple Silicon or Intel Mac', zh: '支持 Apple Silicon 或 Intel Mac' }),
    ],
    windows: [
      localized(locale, { en: 'Windows 10 or Windows 11', zh: 'Windows 10 或 Windows 11' }),
      localized(locale, { en: '64-bit CPU (x64 or ARM64)', zh: '64 位处理器（x64 或 ARM64）' }),
    ],
    linux: [
      localized(locale, {
        en: 'Ubuntu / Debian compatible desktop environment',
        zh: '兼容 Ubuntu / Debian 的桌面环境',
      }),
      localized(locale, { en: 'x64 or ARM64 .deb package support', zh: '支持 x64 或 ARM64 的 .deb 安装包' }),
    ],
    android: [
      localized(locale, { en: 'Android 8.0 or later', zh: 'Android 8.0 或更高版本' }),
      localized(locale, {
        en: 'Allow browser / file-manager installs for APK sideloading',
        zh: '如走 APK 侧载，需要允许浏览器或文件管理器安装应用',
      }),
    ],
    ios: [
      localized(locale, {
        en: 'Install through App Store, TestFlight, or the configured web path',
        zh: '通过 App Store、TestFlight 或配置好的网页入口安装',
      }),
      localized(locale, { en: 'iOS / iPadOS 16 or later recommended', zh: '建议 iOS / iPadOS 16 或更高版本' }),
    ],
    harmony: [
      localized(locale, { en: 'HarmonyOS 4 or later', zh: 'HarmonyOS 4 或更高版本' }),
      localized(locale, {
        en: 'Prefer AppGallery or the configured official install path',
        zh: '优先通过 AppGallery 或配置好的官方安装入口安装',
      }),
    ],
  };
};

const getPlatformPermissions = (locale: Locale): Record<PlatformId, string[]> => {
  return {
    macos: [
      localized(locale, {
        en: 'Network access for remote control, sync, and release updates',
        zh: '用于远程连接、同步和版本更新的网络访问权限',
      }),
      localized(locale, {
        en: 'Microphone and automation prompts appear only when voice input or active-app paste features are enabled',
        zh: '仅在启用语音输入或向前台应用粘贴时请求麦克风与自动化权限',
      }),
    ],
    windows: [
      localized(locale, {
        en: 'Network access for remote control, sync, and agent connectivity',
        zh: '用于远程连接、同步和 Agent 联动的网络访问权限',
      }),
      localized(locale, {
        en: 'File-system access is only used for workspaces and files you explicitly select',
        zh: '文件系统访问只作用于你主动选择的工作目录和文件',
      }),
    ],
    linux: [
      localized(locale, {
        en: 'Network access for remote control, sync, and agent connectivity',
        zh: '用于远程连接、同步和 Agent 联动的网络访问权限',
      }),
      localized(locale, {
        en: 'Reads and writes are limited to workspaces and files you explicitly authorize',
        zh: '读写范围仅限你明确授权的工作目录和文件',
      }),
    ],
    android: [
      localized(locale, {
        en: 'Network access to connect back to the desktop host',
        zh: '用于连接桌面主机的网络访问权限',
      }),
      localized(locale, {
        en: 'Storage / media access is only needed when you choose local files to upload',
        zh: '仅在选择本地文件上传时需要存储或媒体访问权限',
      }),
    ],
    ios: [
      localized(locale, {
        en: 'Network access to connect back to the desktop host',
        zh: '用于连接桌面主机的网络访问权限',
      }),
      localized(locale, {
        en: 'Photos / Files access is only needed when you initiate import or upload flows',
        zh: '仅在主动发起导入或上传流程时需要“照片 / 文件”访问权限',
      }),
    ],
    harmony: [
      localized(locale, {
        en: 'Network access to connect back to the desktop host',
        zh: '用于连接桌面主机的网络访问权限',
      }),
      localized(locale, {
        en: 'Storage / media access is only needed when you choose local files to upload',
        zh: '仅在选择本地文件上传时需要存储或媒体访问权限',
      }),
    ],
  };
};

const createFallbackAction = (locale: Locale, releaseUrl: string): DownloadEntryAction => {
  return {
    href: releaseUrl,
    label: localized(locale, { en: 'Track Release', zh: '关注发布' }),
    emphasis: 'secondary',
    external: true,
  };
};

const getPlatformEntries = (
  locale: Locale,
  release: GitHubRelease | null,
  resolvedAssets: ResolvedAsset[]
): DownloadEntry[] => {
  const releaseUrl = release?.html_url || releasePageUrl;
  const requirements = getPlatformRequirements(locale);
  const permissions = getPlatformPermissions(locale);

  const platformAssets = (platform: DirectPlatformId): ResolvedAsset[] => {
    return resolvedAssets.filter((asset) => asset.platform === platform);
  };

  const macAssets = platformAssets('macos');
  const macUniversalAsset = pickAsset(macAssets, (asset) => matchesArch(asset, [/universal/i]), ['dmg', 'zip']) || null;
  const macArm64Asset =
    pickAsset(macAssets, (asset) => matchesArch(asset, [/arm64/i, /aarch64/i, /apple[-_. ]?silicon/i]), [
      'dmg',
      'zip',
    ]) || null;
  const macX64Asset = pickAsset(macAssets, (asset) => matchesArch(asset, [/x64/i, /intel/i]), ['dmg', 'zip']) || null;

  const macActions: DownloadEntryAction[] = [];
  const macAssetDetails: DownloadEntryAsset[] = [];
  if (macUniversalAsset) {
    macActions.push({
      href: macUniversalAsset.href,
      label: localized(locale, { en: 'Universal Download', zh: '通用版下载' }),
      emphasis: 'primary',
      external: true,
    });
    macAssetDetails.push(buildAssetDescriptor(macUniversalAsset, localized(locale, { en: 'Universal', zh: '通用版' })));
  } else {
    if (macArm64Asset) {
      macActions.push({
        href: macArm64Asset.href,
        label: localized(locale, { en: 'Apple Silicon', zh: 'Apple Silicon' }),
        emphasis: 'primary',
        external: true,
      });
      macAssetDetails.push(
        buildAssetDescriptor(macArm64Asset, localized(locale, { en: 'Apple Silicon', zh: 'Apple Silicon' }))
      );
    }

    if (macX64Asset) {
      macActions.push({
        href: macX64Asset.href,
        label: localized(locale, { en: 'Intel', zh: 'Intel' }),
        emphasis: macActions.length === 0 ? 'primary' : 'secondary',
        external: true,
      });
      macAssetDetails.push(buildAssetDescriptor(macX64Asset, localized(locale, { en: 'Intel', zh: 'Intel' })));
    }
  }

  if (macActions.length === 0) {
    macActions.push(createFallbackAction(locale, releaseUrl));
  }

  const windowsAssets = platformAssets('windows');
  const windowsX64Asset = pickAsset(windowsAssets, (asset) => matchesArch(asset, [/x64/i, /amd64/i]), [
    'exe',
    'msi',
    'zip',
  ]);
  const windowsArm64Asset = pickAsset(windowsAssets, (asset) => matchesArch(asset, [/arm64/i]), ['exe', 'msi', 'zip']);

  const windowsActions: DownloadEntryAction[] = [];
  const windowsAssetDetails: DownloadEntryAsset[] = [];
  if (windowsX64Asset) {
    windowsActions.push({
      href: windowsX64Asset.href,
      label: localized(locale, { en: 'Windows x64', zh: 'Windows x64' }),
      emphasis: 'primary',
      external: true,
    });
    windowsAssetDetails.push(
      buildAssetDescriptor(windowsX64Asset, localized(locale, { en: 'Windows x64', zh: 'Windows x64' }))
    );
  }

  if (windowsArm64Asset) {
    windowsActions.push({
      href: windowsArm64Asset.href,
      label: localized(locale, { en: 'Windows ARM64', zh: 'Windows ARM64' }),
      emphasis: windowsActions.length === 0 ? 'primary' : 'secondary',
      external: true,
    });
    windowsAssetDetails.push(
      buildAssetDescriptor(windowsArm64Asset, localized(locale, { en: 'Windows ARM64', zh: 'Windows ARM64' }))
    );
  }

  if (windowsActions.length === 0) {
    windowsActions.push(createFallbackAction(locale, releaseUrl));
  }

  const linuxAssets = platformAssets('linux');
  const linuxX64Asset = pickAsset(linuxAssets, (asset) => matchesArch(asset, [/x64/i, /amd64/i]), ['deb']);
  const linuxArm64Asset = pickAsset(linuxAssets, (asset) => matchesArch(asset, [/arm64/i, /aarch64/i]), ['deb']);

  const linuxActions: DownloadEntryAction[] = [];
  const linuxAssetDetails: DownloadEntryAsset[] = [];
  if (linuxX64Asset) {
    linuxActions.push({
      href: linuxX64Asset.href,
      label: localized(locale, { en: 'Linux x64', zh: 'Linux x64' }),
      emphasis: 'primary',
      external: true,
    });
    linuxAssetDetails.push(
      buildAssetDescriptor(linuxX64Asset, localized(locale, { en: 'Linux x64', zh: 'Linux x64' }))
    );
  }

  if (linuxArm64Asset) {
    linuxActions.push({
      href: linuxArm64Asset.href,
      label: localized(locale, { en: 'Linux ARM64', zh: 'Linux ARM64' }),
      emphasis: linuxActions.length === 0 ? 'primary' : 'secondary',
      external: true,
    });
    linuxAssetDetails.push(
      buildAssetDescriptor(linuxArm64Asset, localized(locale, { en: 'Linux ARM64', zh: 'Linux ARM64' }))
    );
  }

  if (linuxActions.length === 0) {
    linuxActions.push(createFallbackAction(locale, releaseUrl));
  }

  const androidAssets = platformAssets('android');
  const androidDirectAsset = pickAsset(androidAssets, () => true, ['apk', 'aab']);
  const androidActions: DownloadEntryAction[] = [];
  const androidAssetDetails: DownloadEntryAsset[] = [];

  if (releaseConfig.androidUrl) {
    androidActions.push({
      href: releaseConfig.androidUrl,
      label: localized(locale, { en: 'Android Download', zh: 'Android 下载' }),
      emphasis: 'primary',
      external: true,
    });
  }

  if (androidDirectAsset) {
    androidActions.push({
      href: androidDirectAsset.href,
      label: localized(locale, {
        en: androidDirectAsset.extension === 'aab' ? 'Android AAB' : 'Android APK',
        zh: androidDirectAsset.extension === 'aab' ? 'Android AAB' : 'Android APK',
      }),
      emphasis: androidActions.length === 0 ? 'primary' : 'secondary',
      external: true,
    });
    androidAssetDetails.push(
      buildAssetDescriptor(
        androidDirectAsset,
        localized(locale, {
          en: androidDirectAsset.extension === 'aab' ? 'Android AAB' : 'Android APK',
          zh: androidDirectAsset.extension === 'aab' ? 'Android AAB' : 'Android APK',
        })
      )
    );
  }

  const iosActions: DownloadEntryAction[] = [];
  if (releaseConfig.iosUrl) {
    iosActions.push({
      href: releaseConfig.iosUrl,
      label:
        releaseConfig.iosLabel || localized(locale, { en: 'TestFlight / App Store', zh: 'TestFlight / App Store' }),
      emphasis: 'primary',
      external: true,
    });
  }

  const harmonyAssets = platformAssets('harmony');
  const harmonyDirectAsset = pickAsset(harmonyAssets, () => true, ['hap', 'app']);
  const harmonyActions: DownloadEntryAction[] = [];
  const harmonyAssetDetails: DownloadEntryAsset[] = [];

  if (releaseConfig.harmonyUrl) {
    harmonyActions.push({
      href: releaseConfig.harmonyUrl,
      label:
        releaseConfig.harmonyLabel ||
        localized(locale, { en: 'AppGallery / Open Testing', zh: 'AppGallery / 公开测试' }),
      emphasis: 'primary',
      external: true,
    });
  }

  if (harmonyDirectAsset) {
    harmonyActions.push({
      href: harmonyDirectAsset.href,
      label: localized(locale, {
        en: harmonyDirectAsset.extension === 'app' ? 'HarmonyOS APP' : 'HarmonyOS HAP',
        zh: harmonyDirectAsset.extension === 'app' ? 'HarmonyOS APP' : 'HarmonyOS HAP',
      }),
      emphasis: harmonyActions.length === 0 ? 'primary' : 'secondary',
      external: true,
    });
    harmonyAssetDetails.push(
      buildAssetDescriptor(
        harmonyDirectAsset,
        localized(locale, {
          en: harmonyDirectAsset.extension === 'app' ? 'HarmonyOS APP' : 'HarmonyOS HAP',
          zh: harmonyDirectAsset.extension === 'app' ? 'HarmonyOS APP' : 'HarmonyOS HAP',
        })
      )
    );
  }

  return [
    {
      id: 'macos',
      title: 'macOS',
      channel: localized(locale, { en: 'Direct Download', zh: '直链下载' }),
      summary: localized(locale, {
        en: 'Universal, Apple Silicon, or Intel desktop builds from the latest GitHub Release.',
        zh: '从最新 GitHub Release 直接提供通用版、Apple Silicon 和 Intel 桌面安装包。',
      }),
      status: macAssetDetails.length > 0 ? 'direct' : 'pending',
      actions: macActions,
      assets: macAssetDetails,
      permissions: permissions.macos,
      systemRequirements: requirements.macos,
    },
    {
      id: 'windows',
      title: 'Windows',
      channel: localized(locale, { en: 'Direct Download', zh: '直链下载' }),
      summary: localized(locale, {
        en: 'Direct installers from GitHub Release assets, aligned with the release naming convention.',
        zh: '直接使用 GitHub Release 资产里的安装包，并与 release 资产命名规范保持一致。',
      }),
      status: windowsAssetDetails.length > 0 ? 'direct' : 'pending',
      actions: windowsActions,
      assets: windowsAssetDetails,
      permissions: permissions.windows,
      systemRequirements: requirements.windows,
    },
    {
      id: 'linux',
      title: 'Linux',
      channel: localized(locale, { en: 'Direct Download', zh: '直链下载' }),
      summary: localized(locale, {
        en: 'Debian-compatible desktop packages attached to the latest GitHub Release.',
        zh: '最新 GitHub Release 附带 Debian 系桌面安装包。',
      }),
      status: linuxAssetDetails.length > 0 ? 'direct' : 'pending',
      actions: linuxActions,
      assets: linuxAssetDetails,
      permissions: permissions.linux,
      systemRequirements: requirements.linux,
    },
    {
      id: 'android',
      title: 'Android',
      channel: localized(locale, {
        en: androidActions.length > 0 ? 'Direct Download' : 'Planned Direct Download',
        zh: androidActions.length > 0 ? '直链下载' : '待接入直链下载',
      }),
      summary: localized(locale, {
        en: 'APK or AAB distribution for sideload installs, or a dedicated Android download endpoint.',
        zh: '通过 APK / AAB 侧载分发，或接到独立的 Android 下载地址。',
      }),
      status: androidActions.length > 0 ? 'direct' : 'pending',
      actions: androidActions.length > 0 ? androidActions : [createFallbackAction(locale, releaseUrl)],
      assets: androidAssetDetails,
      permissions: permissions.android,
      systemRequirements: requirements.android,
    },
    {
      id: 'ios',
      title: localized(locale, { en: 'iPhone / iPad', zh: 'iPhone / iPad' }),
      channel: localized(locale, {
        en: iosActions.length > 0 ? 'Official Install Path' : 'Configure Official Path',
        zh: iosActions.length > 0 ? '官方安装路径' : '待配置官方安装路径',
      }),
      summary: localized(locale, {
        en: 'Point users to App Store, TestFlight, or your configured web install path instead of public IPA hosting.',
        zh: '将用户引导到 App Store、TestFlight 或你配置的网页安装入口，而不是公开托管 IPA。',
      }),
      status: iosActions.length > 0 ? 'official' : 'pending',
      actions: iosActions.length > 0 ? iosActions : [createFallbackAction(locale, releaseUrl)],
      assets: [],
      permissions: permissions.ios,
      systemRequirements: requirements.ios,
    },
    {
      id: 'harmony',
      title: 'HarmonyOS',
      channel: localized(locale, {
        en: harmonyActions.length > 0 ? 'Official Or Direct Path' : 'Configure Official Path',
        zh: harmonyActions.length > 0 ? '官方或直链入口' : '待配置官方安装路径',
      }),
      summary: localized(locale, {
        en: 'Prefer AppGallery / AppGallery Connect, while still allowing direct HAP or APP assets as fallback.',
        zh: '优先走 AppGallery / AppGallery Connect，同时保留 HAP / APP 直链作为补充入口。',
      }),
      status: harmonyActions.some((action) => action.emphasis === 'primary' && action.href === releaseConfig.harmonyUrl)
        ? 'official'
        : harmonyAssetDetails.length > 0
          ? 'direct'
          : 'pending',
      actions: harmonyActions.length > 0 ? harmonyActions : [createFallbackAction(locale, releaseUrl)],
      assets: harmonyAssetDetails,
      permissions: permissions.harmony,
      systemRequirements: requirements.harmony,
    },
  ];
};

export const getReleaseSnapshot = async (locale: Locale = 'en'): Promise<ReleaseSnapshot> => {
  let release: GitHubRelease | null = null;
  let latestTag: GitHubTag | null = null;
  let manifest: ReleaseManifest | null = null;

  try {
    release = await getLatestRelease();
  } catch (error) {
    console.error('[web] Failed to fetch latest GitHub release:', error);
  }

  try {
    latestTag = await getLatestTag();
  } catch (error) {
    console.error('[web] Failed to fetch latest GitHub tag:', error);
  }

  try {
    manifest = await fetchReleaseManifest(release);
  } catch (error) {
    console.error('[web] Failed to fetch release manifest:', error);
  }

  const resolvedAssets = normalizeReleaseAssets(release, manifest);
  const entries = getPlatformEntries(locale, release, resolvedAssets);
  const directAssets = entries.flatMap((entry) => entry.assets);
  const checksumsAvailable = directAssets.length > 0 && directAssets.every((asset) => Boolean(asset.sha256));

  return {
    repository: releaseConfig.repository,
    releaseUrl: release?.html_url || releasePageUrl,
    version: release?.tag_name || latestTag?.name || manifest?.version || null,
    publishedAt: release?.published_at || null,
    manifestGeneratedAt: manifest?.generatedAt || null,
    checksumsAvailable,
    source: release ? 'release' : latestTag ? 'tag' : 'none',
    entries,
  };
};

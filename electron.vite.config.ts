import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'fs';
import { resolve } from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import UnoCSS from 'unocss/vite';
import { transformWithEsbuild } from 'vite';
import unoConfig from './uno.config.ts';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Icon Park transform plugin (replaces webpack icon-park-loader)
function iconParkPlugin() {
  return {
    name: 'vite-plugin-icon-park',
    enforce: 'pre' as const,
    transform(source: string, id: string) {
      if (!id.endsWith('.tsx') || id.includes('node_modules')) return null;
      if (!source.includes('@icon-park/react')) return null;
      const transformedSource = source.replace(
        /import\s+\{\s+([a-zA-Z, ]*)\s+\}\s+from\s+['"]@icon-park\/react['"](;?)/g,
        function (str, match) {
          if (!match) return str;
          const components = match.split(',');
          const importComponent = str.replace(
            match,
            components.map((key: string) => `${key} as _${key.trim()}`).join(', ')
          );
          const hoc = `import IconParkHOC from '@renderer/components/IconParkHOC';
          ${components.map((key: string) => `const ${key.trim()} = IconParkHOC(_${key.trim()})`).join(';\n')}`;
          return importComponent + ';' + hoc;
        }
      );
      if (transformedSource !== source) return { code: transformedSource, map: null } as { code: string; map: null };
      return null;
    },
  };
}

const blockSuiteImportPattern = /^@blocksuite\/([^/]+)(\/.*)?$/;
const blockSuitePackageExportsCache = new Map<string, Map<string, string>>();

const stripQuery = (id: string) => id.split('?')[0];

const findNearestNodeModulesRoot = (id?: string) => {
  if (!id) {
    return null;
  }

  const match = stripQuery(id).match(/^(.*[\/]node_modules)(?:[\/].*)$/);
  return match?.[1] ?? null;
};

const findBlockSuitePackageDir = (packageName: string, importer?: string) => {
  const importerNodeModulesRoot = findNearestNodeModulesRoot(importer);
  const candidates = [
    importerNodeModulesRoot ? resolve(importerNodeModulesRoot, '@blocksuite', packageName) : null,
    resolve('node_modules', '@blocksuite', packageName),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    try {
      return realpathSync(candidate);
    } catch {
      return candidate;
    }
  }

  return null;
};

const getBlockSuitePackageExports = (packageDir: string) => {
  const cached = blockSuitePackageExportsCache.get(packageDir);
  if (cached) {
    return cached;
  }

  const packageJsonPath = resolve(packageDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    exports?: Record<string, string | { default?: string }>;
  };
  const exportMap = new Map<string, string>();

  Object.entries(packageJson.exports ?? {}).forEach(([key, value]) => {
    if (typeof value === 'string') {
      exportMap.set(key, value);
      return;
    }

    if (typeof value?.default === 'string') {
      exportMap.set(key, value.default);
    }
  });

  blockSuitePackageExportsCache.set(packageDir, exportMap);
  return exportMap;
};

const resolveBlockSuiteDistPath = (source: string, importer?: string) => {
  const match = source.match(blockSuiteImportPattern);
  if (!match) {
    return null;
  }

  const [, packageName, rawSubpath] = match;
  const packageDir = findBlockSuitePackageDir(packageName, importer);
  if (!packageDir) {
    return null;
  }

  const exportMap = getBlockSuitePackageExports(packageDir);
  const exportKey = rawSubpath ? `.${rawSubpath}` : '.';
  const exportTarget = exportMap.get(exportKey);
  const candidatePaths: string[] = [];

  if (exportTarget) {
    const distTarget = exportTarget.startsWith('./src/')
      ? exportTarget.replace(/^\.\/src\//, './dist/').replace(/\.tsx?$/, '.js')
      : exportTarget;
    candidatePaths.push(resolve(packageDir, distTarget));
  }

  if (rawSubpath) {
    const relativeSubpath = rawSubpath.slice(1);
    candidatePaths.push(resolve(packageDir, 'dist', `${relativeSubpath}.js`));
    candidatePaths.push(resolve(packageDir, 'dist', relativeSubpath, 'index.js'));
  } else {
    candidatePaths.push(resolve(packageDir, 'dist', 'index.js'));
  }

  return candidatePaths.find(candidate => existsSync(candidate)) ?? null;
};

function blockSuiteDistResolvePlugin() {
  return {
    name: 'vite-plugin-blocksuite-dist-resolve',
    enforce: 'pre' as const,
    resolveId(source: string, importer?: string) {
      if (!source.startsWith('@blocksuite/')) {
        return null;
      }

      return resolveBlockSuiteDistPath(source, importer);
    },
  };
}

const bunPackagesDir = resolve('node_modules/.bun');
const findBunPackageDir = (prefix: string, packageSubpath: string) => {
  const entry = readdirSync(bunPackagesDir).find(name => name.startsWith(prefix));
  if (!entry) {
    return null;
  }

  const candidate = resolve(bunPackagesDir, entry, 'node_modules', packageSubpath);
  return existsSync(candidate) ? realpathSync(candidate) : null;
};

const litPackagePath = findBunPackageDir('@blocksuite+global@', 'lit');
const preactSignalsCorePackagePath = findBunPackageDir('@blocksuite+global@', '@preact/signals-core');

const extendShimPath = resolve('src/common/utils/shims/extend.js');
const extendShimSource = readFileSync(extendShimPath, 'utf8');
const isExtendModule = (id: string) => id.includes('/node_modules/.bun/extend@') && id.endsWith('/node_modules/extend/index.js');

const shouldTranspileBlockSuiteModule = (id: string) => {
  if (!id.includes('node_modules')) return false;

  return id.includes('/node_modules/.bun/@blocksuite+') || id.includes('/node_modules/@blocksuite/');
};

function blockSuiteSyntaxCompatPlugin() {
  return {
    name: 'vite-plugin-blocksuite-syntax-compat',
    enforce: 'pre' as const,
    async transform(source: string, id: string) {
      const [cleanId] = id.split('?');

      if (source.includes("from 'extend'")) {
        source = source.replaceAll(
          "from 'extend'",
          "from '/src/common/utils/shims/extend.js?contextgo-shim=1'"
        );
      }

      if (isExtendModule(cleanId)) {
        return {
          code: extendShimSource,
          map: null as null,
        };
      }

      if (!shouldTranspileBlockSuiteModule(cleanId)) return null;
      if (!cleanId.endsWith('.js') && !cleanId.endsWith('.mjs') && !cleanId.endsWith('.ts')) return null;

      return transformWithEsbuild(source, cleanId, {
        loader: cleanId.endsWith('.ts') ? 'ts' : 'js',
        sourcemap: false,
        target: 'es2022',
      });
    },
  };
}

// Common path aliases for main process and workers
const mainAliases = {
  '@': resolve('src'),
  '@common': resolve('src/common'),
  '@renderer': resolve('src/renderer'),
  '@process': resolve('src/process'),
  '@worker': resolve('src/process/worker'),
  '@xterm/headless': resolve('src/common/utils/shims/xterm-headless.ts'),
};

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development';
  const enableSentrySourceMaps = !isDevelopment && !!process.env.SENTRY_AUTH_TOKEN;

  const sentryPluginOptions = {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    sourcemaps: {
      filesToDeleteAfterUpload: ['./out/**/*.map'],
      rewriteSources: (source: string) => {
        // Normalize Windows backslashes and strip leading relative prefixes
        // so Sentry paths match the GitHub repo structure (e.g. src/process/...)
        return source.replace(/\\/g, '/').replace(/^(\.\.\/)+(src\/)/, '$2');
      },
    },
  };

  return {
    main: {
      plugins: [
        // externalizeDepsPlugin replaces our custom getExternalDeps() + pluginExternalizeDynamicImports.
        // 'fix-path' excluded so it gets bundled inline (only 3KB).
        externalizeDepsPlugin({ exclude: ['fix-path'] }),
        ...(!isDevelopment
          ? [
              viteStaticCopy({
                structured: false,
                // electron-vite builds main process as SSR; viteStaticCopy defaults
                // to environment: "client" and silently skips non-client environments.
                environment: 'ssr',
                targets: [
                  // Use single * glob to copy top-level items (directories) with their contents intact.
                  // Using ** would flatten all nested files into the dest root.
                  { src: 'src/process/resources/skills/*', dest: 'skills' },
                  { src: 'src/process/resources/hooks/*', dest: 'hooks' },
                  { src: 'src/process/resources/assistant/*', dest: 'assistant' },
                  { src: 'src/renderer/assets/logos/*', dest: 'static/images' },
                ],
              }),
            ]
          : []),
        ...(enableSentrySourceMaps ? [sentryVitePlugin(sentryPluginOptions)] : []),
      ],
      resolve: { alias: mainAliases, extensions: ['.ts', '.tsx', '.js', '.json'] },
      build: {
        sourcemap: enableSentrySourceMaps ? 'hidden' : false,
        reportCompressedSize: false,
        rollupOptions: {
          input: {
            index: resolve('src/index.ts'),
            // Worker entry files are output alongside index.js in out/main/.
            // BaseAgentManager.resolveWorkerDir() handles the case where code
            // splitting places it in a chunks/ subdirectory.
            gemini: resolve('src/process/worker/gemini.ts'),
            acp: resolve('src/process/worker/acp.ts'),
            codex: resolve('src/process/worker/codex.ts'),
            'openclaw-gateway': resolve('src/process/worker/openclaw-gateway.ts'),
            nanobot: resolve('src/process/worker/nanobot.ts'),
            // Built-in MCP server entry points
            'builtin-mcp-image-gen': resolve('src/process/resources/builtinMcp/imageGenServer.ts'),
          },
          external: ['iohook-macos'],
          onwarn(warning, warn) {
            if (warning.code === 'EVAL') return;
            warn(warning);
          },
        },
      },
      define: {
        'process.env.env': JSON.stringify(process.env.env),
        'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN ?? ''),
      },
    },

    preload: {
      plugins: [externalizeDepsPlugin()],
      resolve: {
        alias: { '@': resolve('src'), '@common': resolve('src/common') },
        extensions: ['.ts', '.tsx', '.js', '.json'],
      },
      build: {
        sourcemap: false,
        reportCompressedSize: false,
        rollupOptions: { input: { index: resolve('src/preload.ts') } },
      },
    },

    renderer: {
      base: './',
      server: {
        // Keep renderer HTTP port deterministic for Electron runtime URL injection.
        // If 5173 is unavailable, fail fast instead of auto-switching to 5174+,
        // which causes renderer resource requests to target the wrong origin.
        port: 5173,
        strictPort: true,
        // Explicit HMR config so Vite client connects directly to the Vite dev server,
        // not to the WebUI proxy server (which would reject the WebSocket and cause infinite reload)
        hmr: {
          host: 'localhost',
          port: 5173,
        },
      },
      resolve: {
        alias: {
          '@': resolve('src'),
          '@common': resolve('src/common'),
          '@renderer': resolve('src/renderer'),
          '@process': resolve('src/process'),
          '@worker': resolve('src/process/worker'),
          // Force ESM version of streamdown
          streamdown: resolve('node_modules/streamdown/dist/index.js'),
          // BlockSuite mindmap imports expect a default export shape that esbuild does not infer.
          'simple-xml-to-json': resolve('src/common/utils/shims/simpleXmlToJson.js'),
          ...(litPackagePath ? { lit: litPackagePath } : {}),
          ...(preactSignalsCorePackagePath ? { '@preact/signals-core': preactSignalsCorePackagePath } : {}),
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.css'],
        dedupe: ['react', 'react-dom', 'react-router-dom'],
      },
      plugins: [
        blockSuiteDistResolvePlugin(),
        blockSuiteSyntaxCompatPlugin(),
        UnoCSS(unoConfig),
        vanillaExtractPlugin(),
        iconParkPlugin(),
        ...(enableSentrySourceMaps ? [sentryVitePlugin(sentryPluginOptions)] : []),
      ],
      build: {
        target: 'es2022',
        sourcemap: enableSentrySourceMaps ? 'hidden' : isDevelopment,
        minify: !isDevelopment,
        reportCompressedSize: false,
        chunkSizeWarningLimit: 1500,
        cssCodeSplit: true,
        rollupOptions: {
          input: { index: resolve('src/renderer/index.html') },
          external: ['node:crypto', 'crypto'],
          output: {
            manualChunks(id: string) {
              if (!id.includes('node_modules')) return undefined;
              if (id.includes('/react-dom/') || id.includes('/react/')) return 'vendor-react';
              if (id.includes('/@arco-design/')) return 'vendor-arco';
              if (
                id.includes('/react-markdown/') ||
                id.includes('/remark-') ||
                id.includes('/rehype-') ||
                id.includes('/unified/') ||
                id.includes('/mdast-') ||
                id.includes('/hast-') ||
                id.includes('/micromark')
              )
                return 'vendor-markdown';
              if (
                id.includes('/react-syntax-highlighter/') ||
                id.includes('/refractor/') ||
                id.includes('/highlight.js/')
              )
                return 'vendor-highlight';
              if (
                id.includes('/monaco-editor/') ||
                id.includes('/@monaco-editor/') ||
                id.includes('/codemirror/') ||
                id.includes('/@codemirror/')
              )
                return 'vendor-editor';
              if (id.includes('/katex/')) return 'vendor-katex';
              if (id.includes('/@icon-park/')) return 'vendor-icons';
              if (id.includes('/diff2html/')) return 'vendor-diff';
              return undefined;
            },
          },
        },
      },
      define: {
        'process.env.env': JSON.stringify(process.env.env),
        'process.env.SENTRY_DSN': JSON.stringify(process.env.SENTRY_DSN ?? ''),
        global: 'globalThis',
      },
      optimizeDeps: {
        exclude: [
          'electron',
          '@blocksuite/affine/effects',
          '@blocksuite/affine/ext-loader',
          '@blocksuite/affine/extensions/store',
          '@blocksuite/affine/extensions/view',
          '@blocksuite/affine/global/lit',
          '@blocksuite/affine/model',
          '@blocksuite/affine/shared/services',
          '@blocksuite/affine/std',
          '@blocksuite/affine/std/gfx',
          '@blocksuite/affine/store',
          '@blocksuite/affine/store/test',
          'lit',
          'lit/directives/keyed.js',
          'lit/directives/when.js',
          '@preact/signals-core',
        ],
        include: [
          'react',
          'react-dom',
          'react-router-dom',
          'react-i18next',
          'i18next',
          '@arco-design/web-react',
          '@icon-park/react',
          'react-markdown',
          'react-syntax-highlighter',
          'react-virtuoso',
          'classnames',
          'swr',
          'eventemitter3',
          'katex',
          'diff2html',
          'remark-gfm',
          'remark-math',
          'remark-breaks',
          'rehype-raw',
          'rehype-katex',
          '@chenglou/pretext',
        ],
      },
    },
  };
});

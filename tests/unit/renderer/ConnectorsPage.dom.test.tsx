import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const bridgeMocks = vi.hoisted(() => ({
  openExternalInvoke: vi.fn(),
  externalConnectorCatalogGetDetailsInvoke: vi.fn(async ({ connector }: { connector: string }) => {
    const detailsByConnector = {
      clipboard: {
        connector: 'clipboard',
        kind: 'activity',
        enabled: true,
        summary: 'Clipboard activity runtime via connector CLI',
        runtime_dir: '/tmp/contextgo/connector/clipboard',
        config_path: '/tmp/contextgo/connector/clipboard/config.yaml',
        platform_access: 'Native desktop clipboard observation through the connector CLI activity runtime.',
        runtime_boundary:
          'Connector runtime lives in the sibling repository and owns observer config, logs, and retention state.',
        native_surface: ['clipboard events', 'daily summaries', 'observer config'],
        implemented_workflows: [
          {
            id: 'clipboard.runtime',
            label: 'Clipboard observer runtime',
            surface: 'runtime',
            status: 'ready',
            native_objects: ['observer config', 'capture loop'],
            entrypoints: ['cgo activity clipboard observe'],
            writes_store: false,
            notes: ['Clipboard runtime is fully owned by the connector project.'],
          },
        ],
        notes: [],
        runtime: {},
      },
      'browser-extension': {
        connector: 'browser-extension',
        kind: 'activity',
        enabled: true,
        summary: 'Browser extension ingest runtime via connector CLI',
        runtime_dir: '/tmp/contextgo/connector/browser-extension',
        config_path: '/tmp/contextgo/connector/browser-extension/config.yaml',
        platform_access: 'Browser extension event ingest plus host forwarding health checks.',
        runtime_boundary:
          'Connector runtime owns extension pairing, ingest state, and browser activity retention before ContextGo consumes the outputs.',
        native_surface: ['browser visits', 'tab sessions', 'daily summaries'],
        implemented_workflows: [
          {
            id: 'browser-extension.collect',
            label: 'Extension ingest runtime',
            surface: 'collect',
            status: 'ready',
            native_objects: ['browser visits', 'tab sessions'],
            entrypoints: ['cgo collect browser-extension'],
            writes_store: true,
            notes: ['The browser extension remains connector-project owned.'],
          },
        ],
        notes: [],
        runtime: {},
      },
      'google-drive': {
        connector: 'google-drive',
        kind: 'official-cli',
        enabled: true,
        summary: 'Google Drive runtime boundary in connector CLI',
        runtime_dir: '/tmp/contextgo/connector/google-drive',
        config_path: '/tmp/contextgo/connector/google-drive/config.yaml',
        platform_access: 'Official Google-native runtime surface managed by the connector project.',
        runtime_boundary:
          'ContextGo only consumes the connector-owned Google Drive capability model and downstream outputs.',
        native_surface: ['files', 'folders', 'drive metadata'],
        implemented_workflows: [
          {
            id: 'google-drive.runtime',
            label: 'Drive CLI passthrough boundary',
            surface: 'runtime',
            status: 'planned',
            native_objects: ['files', 'folders'],
            entrypoints: [],
            writes_store: false,
            notes: ['Google runtime migration is still landing in the connector project.'],
          },
        ],
        notes: [],
        runtime: {},
      },
      'google-docs': {
        connector: 'google-docs',
        kind: 'official-cli',
        enabled: true,
        summary: 'Google Docs runtime boundary in connector CLI',
        runtime_dir: '/tmp/contextgo/connector/google-docs',
        config_path: '/tmp/contextgo/connector/google-docs/config.yaml',
        platform_access: 'Official Google-native runtime surface managed by the connector project.',
        runtime_boundary:
          'ContextGo only consumes the connector-owned Google Docs capability model and downstream outputs.',
        native_surface: ['documents', 'document structure'],
        implemented_workflows: [
          {
            id: 'google-docs.runtime',
            label: 'Docs CLI passthrough boundary',
            surface: 'runtime',
            status: 'planned',
            native_objects: ['documents'],
            entrypoints: [],
            writes_store: false,
            notes: [],
          },
        ],
        notes: [],
        runtime: {},
      },
      'google-sheets': {
        connector: 'google-sheets',
        kind: 'official-cli',
        enabled: true,
        summary: 'Google Sheets runtime boundary in connector CLI',
        runtime_dir: '/tmp/contextgo/connector/google-sheets',
        config_path: '/tmp/contextgo/connector/google-sheets/config.yaml',
        platform_access: 'Official Google-native runtime surface managed by the connector project.',
        runtime_boundary:
          'ContextGo only consumes the connector-owned Google Sheets capability model and downstream outputs.',
        native_surface: ['spreadsheets', 'worksheets', 'ranges'],
        implemented_workflows: [
          {
            id: 'google-sheets.runtime',
            label: 'Sheets CLI passthrough boundary',
            surface: 'runtime',
            status: 'planned',
            native_objects: ['spreadsheets'],
            entrypoints: [],
            writes_store: false,
            notes: [],
          },
        ],
        notes: [],
        runtime: {},
      },
      gmail: {
        connector: 'gmail',
        kind: 'official-cli',
        enabled: true,
        summary: 'Gmail runtime boundary in connector CLI',
        runtime_dir: '/tmp/contextgo/connector/gmail',
        config_path: '/tmp/contextgo/connector/gmail/config.yaml',
        platform_access: 'Official Google-native runtime surface managed by the connector project.',
        runtime_boundary: 'ContextGo only consumes the connector-owned Gmail capability model and downstream outputs.',
        native_surface: ['mailboxes', 'messages', 'labels'],
        implemented_workflows: [
          {
            id: 'gmail.runtime',
            label: 'Gmail CLI passthrough boundary',
            surface: 'runtime',
            status: 'planned',
            native_objects: ['mailboxes', 'messages'],
            entrypoints: [],
            writes_store: false,
            notes: [],
          },
        ],
        notes: [],
        runtime: {},
      },
      'google-calendar': {
        connector: 'google-calendar',
        kind: 'official-cli',
        enabled: true,
        summary: 'Google Calendar runtime boundary in connector CLI',
        runtime_dir: '/tmp/contextgo/connector/google-calendar',
        config_path: '/tmp/contextgo/connector/google-calendar/config.yaml',
        platform_access: 'Official Google-native runtime surface managed by the connector project.',
        runtime_boundary:
          'ContextGo only consumes the connector-owned Google Calendar capability model and downstream outputs.',
        native_surface: ['calendars', 'events'],
        implemented_workflows: [
          {
            id: 'google-calendar.runtime',
            label: 'Calendar CLI passthrough boundary',
            surface: 'runtime',
            status: 'planned',
            native_objects: ['calendars', 'events'],
            entrypoints: [],
            writes_store: false,
            notes: [],
          },
        ],
        notes: [],
        runtime: {},
      },
      xiaohongshu: {
        connector: 'xiaohongshu',
        kind: 'managed_runtime',
        enabled: true,
        summary: 'Xiaohongshu MCP service process is running; authorize an account to use user actions.',
        runtime_dir: '/Users/bytedance/.contextgo/spaces/main/connectors/xiaohongshu',
        config_path: '/Users/bytedance/.contextgo/spaces/main/connectors/xiaohongshu/config.json',
        platform_access: 'Managed local `xiaohongshu-mcp` service dependency through REST and MCP Streamable HTTP',
        runtime_boundary:
          'The active space owns account registry, cookies, service metadata, logs, datasource/profile projection, and HTTP invocation state.',
        native_surface: ['accounts', 'feeds', 'search', 'note detail', 'comments', 'publish', 'interactions'],
        implemented_workflows: [
          {
            id: 'xiaohongshu-managed-service',
            label: 'Managed service and account control plane',
            surface: 'runtime',
            status: 'ready',
            native_objects: ['managed accounts', 'cookies', 'service process', 'REST API', 'MCP tools'],
            entrypoints: ['cgo xiaohongshu service-status', 'cgo xiaohongshu login-browser'],
            writes_store: false,
            notes: ['The upstream service is an external process dependency.'],
          },
        ],
        capabilities: {
          version: 1,
          extraction_mode: 'manual-curation',
          discovery_commands: ['cgo xiaohongshu capabilities --json'],
          notes: ['Capabilities are executed through the Space Connector managed Xiaohongshu MCP service.'],
          groups: [
            {
              id: 'account-runtime',
              label: 'Account and runtime',
              summary: 'Manage the local service process, account registry, login state, and current user profile.',
              native_objects: ['account registry', 'cookies', 'login QR code'],
              discovery_commands: ['cgo xiaohongshu service-status --json'],
              sources: [{ kind: 'manual-curation', ref: 'xiaohongshu-mcp REST and MCP tool surface' }],
              actions: [
                {
                  id: 'login',
                  label: 'Authorize account',
                  summary: 'Check login state, display a QR code, or use the headed browser login flow.',
                  entrypoints: ['cgo xiaohongshu login-status --json', 'cgo xiaohongshu login-browser'],
                  auth_modes: ['user'],
                  sources: [{ kind: 'manual-curation', ref: 'xiaohongshu-mcp REST and MCP tool surface' }],
                },
                {
                  id: 'current-user',
                  label: 'Read current user',
                  summary: 'Fetch the profile for the currently authorized Xiaohongshu account.',
                  entrypoints: ['cgo xiaohongshu me --json'],
                  auth_modes: ['user'],
                  sources: [{ kind: 'manual-curation', ref: 'xiaohongshu-mcp REST and MCP tool surface' }],
                },
              ],
            },
            {
              id: 'content-discovery',
              label: 'Content discovery',
              summary: 'Read home feeds and search notes using Xiaohongshu native content surfaces.',
              native_objects: ['home feed', 'search results', 'notes'],
              discovery_commands: ['cgo xiaohongshu feeds-list --json', 'cgo xiaohongshu search <keyword> --json'],
              sources: [{ kind: 'manual-curation', ref: 'xiaohongshu-mcp REST and MCP tool surface' }],
              actions: [
                {
                  id: 'feeds-list',
                  label: 'Read feed list',
                  summary: 'Fetch the logged-in account feed list from the managed local service.',
                  entrypoints: ['cgo xiaohongshu feeds-list --json'],
                  auth_modes: ['user'],
                  sources: [{ kind: 'manual-curation', ref: 'xiaohongshu-mcp REST and MCP tool surface' }],
                },
                {
                  id: 'search',
                  label: 'Search notes',
                  summary: 'Search Xiaohongshu notes by keyword and optional filter JSON.',
                  entrypoints: ['cgo xiaohongshu search <keyword> --json'],
                  auth_modes: ['user'],
                  sources: [{ kind: 'manual-curation', ref: 'xiaohongshu-mcp REST and MCP tool surface' }],
                },
              ],
            },
            {
              id: 'publishing-interactions',
              label: 'Publishing and interactions',
              summary: 'Publish content and perform authenticated note interactions.',
              native_objects: ['image posts', 'video posts', 'comments', 'likes', 'favorites'],
              discovery_commands: ['cgo xiaohongshu publish --help', 'cgo xiaohongshu publish-video --help'],
              sources: [{ kind: 'manual-curation', ref: 'xiaohongshu-mcp REST and MCP tool surface' }],
              actions: [
                {
                  id: 'publish-image',
                  label: 'Publish image note',
                  summary: 'Publish an image/text note using local image paths.',
                  entrypoints: ['cgo xiaohongshu publish --title <title> --content <text> --image <path>'],
                  auth_modes: ['user'],
                  sources: [{ kind: 'manual-curation', ref: 'xiaohongshu-mcp REST and MCP tool surface' }],
                },
                {
                  id: 'like-favorite',
                  label: 'Like and favorite',
                  summary: 'Use the MCP tool surface to like/unlike or favorite/unfavorite a note.',
                  entrypoints: ['cgo xiaohongshu like --feed-id <id> --xsec-token <token>'],
                  auth_modes: ['user'],
                  sources: [{ kind: 'manual-curation', ref: 'xiaohongshu-mcp REST and MCP tool surface' }],
                },
              ],
            },
          ],
        },
        notes: [],
        runtime: {
          pid_running: true,
          health_reachable: true,
          logged_in: false,
          active_account_id: 'default',
          account_count: 1,
          base_url: 'http://127.0.0.1:18060',
          headless: true,
          capabilities: ['feeds-list', 'search', 'publish', 'like'],
          cookies_path: '/Users/bytedance/.contextgo/spaces/main/connectors/xiaohongshu/cookies.json',
          service_repo_path: '/Users/bytedance/project/xiaohongshu-mcp',
          state_dir: '/Users/bytedance/.contextgo/spaces/main/connectors/xiaohongshu',
        },
      },
      feishu: {
        connector: 'feishu',
        kind: 'connector',
        enabled: true,
        summary: 'Feishu connector via lark-cli',
        runtime_dir: '/tmp/contextgo/connector/feishu',
        config_path: '/tmp/contextgo/connector/feishu/config.json',
        platform_access: 'Official Feishu Open Platform through lark-cli.',
        runtime_boundary: 'Connector runtime lives in the sibling connector repository and keeps its own auth state.',
        native_surface: ['messages', 'docs', 'calendar'],
        implemented_workflows: [
          {
            id: 'feishu.collect.messages',
            label: 'Collect chat messages',
            surface: 'collect',
            status: 'ready',
            native_objects: ['chats', 'messages'],
            entrypoints: ['cgo connectors feishu collect'],
            writes_store: true,
            notes: ['Writes normalized Feishu assets into connector storage.'],
          },
        ],
        capabilities: {
          version: 1,
          extraction_mode: 'hybrid',
          discovery_commands: ['lark schema', 'lark docs --help', 'lark calendar --help'],
          notes: ['Capability schema combines CLI self-description and curated annotations.'],
          groups: [
            {
              id: 'docs',
              label: 'Docs',
              summary: 'Document authoring, reading, and search.',
              native_objects: ['documents', 'blocks'],
              discovery_commands: ['lark docs --help'],
              sources: [{ kind: 'official-cli-help', ref: 'lark docs --help' }],
              actions: [
                {
                  id: 'docs.read',
                  label: 'Read and search documents',
                  summary: 'Inspect document content and find relevant docs.',
                  entrypoints: ['lark docs ...'],
                  auth_modes: ['user', 'bot'],
                  sources: [{ kind: 'official-cli-help', ref: 'lark docs --help' }],
                },
              ],
            },
            {
              id: 'calendar',
              label: 'Calendar',
              summary: 'Schedule planning, event management, and attendee coordination.',
              native_objects: ['calendars', 'events', 'attendees'],
              discovery_commands: ['lark calendar --help'],
              sources: [{ kind: 'official-cli-help', ref: 'lark calendar --help' }],
              actions: [
                {
                  id: 'calendar.manage',
                  label: 'Create and update events',
                  summary: 'Create meetings, adjust schedules, and manage attendees.',
                  entrypoints: ['lark calendar ...'],
                  auth_modes: ['user', 'bot'],
                  sources: [{ kind: 'official-cli-help', ref: 'lark calendar --help' }],
                },
              ],
            },
          ],
        },
        notes: [],
        runtime: {},
      },
      github: {
        connector: 'github',
        kind: 'connector',
        enabled: true,
        summary: 'GitHub connector via gh CLI',
        runtime_dir: '/tmp/contextgo/connector/github',
        config_path: '/tmp/contextgo/connector/github/config.json',
        platform_access: 'Official GitHub API through gh CLI.',
        runtime_boundary: 'Connector runtime lives in the sibling connector repository and reuses gh auth state.',
        native_surface: ['repositories', 'issues', 'pull requests'],
        implemented_workflows: [
          {
            id: 'github.collect.repositories',
            label: 'Collect repository source',
            surface: 'collect',
            status: 'ready',
            native_objects: ['repositories', 'issues'],
            entrypoints: ['cgo connectors github collect', 'gh repo view'],
            writes_store: true,
            notes: ['Writes collected GitHub assets into connector storage.'],
          },
        ],
        notes: [],
        runtime: {},
      },
    } as const;

    const details = detailsByConnector[connector as keyof typeof detailsByConnector];
    if (details) {
      return { success: true, data: details };
    }

    return { success: false, msg: `Unknown connector: ${connector}` };
  }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    shell: {
      openExternal: {
        invoke: (...args: unknown[]) => bridgeMocks.openExternalInvoke(...args),
      },
    },
    externalConnectorCatalog: {
      getDetails: { invoke: bridgeMocks.externalConnectorCatalogGetDetailsInvoke },
    },
  },
}));

vi.mock('@/renderer/hooks/context/LayoutContext', async () => {
  const actual = await vi.importActual<typeof import('@/renderer/hooks/context/LayoutContext')>(
    '@/renderer/hooks/context/LayoutContext'
  );
  return actual;
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'settings.connectors.count') {
        return `${options?.count ?? 0} connectors`;
      }

      if (key === 'settings.connectors.summaryTemplate') {
        return `${options?.name ?? ''} / ${options?.category ?? ''}`;
      }

      if (key === 'settings.connectors.externalCatalog.workflowSurface') {
        return `Integration Type: ${String(options?.surface ?? '')}`;
      }

      const labels: Record<string, string> = {
        'settings.connectors.title': 'Connector',
        'settings.connectors.description': 'Connector catalog',
        'settings.connectors.kind': 'Context Connector',
        'settings.connectors.support': 'Support Status',
        'settings.connectors.resources': 'Resources',
        'settings.connectors.auth': 'Authentication',
        'settings.connectors.officialSite': 'Official Site',
        'settings.connectors.openWebsite': 'Open Website',
        'settings.connectors.note': 'Connector note',
        'settings.connectors.catalogPlaceholderDesc': 'This connector is still catalog only.',
        'settings.connectors.catalogExternalDesc':
          'This connector is currently integrated through an external connector runtime. Its capabilities are shown here and can be used by ContextGo after integration.',
        'settings.connectors.externalCatalog.platformAccess': 'Platform Access',
        'settings.connectors.externalCatalog.runtimeBoundary': 'Runtime Boundary',
        'settings.connectors.externalCatalog.runtimeStatus': 'Runtime Status',
        'settings.connectors.externalCatalog.runtimeStatusSummary':
          'Live connector state reported by the active Space runtime.',
        'settings.connectors.externalCatalog.nativeSurface': 'Native Surface',
        'settings.connectors.externalCatalog.commandEntrypoints': 'Command Entrypoints',
        'settings.connectors.externalCatalog.capabilities': 'Capability Tree',
        'settings.connectors.externalCatalog.capabilitySummary':
          "Explore the content and actions available across the upstream product's native capability groups.",
        'settings.connectors.externalCatalog.capabilityGroups': 'Capability Groups',
        'settings.connectors.externalCatalog.discoveryCommands': 'Discovery Commands',
        'settings.connectors.externalCatalog.extractionMode': 'Extraction Mode',
        'settings.connectors.externalCatalog.actions': 'Actions',
        'settings.connectors.externalCatalog.authModesTitle': 'Auth Modes',
        'settings.connectors.externalCatalog.noneYet': 'None yet',
        'settings.connectors.externalCatalog.workflows': 'Workflows',
        'settings.connectors.externalCatalog.nativeObjects': 'Native Objects',
        'settings.connectors.externalCatalog.entrypoints': 'Entrypoints',
        'settings.connectors.externalCatalog.writesStore': 'Results persist automatically',
        'settings.connectors.externalCatalog.noStoreWrite': 'Results do not persist yet',
        'settings.connectors.externalCatalog.runtimeFields.serviceStatus': 'Service',
        'settings.connectors.externalCatalog.runtimeFields.loginStatus': 'Login',
        'settings.connectors.externalCatalog.runtimeFields.activeAccount': 'Active account',
        'settings.connectors.externalCatalog.runtimeFields.accounts': 'Accounts',
        'settings.connectors.externalCatalog.runtimeFields.baseUrl': 'Base URL',
        'settings.connectors.externalCatalog.runtimeFields.headlessMode': 'Headless',
        'settings.connectors.externalCatalog.runtimeFields.capabilityCount': 'Capabilities',
        'settings.connectors.externalCatalog.runtimeFields.cookiesPath': 'Cookies path',
        'settings.connectors.externalCatalog.runtimeFields.serviceRepo': 'Service repo',
        'settings.connectors.externalCatalog.runtimeFields.runtimeDir': 'Runtime dir',
        'settings.connectors.externalCatalog.runtimeValues.running': 'Running',
        'settings.connectors.externalCatalog.runtimeValues.stopped': 'Stopped',
        'settings.connectors.externalCatalog.runtimeValues.loggedIn': 'Logged in',
        'settings.connectors.externalCatalog.runtimeValues.loggedOut': 'Not logged in',
        'settings.connectors.externalCatalog.runtimeValues.true': 'Yes',
        'settings.connectors.externalCatalog.runtimeValues.false': 'No',
        'settings.connectors.externalCatalog.unavailableTitle': 'Connector details unavailable',
        'settings.connectors.externalCatalog.extractionModes.manual-curation': 'Manual Curation',
        'settings.connectors.externalCatalog.extractionModes.help-derived': 'Help Derived',
        'settings.connectors.externalCatalog.extractionModes.schema-derived': 'Schema Derived',
        'settings.connectors.externalCatalog.extractionModes.hybrid': 'Hybrid',
        'settings.connectors.externalCatalog.authModes.user': 'User Authorization',
        'settings.connectors.externalCatalog.authModes.bot': 'Bot / App Authorization',
        'settings.connectors.externalCatalog.authModes.service': 'Service Context',
        'settings.connectors.externalCatalog.workflowSurfaces.runtime': 'Runtime integration',
        'settings.connectors.externalCatalog.workflowSurfaces.source': 'Source integration',
        'settings.connectors.externalCatalog.workflowSurfaces.collect': 'Content collection',
        'settings.connectors.externalCatalog.workflowSurfaces.fetch': 'Data fetch',
        'settings.connectors.externalCatalog.workflowSurfaces.activity': 'Activity integration',
        'settings.connectors.externalCatalog.workflowStatus.ready': 'Ready',
        'settings.connectors.externalCatalog.workflowStatus.partial': 'Partial',
        'settings.connectors.externalCatalog.workflowStatus.planned': 'Planned',
        'settings.connectors.stagePriority': 'Priority',
        'settings.connectors.stagePlanned': 'Planned',
        'settings.connectors.supportStatus.supported': 'Supported',
        'settings.connectors.supportStatus.notSupportedYet': 'Not Supported Yet',
        'settings.connectors.implementation': 'Integration Mode',
        'settings.connectors.implementationOwners.official': 'Official integration',
        'settings.connectors.implementationOwners.contextgo': 'ContextGo native',
        'settings.connectors.implementationOwners.connectorRepo': 'External connector runtime',
        'settings.connectors.implementationOwners.hybrid': 'Hybrid integration',
        'settings.connectors.implementationOwners.default': 'Connector integration',
        'settings.connectors.supportSources': 'Support Sources',
        'settings.connectors.noSupportSources': 'No linked support sources yet.',
        'settings.connectors.sectionTitles.overview': 'Connection Overview',
        'settings.connectors.sectionTitles.nativeCapabilitySurface': 'Accessible Capabilities',
        'settings.connectors.sectionTitles.contextgoReadiness': 'Available Now',
        'settings.connectors.sectionTitles.sourcesAndBoundary': 'More Information',
        'settings.connectors.sectionDescriptions.overview':
          'See what this connector can connect to and how it is currently integrated.',
        'settings.connectors.sectionDescriptions.nativeCapabilitySurface':
          "Browse the content and actions currently available across the upstream product's capability groups.",
        'settings.connectors.sectionDescriptions.contextgoReadiness':
          'This section shows what is already usable inside ContextGo today.',
        'settings.connectors.sectionDescriptions.sourcesAndBoundary':
          'Review official docs, integration notes, and technical details.',
        'settings.connectors.summaryStats.capabilityGroups': 'Capability Groups',
        'settings.connectors.summaryStats.actions': 'Available Actions',
        'settings.connectors.summaryStats.readyWorkflows': 'Ready Workflows',
        'settings.connectors.summaryStats.primaryRuntime': 'Primary Runtime',
        'settings.connectors.groupNavigator': 'Review each capability group and the actions currently available in it.',
        'settings.connectors.workflowCatalog.feishu.officialCliRuntime.label': 'Official CLI integration',
        'settings.connectors.workflowCatalog.feishu.officialCliRuntime.notes.0':
          'Configuration, login, and command passthrough are already available through the official CLI.',
        'settings.connectors.workflowCatalog.feishu.officialCliRuntime.notes.1':
          'Structured collection for Feishu docs, messages, sheets, and related objects is still being built.',
        'settings.connectors.workflowCatalog.feishu.officialCliRuntime.nativeObjects.0': 'App configuration',
        'settings.connectors.workflowCatalog.feishu.officialCliRuntime.nativeObjects.1': 'User auth session',
        'settings.connectors.workflowCatalog.feishu.officialCliRuntime.nativeObjects.2': 'General CLI command access',
        'settings.connectors.supportKinds.officialDocs': 'Official Docs',
        'settings.connectors.supportKinds.officialRuntime': 'Official Runtime',
        'settings.connectors.supportKinds.officialSdk': 'Official SDK',
        'settings.connectors.supportKinds.contextgoNative': 'ContextGo',
        'settings.connectors.supportKinds.connectorRepo': 'Connector Repo',
        'settings.connectors.supportKinds.default': 'Support',
        'settings.connectors.categories.contextgo': 'ContextGo Family',
        'settings.connectors.categories.googleWorkspace': 'Google Workspace',
        'settings.connectors.categories.collaboration': 'Collaboration',
        'settings.connectors.categories.development': 'Development',
        'settings.connectors.categories.knowledge': 'Knowledge',
        'settings.connectors.categories.design': 'Design',
        'settings.connectors.categories.storage': 'Storage',
        'settings.connectors.categories.business': 'Business',
        'settings.connectors.categories.data': 'Data',
        'settings.connectors.resourceTypes.clipboard': 'Clipboard',
        'settings.connectors.resourceTypes.browserHistory': 'Browser History',
        'settings.connectors.resourceTypes.webPages': 'Web Pages',
        'settings.connectors.resourceTypes.files': 'Files',
        'settings.connectors.resourceTypes.docs': 'Docs',
        'settings.connectors.resourceTypes.sheets': 'Sheets',
        'settings.connectors.resourceTypes.chat': 'Chat',
        'settings.connectors.resourceTypes.calendar': 'Calendar',
        'settings.connectors.resourceTypes.repositories': 'Repositories',
        'settings.connectors.resourceTypes.issues': 'Issues',
        'settings.connectors.resourceTypes.tasks': 'Tasks',
        'settings.connectors.resourceTypes.analytics': 'Analytics',
        'settings.connectors.resourceTypes.databases': 'Databases',
        'settings.connectors.resourceTypes.wiki': 'Wiki',
        'settings.connectors.resourceTypes.email': 'Email',
        'settings.connectors.resourceTypes.designs': 'Designs',
        'settings.connectors.resourceTypes.crm': 'CRM',
        'settings.connectors.resourceTypes.commerce': 'Commerce',
        'settings.connectors.resourceTypes.incidents': 'Incidents',
        'settings.connectors.authTypes.oauth': 'OAuth',
        'settings.connectors.authTypes.bot': 'Bot Token',
        'settings.connectors.authTypes.apiKey': 'API Key',
        'settings.connectors.authTypes.pat': 'Personal Access Token',
        'settings.connectors.authTypes.serviceAccount': 'Service Account',
        'settings.connectors.authTypes.native': 'Local Permission',
        'settings.connectors.authTypes.extension': 'Extension Pairing',
        'settings.connectors.authTypes.none': 'No Auth',
        'common.website': 'Website',
      };

      return labels[key] || key;
    },
  }),
}));

import ConnectorsPage from '@/renderer/pages/connectors';
import { LayoutContext, type LayoutContextValue } from '@/renderer/hooks/context/LayoutContext';
import { CONNECTORS } from '@/renderer/pages/connectors/connectors';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid='location-probe'>{location.pathname}</div>;
};

describe('ConnectorsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects invalid routes to the first connector detail page', async () => {
    const fallbackConnector = CONNECTORS[0];

    render(
      <MemoryRouter initialEntries={['/connectors/unknown']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent(`/connectors/${fallbackConnector.id}`);
    });
  });

  it('switches detail content and opens the connector website', async () => {
    render(
      <MemoryRouter initialEntries={['/connectors/google-drive']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Google Drive' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open Website' }));
    expect(bridgeMocks.openExternalInvoke).toHaveBeenCalledWith('https://drive.google.com');
  });

  it('renders connector-owned catalog details for the clipboard connector', async () => {
    render(
      <MemoryRouter initialEntries={['/connectors/contextgo-clipboard']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ContextGo Clipboard' })).toBeInTheDocument();
    });

    expect(screen.getByText('Support Sources')).toBeInTheDocument();
    expect(screen.getByText('Connector Repository')).toBeInTheDocument();
    expect(screen.getAllByText('Supported').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Configure' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Clipboard observer runtime')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Native desktop clipboard observation through the connector CLI activity runtime.')
    ).toBeInTheDocument();
    expect(screen.getAllByText('cgo activity clipboard observe').length).toBeGreaterThan(0);
    expect(bridgeMocks.externalConnectorCatalogGetDetailsInvoke).toHaveBeenCalledWith({ connector: 'clipboard' });
  });

  it('shows externally managed connectors as catalog entries without an in-app configure tab', async () => {
    render(
      <MemoryRouter initialEntries={['/connectors/contextgo-browser-extension']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'ContextGo Browser Extension' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Configure' })).not.toBeInTheDocument();
    expect(
      screen.getAllByText(
        'This connector is currently integrated through an external connector runtime. Its capabilities are shown here and can be used by ContextGo after integration.'
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByText('Connector Repository')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Extension ingest runtime')).toBeInTheDocument();
    });

    expect(screen.getAllByText('cgo collect browser-extension').length).toBeGreaterThan(0);
    expect(bridgeMocks.externalConnectorCatalogGetDetailsInvoke).toHaveBeenCalledWith({
      connector: 'browser-extension',
    });
  });

  it('loads the external capability panel for Feishu from the connector catalog bridge', async () => {
    render(
      <MemoryRouter initialEntries={['/connectors/lark']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Feishu / Lark' })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Official Feishu Open Platform through lark-cli.')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Configure' })).not.toBeInTheDocument();
    expect(screen.getByText('Collect chat messages')).toBeInTheDocument();
    expect(screen.getAllByText('cgo connectors feishu collect').length).toBeGreaterThan(0);
    expect(screen.getByText('Connection Overview')).toBeInTheDocument();
    expect(screen.getByText('Accessible Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Available Now')).toBeInTheDocument();
    expect(screen.getByText('More Information')).toBeInTheDocument();
    expect(screen.getAllByText('Capability Groups').length).toBeGreaterThan(0);
    expect(screen.getByText('Available Actions')).toBeInTheDocument();
    expect(screen.getByText('Primary Runtime')).toBeInTheDocument();
    expect(screen.getAllByText('Docs').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Calendar').length).toBeGreaterThan(0);
    expect(screen.getByText('Read and search documents')).toBeInTheDocument();
    expect(screen.getByText('Create and update events')).toBeInTheDocument();
    expect(screen.getAllByText('User Authorization').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bot / App Authorization').length).toBeGreaterThan(0);
    expect(screen.getAllByText('lark docs --help').length).toBeGreaterThan(0);
    expect(screen.getAllByText('lark calendar --help').length).toBeGreaterThan(0);
    expect(bridgeMocks.externalConnectorCatalogGetDetailsInvoke).toHaveBeenCalledWith({ connector: 'feishu' });
  });

  it('renders Google Drive as a connector-catalog driven capability page', async () => {
    render(
      <MemoryRouter initialEntries={['/connectors/google-drive']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Drive CLI passthrough boundary')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Configure' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Official Google-native runtime surface managed by the connector project.')
    ).toBeInTheDocument();
    expect(screen.getAllByText('None yet').length).toBeGreaterThan(0);
    expect(bridgeMocks.externalConnectorCatalogGetDetailsInvoke).toHaveBeenCalledWith({ connector: 'google-drive' });
  });

  it('renders Xiaohongshu runtime status and capability actions from the Space connector catalog', async () => {
    render(
      <MemoryRouter initialEntries={['/connectors/xiaohongshu']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Xiaohongshu' })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Managed service and account control plane')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Configure' })).not.toBeInTheDocument();
    expect(screen.getByText('Runtime Status')).toBeInTheDocument();
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Not logged in')).toBeInTheDocument();
    expect(screen.getByText('Active account')).toBeInTheDocument();
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('http://127.0.0.1:18060')).toBeInTheDocument();
    expect(screen.getByText('/Users/bytedance/project/xiaohongshu-mcp')).toBeInTheDocument();
    expect(
      screen.getAllByText('/Users/bytedance/.contextgo/spaces/main/connectors/xiaohongshu').length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Account and runtime').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Content discovery').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Publishing and interactions').length).toBeGreaterThan(0);
    expect(screen.getByText('Search notes')).toBeInTheDocument();
    expect(screen.getByText('Publish image note')).toBeInTheDocument();
    expect(screen.getAllByText('cgo xiaohongshu login-browser').length).toBeGreaterThan(0);
    expect(bridgeMocks.externalConnectorCatalogGetDetailsInvoke).toHaveBeenCalledWith({ connector: 'xiaohongshu' });
  });

  it('keeps the connector list stable when category sections collapse', async () => {
    render(
      <MemoryRouter initialEntries={['/connectors/contextgo-clipboard']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    );

    const categoryToggle = screen.getByRole('button', { name: /ContextGo Family/i });
    const clipboardButton = screen.getByRole('button', { name: /ContextGo Clipboard/i });

    expect(clipboardButton).toBeVisible();
    fireEvent.click(categoryToggle);
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/connectors/contextgo-clipboard');
    expect(clipboardButton).not.toBeVisible();
  });

  it('shows a compact mobile catalog instead of the desktop sidebar split view', async () => {
    const mobileLayoutValue: LayoutContextValue = {
      isMobile: true,
      siderCollapsed: false,
      setSiderCollapsed: vi.fn(),
    };

    render(
      <MemoryRouter initialEntries={['/connectors/google-drive']}>
        <LayoutContext.Provider value={mobileLayoutValue}>
          <Routes>
            <Route path='/connectors' element={<ConnectorsPage />} />
            <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
          </Routes>
        </LayoutContext.Provider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('connector-mobile-catalog')).toBeInTheDocument();
    });

    expect(screen.getByText('Connector catalog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ContextGo Family/i })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Google Drive' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Configure' })).not.toBeInTheDocument();
  });

  it('loads the external capability panel for GitHub from the connector catalog bridge', async () => {
    render(
      <MemoryRouter initialEntries={['/connectors/github']}>
        <Routes>
          <Route path='/connectors' element={<ConnectorsPage />} />
          <Route path='/connectors/:connectorId' element={<ConnectorsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'GitHub' })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Official GitHub API through gh CLI.')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Configure' })).not.toBeInTheDocument();
    expect(screen.getByText('Collect repository source')).toBeInTheDocument();
    expect(screen.getAllByText('gh repo view').length).toBeGreaterThan(0);
    expect(bridgeMocks.externalConnectorCatalogGetDetailsInvoke).toHaveBeenCalledWith({ connector: 'github' });
  });
});

/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SpaceConnectorDescriptor, SpaceConnectorId } from './types.ts';

const FIRST_WAVE_CONNECTORS: readonly SpaceConnectorDescriptor[] = [
  {
    id: 'contextgo-browser',
    familyId: 'contextgo-native',
    name: 'ContextGo Browser',
    summary: 'Space-owned browser context assets bound to conversation entry and desktop preview.',
    kind: 'managed-runtime',
    runtimeOwner: 'contextgo-desktop',
    launchSurface: 'conversation-entry',
    profileStrategy: 'space-owned-browser-context',
    storeTarget: 'space-assets',
    upstreamSource: 'contextgo-native',
    status: 'ready',
    fusionWave: 'wave-1',
    desktopHostOnly: true,
    spaceScoped: true,
    contextEngineReady: true,
    ownershipBoundary: 'Product semantics, consent, and browser-context ownership stay inside ContextGo.',
    nextStep:
      'Promote browser context picker and manager from conversation-bound flow to a Space-level connector surface.',
    dependencies: [
      {
        kind: 'binary',
        name: 'agent-browser',
        required: true,
        notes: 'Default managed browser runtime for ContextGo browser contexts.',
      },
    ],
  },
  {
    id: 'contextgo-clipboard',
    familyId: 'activity',
    name: 'ContextGo Clipboard',
    summary: 'Clipboard observation is owned by the connector CLI and exposed back to ContextGo as connector-managed activity outputs.',
    kind: 'activity',
    runtimeOwner: 'connector-project',
    launchSurface: 'managed-external-runtime',
    profileStrategy: 'local-observer-config',
    storeTarget: 'connector-store',
    upstreamSource: 'connector-repo',
    status: 'scaffolded',
    fusionWave: 'wave-1',
    desktopHostOnly: true,
    spaceScoped: true,
    contextEngineReady: true,
    ownershipBoundary:
      'The standalone connector project owns clipboard runtime, retention, and collect outputs; ContextGo only consumes those outputs into Context Engine and space memory flows.',
    nextStep:
      'Consume connector-owned clipboard runtime and collect outputs directly instead of hosting a product-inline observer panel.',
    dependencies: [
      {
        kind: 'binary',
        name: 'cgo',
        required: true,
        notes: 'Standalone connector CLI that owns clipboard runtime state, observation, and collect/store workflows.',
      },
    ],
  },
  {
    id: 'feishu-openapi',
    familyId: 'feishu',
    name: 'Feishu OpenAPI',
    summary:
      'Official Feishu/Lark OpenAPI runtime for docs, chats, calendar, and files through a managed external connector.',
    kind: 'official-cli',
    runtimeOwner: 'connector-project',
    launchSurface: 'managed-external-runtime',
    profileStrategy: 'oauth-user',
    storeTarget: 'connector-store',
    upstreamSource: 'connector-repo',
    status: 'scaffolded',
    fusionWave: 'wave-1',
    desktopHostOnly: true,
    spaceScoped: true,
    contextEngineReady: true,
    ownershipBoundary:
      'Connector runtime setup belongs to the standalone connector project, while datasource ownership, source assets, and collected outputs remain ContextGo-owned.',
    nextStep:
      'Consume `cgo feishu` runtime state and collect outputs instead of maintaining an in-repo Feishu runtime wrapper.',
    dependencies: [
      {
        kind: 'binary',
        name: 'cgo',
        required: true,
        notes: 'Standalone ContextGo connector CLI that owns the Feishu runtime wrapper and control plane.',
      },
      {
        kind: 'binary',
        name: 'lark-cli',
        required: true,
        notes: 'Official Feishu/Lark CLI used by the connector project for config, auth, and API passthrough.',
      },
    ],
  },
  {
    id: 'google-drive',
    familyId: 'google-workspace',
    name: 'Google Drive',
    summary: 'Google Drive is modeled as a connector-project owned runtime boundary instead of a ContextGo inline sidecar.',
    kind: 'official-cli',
    runtimeOwner: 'connector-project',
    launchSurface: 'managed-external-runtime',
    profileStrategy: 'oauth-user',
    storeTarget: 'connector-store',
    upstreamSource: 'connector-repo',
    status: 'scaffolded',
    fusionWave: 'wave-1',
    desktopHostOnly: true,
    spaceScoped: true,
    contextEngineReady: true,
    ownershipBoundary:
      'Connector runtime ownership belongs to the standalone connector project, while ContextGo consumes capability metadata and downstream collect outputs.',
    nextStep: 'Route Google Drive capability and collect state from connector CLI instead of maintaining an in-app sidecar model.',
    dependencies: [
      {
        kind: 'binary',
        name: 'cgo',
        required: true,
        notes: 'Standalone connector CLI that will own Google Drive runtime selection and capability reporting.',
      },
      {
        kind: 'oauth-app',
        name: 'Google account authorization',
        required: true,
      },
    ],
  },
  {
    id: 'google-docs',
    familyId: 'google-workspace',
    name: 'Google Docs',
    summary: 'Google Docs is modeled as a connector-project owned runtime boundary instead of a ContextGo inline sidecar.',
    kind: 'official-cli',
    runtimeOwner: 'connector-project',
    launchSurface: 'managed-external-runtime',
    profileStrategy: 'oauth-user',
    storeTarget: 'connector-store',
    upstreamSource: 'connector-repo',
    status: 'scaffolded',
    fusionWave: 'wave-1',
    desktopHostOnly: true,
    spaceScoped: true,
    contextEngineReady: true,
    ownershipBoundary:
      'Connector runtime ownership belongs to the standalone connector project, while ContextGo consumes capability metadata and downstream collect outputs.',
    nextStep: 'Expose Google Docs capability and collect state from connector CLI instead of a product-inline panel.',
    dependencies: [
      {
        kind: 'binary',
        name: 'cgo',
        required: true,
        notes: 'Standalone connector CLI that will own Google Docs runtime selection and capability reporting.',
      },
      {
        kind: 'oauth-app',
        name: 'Google account authorization',
        required: true,
      },
    ],
  },
  {
    id: 'google-sheets',
    familyId: 'google-workspace',
    name: 'Google Sheets',
    summary: 'Google Sheets is modeled as a connector-project owned runtime boundary instead of a ContextGo inline sidecar.',
    kind: 'official-cli',
    runtimeOwner: 'connector-project',
    launchSurface: 'managed-external-runtime',
    profileStrategy: 'oauth-user',
    storeTarget: 'connector-store',
    upstreamSource: 'connector-repo',
    status: 'scaffolded',
    fusionWave: 'wave-1',
    desktopHostOnly: true,
    spaceScoped: true,
    contextEngineReady: true,
    ownershipBoundary:
      'Connector runtime ownership belongs to the standalone connector project, while ContextGo consumes capability metadata and downstream collect outputs.',
    nextStep: 'Expose Google Sheets capability and collect state from connector CLI instead of a product-inline panel.',
    dependencies: [
      {
        kind: 'binary',
        name: 'cgo',
        required: true,
        notes: 'Standalone connector CLI that will own Google Sheets runtime selection and capability reporting.',
      },
      {
        kind: 'oauth-app',
        name: 'Google account authorization',
        required: true,
      },
    ],
  },
  {
    id: 'gmail',
    familyId: 'google-workspace',
    name: 'Gmail',
    summary: 'Gmail is modeled as a connector-project owned runtime boundary instead of a ContextGo inline sidecar.',
    kind: 'official-cli',
    runtimeOwner: 'connector-project',
    launchSurface: 'managed-external-runtime',
    profileStrategy: 'oauth-user',
    storeTarget: 'connector-store',
    upstreamSource: 'connector-repo',
    status: 'scaffolded',
    fusionWave: 'wave-1',
    desktopHostOnly: true,
    spaceScoped: true,
    contextEngineReady: true,
    ownershipBoundary:
      'Connector runtime ownership belongs to the standalone connector project, while ContextGo consumes capability metadata and downstream collect outputs.',
    nextStep: 'Expose Gmail capability and collect state from connector CLI instead of a product-inline panel.',
    dependencies: [
      {
        kind: 'binary',
        name: 'cgo',
        required: true,
        notes: 'Standalone connector CLI that will own Gmail runtime selection and capability reporting.',
      },
      {
        kind: 'oauth-app',
        name: 'Google account authorization',
        required: true,
      },
    ],
  },
  {
    id: 'google-calendar',
    familyId: 'google-workspace',
    name: 'Google Calendar',
    summary: 'Google Calendar is modeled as a connector-project owned runtime boundary instead of a ContextGo inline sidecar.',
    kind: 'official-cli',
    runtimeOwner: 'connector-project',
    launchSurface: 'managed-external-runtime',
    profileStrategy: 'oauth-user',
    storeTarget: 'connector-store',
    upstreamSource: 'connector-repo',
    status: 'scaffolded',
    fusionWave: 'wave-1',
    desktopHostOnly: true,
    spaceScoped: true,
    contextEngineReady: true,
    ownershipBoundary:
      'Connector runtime ownership belongs to the standalone connector project, while ContextGo consumes capability metadata and downstream collect outputs.',
    nextStep: 'Expose Google Calendar capability and collect state from connector CLI instead of a product-inline panel.',
    dependencies: [
      {
        kind: 'binary',
        name: 'cgo',
        required: true,
        notes: 'Standalone connector CLI that will own Google Calendar runtime selection and capability reporting.',
      },
      {
        kind: 'oauth-app',
        name: 'Google account authorization',
        required: true,
      },
    ],
  },
];

const CONNECTOR_MAP = new Map<SpaceConnectorId, SpaceConnectorDescriptor>(
  FIRST_WAVE_CONNECTORS.map((connector) => [connector.id, connector])
);

export function listBuiltinSpaceConnectors(): readonly SpaceConnectorDescriptor[] {
  return FIRST_WAVE_CONNECTORS;
}

export function getBuiltinSpaceConnector(id: SpaceConnectorId): SpaceConnectorDescriptor | undefined {
  return CONNECTOR_MAP.get(id);
}

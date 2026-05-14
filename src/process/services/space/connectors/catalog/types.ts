/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

export type SpaceConnectorId =
  | 'contextgo-browser'
  | 'contextgo-clipboard'
  | 'feishu-openapi'
  | 'google-drive'
  | 'google-docs'
  | 'google-sheets'
  | 'gmail'
  | 'google-calendar';

export type SpaceConnectorFamilyId = 'contextgo-native' | 'activity' | 'feishu' | 'google-workspace';

export type SpaceConnectorKind = 'managed-runtime' | 'activity' | 'official-cli' | 'official-sdk';

export type SpaceConnectorRuntimeOwner = 'contextgo-desktop' | 'contextgo-managed-sidecar' | 'connector-project';

export type SpaceConnectorLaunchSurface = 'conversation-entry' | 'space-background' | 'managed-external-runtime';

export type SpaceConnectorProfileStrategy =
  | 'space-owned-browser-context'
  | 'local-observer-config'
  | 'oauth-user'
  | 'service-account';

export type SpaceConnectorStoreTarget = 'space-assets' | 'activity-events' | 'connector-store';

export type SpaceConnectorStatus = 'ready' | 'scaffolded' | 'planned';

export type SpaceConnectorFusionWave = 'wave-1';

export type SpaceConnectorUpstreamSource =
  | 'contextgo-native'
  | 'connector-repo'
  | 'official-open-source-cli'
  | 'official-sdk';

export type SpaceConnectorDependencyKind = 'binary' | 'python-module' | 'go-module' | 'oauth-app' | 'browser-extension';

export type SpaceConnectorDependency = {
  kind: SpaceConnectorDependencyKind;
  name: string;
  required: boolean;
  notes?: string;
};

/**
 * Space connector descriptors model external product access capabilities only.
 *
 * They do NOT represent IM publication transports. Slack / Telegram / Discord /
 * Weixin / Lark bot routing and publication live in `src/process/channels/`.
 */
export type SpaceConnectorDescriptor = {
  id: SpaceConnectorId;
  familyId: SpaceConnectorFamilyId;
  name: string;
  summary: string;
  kind: SpaceConnectorKind;
  runtimeOwner: SpaceConnectorRuntimeOwner;
  launchSurface: SpaceConnectorLaunchSurface;
  profileStrategy: SpaceConnectorProfileStrategy;
  storeTarget: SpaceConnectorStoreTarget;
  upstreamSource: SpaceConnectorUpstreamSource;
  status: SpaceConnectorStatus;
  fusionWave: SpaceConnectorFusionWave;
  desktopHostOnly: boolean;
  spaceScoped: boolean;
  contextEngineReady: boolean;
  ownershipBoundary: string;
  nextStep: string;
  dependencies: readonly SpaceConnectorDependency[];
};

export type SpaceConnectorExecutionMode =
  | 'native-contextgo'
  | 'python-sidecar'
  | 'external-binary-sidecar'
  | 'go-sidecar'
  | 'connector-cli';

export type SpaceConnectorInstallSource =
  | 'bundled'
  | 'sibling-repo'
  | 'official-release'
  | 'source-build'
  | 'connector-project';

export type SpaceConnectorHostProcess = 'desktop-main' | 'desktop-sidecar';

export type SpaceConnectorExecutionPlan = {
  connectorId: SpaceConnectorId;
  executionMode: SpaceConnectorExecutionMode;
  installSource: SpaceConnectorInstallSource;
  hostProcess: SpaceConnectorHostProcess;
  needsUserProvisioning: boolean;
  commandHint?: string;
  notes: string;
};

export type SpaceConnectorFamilySummary = {
  familyId: SpaceConnectorFamilyId;
  connectors: readonly SpaceConnectorDescriptor[];
  status: SpaceConnectorStatus;
};

/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import {
  SpaceConnectorCatalogService,
  SpaceConnectorRuntimeService,
} from '../../src/process/services/space/connectors';

describe('Space connector fusion services', () => {
  it('lists the first-wave connector fusion set', () => {
    const service = new SpaceConnectorCatalogService();

    expect(service.listWaveConnectors().map((connector) => connector.id)).toEqual([
      'contextgo-browser',
      'contextgo-clipboard',
      'feishu-openapi',
      'google-drive',
      'google-docs',
      'google-sheets',
      'gmail',
      'google-calendar',
    ]);
  });

  it('keeps browser as a ContextGo-native managed runtime', () => {
    const service = new SpaceConnectorCatalogService();
    const connector = service.getConnector('contextgo-browser');

    expect(connector).toMatchObject({
      familyId: 'contextgo-native',
      kind: 'managed-runtime',
      runtimeOwner: 'contextgo-desktop',
      storeTarget: 'space-assets',
      status: 'ready',
    });
    expect(connector?.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'agent-browser',
          kind: 'binary',
        }),
      ])
    );
  });

  it('models clipboard as a connector-project owned activity runtime', () => {
    const service = new SpaceConnectorCatalogService();
    const connector = service.getConnector('contextgo-clipboard');

    expect(connector).toMatchObject({
      familyId: 'activity',
      kind: 'activity',
      upstreamSource: 'connector-repo',
      runtimeOwner: 'connector-project',
      storeTarget: 'connector-store',
      launchSurface: 'managed-external-runtime',
    });
  });

  it('models Feishu as a connector-project managed runtime instead of a ContextGo-owned sidecar', () => {
    const service = new SpaceConnectorCatalogService();
    const connector = service.getConnector('feishu-openapi');

    expect(connector).toMatchObject({
      familyId: 'feishu',
      kind: 'official-cli',
      runtimeOwner: 'connector-project',
      upstreamSource: 'connector-repo',
      launchSurface: 'managed-external-runtime',
      profileStrategy: 'oauth-user',
    });
    expect(connector?.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'cgo',
          required: true,
        }),
        expect.objectContaining({
          name: 'lark-cli',
          required: true,
        }),
      ])
    );
  });

  it('groups Google Workspace connectors into one family summary', () => {
    const service = new SpaceConnectorCatalogService();
    const googleFamily = service.listFamilySummaries().find((family) => family.familyId === 'google-workspace');

    expect(googleFamily?.status).toBe('scaffolded');
    expect(googleFamily?.connectors.map((connector) => connector.id)).toEqual([
      'google-drive',
      'google-docs',
      'google-sheets',
      'gmail',
      'google-calendar',
    ]);
  });

  it('derives runtime execution plans for the first wave', () => {
    const service = new SpaceConnectorRuntimeService();

    expect(service.buildExecutionPlan('contextgo-browser')).toMatchObject({
      executionMode: 'native-contextgo',
      installSource: 'bundled',
      hostProcess: 'desktop-main',
      needsUserProvisioning: false,
    });

    expect(service.buildExecutionPlan('contextgo-clipboard')).toMatchObject({
      executionMode: 'connector-cli',
      installSource: 'connector-project',
      hostProcess: 'desktop-sidecar',
      needsUserProvisioning: true,
    });

    expect(service.buildExecutionPlan('feishu-openapi')).toMatchObject({
      executionMode: 'connector-cli',
      installSource: 'connector-project',
      needsUserProvisioning: true,
    });

    expect(service.buildExecutionPlan('google-drive')).toMatchObject({
      executionMode: 'connector-cli',
      installSource: 'connector-project',
      needsUserProvisioning: true,
    });
  });
});

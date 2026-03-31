/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import { SpaceConnectorCatalogService, SpaceConnectorRuntimeService } from '../../src/process/services/space/connectors';

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

  it('marks clipboard as an activity connector incubated from the connector repository', () => {
    const service = new SpaceConnectorCatalogService();
    const connector = service.getConnector('contextgo-clipboard');

    expect(connector).toMatchObject({
      familyId: 'activity',
      kind: 'activity',
      upstreamSource: 'connector-repo',
      runtimeOwner: 'contextgo-managed-sidecar',
      storeTarget: 'activity-events',
    });
  });

  it('models Feishu as a managed official CLI runtime instead of an IM channel plugin', () => {
    const service = new SpaceConnectorCatalogService();
    const connector = service.getConnector('feishu-openapi');

    expect(connector).toMatchObject({
      familyId: 'feishu',
      kind: 'official-cli',
      launchSurface: 'managed-external-runtime',
      profileStrategy: 'oauth-user',
    });
    expect(connector?.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'lark-openapi-mcp',
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
      executionMode: 'python-sidecar',
      installSource: 'sibling-repo',
      hostProcess: 'desktop-sidecar',
    });

    expect(service.buildExecutionPlan('feishu-openapi')).toMatchObject({
      executionMode: 'external-binary-sidecar',
      installSource: 'official-release',
      needsUserProvisioning: true,
    });

    expect(service.buildExecutionPlan('google-drive')).toMatchObject({
      executionMode: 'go-sidecar',
      installSource: 'source-build',
      needsUserProvisioning: true,
    });
  });
});

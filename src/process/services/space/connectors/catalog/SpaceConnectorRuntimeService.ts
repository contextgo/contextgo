/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpaceConnectorCatalogService } from './SpaceConnectorCatalogService.ts';
import type { SpaceConnectorExecutionPlan, SpaceConnectorId } from './types.ts';

export class SpaceConnectorRuntimeService {
  constructor(private readonly catalog = new SpaceConnectorCatalogService()) {}

  buildExecutionPlan(connectorId: SpaceConnectorId): SpaceConnectorExecutionPlan {
    const connector = this.catalog.getConnector(connectorId);
    if (!connector) {
      throw new Error(`Unknown space connector: ${connectorId}`);
    }

    switch (connectorId) {
      case 'contextgo-browser':
        return {
          connectorId,
          executionMode: 'native-contextgo',
          installSource: 'bundled',
          hostProcess: 'desktop-main',
          needsUserProvisioning: false,
          commandHint: 'Use the existing BrowserContext bridge and desktop preview runtime.',
          notes: 'This connector already lives inside ContextGo and should be promoted at the Space layer.',
        };
      case 'contextgo-clipboard':
        return {
          connectorId,
          executionMode: 'python-sidecar',
          installSource: 'sibling-repo',
          hostProcess: 'desktop-sidecar',
          needsUserProvisioning: false,
          commandHint: 'Wrap connector.infohub.activity_clipboard_runtime behind ClipboardConnectorService and a managed desktop observer process.',
          notes: 'Keep retention, consent, and pause controls in ContextGo while incubating the runtime from the sibling repository.',
        };
      case 'feishu-openapi':
        return {
          connectorId,
          executionMode: 'external-binary-sidecar',
          installSource: 'official-release',
          hostProcess: 'desktop-sidecar',
          needsUserProvisioning: true,
          commandHint: 'Install and manage lark-openapi-mcp as a ContextGo-owned sidecar runtime.',
          notes: 'Datasource auth stays in ContextGo, but API execution can run through the official external runtime.',
        };
      case 'google-drive':
      case 'google-docs':
      case 'google-sheets':
      case 'gmail':
      case 'google-calendar':
        return {
          connectorId,
          executionMode: 'go-sidecar',
          installSource: 'source-build',
          hostProcess: 'desktop-sidecar',
          needsUserProvisioning: true,
          commandHint: 'Build a small ContextGo-managed Go runtime around the official google-api-go-client packages.',
          notes: 'Share OAuth state across the Google Workspace family, but keep datasource scoping and collect results in ContextGo.',
        };
    }
  }

  listExecutionPlans(): readonly SpaceConnectorExecutionPlan[] {
    return this.catalog.listWaveConnectors().map((connector) => this.buildExecutionPlan(connector.id));
  }

  listProvisioningRequired(): readonly SpaceConnectorExecutionPlan[] {
    return this.listExecutionPlans().filter((plan) => plan.needsUserProvisioning);
  }
}

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
          executionMode: 'connector-cli',
          installSource: 'connector-project',
          hostProcess: 'desktop-sidecar',
          needsUserProvisioning: true,
          commandHint:
            'Use `cgo activity clipboard ...` and `cgo collect clipboard` as the connector-owned clipboard runtime boundary.',
          notes:
            'ContextGo should consume connector-owned clipboard activity outputs instead of hosting a product-inline observer runtime.',
        };
      case 'feishu-openapi':
        return {
          connectorId,
          executionMode: 'connector-cli',
          installSource: 'connector-project',
          hostProcess: 'desktop-sidecar',
          needsUserProvisioning: true,
          commandHint:
            'Use `cgo feishu runtime`, `cgo feishu auth`, and `cgo feishu exec` to manage the official lark-cli wrapper outside ContextGo.',
          notes:
            'ContextGo should consume connector-project outputs for Feishu instead of shipping its own runtime wrapper.',
        };
      case 'google-drive':
      case 'google-docs':
      case 'google-sheets':
      case 'gmail':
      case 'google-calendar':
        return {
          connectorId,
          executionMode: 'connector-cli',
          installSource: 'connector-project',
          hostProcess: 'desktop-sidecar',
          needsUserProvisioning: true,
          commandHint:
            'Use `cgo connectors show <connector> --json` plus connector-owned runtime/auth commands as the Google-family execution boundary.',
          notes:
            'Google-family runtime ownership should live entirely in the connector project, and ContextGo should only consume capability metadata and collected outputs.',
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

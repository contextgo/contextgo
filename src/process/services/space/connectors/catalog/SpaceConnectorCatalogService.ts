/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getBuiltinSpaceConnector, listBuiltinSpaceConnectors } from './builtinConnectorCatalog.ts';
import type {
  SpaceConnectorDescriptor,
  SpaceConnectorFamilyId,
  SpaceConnectorFamilySummary,
  SpaceConnectorId,
  SpaceConnectorStatus,
} from './types.ts';

const STATUS_ORDER: Record<SpaceConnectorStatus, number> = {
  ready: 0,
  scaffolded: 1,
  planned: 2,
};

const compareStatus = (left: SpaceConnectorStatus, right: SpaceConnectorStatus): number => {
  return STATUS_ORDER[left] - STATUS_ORDER[right];
};

const summarizeFamilyStatus = (connectors: readonly SpaceConnectorDescriptor[]): SpaceConnectorStatus => {
  return connectors.reduce<SpaceConnectorStatus>((current, connector) => {
    return compareStatus(connector.status, current) < 0 ? connector.status : current;
  }, 'planned');
};

export class SpaceConnectorCatalogService {
  listConnectors(): readonly SpaceConnectorDescriptor[] {
    return listBuiltinSpaceConnectors();
  }

  listWaveConnectors(): readonly SpaceConnectorDescriptor[] {
    return this.listConnectors().filter((connector) => connector.fusionWave === 'wave-1');
  }

  getConnector(id: SpaceConnectorId): SpaceConnectorDescriptor | undefined {
    return getBuiltinSpaceConnector(id);
  }

  listFamilySummaries(): readonly SpaceConnectorFamilySummary[] {
    const familyMap = new Map<SpaceConnectorFamilyId, SpaceConnectorDescriptor[]>();

    for (const connector of this.listWaveConnectors()) {
      const existing = familyMap.get(connector.familyId);
      if (existing) {
        existing.push(connector);
      } else {
        familyMap.set(connector.familyId, [connector]);
      }
    }

    return [...familyMap.entries()]
      .map(([familyId, connectors]) => ({
        familyId,
        connectors,
        status: summarizeFamilyStatus(connectors),
      }))
      .toSorted((left, right) => left.familyId.localeCompare(right.familyId));
  }

  listRuntimeOwnedByContextGo(): readonly SpaceConnectorDescriptor[] {
    return this.listWaveConnectors().filter((connector) => connector.runtimeOwner.startsWith('contextgo-'));
  }
}

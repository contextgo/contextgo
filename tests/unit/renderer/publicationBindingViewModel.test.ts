/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { IChannelBinding } from '@process/channels/types';
import {
  buildBindingPayload,
  splitBindingsByLifetime,
} from '@renderer/components/settings/SettingsModal/contents/channels/publication/viewModel';

describe('publication binding view model', () => {
  const baseBinding: IChannelBinding = {
    id: 'binding-1',
    connectorId: 'connector-1',
    scopeType: 'remote_chat',
    scopeKey: 'group:alpha',
    agentProfileId: 'agent-profile-1',
    priority: 10,
    enabled: true,
    temporary: false,
    createdAt: 1,
    updatedAt: 1,
  };

  it('splits durable bindings from temporary overrides', () => {
    const temporaryBinding: IChannelBinding = {
      ...baseBinding,
      id: 'binding-temp',
      scopeType: 'temporary_override',
      temporary: true,
    };

    const result = splitBindingsByLifetime([baseBinding, temporaryBinding]);

    expect(result.durableBindings).toEqual([baseBinding]);
    expect(result.temporaryBindings).toEqual([temporaryBinding]);
  });

  it('reuses an existing binding id when saving the same scope again', () => {
    const nextBinding = buildBindingPayload([baseBinding], {
      channelAccountId: 'connector-1',
      scopeType: 'remote_chat',
      scopeKey: 'group:alpha',
      agentProfileId: 'agent-profile-2',
      temporary: false,
      priority: 20,
    });

    expect(nextBinding.id).toBe('binding-1');
    expect(nextBinding.channelAccountId).toBe('connector-1');
    expect(nextBinding.agentProfileId).toBe('agent-profile-2');
    expect(nextBinding.priority).toBe(20);
    expect(nextBinding.metadata).toEqual(
      expect.objectContaining({
        source: 'settings-publication-panel',
        operation: 'durable-publication',
      })
    );
  });

  it('stores structured publish-object metadata when the publish object is known', () => {
    const nextBinding = buildBindingPayload([], {
      channelAccountId: 'connector-1',
      scopeType: 'remote_chat',
      scopeKey: 'oc_group_1:thread:om_topic_root_1',
      agentProfileId: 'agent-profile-1',
      temporary: false,
      priority: 10,
      publishObject: {
        nativeObjectType: 'topic',
        nativeObjectId: 'om_topic_root_1',
        parentNativeObjectId: 'oc_group_1',
        displayName: 'Ops Topic',
        discoverySource: 'inbound-learned',
      },
    });

    expect(nextBinding.metadata).toEqual(
      expect.objectContaining({
        publishObject: {
          nativeObjectType: 'topic',
          nativeObjectId: 'om_topic_root_1',
          parentNativeObjectId: 'oc_group_1',
          displayName: 'Ops Topic',
          discoverySource: 'inbound-learned',
        },
      })
    );
  });
});

/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { IChannelBinding } from '../../../../src/process/channels/types';
import { ContextGoUIDatabase } from '../../../../src/process/services/database';
import type { IStatement, ISqliteDriver } from '../../../../src/process/services/database/drivers/ISqliteDriver';
import { withChannelBindingTarget } from '../../../../src/process/channels/types';

type StoredBindingRow = {
  id: string;
  channel_account_id: string;
  scope_type: string;
  scope_key: string | null;
  agent_profile_id: string;
  priority: number;
  enabled: number;
  temporary: number;
  fallback_agent_profile_id: string | null;
  metadata: string;
  created_at: number;
  updated_at: number;
};

function createNoopStatement(): IStatement {
  return {
    get: () => undefined,
    all: () => [],
    run: () => ({ changes: 0, lastInsertRowid: 0 }),
  };
}

function createDatabaseForBindingTests(): ContextGoUIDatabase {
  const bindingRows = new Map<string, StoredBindingRow>();

  const driver: ISqliteDriver = {
    prepare(sql: string): IStatement {
      if (sql.includes('INSERT INTO channel_bindings')) {
        return {
          get: () => undefined,
          all: () => [],
          run: (...args: unknown[]) => {
            const [
              id,
              connectorId,
              scopeType,
              scopeKey,
              agentProfileId,
              priority,
              enabled,
              temporary,
              fallbackAgentProfileId,
              metadata,
              createdAt,
              updatedAt,
            ] = args;
            bindingRows.set(String(id), {
              id: String(id),
              channel_account_id: String(connectorId),
              scope_type: String(scopeType),
              scope_key: scopeKey === null ? null : String(scopeKey),
              agent_profile_id: String(agentProfileId),
              priority: Number(priority),
              enabled: Number(enabled),
              temporary: Number(temporary),
              fallback_agent_profile_id: fallbackAgentProfileId === null ? null : String(fallbackAgentProfileId),
              metadata: String(metadata),
              created_at: Number(createdAt),
              updated_at: Number(updatedAt),
            });
            return { changes: 1, lastInsertRowid: 1 };
          },
        };
      }

      if (sql.includes('SELECT * FROM channel_bindings WHERE id = ?')) {
        return {
          get: (bindingId?: unknown) => (bindingId ? bindingRows.get(String(bindingId)) : undefined),
          all: () => [],
          run: () => ({ changes: 0, lastInsertRowid: 0 }),
        };
      }

      if (
        sql.includes(
          'SELECT * FROM channel_bindings WHERE channel_account_id = ? ORDER BY priority DESC, created_at ASC'
        )
      ) {
        return {
          get: () => undefined,
          all: (connectorId?: unknown) =>
            Array.from(bindingRows.values())
              .filter((row) => row.channel_account_id === String(connectorId))
              .sort((left, right) => right.priority - left.priority || left.created_at - right.created_at),
          run: () => ({ changes: 0, lastInsertRowid: 0 }),
        };
      }

      return createNoopStatement();
    },
    exec: () => {},
    pragma: () => undefined,
    transaction: <T>(fn: (...args: unknown[]) => T) => fn,
    close: () => {},
  };

  const database = Object.create(ContextGoUIDatabase.prototype) as ContextGoUIDatabase;
  (database as unknown as { db: ISqliteDriver }).db = driver;
  return database;
}

describe('ContextGoUIDatabase channel binding validation', () => {
  let database: ContextGoUIDatabase;

  beforeEach(() => {
    database = createDatabaseForBindingTests();
  });

  it('rejects channel_account_default bindings with a scope key', () => {
    const result = database.upsertChannelBinding({
      id: 'binding-invalid-default',
      channelAccountId: 'channel-account-test',
      scopeType: 'channel_account_default',
      scopeKey: 'user-1',
      agentProfileId: 'agent-profile-test',
      priority: 0,
      enabled: true,
      temporary: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('channel_account_default bindings cannot define scopeKey');
  });

  it('rejects remote_user bindings for group-scoped keys', () => {
    const result = database.upsertChannelBinding({
      id: 'binding-invalid-group-user',
      channelAccountId: 'channel-account-test',
      scopeType: 'remote_user',
      scopeKey: 'group:team-alpha',
      agentProfileId: 'agent-profile-test',
      priority: 10,
      enabled: true,
      temporary: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('remote_user bindings cannot target group-scoped keys');
  });

  it('rejects external_session targets outside remote_chat scope', () => {
    const invalidBinding = withChannelBindingTarget(
      {
        id: 'binding-invalid-target-scope',
        channelAccountId: 'channel-account-test',
        scopeType: 'channel_account_default',
        agentProfileId: 'agent-profile-test',
        priority: 10,
        enabled: true,
        temporary: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        type: 'external_session',
        id: 'external-session-1',
        mode: 'resume',
      }
    );

    const result = database.upsertChannelBinding(invalidBinding);

    expect(result.success).toBe(false);
    expect(result.error).toContain('external_session targets require remote_chat scope');
  });

  it('accepts direct-user bindings and chat bindings with valid scope keys', () => {
    const directUserBinding: IChannelBinding = {
      id: 'binding-remote-user',
      channelAccountId: 'channel-account-test',
      scopeType: 'remote_user',
      scopeKey: 'user-42',
      agentProfileId: 'agent-profile-test',
      priority: 10,
      enabled: true,
      temporary: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const remoteChatBinding: IChannelBinding = {
      id: 'binding-remote-chat',
      channelAccountId: 'channel-account-test',
      scopeType: 'remote_chat',
      scopeKey: 'group:team-alpha',
      agentProfileId: 'agent-profile-test',
      priority: 20,
      enabled: true,
      temporary: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const directUserResult = database.upsertChannelBinding(directUserBinding);
    const remoteChatResult = database.upsertChannelBinding(remoteChatBinding);

    expect(directUserResult.success).toBe(true);
    expect(remoteChatResult.success).toBe(true);
    expect(database.getChannelBinding(directUserBinding.id).data).toEqual(
      expect.objectContaining({
        ...directUserBinding,
        updatedAt: expect.any(Number),
      })
    );
    expect(database.getChannelBinding(remoteChatBinding.id).data).toEqual(
      expect.objectContaining({
        ...remoteChatBinding,
        updatedAt: expect.any(Number),
      })
    );
  });

  it('requires temporary_override bindings to stay marked as temporary', () => {
    const result = database.upsertChannelBinding({
      id: 'binding-invalid-temporary-override',
      channelAccountId: 'channel-account-test',
      scopeType: 'temporary_override',
      scopeKey: 'group:team-alpha',
      agentProfileId: 'agent-profile-test',
      priority: 50,
      enabled: true,
      temporary: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('temporary_override bindings must set temporary = true');
  });

  it('accepts temporary_override bindings with a valid scope key', () => {
    const temporaryOverrideBinding: IChannelBinding = {
      id: 'binding-temporary-override',
      channelAccountId: 'channel-account-test',
      scopeType: 'temporary_override',
      scopeKey: 'group:team-alpha',
      agentProfileId: 'agent-profile-test',
      priority: 50,
      enabled: true,
      temporary: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = database.upsertChannelBinding(temporaryOverrideBinding);

    expect(result.success).toBe(true);
    expect(database.getChannelBinding(temporaryOverrideBinding.id).data).toEqual(
      expect.objectContaining({
        ...temporaryOverrideBinding,
        updatedAt: expect.any(Number),
      })
    );
  });

  it('normalizes durable bindings to persist first-class publish object metadata', () => {
    const result = database.upsertChannelBinding({
      id: 'binding-publish-object',
      channelAccountId: 'channel-account-test',
      scopeType: 'remote_chat',
      scopeKey: 'oc_group_1:thread:om_topic_root_1',
      agentProfileId: 'agent-profile-test',
      priority: 10,
      enabled: true,
      temporary: false,
      metadata: {
        objectKind: 'topic',
        objectTitle: 'Ops Topic',
        parentObjectKey: 'oc_group_1',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(result.success).toBe(true);
    expect(database.getChannelBinding('binding-publish-object').data).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          publishObject: {
            nativeObjectType: 'topic',
            nativeObjectId: 'om_topic_root_1',
            parentNativeObjectId: 'oc_group_1',
            displayName: 'Ops Topic',
            discoverySource: 'manual',
          },
        }),
      })
    );
  });

  it('reuses the existing durable binding when the same agent republishes the same publish object', () => {
    const firstResult = database.upsertChannelBinding({
      id: 'binding-1',
      channelAccountId: 'channel-account-test',
      scopeType: 'remote_chat',
      scopeKey: 'oc_group_1:thread:om_topic_root_1',
      agentProfileId: 'agent-profile-test',
      priority: 10,
      enabled: true,
      temporary: false,
      metadata: {
        publishObject: {
          nativeObjectType: 'topic',
          nativeObjectId: 'om_topic_root_1',
          parentNativeObjectId: 'oc_group_1',
          displayName: 'Ops Topic',
          discoverySource: 'manual',
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const secondResult = database.upsertChannelBinding({
      id: 'binding-2',
      channelAccountId: 'channel-account-test',
      scopeType: 'remote_chat',
      scopeKey: 'legacy-scope',
      agentProfileId: 'agent-profile-test',
      priority: 10,
      enabled: true,
      temporary: false,
      metadata: {
        publishObject: {
          nativeObjectType: 'topic',
          nativeObjectId: 'om_topic_root_1',
          parentNativeObjectId: 'oc_group_1',
          displayName: 'Ops Topic',
          discoverySource: 'inbound-learned',
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(firstResult.success).toBe(true);
    expect(secondResult.success).toBe(true);
    expect(database.getChannelBinding('binding-1').data).toEqual(
      expect.objectContaining({
        scopeKey: 'legacy-scope',
        metadata: expect.objectContaining({
          publishObject: expect.objectContaining({
            nativeObjectType: 'topic',
            nativeObjectId: 'om_topic_root_1',
          }),
        }),
      })
    );
    expect(database.getChannelBinding('binding-2').data).toBeNull();
  });

  it('rejects another agent claiming the same publish object on the same channel account', () => {
    database.upsertChannelBinding({
      id: 'binding-1',
      channelAccountId: 'channel-account-test',
      scopeType: 'remote_chat',
      scopeKey: 'oc_group_1:thread:om_topic_root_1',
      agentProfileId: 'agent-profile-1',
      priority: 10,
      enabled: true,
      temporary: false,
      metadata: {
        publishObject: {
          nativeObjectType: 'topic',
          nativeObjectId: 'om_topic_root_1',
          parentNativeObjectId: 'oc_group_1',
          displayName: 'Ops Topic',
          discoverySource: 'manual',
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const result = database.upsertChannelBinding({
      id: 'binding-2',
      channelAccountId: 'channel-account-test',
      scopeType: 'remote_chat',
      scopeKey: 'other-scope',
      agentProfileId: 'agent-profile-2',
      priority: 10,
      enabled: true,
      temporary: false,
      metadata: {
        publishObject: {
          nativeObjectType: 'topic',
          nativeObjectId: 'om_topic_root_1',
          parentNativeObjectId: 'oc_group_1',
          displayName: 'Ops Topic',
          discoverySource: 'manual',
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('already bound');
    expect(database.getChannelBinding('binding-2').data).toBeNull();
  });
});

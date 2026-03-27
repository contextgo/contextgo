/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { IChannelBinding } from '../../../../src/process/channels/types';
import { AionUIDatabase } from '../../../../src/process/services/database';
import type { IStatement, ISqliteDriver } from '../../../../src/process/services/database/drivers/ISqliteDriver';

type StoredBindingRow = {
  id: string;
  connector_id: string;
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

function createDatabaseForBindingTests(): AionUIDatabase {
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
              connector_id: String(connectorId),
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

      return createNoopStatement();
    },
    exec: () => {},
    pragma: () => undefined,
    transaction: <T>(fn: (...args: unknown[]) => T) => fn,
    close: () => {},
  };

  const database = Object.create(AionUIDatabase.prototype) as AionUIDatabase;
  (database as unknown as { db: ISqliteDriver }).db = driver;
  return database;
}

describe('AionUIDatabase channel binding validation', () => {
  let database: AionUIDatabase;

  beforeEach(() => {
    database = createDatabaseForBindingTests();
  });

  it('rejects connector_default bindings with a scope key', () => {
    const result = database.upsertChannelBinding({
      id: 'binding-invalid-default',
      connectorId: 'connector-test',
      scopeType: 'connector_default',
      scopeKey: 'user-1',
      agentProfileId: 'agent-profile-test',
      priority: 0,
      enabled: true,
      temporary: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('connector_default bindings cannot define scopeKey');
  });

  it('rejects remote_user bindings for group-scoped keys', () => {
    const result = database.upsertChannelBinding({
      id: 'binding-invalid-group-user',
      connectorId: 'connector-test',
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

  it('accepts direct-user bindings and chat bindings with valid scope keys', () => {
    const directUserBinding: IChannelBinding = {
      id: 'binding-remote-user',
      connectorId: 'connector-test',
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
      connectorId: 'connector-test',
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
    expect(database.getChannelBinding(directUserBinding.id).data).toEqual(expect.objectContaining(directUserBinding));
    expect(database.getChannelBinding(remoteChatBinding.id).data).toEqual(expect.objectContaining(remoteChatBinding));
  });
});

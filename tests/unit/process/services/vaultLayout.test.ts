import { describe, expect, it } from 'vitest';
import {
  getConnectorDocsRelativeDir,
  getConnectorImportIndexRelativePath,
  getConnectorImportOverviewRelativePath,
  getConnectorImportRunRelativePath,
  getConnectorRawRelativeDir,
  getActiveAgentsRelativePath,
  getArtifactLedgerRelativePath,
  getAttentionQueueRelativePath,
  getContextFlowWorkbenchRelativePath,
  getDecisionInboxRelativePath,
  getHandoffBusRelativePath,
  getProfileMemoryRelativePath,
  getRelationsManifestRelativePath,
  getSchemaMemoryRelativePath,
  getSignalMatrixRelativePath,
  getSessionArchiveExtractionRelativePath,
  getSessionArchiveOverviewRelativePath,
  getSessionArchiveStatusRelativePath,
  getSessionArchivesRelativeDir,
  getSessionCheckpointsRelativeDir,
  getSessionContextRootRelativePath,
  getSessionTimelineRelativePath,
  getSessionWorkingContextRelativePath,
} from '../../../../src/process/services/space/vaultLayout';

describe('vaultLayout', () => {
  it('builds project-bound session lifecycle paths', () => {
    expect(getSessionContextRootRelativePath('release:thread/1', 'contextgo')).toBe(
      'Projects/contextgo/_context/sessions/release-thread-1'
    );
    expect(getSessionTimelineRelativePath('release:thread/1', 'contextgo')).toBe(
      'Projects/contextgo/_context/sessions/release-thread-1/timeline.md'
    );
    expect(getSessionWorkingContextRelativePath('release:thread/1', 'contextgo')).toBe(
      'Projects/contextgo/_context/sessions/release-thread-1/working-context.md'
    );
    expect(getSessionCheckpointsRelativeDir('release:thread/1', 'contextgo')).toBe(
      'Projects/contextgo/_context/sessions/release-thread-1/checkpoints'
    );
    expect(getSessionArchivesRelativeDir('release:thread/1', 'contextgo')).toBe(
      'Projects/contextgo/_context/sessions/release-thread-1/archives'
    );
    expect(getSessionArchiveOverviewRelativePath('release:thread/1', 'archive:001', 'contextgo')).toBe(
      'Projects/contextgo/_context/sessions/release-thread-1/archives/archive-001/overview.md'
    );
    expect(getSessionArchiveExtractionRelativePath('release:thread/1', 'archive:001', 'contextgo')).toBe(
      'Projects/contextgo/_context/sessions/release-thread-1/archives/archive-001/extraction.md'
    );
    expect(getSessionArchiveStatusRelativePath('release:thread/1', 'archive:001', 'contextgo')).toBe(
      'Projects/contextgo/_context/sessions/release-thread-1/archives/archive-001/status.json'
    );
  });

  it('builds unbound session lifecycle paths', () => {
    expect(getSessionContextRootRelativePath('mobile sync')).toBe('sessions/mobile-sync');
    expect(getSessionArchiveOverviewRelativePath('mobile sync', 'archive 001')).toBe(
      'sessions/mobile-sync/archives/archive-001/overview.md'
    );
    expect(getSessionArchiveExtractionRelativePath('mobile sync', 'archive 001')).toBe(
      'sessions/mobile-sync/archives/archive-001/extraction.md'
    );
    expect(getSessionArchiveStatusRelativePath('mobile sync', 'archive 001')).toBe(
      'sessions/mobile-sync/archives/archive-001/status.json'
    );
  });

  it('builds schema memory and relation manifest paths', () => {
    expect(getProfileMemoryRelativePath()).toBe('System/Context Engine/Profile Memory.md');
    expect(getSchemaMemoryRelativePath('Decisions', 'Vault layout: L0/L1/L2')).toBe(
      'System/Context Engine/Memory/Decisions/Vault-layout-L0-L1-L2.md'
    );
    expect(getSchemaMemoryRelativePath('Workflows', 'connector import flow')).toBe(
      'System/Context Engine/Memory/Workflows/connector-import-flow.md'
    );
    expect(getRelationsManifestRelativePath()).toBe('System/Context Engine/Relations/relations.jsonl');
  });

  it('builds connector import lifecycle paths', () => {
    expect(getConnectorImportIndexRelativePath()).toBe('System/Context Engine/Imports/connector-import-index.md');
    expect(getConnectorImportOverviewRelativePath('Feishu / Lark')).toBe(
      'Sources/Connectors/Feishu-Lark/Import Overview.md'
    );
    expect(getConnectorImportRunRelativePath('Feishu / Lark', 'initial:2026-04-24')).toBe(
      'Sources/Connectors/Feishu-Lark/import-runs/initial-2026-04-24.md'
    );
    expect(getConnectorDocsRelativeDir('Feishu / Lark')).toBe('Sources/Connectors/Feishu-Lark/docs');
    expect(getConnectorRawRelativeDir('Feishu / Lark')).toBe('Sources/Connectors/Feishu-Lark/raw');
  });

  it('builds operational console surface paths', () => {
    expect(getActiveAgentsRelativePath()).toBe('System/Agent Desk/Active Agents.md');
    expect(getDecisionInboxRelativePath()).toBe('System/Agent Desk/Decision Inbox.md');
    expect(getArtifactLedgerRelativePath()).toBe('System/Agent Desk/Artifact Ledger.md');
    expect(getContextFlowWorkbenchRelativePath()).toBe('System/Workbench/Context Flow Workbench.md');
    expect(getAttentionQueueRelativePath()).toBe('System/Workbench/Attention Queue.md');
    expect(getSignalMatrixRelativePath()).toBe('System/Workbench/Signal Matrix.md');
    expect(getHandoffBusRelativePath()).toBe('System/Workbench/Handoff Bus.md');
  });
});

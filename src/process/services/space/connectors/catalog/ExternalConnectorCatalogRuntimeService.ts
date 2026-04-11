/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { existsSync } from 'node:fs';
import type { ExternalConnectorCatalogDetails } from '@/common/types/connectors/externalConnectorCatalog';
import { safeExecFile } from '@process/utils/safeExec';
import { getEnhancedEnv } from '@process/utils/shellEnv';

const CONNECTOR_REPO_ENV_KEY = 'CONTEXTGO_CONNECTOR_REPO_DIR';
const CGO_BINARY_ENV_KEY = 'CONTEXTGO_CONNECTOR_CGO_BINARY';
const CONNECTOR_TIMEOUT_MS = 15_000;

const resolveConnectorRepoCandidates = (): string[] => {
  const cwd = process.cwd();
  const envPath = process.env[CONNECTOR_REPO_ENV_KEY]?.trim();

  return [
    envPath,
    path.resolve(cwd, '../connector'),
    path.resolve(cwd, 'connector'),
    path.resolve(cwd, '../../connector'),
  ].filter((value): value is string => Boolean(value));
};

export const resolveConnectorRepoDir = (): string | null => {
  for (const candidate of resolveConnectorRepoCandidates()) {
    if (existsSync(path.join(candidate, 'package.json')) && existsSync(path.join(candidate, 'src', 'cli.ts'))) {
      return candidate;
    }
  }

  return null;
};

const resolveCgoBinaryCandidates = (repoDir: string): string[] => {
  const envBinary = process.env[CGO_BINARY_ENV_KEY]?.trim();
  return [envBinary, path.join(repoDir, 'bin', 'cgo'), 'cgo'].filter((value): value is string => Boolean(value));
};

async function resolveCgoBinary(repoDir: string): Promise<string> {
  for (const candidate of resolveCgoBinaryCandidates(repoDir)) {
    if (candidate !== 'cgo' && !existsSync(candidate)) {
      continue;
    }

    try {
      await safeExecFile(candidate, ['--help'], {
        timeout: CONNECTOR_TIMEOUT_MS,
        env: getEnhancedEnv(),
      });
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error('ContextGo connector CLI was not found. Set CONTEXTGO_CONNECTOR_REPO_DIR or CONTEXTGO_CONNECTOR_CGO_BINARY.');
}

export class ExternalConnectorCatalogRuntimeService {
  async getConnectorDetails(connectorName: string): Promise<ExternalConnectorCatalogDetails> {
    const repoDir = resolveConnectorRepoDir();
    if (!repoDir) {
      throw new Error('Could not find the sibling connector repository. Set CONTEXTGO_CONNECTOR_REPO_DIR to continue.');
    }

    const cgoBinary = await resolveCgoBinary(repoDir);
    const result = await safeExecFile(cgoBinary, ['connectors', 'show', connectorName, '--json'], {
      timeout: CONNECTOR_TIMEOUT_MS,
      cwd: repoDir,
      env: getEnhancedEnv(),
    });

    try {
      return JSON.parse(result.stdout) as ExternalConnectorCatalogDetails;
    } catch (error) {
      throw new Error(
        `Failed to parse connector catalog output for ${connectorName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

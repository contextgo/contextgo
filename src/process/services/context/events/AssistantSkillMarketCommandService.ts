/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { skillMarketService } from '@process/bridge/services/skillmarket/SkillMarketService';
import type {
  SkillMarketArchive,
  SkillMarketInstallResult,
  SkillMarketSearchResult,
  SkillMarketView,
} from '@process/bridge/services/skillmarket/SkillMarketService';
import { AcpSkillManager } from '@process/task/AcpSkillManager';
import { stripAssistantControlCommands } from '@process/services/context/events/schedule/AssistantScheduleCommandService';

const SKILLMARKET_SEARCH_BLOCK_PATTERN = /\[SKILLMARKET_SEARCH\]([\s\S]*?)\[\/SKILLMARKET_SEARCH\]/gi;
const SKILLMARKET_INSTALL_BLOCK_PATTERN = /\[SKILLMARKET_INSTALL\]([\s\S]*?)\[\/SKILLMARKET_INSTALL\]/gi;

type SkillMarketCommand =
  | {
      index: number;
      type: 'search';
      query: string;
      view: SkillMarketView | '';
      industryId: string;
      limit: number | null;
    }
  | {
      index: number;
      type: 'install';
      skillId: string;
      archive?: SkillMarketArchive;
    };

export type AssistantSkillMarketCommandResult = {
  cleanedContent: string;
  hasCommands: boolean;
  systemResponses: string[];
};

function readBlockField(block: string, fieldName: string): string {
  const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fieldPattern = new RegExp(`^${escapedFieldName}:\\s*([\\s\\S]*?)(?=^\\w[\\w_]*:\\s|$)`, 'im');
  const match = fieldPattern.exec(block);
  return match?.[1]?.trim() ?? '';
}

function parseOptionalLimit(rawValue: string): number | null {
  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function collectSkillMarketCommands(content: string): SkillMarketCommand[] {
  const commands: SkillMarketCommand[] = [];

  for (const match of content.matchAll(SKILLMARKET_SEARCH_BLOCK_PATTERN)) {
    const block = match[1] ?? '';
    const view = readBlockField(block, 'view').toLowerCase();

    commands.push({
      index: match.index ?? 0,
      type: 'search',
      query: readBlockField(block, 'query'),
      view: view === 'curated' || view === 'full' ? view : '',
      industryId: readBlockField(block, 'industry_id'),
      limit: parseOptionalLimit(readBlockField(block, 'limit')),
    });
  }

  for (const match of content.matchAll(SKILLMARKET_INSTALL_BLOCK_PATTERN)) {
    const block = match[1] ?? '';
    const source = readBlockField(block, 'source');
    const relativePath = readBlockField(block, 'relative_path');
    const label = readBlockField(block, 'label');

    commands.push({
      index: match.index ?? 0,
      type: 'install',
      skillId: readBlockField(block, 'skill_id'),
      archive: source && relativePath ? { source, relativePath, label: label || undefined } : undefined,
    });
  }

  return commands.toSorted((left, right) => left.index - right.index);
}

function formatSearchResult(searchResult: SkillMarketSearchResult): string {
  if (searchResult.items.length === 0) {
    return '[SkillMarket Result]\nNo matching skills were found in the public catalog.';
  }

  const lines = searchResult.items.map((item, index) => {
    const archive = item.archives[0];
    return [
      `${index + 1}. skill_id=${item.id}`,
      `   name=${item.name}`,
      `   display_name=${item.displayName}`,
      `   description=${item.description}`,
      `   themes=${item.themes.join(', ') || '-'}`,
      `   industries=${item.industries.join(', ') || '-'}`,
      `   quality_score=${item.qualityScore}`,
      `   popularity=${item.popularity}`,
      `   installable_archive=${archive ? `${archive.source}:${archive.relativePath}` : 'none'}`,
    ].join('\n');
  });

  return [
    '[SkillMarket Result]',
    `Found ${searchResult.items.length} matching skill(s) in ${searchResult.view} view (total=${searchResult.total}).`,
    `site_url=${searchResult.siteUrl}`,
    ...lines,
  ].join('\n');
}

function formatInstallResult(installResult: SkillMarketInstallResult): string {
  return [
    '[SkillMarket Result]',
    `Installed skill ${installResult.skillName}.`,
    `skill_name=${installResult.skillName}`,
    `installed_path=${installResult.installedPath}`,
    `archive_url=${installResult.archiveUrl}`,
  ].join('\n');
}

function formatCommandError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `[SkillMarket Result]\nError: ${message}`;
}

async function executeSkillMarketCommand(command: SkillMarketCommand): Promise<string> {
  switch (command.type) {
    case 'search': {
      if (!command.query) {
        throw new Error('SKILLMARKET_SEARCH requires query');
      }

      const result = await skillMarketService.searchSkills({
        query: command.query,
        limit: command.limit ?? 5,
        view: command.view || undefined,
        industryId: command.industryId || undefined,
      });
      return formatSearchResult(result);
    }
    case 'install': {
      if (!command.skillId) {
        throw new Error('SKILLMARKET_INSTALL requires skill_id');
      }

      const result = await skillMarketService.installSkill({
        skillId: command.skillId,
        archive: command.archive,
      });
      AcpSkillManager.resetInstance();
      return formatInstallResult(result);
    }
  }
}

export async function executeAssistantSkillMarketCommands(params: {
  content: string;
}): Promise<AssistantSkillMarketCommandResult> {
  const { content } = params;
  const commands = collectSkillMarketCommands(content);

  if (commands.length === 0) {
    return {
      cleanedContent: stripAssistantControlCommands(content),
      hasCommands: false,
      systemResponses: [],
    };
  }

  const systemResponses: string[] = [];

  for (const command of commands) {
    try {
      // Preserve command order within a single assistant turn.
      // eslint-disable-next-line no-await-in-loop
      const response = await executeSkillMarketCommand(command);
      systemResponses.push(response);
    } catch (error) {
      systemResponses.push(formatCommandError(error));
    }
  }

  return {
    cleanedContent: stripAssistantControlCommands(content),
    hasCommands: true,
    systemResponses,
  };
}

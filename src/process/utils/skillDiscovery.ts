/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';

export type SkillOpenAIToolDependency = {
  type: string;
  value: string;
  description?: string;
  transport?: string;
  url?: string;
};

export type SkillOpenAIConfig = {
  interface?: {
    displayName?: string;
    shortDescription?: string;
    defaultPrompt?: string;
  };
  policy?: {
    allowImplicitInvocation?: boolean;
  };
  dependencies?: {
    tools: SkillOpenAIToolDependency[];
  };
};

export type SkillDependencyHint = {
  kind: 'env' | 'command' | 'network' | 'mcp' | 'note';
  label: string;
  status: 'ready' | 'missing' | 'info';
  source: 'compatibility' | 'openai';
  detail?: string;
};

export type SkillDirectoryInfo = {
  name: string;
  description: string;
  compatibility: string[];
  dirName: string;
  dirPath: string;
};

export type DiscoverSkillDirectoriesOptions = {
  excludeTopLevelNames?: string[];
};

const FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---/;
const TOP_LEVEL_KEY_PATTERN = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/;

const normalizeYamlScalar = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const stripCommonIndent = (lines: string[]): string[] => {
  const nonEmptyLines = lines.filter((line) => line.trim());
  if (nonEmptyLines.length === 0) {
    return [];
  }

  const minIndent = Math.min(
    ...nonEmptyLines.map((line) => {
      const match = line.match(/^(\s*)/);
      return match?.[1].length || 0;
    })
  );

  return lines.map((line) => line.slice(minIndent));
};

const normalizeBlockScalar = (lines: string[], folded: boolean): string => {
  const dedented = stripCommonIndent(lines);
  if (!folded) {
    return dedented.join('\n').trim();
  }

  return dedented
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
};

const parseIndentedList = (lines: string[]): string[] => {
  const dedented = stripCommonIndent(lines);
  const values: string[] = [];

  for (const line of dedented) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) {
      continue;
    }

    values.push(normalizeYamlScalar(trimmed.slice(2)));
  }

  return values;
};

const parseTopLevelYamlLike = (content: string): Record<string, string | string[]> => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const result: Record<string, string | string[]> = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      index += 1;
      continue;
    }

    const match = line.match(TOP_LEVEL_KEY_PATTERN);
    if (!match) {
      index += 1;
      continue;
    }

    const [, key, rawValue = ''] = match;
    const normalizedValue = rawValue.trim();

    if (/^[>|][+-]?$/.test(normalizedValue)) {
      const blockLines: string[] = [];
      index += 1;

      while (index < lines.length && (lines[index].startsWith(' ') || lines[index].trim() === '')) {
        blockLines.push(lines[index]);
        index += 1;
      }

      result[key] = normalizeBlockScalar(blockLines, normalizedValue.startsWith('>'));
      continue;
    }

    if (!normalizedValue) {
      const blockLines: string[] = [];
      index += 1;

      while (index < lines.length && (lines[index].startsWith(' ') || lines[index].trim() === '')) {
        blockLines.push(lines[index]);
        index += 1;
      }

      result[key] = parseIndentedList(blockLines);
      continue;
    }

    result[key] = normalizeYamlScalar(normalizedValue);
    index += 1;
  }

  return result;
};

const extractFrontmatter = (content: string): string | null => {
  return content.match(FRONTMATTER_PATTERN)?.[1] || null;
};

export const parseSkillFrontmatter = (
  content: string,
  fallbackName: string
): Pick<SkillDirectoryInfo, 'name' | 'description' | 'compatibility'> => {
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) {
    return {
      name: fallbackName,
      description: '',
      compatibility: [],
    };
  }

  const parsed = parseTopLevelYamlLike(frontmatter);
  const compatibility = parsed.compatibility;

  return {
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : fallbackName,
    description: typeof parsed.description === 'string' ? parsed.description : '',
    compatibility: Array.isArray(compatibility)
      ? compatibility.filter((item) => typeof item === 'string' && item.trim())
      : typeof compatibility === 'string' && compatibility.trim()
        ? [compatibility]
        : [],
  };
};

const extractSectionLines = (content: string, sectionName: string): string[] => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const sectionStart = lines.findIndex((line) => line.match(new RegExp(`^${sectionName}:\\s*$`)));
  if (sectionStart === -1) {
    return [];
  }

  const sectionLines: string[] = [];
  let index = sectionStart + 1;
  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() && !line.startsWith(' ')) {
      break;
    }
    sectionLines.push(line);
    index += 1;
  }

  return sectionLines;
};

const extractNestedSectionLines = (lines: string[], sectionName: string): string[] => {
  const sectionStart = lines.findIndex(
    (line) => line.match(new RegExp(`^\\s+[A-Za-z0-9_-]+:\\s*$`)) && line.trim() === `${sectionName}:`
  );
  if (sectionStart === -1) {
    return [];
  }

  const indent = lines[sectionStart].match(/^(\s*)/)?.[1].length || 0;
  const sectionLines: string[] = [];
  let index = sectionStart + 1;

  while (index < lines.length) {
    const line = lines[index];
    const lineIndent = line.match(/^(\s*)/)?.[1].length || 0;
    if (line.trim() && lineIndent <= indent) {
      break;
    }
    sectionLines.push(line);
    index += 1;
  }

  return sectionLines;
};

const parseSectionScalars = (lines: string[]): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const line of lines) {
    const match = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.+)\s*$/);
    if (!match) {
      continue;
    }
    values[match[1]] = normalizeYamlScalar(match[2]);
  }
  return values;
};

const parseToolDependencies = (lines: string[]): SkillOpenAIToolDependency[] => {
  const toolsSection = extractNestedSectionLines(lines, 'tools');
  if (toolsSection.length === 0) {
    return [];
  }

  const tools: SkillOpenAIToolDependency[] = [];
  let current: Partial<SkillOpenAIToolDependency> | null = null;

  for (const line of toolsSection) {
    const itemStart = line.match(/^\s*-\s+([A-Za-z0-9_-]+):\s*(.+)\s*$/);
    if (itemStart) {
      if (current?.type && current.value) {
        tools.push(current as SkillOpenAIToolDependency);
      }

      current = {
        [itemStart[1]]: normalizeYamlScalar(itemStart[2]),
      };
      continue;
    }

    const propertyMatch = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.+)\s*$/);
    if (current && propertyMatch) {
      current[propertyMatch[1] as keyof SkillOpenAIToolDependency] = normalizeYamlScalar(propertyMatch[2]);
    }
  }

  if (current?.type && current.value) {
    tools.push(current as SkillOpenAIToolDependency);
  }

  return tools;
};

export const parseOpenAISkillConfig = (content: string): SkillOpenAIConfig => {
  const interfaceValues = parseSectionScalars(extractSectionLines(content, 'interface'));
  const policyValues = parseSectionScalars(extractSectionLines(content, 'policy'));
  const dependenciesSection = extractSectionLines(content, 'dependencies');
  const tools = parseToolDependencies(dependenciesSection);

  return {
    interface:
      Object.keys(interfaceValues).length > 0
        ? {
            displayName: interfaceValues.display_name,
            shortDescription: interfaceValues.short_description,
            defaultPrompt: interfaceValues.default_prompt,
          }
        : undefined,
    policy:
      Object.keys(policyValues).length > 0
        ? {
            allowImplicitInvocation: policyValues.allow_implicit_invocation === 'true',
          }
        : undefined,
    dependencies: tools.length > 0 ? { tools } : undefined,
  };
};

export const readSkillOpenAIConfig = async (dirPath: string): Promise<SkillOpenAIConfig | undefined> => {
  const openAiConfigPath = path.join(dirPath, 'agents', 'openai.yaml');

  try {
    const content = await fs.readFile(openAiConfigPath, 'utf-8');
    const parsed = parseOpenAISkillConfig(content);
    if (!parsed.interface && !parsed.dependencies && !parsed.policy) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
};

const isLikelyEnvName = (value: string): boolean => {
  return /^[A-Z][A-Z0-9_]+$/.test(value) && value.includes('_');
};

const splitPathEntries = (value: string | undefined): string[] => {
  return (value || '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const isCommandAvailable = async (commandName: string): Promise<boolean> => {
  const pathEntries = splitPathEntries(process.env.PATH);
  if (pathEntries.length === 0) {
    return false;
  }

  const windowsExtensions =
    process.platform === 'win32'
      ? splitPathEntries((process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').replace(/;/g, path.delimiter))
      : [''];

  for (const entry of pathEntries) {
    for (const extension of windowsExtensions) {
      const candidate = path.join(entry, process.platform === 'win32' ? `${commandName}${extension}` : commandName);
      try {
        await fs.access(candidate);
        return true;
      } catch {
        // Try next candidate
      }
    }
  }

  return false;
};

export const buildSkillDependencyHints = async ({
  compatibility,
  openAIConfig,
}: {
  compatibility: string[];
  openAIConfig?: SkillOpenAIConfig;
}): Promise<SkillDependencyHint[]> => {
  const hints: SkillDependencyHint[] = [];
  const seenLabels = new Set<string>();

  const pushHint = (hint: SkillDependencyHint) => {
    const key = `${hint.source}:${hint.kind}:${hint.label}`;
    if (seenLabels.has(key)) {
      return;
    }
    seenLabels.add(key);
    hints.push(hint);
  };

  for (const item of compatibility) {
    const envMatches = Array.from(item.matchAll(/\b[A-Z][A-Z0-9_]+\b/g))
      .map((match) => match[0])
      .filter(isLikelyEnvName);

    for (const envName of envMatches) {
      pushHint({
        kind: 'env',
        label: envName,
        status: process.env[envName] ? 'ready' : 'missing',
        source: 'compatibility',
        detail: item,
      });
    }

    const commandLineMatch = item.match(/command(?:-line)? tool(?:s)?/i);
    if (commandLineMatch) {
      const commandNames = Array.from(item.matchAll(/`([a-z0-9._-]+)`/gi)).map((match) => match[1]);
      for (const commandName of commandNames) {
        pushHint({
          kind: 'command',
          label: commandName,
          status: (await isCommandAvailable(commandName)) ? 'ready' : 'missing',
          source: 'compatibility',
          detail: item,
        });
      }
    }

    if (/network access/i.test(item)) {
      pushHint({
        kind: 'network',
        label: 'network-access',
        status: 'info',
        source: 'compatibility',
        detail: item,
      });
      continue;
    }

    if (envMatches.length === 0 && !commandLineMatch) {
      pushHint({
        kind: 'note',
        label: item,
        status: 'info',
        source: 'compatibility',
        detail: item,
      });
    }
  }

  for (const dependency of openAIConfig?.dependencies?.tools || []) {
    pushHint({
      kind: dependency.type === 'mcp' ? 'mcp' : 'note',
      label: dependency.value,
      status: 'info',
      source: 'openai',
      detail: dependency.description || dependency.url,
    });
  }

  return hints;
};

const readSkillDirectory = async (dirPath: string, fallbackName: string): Promise<SkillDirectoryInfo | null> => {
  const skillMdPath = path.join(dirPath, 'SKILL.md');

  try {
    const content = await fs.readFile(skillMdPath, 'utf-8');
    const parsed = parseSkillFrontmatter(content, fallbackName);

    return {
      name: parsed.name,
      description: parsed.description,
      compatibility: parsed.compatibility,
      dirName: path.basename(dirPath),
      dirPath,
    };
  } catch {
    return null;
  }
};

const readSkillsFromNestedPack = async (dirPath: string): Promise<SkillDirectoryInfo[]> => {
  const nestedSkillsDir = path.join(dirPath, 'skills');

  try {
    await fs.access(nestedSkillsDir);
  } catch {
    return [];
  }

  const nestedEntries = await fs.readdir(nestedSkillsDir, { withFileTypes: true });
  const skills: SkillDirectoryInfo[] = [];

  for (const nestedEntry of nestedEntries) {
    if (!nestedEntry.isDirectory() && !nestedEntry.isSymbolicLink()) continue;

    const nestedSkillPath = path.join(nestedSkillsDir, nestedEntry.name);
    const directNestedSkill = await readSkillDirectory(nestedSkillPath, nestedEntry.name);
    if (directNestedSkill) {
      skills.push(directNestedSkill);
      continue;
    }

    const nestedPackSkills = await readSkillsFromNestedPack(nestedSkillPath);
    if (nestedPackSkills.length > 0) {
      skills.push(...nestedPackSkills);
    }
  }

  return skills;
};

export async function discoverSkillDirectories(
  rootDir: string,
  options: DiscoverSkillDirectoriesOptions = {}
): Promise<SkillDirectoryInfo[]> {
  const { excludeTopLevelNames = [] } = options;

  try {
    await fs.access(rootDir);
  } catch {
    return [];
  }

  const skills: SkillDirectoryInfo[] = [];
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    if (excludeTopLevelNames.includes(entry.name)) continue;

    const entryPath = path.join(rootDir, entry.name);
    const directSkill = await readSkillDirectory(entryPath, entry.name);
    if (directSkill) {
      skills.push(directSkill);
      continue;
    }

    skills.push(...(await readSkillsFromNestedPack(entryPath)));
  }

  return skills;
}

export async function resolveSkillDirectory(
  rootDir: string,
  skillName: string,
  options: DiscoverSkillDirectoriesOptions = {}
): Promise<SkillDirectoryInfo | null> {
  const normalizedName = skillName.trim();
  if (!normalizedName) {
    return null;
  }

  const skills = await discoverSkillDirectories(rootDir, options);
  return skills.find((skill) => skill.name === normalizedName || skill.dirName === normalizedName) || null;
}

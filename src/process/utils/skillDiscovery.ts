/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';

export type SkillDirectoryInfo = {
  name: string;
  description: string;
  dirName: string;
  dirPath: string;
};

type DiscoverSkillDirectoriesOptions = {
  excludeTopLevelNames?: string[];
};

const parseSkillFrontmatter = (
  content: string,
  fallbackName: string
): Pick<SkillDirectoryInfo, 'name' | 'description'> => {
  const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontMatterMatch) {
    return {
      name: fallbackName,
      description: '',
    };
  }

  const yaml = frontMatterMatch[1];
  const nameMatch = yaml.match(/^name:\s*['"]?(.+?)['"]?\s*$/m);
  const descriptionMatch = yaml.match(/^description:\s*['"]?(.+?)['"]?\s*$/m);

  return {
    name: (nameMatch?.[1] || fallbackName).trim(),
    description: descriptionMatch?.[1]?.trim() || '',
  };
};

const readSkillDirectory = async (dirPath: string, fallbackName: string): Promise<SkillDirectoryInfo | null> => {
  const skillMdPath = path.join(dirPath, 'SKILL.md');

  try {
    const content = await fs.readFile(skillMdPath, 'utf-8');
    const parsed = parseSkillFrontmatter(content, fallbackName);

    return {
      name: parsed.name,
      description: parsed.description,
      dirName: path.basename(dirPath),
      dirPath,
    };
  } catch {
    return null;
  }
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

    const nestedSkillsDir = path.join(entryPath, 'skills');
    try {
      await fs.access(nestedSkillsDir);
      const nestedEntries = await fs.readdir(nestedSkillsDir, { withFileTypes: true });

      for (const nestedEntry of nestedEntries) {
        if (!nestedEntry.isDirectory() && !nestedEntry.isSymbolicLink()) continue;

        const nestedSkill = await readSkillDirectory(path.join(nestedSkillsDir, nestedEntry.name), nestedEntry.name);
        if (nestedSkill) {
          skills.push(nestedSkill);
        }
      }
    } catch {
      // Skill pack without nested skills directory.
    }
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

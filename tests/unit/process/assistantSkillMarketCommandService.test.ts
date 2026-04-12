import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchSkillsMock = vi.fn();
const installSkillMock = vi.fn();
const resetInstanceMock = vi.fn();

vi.mock('@process/bridge/services/skillmarket/SkillMarketService', () => ({
  skillMarketService: {
    searchSkills: (...args: unknown[]) => searchSkillsMock(...args),
    installSkill: (...args: unknown[]) => installSkillMock(...args),
  },
}));

vi.mock('@process/task/AcpSkillManager', () => ({
  AcpSkillManager: {
    resetInstance: () => resetInstanceMock(),
  },
}));

import { executeAssistantSkillMarketCommands } from '@/process/services/context/events/AssistantSkillMarketCommandService';

describe('AssistantSkillMarketCommandService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches the public skill catalog and formats the result for model continuation', async () => {
    searchSkillsMock.mockResolvedValue({
      view: 'curated',
      total: 2,
      siteUrl: 'https://skillmarket.com.cn',
      items: [
        {
          id: 'browser-context::1.0.0::tester',
          name: 'browser-context',
          displayName: 'Browser Context',
          description: 'Collects browser context into Context Engine.',
          themes: ['browser', 'context'],
          industries: ['engineering'],
          qualityScore: 92,
          popularity: 128,
          archives: [{ source: 'skillhub', relativePath: 'browser-context/1.0.0.zip' }],
        },
      ],
    });

    const result = await executeAssistantSkillMarketCommands({
      content: '[SKILLMARKET_SEARCH]\nquery: browser context\nview: curated\nlimit: 3\n[/SKILLMARKET_SEARCH]',
    });

    expect(searchSkillsMock).toHaveBeenCalledWith({
      query: 'browser context',
      limit: 3,
      view: 'curated',
      industryId: undefined,
    });
    expect(result.systemResponses[0]).toContain('[SkillMarket Result]');
    expect(result.systemResponses[0]).toContain('skill_id=browser-context::1.0.0::tester');
  });

  it('installs a selected skill archive from the public catalog', async () => {
    installSkillMock.mockResolvedValue({
      skillName: 'browser-context',
      installedPath: '/tmp/skills/browser-context',
      archiveUrl: 'https://skillmarket.com.cn/packages/browser-context.zip',
    });

    const result = await executeAssistantSkillMarketCommands({
      content:
        '[SKILLMARKET_INSTALL]\nskill_id: browser-context::1.0.0::tester\nsource: skillhub\nrelative_path: browser-context/1.0.0.zip\nlabel: Browser Context\n[/SKILLMARKET_INSTALL]',
    });

    expect(installSkillMock).toHaveBeenCalledWith({
      skillId: 'browser-context::1.0.0::tester',
      archive: {
        source: 'skillhub',
        relativePath: 'browser-context/1.0.0.zip',
        label: 'Browser Context',
      },
    });
    expect(resetInstanceMock).toHaveBeenCalledTimes(1);
    expect(result.systemResponses[0]).toContain('Installed skill browser-context');
  });

  it('returns a command error when search is missing a query', async () => {
    const result = await executeAssistantSkillMarketCommands({
      content: '[SKILLMARKET_SEARCH]\nview: curated\n[/SKILLMARKET_SEARCH]',
    });

    expect(searchSkillsMock).not.toHaveBeenCalled();
    expect(result.systemResponses).toEqual(['[SkillMarket Result]\nError: SKILLMARKET_SEARCH requires query']);
  });
});

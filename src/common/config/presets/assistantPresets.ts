import type { PresetAgentType } from '@/common/types/acpTypes';

export type AssistantPreset = {
  id: string;
  avatar: string;
  presetAgentType?: PresetAgentType;
  harnessTagI18n?: Record<string, string>;
  recommendedDomainI18n?: Record<string, string>;
  workspaceBootstrapHintI18n?: Record<string, string>;
  nameI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  promptsI18n?: Record<string, string[]>;
};

export const ASSISTANT_PRESETS: AssistantPreset[] = [
  {
    id: 'morph-ppt',
    avatar: 'morph-ppt.svg',
    presetAgentType: 'codex',
    recommendedDomainI18n: {
      'en-US': 'Presentations',
      'zh-CN': '演示文稿',
    },
    workspaceBootstrapHintI18n: {
      'en-US':
        'Link a workspace if you want generated PPTX files, briefs, and build scripts saved into the project folder.',
      'zh-CN': '如果希望把生成的 PPTX、brief 和构建脚本直接落到项目目录，开始前建议先关联工作空间。',
    },
    nameI18n: {
      'en-US': 'Morph PPT',
      'zh-CN': 'Morph PPT',
    },
    descriptionI18n: {
      'en-US':
        'A specialist assistant for building polished PowerPoint decks with Morph animations, structured storytelling, and reproducible build scripts.',
      'zh-CN': '一个专门产出带 Morph 动画、叙事结构清晰且可复现构建脚本的 PPT 专项助手。',
    },
    promptsI18n: {
      'en-US': [
        'Create a Morph-animated presentation for this product launch narrative',
        'Turn this report into a polished PPT deck with strong motion and story flow',
        'Plan the deck first, then generate the PPTX and build script for this topic',
      ],
      'zh-CN': [
        '围绕这个产品发布主题做一套带 Morph 动画的演示文稿',
        '把这份报告做成一套叙事感强、动态效果好的 PPT',
        '先规划整套 deck，再生成这次主题的 PPTX 和构建脚本',
      ],
    },
  },
  {
    id: 'startup-strategist',
    avatar: '\u{1F680}',
    presetAgentType: 'codex',
    harnessTagI18n: {
      'en-US': 'Startup Strategist',
      'zh-CN': 'Startup Strategist',
    },
    recommendedDomainI18n: {
      'en-US': 'Startup Strategy',
      'zh-CN': '创业战略',
    },
    workspaceBootstrapHintI18n: {
      'en-US':
        'Link a workspace before starting if you want startup canvases, ICP notes, GTM plans, and founder briefs written back into the project folder.',
      'zh-CN':
        '如果希望把 startup canvas、ICP 笔记、GTM 方案和 founder brief 直接写回项目目录，开始前建议先关联工作空间。',
    },
    nameI18n: {
      'en-US': 'Startup Strategist',
      'zh-CN': 'Startup Strategist',
    },
    descriptionI18n: {
      'en-US':
        'Founder-oriented strategy assistant for pressure-testing startup ideas, choosing a beachhead segment, shaping value propositions, designing GTM, setting North Star metrics, and turning early evidence into crisp strategic decisions.',
      'zh-CN':
        '面向创业者与新业务探索的内置助手，用于压测 startup idea、选择 beachhead segment、打磨价值主张、设计 GTM、设定北极星指标，并把早期证据整理成清晰的战略判断。',
    },
    promptsI18n: {
      'en-US': [
        'Pressure-test this startup idea, then tell me what must be true for it to work',
        'Build a startup canvas, ICP, and GTM for this product concept',
        'Help me choose the beachhead segment, value proposition, and North Star metric for this startup',
      ],
      'zh-CN': [
        '把这个 startup idea 真正压测一遍，告诉我它成立必须满足什么条件',
        '围绕这个产品概念做一版 startup canvas、ICP 和 GTM 方案',
        '帮我为这个创业项目确定 beachhead segment、价值主张和北极星指标',
      ],
    },
  },
  {
    id: 'design-director',
    avatar: '\u{1F3A8}',
    presetAgentType: 'codex',
    harnessTagI18n: {
      'en-US': 'Design Director',
      'zh-CN': 'Design Director',
    },
    recommendedDomainI18n: {
      'en-US': 'Design Direction',
      'zh-CN': '设计方向',
    },
    workspaceBootstrapHintI18n: {
      'en-US':
        'Link a workspace before starting if you want DESIGN.md drafts, page art direction briefs, critique notes, and implementation handoff files written back into the project folder.',
      'zh-CN':
        '如果希望把 DESIGN.md 草稿、页面 art direction brief、评审笔记和实现交付稿直接写回项目目录，开始前建议先关联工作空间。',
    },
    nameI18n: {
      'en-US': 'Design Director',
      'zh-CN': 'Design Director',
    },
    descriptionI18n: {
      'en-US':
        'A built-in design-direction assistant for choosing visual archetypes, critiquing screenshots, absorbing Figma references into first-party system rules, distilling project-level design systems, art-directing pages, and turning design intent into component-level implementation guidance.',
      'zh-CN':
        '面向设计方向与前端实现协作的内置助手，用于选择视觉 archetype、做截图评审、吸收 Figma 参考并内化为一方系统规则、蒸馏项目级设计系统、做页面 art direction，并把设计意图推进到组件级可执行交付。',
    },
    promptsI18n: {
      'en-US': [
        'Help me choose the right visual direction for this product before we build the UI',
        'Turn these references and product goals into a project-level DESIGN.md and page art direction',
        'Critique this current UI, then give me a cleaner design direction and implementation handoff',
        'Review these screenshots, absorb the strongest Figma signals, and write a component-level visual spec',
      ],
      'zh-CN': [
        '先帮我为这个产品选对视觉方向，再开始做 UI',
        '把这些参考和产品目标蒸馏成一份项目级 DESIGN.md 和页面 art direction',
        '评审一下当前 UI，然后给我一版更干净的设计方向和实现交付稿',
        '把这些截图评一遍，再吸收 Figma 里最该借鉴的信号，最后写成组件级视觉规范',
      ],
    },
  },
  {
    id: 'figma-closed-loop',
    avatar: '\u{1F517}',
    presetAgentType: 'codex',
    harnessTagI18n: {
      'en-US': 'Figma Closed Loop',
      'zh-CN': 'Figma Closed Loop',
    },
    recommendedDomainI18n: {
      'en-US': 'Design Execution',
      'zh-CN': '设计执行闭环',
    },
    workspaceBootstrapHintI18n: {
      'en-US':
        'Link a workspace before starting if you want Figma file ledger entries, sync notes, implementation handoff records, and drift reports written back into the project folder.',
      'zh-CN':
        '如果希望把 Figma 文件台账、同步记录、实现交付记录和 drift 报告直接写回项目目录，开始前建议先关联工作空间。',
    },
    nameI18n: {
      'en-US': 'Figma Closed Loop',
      'zh-CN': 'Figma Closed Loop',
    },
    descriptionI18n: {
      'en-US':
        'A built-in design-execution assistant that closes the code <-> Figma <-> code loop. Generates Figma files and screens from project context, syncs design system rules and component libraries into Figma, produces implementation suggestions from Figma nodes, and audits drift between code and Figma.',
      'zh-CN':
        '面向 code <-> Figma <-> code 真正闭环的内置助手，用于从项目上下文生成 Figma 文件和 screen、把设计系统规则与组件库同步到 Figma、基于 Figma node 反向生成实现建议，并周期性审计代码系统与 Figma 系统之间的 drift。',
    },
    promptsI18n: {
      'en-US': [
        'Push this page structure into Figma as a frame and record the new node ids',
        'Sync the recent component library changes into the linked Figma library, but do not publish yet',
        'Generate an implementation suggestion from this Figma node, with explicit assumptions and missing tokens',
        'Audit the drift between this design system and the linked Figma file, then propose a remediation plan',
      ],
      'zh-CN': [
        '把这个页面结构推到 Figma 里作为一个 frame，并记录新生成的 node id',
        '把最近的组件库改动同步到关联的 Figma library 里，先不要 publish',
        '基于这个 Figma node 生成一份实现建议，明确列出假设和缺失的 token',
        '审计一下这套设计系统与关联 Figma 文件之间的 drift，并给出整改方案',
      ],
    },
  },
  {
    id: 'marketing-creative-studio',
    avatar: '\u{1F4E3}',
    presetAgentType: 'codex',
    harnessTagI18n: {
      'en-US': 'Marketing Creative Studio',
      'zh-CN': 'Marketing Creative Studio',
    },
    recommendedDomainI18n: {
      'en-US': 'Marketing & Creative',
      'zh-CN': '市场与创意',
    },
    workspaceBootstrapHintI18n: {
      'en-US':
        'Link a workspace before starting if you want normalized brand context, theme packs, ad creatives, social asset batches, and campaign variant matrices written back into the project folder.',
      'zh-CN':
        '如果希望把规范化的 brand context、主题包、广告 KV、社交媒体批量素材以及活动变体矩阵直接写回项目目录，开始前建议先关联工作空间。',
    },
    nameI18n: {
      'en-US': 'Marketing Creative Studio',
      'zh-CN': 'Marketing Creative Studio',
    },
    descriptionI18n: {
      'en-US':
        'A built-in marketing creative assistant for normalizing brand context, building reusable theme packs, generating paid-ad creatives, organic social batches, visual + copy pairings, and structured campaign variant matrices for ecommerce, SaaS, presales, and event campaigns.',
      'zh-CN':
        '面向品牌、营销、增长、电商与售前活动的内置创意助手，用于规范化 brand context、产出可复用主题包、生成付费广告 KV、组织社交媒体批量素材、做视觉与文案配对，并按行业模板展开活动变体矩阵。',
    },
    promptsI18n: {
      'en-US': [
        'Normalize this brand handbook and product page into a stable brand context I can reuse across campaigns',
        'Turn this campaign brief into a multi-platform ad creative batch with the right size and tone per channel',
        'Plan a one-week organic social batch across Instagram, TikTok, and LinkedIn that respects the brand voice',
        'Expand this approved hero KV into locale, audience, and stage variants for an ecommerce launch',
      ],
      'zh-CN': [
        '把这份品牌手册和产品页规范化成可复用的 brand context，方便后续多场活动共用',
        '把这份活动 brief 拆成各平台尺寸和语气都对的广告 KV 批量产出',
        '为 Instagram、TikTok、LinkedIn 规划一周的自然流量内容批量，并保持品牌口吻一致',
        '把这版已通过的主 KV 按 locale、人群和阶段展开成电商上新需要的变体矩阵',
      ],
    },
  },
  {
    id: 'motion-studio',
    avatar: '\u{1F3AC}',
    presetAgentType: 'codex',
    harnessTagI18n: {
      'en-US': 'Motion Studio',
      'zh-CN': 'Motion Studio',
    },
    recommendedDomainI18n: {
      'en-US': 'Motion and Video',
      'zh-CN': '动效与视频',
    },
    workspaceBootstrapHintI18n: {
      'en-US':
        'Link a workspace before starting if you want storyboards, render configs, contact sheets, and QC reports for motion artifacts written back into the project folder.',
      'zh-CN':
        '如果希望把 storyboard、render config、contact sheet 和动效 QC 报告直接写回项目目录，开始前建议先关联工作空间。',
    },
    nameI18n: {
      'en-US': 'Motion Studio',
      'zh-CN': 'Motion Studio',
    },
    descriptionI18n: {
      'en-US':
        'A built-in motion-execution assistant for storyboarding videos, motion posters, product demo cuts, and social cutdowns, then driving them through a reproducible code-driven render pipeline with QC, contact sheets, and rerun guidance.',
      'zh-CN':
        '面向视频与动效执行的内置助手，用于编写 storyboard、规划镜头与转场，再通过 code-driven 的 render 流程批量产出动效海报、产品演示短片、活动预热视频和社媒 cutdown，并配合 QC 与抽帧审阅形成可复现的产线。',
    },
    promptsI18n: {
      'en-US': [
        'Plan a storyboard for this product launch video and prepare multiple social cutdown sizes',
        'Build a motion poster for this campaign and run it through QC before we publish',
        'Re-render this storyboard with the updated assets and produce a contact sheet for review',
      ],
      'zh-CN': [
        '为这次产品发布做一版 storyboard，并准备多种社媒 cutdown 尺寸',
        '为这次活动做一版动效海报，并跑一遍 QC 再发布',
        '用更新后的素材重新渲染这版 storyboard，并产出一份 contact sheet 供审稿',
      ],
    },
  },
  {
    id: 'pm-workbench',
    avatar: 'pm-workbench.svg',
    presetAgentType: 'codex',
    harnessTagI18n: {
      'en-US': 'PM Workbench',
      'zh-CN': 'PM Workbench',
    },
    recommendedDomainI18n: {
      'en-US': 'Product Management',
      'zh-CN': '产品管理',
    },
    workspaceBootstrapHintI18n: {
      'en-US':
        'Link a workspace before starting if you want discovery notes, PRDs, prioritization tables, and roadmap artifacts written back into the project folder.',
      'zh-CN': '如果希望把发现笔记、PRD、优先级表和路线图产物直接写回项目目录，开始前建议先关联工作空间。',
    },
    nameI18n: {
      'en-US': 'PM Workbench',
      'zh-CN': 'PM Workbench',
    },
    descriptionI18n: {
      'en-US':
        'Product management assistant for evidence-led discovery, clear PRDs, roadmap sequencing, and pragmatic prioritization around a linked workspace.',
      'zh-CN':
        '面向产品经理的内置助手，围绕已关联工作空间推进证据驱动的发现、清晰的 PRD、路线图排序与务实的优先级判断。',
    },
    promptsI18n: {
      'en-US': [
        'Attach this workspace and help me run discovery, draft the PRD, and sequence a product roadmap',
        'Pressure-test this product request before it turns into a roadmap commitment',
        'Use a PM workbench workflow to discover, prioritize, and document this initiative',
      ],
      'zh-CN': [
        '先关联这个工作空间，再帮我跑 discovery、起草 PRD，并排出产品路线图',
        '先把这个产品需求压测清楚，再决定要不要进路线图',
        '用 PM workbench 的工作流来完成这次需求发现、优先级判断和文档沉淀',
      ],
    },
  },
  {
    id: 'office-analyst',
    avatar: 'office-analyst.svg',
    presetAgentType: 'codex',
    harnessTagI18n: {
      'en-US': 'Office Analyst',
      'zh-CN': 'Office Analyst',
    },
    recommendedDomainI18n: {
      'en-US': 'Office Productivity',
      'zh-CN': '办公生产力',
    },
    workspaceBootstrapHintI18n: {
      'en-US':
        'Link a workspace before starting if you want cleaned spreadsheets, extracted notes, reconciled findings, and draft reports saved into the working folder.',
      'zh-CN': '如果希望把清洗后的表格、提取笔记、对账结果和草拟报告直接保存到工作目录，开始前建议先关联工作空间。',
    },
    nameI18n: {
      'en-US': 'Office Analyst',
      'zh-CN': 'Office Analyst',
    },
    descriptionI18n: {
      'en-US':
        'Office productivity assistant for spreadsheet analysis, multi-file SQL-style analysis, document synthesis, source reconciliation, and polished reporting around a linked workspace.',
      'zh-CN':
        '面向办公生产力的内置助手，围绕已关联工作空间推进表格分析、多文件 SQL 式分析、文档提炼、多源核对和成品报告输出。',
    },
    promptsI18n: {
      'en-US': [
        'Analyze these spreadsheets and documents, then give me a clean management summary',
        'Cross-check the numbers across this workbook, PDF, and memo before I send the report',
        'Use an office analyst workflow to clean the data, extract the signal, and draft the final report',
      ],
      'zh-CN': [
        '把这些表格和文档分析一下，然后给我一版干净的管理摘要',
        '先把这个工作簿、PDF 和备忘录里的数字核对清楚，再输出报告',
        '用 Office Analyst 的工作流完成数据清洗、信息提炼和最终报告草拟',
      ],
    },
  },
  {
    id: 'finance-analyst',
    avatar: '\u{1F4B9}',
    presetAgentType: 'codex',
    harnessTagI18n: {
      'en-US': 'Finance Analyst',
      'zh-CN': 'Finance Analyst',
    },
    recommendedDomainI18n: {
      'en-US': 'Finance & Planning',
      'zh-CN': '财务与经营规划',
    },
    workspaceBootstrapHintI18n: {
      'en-US':
        'Link a workspace before starting if you want financial extracts, variance views, valuation notes, and draft investment memos saved into the working folder.',
      'zh-CN':
        '如果希望把财务提取结果、偏差分析、估值笔记和投资备忘录草稿直接保存到工作目录，开始前建议先关联工作空间。',
    },
    nameI18n: {
      'en-US': 'Finance Analyst',
      'zh-CN': 'Finance Analyst',
    },
    descriptionI18n: {
      'en-US':
        'Finance decision-support assistant for statement analysis, variance review, valuation work, company comparison, investment screening, thesis stress-testing, scenario planning, SaaS metrics, and executive financial reporting around a linked workspace.',
      'zh-CN':
        '面向财务判断与经营规划的内置助手，围绕已关联工作空间推进报表分析、偏差复盘、估值建模、公司比较、投资筛选、thesis 压测、情景预测、SaaS 指标判断和高层财务汇报。',
    },
    promptsI18n: {
      'en-US': [
        'Analyze these financial statements, explain the main risks, and tell me what needs follow-up',
        'Build a finance analyst workflow for budget variance, valuation, and executive reporting',
        'Use this workspace to benchmark SaaS metrics, stress-test assumptions, and draft an investment memo',
      ],
      'zh-CN': [
        '把这些财务报表分析一下，解释主要风险，并告诉我下一步该深挖什么',
        '用 Finance Analyst 的工作流完成预算偏差解释、估值判断和高层财务汇报',
        '围绕这个 workspace 跑 SaaS 指标 benchmark、假设压测和投资备忘录草拟',
      ],
    },
  },
  {
    id: 'superpowers',
    avatar: 'superpowers.svg',
    presetAgentType: 'codex',
    harnessTagI18n: {
      'en-US': 'Superpowers',
      'zh-CN': 'Superpowers',
    },
    recommendedDomainI18n: {
      'en-US': 'Engineering',
      'zh-CN': '研发',
    },
    workspaceBootstrapHintI18n: {
      'en-US': 'Link a workspace before starting. Best for repository-based engineering delivery.',
      'zh-CN': '开始前建议先关联工作空间，更适合基于仓库的研发交付。',
    },
    nameI18n: {
      'en-US': 'Superpowers Harness',
      'zh-CN': 'Superpowers Harness',
    },
    descriptionI18n: {
      'en-US':
        'Engineering harness assistant inspired by Superpowers. Guides spec, planning, TDD, review, and final verification around a linked workspace.',
      'zh-CN': '受 Superpowers 启发的工程 Harness 助手，围绕已关联工作空间推进规格、规划、TDD、评审和最终验证。',
    },
    promptsI18n: {
      'en-US': [
        'Attach this repository and drive it with a strict spec -> plan -> TDD -> review workflow',
        'Set up an engineering harness for this repo before implementation starts',
        'Use a workspace-first development process with explicit planning and verification',
      ],
      'zh-CN': [
        '先关联这个仓库，再按 spec -> plan -> TDD -> review 的严格流程推进',
        '在开始实现前，先为这个仓库建立工程 harness',
        '用先绑定工作空间、再规划和验证的研发流程来推进这个任务',
      ],
    },
  },
  {
    id: 'everything-in-claude-code',
    avatar: 'everything-claude-code.svg',
    presetAgentType: 'claude',
    harnessTagI18n: {
      'en-US': 'Everything Claude Code',
      'zh-CN': 'Everything Claude Code',
    },
    recommendedDomainI18n: {
      'en-US': 'Engineering',
      'zh-CN': '研发',
    },
    workspaceBootstrapHintI18n: {
      'en-US': 'Link a workspace before starting. Best for repository-focused Claude Code style delivery.',
      'zh-CN': '开始前建议先关联工作空间，更适合 Claude Code 风格的仓库研发交付。',
    },
    nameI18n: {
      'en-US': 'Everything Claude Code Harness',
      'zh-CN': 'Everything Claude Code Harness',
    },
    descriptionI18n: {
      'en-US':
        'Engineering harness assistant absorbed from Everything Claude Code. Ships its native skill pack, legacy slash shims, and Claude workspace hook payload as a first-class built-in preset.',
      'zh-CN':
        '从 Everything Claude Code 完整吸收进来的工程 Harness 助手，内置其原生 skill 包、兼容 slash 命令和 Claude 工作区 hook 载荷。',
    },
    promptsI18n: {
      'en-US': [
        'Link my repo and run the native Everything Claude Code harness in this workspace',
        'Prepare a Claude Code style engineering harness for this workspace before coding',
        'Use the bundled ECC skill pack, command shims, and hook runtime for this project',
      ],
      'zh-CN': [
        '先关联仓库，再在这个工作空间里启用原生 Everything Claude Code harness',
        '在开始编码前，为这个工作空间准备 Claude Code 风格的完整工程 harness',
        '用内置的 ECC skill 包、命令 shim 和 hook 运行时来推进这个项目',
      ],
    },
  },
  {
    id: 'karpathy-coding-guard',
    avatar: '\u{1F6E1}\uFE0F',
    presetAgentType: 'codex',
    harnessTagI18n: {
      'en-US': 'Karpathy Coding Guard',
      'zh-CN': 'Karpathy Coding Guard',
    },
    recommendedDomainI18n: {
      'en-US': 'Engineering',
      'zh-CN': '研发',
    },
    workspaceBootstrapHintI18n: {
      'en-US':
        'Link a workspace before starting if you want assumption notes, scoped change records, and verification logs written back into the project folder.',
      'zh-CN': '如果希望把假设记录、改动边界说明和验证日志直接写回项目目录，开始前建议先关联工作空间。',
    },
    nameI18n: {
      'en-US': 'Karpathy Coding Guard',
      'zh-CN': 'Karpathy Coding Guard',
    },
    descriptionI18n: {
      'en-US':
        'A built-in engineering assistant for assumption auditing, minimal diffs, anti-overengineering discipline, and success-criteria-driven coding around a linked workspace.',
      'zh-CN':
        '一个面向工程交付的内置助手，围绕已关联工作空间推进假设审计、最小 diff、反过度设计约束，以及基于成功标准的编码闭环。',
    },
    promptsI18n: {
      'en-US': [
        'Help me implement this change with the smallest verifiable diff and call out any hidden assumptions first',
        'Audit the ambiguity in this coding task, then propose the simplest safe implementation path',
        'Review this planned code change for overengineering, scope creep, and weak verification',
      ],
      'zh-CN': [
        '先把这个编码任务里的隐含假设挑出来，再用最小可验证 diff 来实现',
        '先审计这次改动的歧义和范围，再给我一条最简单且安全的实现路径',
        '帮我检查这次代码改动有没有过度设计、范围膨胀和验证不足的问题',
      ],
    },
  },
];

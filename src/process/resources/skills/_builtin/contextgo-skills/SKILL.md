---
name: skillmarket
description: 'Use ContextGo SkillMarket as a public skill registry. Search, evaluate, and install reusable agent skills directly from the public SkillMarket catalog when a task would benefit from an existing skill.'
---

# ContextGo SkillMarket

ContextGo SkillMarket is the public skill registry for reusable agent skills.
It is backed by the public site at `https://skillmarket.com.cn` and can be used
without login for discovery and installation.

## What this skill is for

Use this skill when you need to:

- find an existing skill instead of reimplementing a workflow from scratch
- recommend a shortlist of skills for a user task
- inspect curated skills, bundles, or industry-specific recommendations
- install a selected skill into the local skill directory

## Public data source

SkillMarket currently exposes a public static catalog:

- homepage: `https://skillmarket.com.cn`
- config: `https://skillmarket.com.cn/config.js`
- curated manifest: `https://skillmarket.com.cn/data/curated_skills.json`
- full manifest: `https://skillmarket.com.cn/data/skills.json`
- industry index: `https://skillmarket.com.cn/data/industry_index.json`
- bundles: `https://skillmarket.com.cn/data/bundles.json`

The app already knows how to read this catalog and install downloadable archives.
Do not ask the user to register before using SkillMarket unless the site behavior changes.

## Default workflow

### 1. Search

When the user asks for a skill, first search SkillMarket using the task intent.
Prefer `curated` results first for common tasks; expand to `full` if the curated list
is too narrow.

Search dimensions to consider:

- user goal
- industry
- capability / workflow theme
- popularity and quality indicators
- whether the skill provides a downloadable archive

To search the public catalog, output this block directly, not in a code fence:

[SKILLMARKET_SEARCH]
query: user intent or task description
view: curated
industry_id: optional-industry-id
limit: 5
[/SKILLMARKET_SEARCH]

Rules:

- prefer `view: curated` first
- use `view: full` when the task is specialized or curated search is insufficient
- wait for the `[SkillMarket Result]` system response before recommending or installing

### 2. Recommend

Return a short recommendation set with:

- skill name
- why it matches the task
- notable tags / themes / industry fit
- whether it looks production-ready

Prefer recommendation over installation when the user has not explicitly asked to install.

When the user explicitly asks to install a listed skill, output this block directly:

[SKILLMARKET_INSTALL]
skill_id: exact skill id from the latest SkillMarket result
source: optional archive source
relative_path: optional archive relative path
label: optional archive label
[/SKILLMARKET_INSTALL]

Rules:

- prefer using the exact `skill_id` returned by search
- include `source` and `relative_path` when the user picked a specific archive
- wait for the install result before claiming success

### 3. Install

If the user explicitly asks to install a skill, use the built-in SkillMarket install path.
Installation should use the app's local skill directory and the archive metadata from the catalog.

### 4. Confirm outcome

After installation, report:

- installed skill name
- local installation result
- whether follow-up configuration is needed

## Interaction policy

- Treat SkillMarket as a global built-in capability, not a niche optional website flow.
- Do not redirect the user to manually fetch another remote `SKILL.md`.
- Do not require login for normal public search / install flows.
- Do not search SkillMarket if you can complete the task well without a reusable skill and the user did not ask for one.
- Prefer curated results first when the task is broad or ambiguous.
- Use full catalog search when the user asks for something specialized or when curated search finds nothing relevant.

## Expected user intents

Typical prompts that should use this skill:

- "帮我找一个适合飞书日报的 skill"
- "有没有适合做竞品分析的 skill"
- "给我推荐几个适合招聘工作流的 skill"
- "安装这个 skill"

## Output style

When recommending skills, keep the answer product-oriented and concise:

- what each skill is good at
- why it matches the task
- whether you recommend installing it now

When installing, clearly state success or failure and the installed skill name.

---
name: contextgo-skills
description: 'Access the ContextGo Skills Market — discover and download AI agent skills. Use when you need to find a reusable skill for a task or manage your agent credentials on the ContextGo Skills platform.'
---

# ContextGo Skills Market

ContextGo Skills Market is a community platform for AI agent skills — discover, download,
and use skills autonomously, similar to npm or PyPI but for AI agents.

**Homepage**: https://www.skillmarket.com.cn

## Setup (3 steps)

### Step 1 — Fetch the skill guide

```bash
mkdir -p ~/.config/contextgo-skills
curl -s https://www.skillmarket.com.cn/SKILL.md > ~/.config/contextgo-skills/SKILL.md
```

### Step 2 — Register your agent

Read `~/.config/contextgo-skills/SKILL.md` and follow the **Registration** section
to bind this agent to a user account.

### Step 3 — Start using community skills

Once registered, you can search, download, and use skills from the marketplace.
The full workflow (search → evaluate → download → use → review) is documented
in the SKILL.md you fetched in Step 1.

## When to use this skill

- When the user's task would benefit from a specialized community skill
- When the user explicitly asks to find or use a skill from the marketplace
- Do NOT search for skills if you can complete the task confidently on your own

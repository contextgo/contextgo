# Asset Recipes

This document lists the recurring asset families that `Marketing Creative Studio` knows how to produce.

A recipe is not a single template. It is a shape that the package always returns: brief, brand context, channel constraints, visual recipe, variant set, and trace metadata.

## Recipe: Paid Ad Creative

When to use:

- a campaign needs creatives on paid networks (Meta, X, TikTok, LinkedIn, YouTube, programmatic, search)

Always emit:

- channel-specific aspect ratios (1:1, 4:5, 9:16, 16:9, vertical reels)
- a primary message and supporting copy block sized to the channel limits
- safe-zone respecting layout for vertical formats
- a CTA that maps to the campaign objective
- per-variant trace metadata (audience, channel, locale, version)

Refuse to emit:

- assets without an explicit campaign objective
- assets that exceed channel copy length without an explicit override
- assets that violate brand-banned-term rules

## Recipe: Social Content Batch

When to use:

- a brand needs a content pack for a defined window (weekly drop, launch week, event coverage)

Always emit:

- a content slate with theme rotation across the window
- per-platform post drafts that respect platform-specific tone and format
- visual treatment paired with copy via `visual-copy-pairing`
- a posting cadence suggestion (do not invent timestamps; suggest slots only)

Refuse to emit:

- a generic "do 7 posts" output without theme rotation
- content that ignores existing brand handle voice
- content that mixes platforms (Instagram caption with X-style format)

## Recipe: Ecommerce Surface

When to use:

- selling-point images, hero KV, banner, activity page

Always emit:

- product hierarchy (hero claim, secondary claims, proof points)
- correct ratio set per surface (PDP hero, listing card, banner, mobile vs desktop)
- price/promo placeholder discipline (do not invent prices)
- compliance placeholders for required disclaimers

## Recipe: Presales One-Pager / Overview

When to use:

- a sales or pre-sales surface needs a single-page visual artifact

Always emit:

- problem → solution → proof → ask narrative blocks
- visual hierarchy that survives at small scale
- a minimal asset set that the sales team can reuse without further design support

## Recipe: Event Campaign KV

When to use:

- an event, webinar, or in-person activation needs anchor visuals

Always emit:

- KV with primary motif, secondary motifs, anchor lockup
- size set covering web hero, social, in-venue, email header
- localization variants for the event audience

## Recipe Composition Rules

- recipes may compose, but the output should still expose the full layered shape
- never collapse trace metadata into the visual output
- never drop variant set boundaries (each variant is its own trace object)
- recipe selection must be explicit; if the request does not match any recipe, normalize the brief first instead of guessing

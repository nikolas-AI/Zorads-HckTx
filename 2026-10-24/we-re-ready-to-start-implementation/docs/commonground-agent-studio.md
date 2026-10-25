# Friend Studio — hackathon prototype

The current user direction supersedes the earlier full-platform plan. Keep the Studio inside **Create an AI friend** at `/chat/ai/create`, independent of chats. Reuse the existing Supabase/Gemini chat engine; do not add publishing, version/deployment management, or a general-purpose tool runner for this prototype.

Visual baseline: the pulled `bc6783e` builder in `chat.css` and `AgentPreview`. Keep its compact header, library/form/preview columns, numbered sections, teal/white colors, typography, and neutral dark-mode rules. New Studio views extend those components; do not introduce another visual identity.

## Implemented experience

- A personal friend library, six editable templates, and a live profile preview.
- Nine selectable behavior/expertise skills; web search and scraping visibly unavailable.
- Profiles from Studio or chat, creator-only originals, optional template copying, and optional group-member customization.
- Add one library original to multiple groups, each with its own configuration copy.
- Private chats with one or up to five AI friends. One-to-one chats route without mentions; multi-agent chats route by name.

## Data and privacy

Migration 004 extends `agents`. A library original has an owner and no `room_id`; a group copy has `room_id` and `source_id`. Built-ins have no owner. RLS distinguishes these cases; a null room does not make a personal original public. Existing Phase 3 friends retain their IDs/history and gain library originals.

Database RPCs check identity, membership, ownership, allowed skills, and sharing permissions. Group edits do not change originals or other group copies. Permission changes propagate to existing copies; subsequent copying/editing rechecks them. Forking creates an independent owned friend with no conversation data.

Inference receives only the current room's recent messages and room-scoped follow-up context. Skills add explicit behavior guidance, not tools or external access. There is no persistent memory shared between groups.

## Demo path

Choose a template → change personality/skills → save → open profile → add to two groups → customize one group's version → verify the original and other group remain unchanged. Toggle template permission and copy the group profile as another member. Select one or several library friends and start a private chat.

## Rollout

Run migration 004 after 001–003, rebuild the app, and verify the demo path on Supabase/Gemini. No new environment settings. Local database/security tests and browser editor checks pass; live migration/save/chat remain deployment checks. This is a prototype, not a published agent marketplace or full agent platform.

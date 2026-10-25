# AI Friends

Phases 1–2: Next.js + Supabase Auth/Postgres/Realtime + server-side Gemini, conversational routing, and activity estimates. Requires Node 22+ (Node 24 recommended).

## Run

1. `npm ci`
2. Copy `.env.example` to `.env.local` and fill in all values. Only the two `NEXT_PUBLIC_*` values are public. Never expose the service-role or Gemini key.
3. In Supabase, enable **Authentication → Sign In / Providers → Anonymous Sign-Ins**. Run `supabase/migrations/001_phase1.sql` once in the SQL Editor. The migration enables Realtime for messages and membership.
4. `npm run dev` and open http://localhost:3000.
5. Create a group, copy its invite, and open it in another browser/device. Send human messages, then mention `@Paul`, `@Ravi`, or `@Kaira`. The first recognized mention gets one genuine Gemini reply. Use an HTTPS deployment for phones and clipboard support.

`npm test`, `npm run typecheck`, and `npm run build` check the implementation. Tests use embedded PostgreSQL for the actual migration/RLS/RPCs and stub HTTP only for provider contract tests. They do not establish live Supabase Realtime or Gemini availability.

## Deploy on Vultr

Use a Docker-capable VM and a TLS reverse proxy to port 3000. Public Supabase values must be present **at build time** because Next.js includes them in the browser bundle:

```sh
docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=https://YOUR.supabase.co --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY -t ai-friends .
docker run -d --restart unless-stopped --name ai-friends --env-file .env.local -p 127.0.0.1:3000:3000 ai-friends
```

Keep `.env.local` on the server, outside the image. Allow requests at least 60 seconds through the reverse proxy. Set a Gemini project quota/budget before sharing a public demo. Anonymous identities are per browser; clearing browser storage loses that identity, but the invite lets someone rejoin.

## Phase 1 boundaries

Room membership gates reads; invite tokens are separate from room IDs and are shared in URL fragments. Members can share invites. All writes use authorized database functions or the server. Submission IDs deduplicate retries; a database compare-and-set allows only one AI execution. Messages are limited to 30/user/minute, AI requests to 12/room/minute, room creation to 10/user/hour. AI calls remain outside database transactions. See Phase 2 below for the current conversational trigger rules.

Realtime reconnects trigger a fresh read; a 15-second reconciliation poll covers dropped events. History loads 100 messages at a time. Agent failures are persisted; interrupted server executions become visibly stale after 90 seconds. Send a new mention to retry an interrupted AI call; automatic generation retries are intentionally disabled to avoid duplicate charges. Refresh/reconnect never launches inference.

Phase 2 adds routing, optional fallback models, activity/cost estimates and conversational escalation. Images, tools and persistent memory remain deferred. Ravi explicitly has no live web search yet. No AI responses are mocked in the app.

API references: [Gemini generateContent](https://ai.google.dev/api/generate-content), [Supabase anonymous auth](https://supabase.com/docs/guides/auth/auth-anonymous), [Realtime Postgres changes](https://supabase.com/docs/guides/realtime/postgres-changes).

## HTTPS deployment with Compose

On a Docker-enabled Vultr VM, add `APP_DOMAIN=chat.your-domain.com` to `.env.local`, alongside the existing credentials. Point the domain's DNS A record to the VM's public IPv4 address. Allow inbound TCP 80/443 publicly and TCP 22 from your own IP in the Vultr firewall. The application container has no public port; Caddy proxies requests to it and persists certificates in Docker volumes.

```sh
chmod 600 .env.local
docker compose --env-file .env.local config --quiet
docker compose --env-file .env.local up -d --build
docker compose ps
docker compose logs --tail=50 app caddy
```

Use `config --quiet` rather than printing the resolved configuration, which contains secrets. Visit `https://` followed by your configured domain. After changing public Supabase configuration, rebuild with the same `up -d --build` command. Do not use `down -v` during updates, because that removes the persistent certificate volumes. The Compose deployment needs Docker Engine and the Compose plugin; its live validation must be performed on the VM.

## Phase 2: conversational depth and activity

Apply `supabase/migrations/002_conversational_routing.sql` **once, before deploying this version**. It is additive and preserves existing chat history. No need to rerun migration 001. Update the server environment using the Phase 2 entries in `.env.example`, then rebuild the app container.

Friends respond to explicit mentions and direct address (for example, `Ravi, can you compare these?`). A direct name that matches a human participant is left for the human; use `@Ravi` to disambiguate. A short unnamed follow-up is accepted only immediately after the same user's AI exchange, within ten minutes. Intervening human messages keep the AI quiet. A named friend asks for clarification when a follow-up lacks an identifiable earlier reply. These are deterministic English-language heuristics, not a general conversation-understanding classifier.

Requests such as `Ravi, dig deeper into that` or `Paul, that's too generic` reuse the earlier answer and original question, select a stronger configured tier when available, and produce a new message. No escalation button or model details appear in chat. Original replies stay intact. Highest-tier or single-model setups can refine an answer without claiming an upgrade.

Model defaults are Gemini 3.5 Flash-Lite (low), 3.8 Flash (medium), and 4 Argon (high). Configure accessible model IDs per project; set a tier to `disabled` if unavailable. Argon requires paid-tier access. A single optional `GEMINI_FALLBACK_MODEL` must match a registered model; fallback only occurs on definite 404/429/503 rejections. Network timeouts never auto-retry because usage may already have been incurred. See https://ai.google.dev/gemini-api/docs/models and https://ai.google.dev/gemini-api/docs/pricing for current model access and rates.

The activity drawer shows the latest 100 attempts, grouped request count, model/agent/complexity distribution, latency, and estimated costs. Price variables are USD per million tokens and are unset by default. Prices are snapshotted per attempt. Output usage includes reported thinking tokens. Estimates use standard text-token rates; they are not billing statements and do not apply caching discounts. Unknown usage (including failed/timeout attempts) remains unknown, not zero. Known-cost subtotals are labeled; aggregate savings are hidden when any attempt in the window lacks comparable usage/pricing. Baseline applies the same tokens to the configured reference model (highest configured tier by default); it is a pricing comparison, not a quality-equivalent benchmark. No paid classification or tools are used in Phase 2.

The server persists routing with the original human request and claims the AI reply atomically. Retries reuse the saved routing. Each inference attempt is logged before the provider call; usage and the final visible reply are saved in one database transaction afterward. Interrupted workers remain visibly interrupted/unknown rather than being silently re-executed.


## Create an AI friend — prototype Studio

Apply migrations 001–004 in order. For an existing Phase 3 installation, run **only** `supabase/migrations/004_friend_library.sql`, once, before deploying this build. It preserves old room friends/messages and creates library originals for their owners. No new environment variables or external services are required. Deploy migration and app together: old editor RPCs are intentionally disabled to enforce the new permissions.

Open **Create an AI friend** in the profile menu, or `/chat/ai/create`, without joining a chat. Pick one of six templates or start blank. Nine selectable skills guide real Gemini replies; code review/data analysis work on text pasted into chat, not code execution. Web search and scraping are visibly unconnected. Model routing stays automatic.

Your library originals are owner-only. Add an original to multiple groups; each receives its own configuration copy and chat context. Editing an original does not overwrite existing group configurations. Creators can enable group-member customization and template copying; those permissions apply immediately to their existing group copies. Group edits stay in that group. Authorized template copies become independent originals owned by the copier, without messages or memory. Revocation prevents future copying; already-created copies remain independent.

Open profiles through library cards, chat participant names, or AI message names. Select one to five friends in the library to start a private chat; no human invitations are allowed. One-to-one replies need no mention. In a multi-agent chat, address the friend you want to hear from. Agents do not autonomously talk to each other.

Privacy uses room-filtered message context, not a cross-chat memory store. Ownership uses the existing anonymous Supabase identity; clearing that browser's storage loses access to creator controls. Limits: 50 library friends/user, 10 active custom friends/group, six skills/friend, and the existing message/inference limits.

Validation: 22 automated tests, including migration preservation, RLS, ownership, permission revocation, group-only edits, template forks, private rooms, routing, and isolated model context. TypeScript and production build pass. Browser checked template prefilling, skill selection/limits and previews. Live save/add/chat still needs migration 004 in Supabase. Phase 2 timeout behavior is unchanged.

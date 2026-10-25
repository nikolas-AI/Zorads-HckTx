# AI Friends

Phase 1: Next.js + Supabase Auth/Postgres/Realtime + server-side Gemini. Requires Node 22+ (Node 24 recommended).

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

Room membership gates reads; invite tokens are separate from room IDs and are shared in URL fragments. Members can share invites. All writes use authorized database functions or the server. Submission IDs deduplicate retries; a database compare-and-set allows only one AI execution. Messages are limited to 30/user/minute, AI requests to 12/room/minute, room creation to 10/user/hour. AI calls remain outside database transactions.

Realtime reconnects trigger a fresh read; a 15-second reconciliation poll covers dropped events. History loads 100 messages at a time. Agent failures are persisted; interrupted server executions become visibly stale after 90 seconds. Send a new mention to retry an interrupted AI call; automatic generation retries are intentionally disabled to avoid duplicate charges. Refresh/reconnect never launches inference.

Advanced routing, fallback models, costs, Think Harder, images, tools, custom agents and persistent memory are deferred until the live two-device Phase 1 check passes. Ravi explicitly has no live web search yet. No AI responses are mocked in the app.

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

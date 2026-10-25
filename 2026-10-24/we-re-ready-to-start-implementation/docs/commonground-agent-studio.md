# CommonGround Agent Studio

## Product goal

Build a no-code platform behind agents for the NMC2 HackTX challenge: configure once, test, publish an immutable version, deploy it repeatedly, and inspect every execution. Model calls and tools must run through one shared execution engine. Keep the existing group-chat application working while building the independent Studio at `/studio`.

## Existing foundation

- Next.js, React, TypeScript and Supabase authentication/Postgres.
- Real server-side Gemini requests, routing, retries and attempt monitoring.
- Group-scoped custom friends with ownership and edit/remove controls.
- Current limitations: friend definitions depend on a room, model routing is automatic, and there is no general-purpose tool execution, independent version library or deployment lifecycle.

The existing friend editor is an integration destination, not the platform's agent definition model. Keep new platform tables separate from the existing `agents` table until a deliberate adapter is implemented.

## User experience

Use the current DM Sans typography and restrained teal/white palette, with neutral black dark mode. A compact sidebar contains Agents, Templates, Deployments and Runs. Each screen has one clear title and primary action.

| Screen | Purpose |
| --- | --- |
| `/studio` | Agent library with draft/published state and create action |
| `/studio/agents/new` | Start from scratch or choose a template |
| `/studio/agents/[id]` | Configure identity, instructions, model, tool permissions and memory |
| `/studio/agents/[id]/test` | Playground with conversation, response, tool events and errors |
| `/studio/templates` | Browse reusable configuration templates |
| `/studio/deployments` | Create, enable or disable a deployment pinned to a published version |
| `/studio/runs` | Execution history with status, latency, model and tool usage |
| `/studio/runs/[id]` | Ordered execution events, inputs, outputs and failures |

Keep operational details in the playground trace and monitoring screens rather than ordinary end-user conversations. Show unconfigured integrations as unavailable rather than fabricating results.

## Module responsibilities

- **Configuration schemas:** shared validation for builder, API, versions and templates.
- **Agent repository:** owner-authorized reads and transactional configuration writes.
- **Provider registry:** model capabilities and available adapters, configured server-side.
- **Tool registry:** tool schemas, permission requirements and bounded execution handlers.
- **Execution engine:** load configuration, enforce permissions, run bounded model/tool loop and persist events.
- **Memory repository:** user-approved, tenant-scoped memory writes and retrieval.
- **Deployment service:** pin published versions, enforce enabled state and authorize invocation.
- **Monitoring repository:** authorized run/event queries and aggregation.
- **UI components/hooks:** forms and presentation; no secret handling or provider logic.

Use small interfaces for model providers, tools and repositories. Avoid one class per field or generic abstractions without multiple implementations.

## Database model

All new application tables require ownership-aware RLS and explicit grants. Use `studio_` prefixes to avoid collisions with existing tables.

| Table | Main fields and constraints |
| --- | --- |
| `studio_agents` | id, owner_id, name, description, role, current_draft, draft_revision, timestamps; owner-only writes |
| `studio_versions` | id, agent_id, version_number, validated config JSON, config_schema_version, created_at; immutable, unique agent/version |
| `studio_templates` | id, owner_id, name, description, validated config JSON; private by default; curated templates separately readable |
| `studio_deployments` | id, owner_id, version_id, name, environment, enabled; published version required |
| `studio_runs` | id, owner_id, agent_id, version_id or draft snapshot, deployment_id, idempotency_key, status, timestamps, model, latency, error; unique owner/idempotency key |
| `studio_run_events` | id, run_id, sequence, type, safe payload, timestamp; unique run/sequence |
| `studio_memories` | id, owner_id, agent_id, content, consent/provenance, timestamps; no cross-owner retrieval |

Use optimistic concurrency for draft updates, transactional version numbering, and immutable run configuration snapshots. Disabling a deployment prevents new runs; it does not claim to cancel an in-flight provider request.

## API contracts

Authenticated server routes verify bearer tokens and scope every resource lookup to the caller. Never accept an owner ID as authorization. Anonymous browser identities may support a local demo, but durable accounts are needed for reliable long-term ownership.

- `GET/POST /api/studio/agents`: list/create owned agents.
- `GET/PATCH /api/studio/agents/:id`: inspect/update a draft with expected revision.
- `POST /api/studio/agents/:id/publish`: validate and snapshot a published version.
- `GET/POST /api/studio/templates`: list/save reusable configurations.
- `POST /api/studio/templates/:id/instantiate`: create an independent draft copy.
- `POST /api/studio/agents/:id/test`: execute a draft snapshot with an idempotency key.
- `GET/POST/PATCH /api/studio/deployments`: manage owner-authorized deployments.
- `POST /api/studio/deployments/:id/invoke`: execute the pinned version through the same engine.
- `GET /api/studio/runs` and `GET /api/studio/runs/:id`: inspect authorized runs/events.

A connected application needs a scoped, revocable credential or user authorization. Store only hashes of issued deployment credentials and never expose service-role credentials to clients.

## Runtime lifecycle

1. Authenticate and authorize the agent/deployment.
2. Validate input and claim an idempotent run.
3. Snapshot the exact draft or published configuration.
4. Resolve an installed, configured model adapter.
5. Expose only the configured allowlisted tools to that model.
6. Validate each tool call's arguments and recheck runtime permissions.
7. Enforce iteration, timeout, output-size and request budgets.
8. Persist ordered model/tool events and the final result or failure.
9. Report interrupted work honestly; never silently repeat an uncertain charged call.

The playground and deployment invocation must call this same engine. Do not build separate inference flows for individual templates.

## Providers and tools

**First provider:** adapt the existing Gemini implementation to a structured provider interface that can return text and tool calls. Keep the current social-chat provider behavior behind its existing interface while introducing this adapter.

**Snowflake:** implement only after the actual account endpoint, available models and authentication method are established. Model availability must come from configured capabilities, not invented options.

**Web search:** SerpApi runs server-side using a server-only key. Return bounded structured results with source URLs. Search content is untrusted data, not new instructions.

**Memory:** start with explicit approval and scoped text retrieval. Separate read and write permissions; disabling memory means the runtime does not access it. No automatic capture of the entire conversation.

**Tool definition contract:** stable ID, display name, argument schema, permission requirements, timeout, output-size limit and execute handler. No arbitrary code execution or arbitrary user-supplied URLs in the initial registry.

## Delivery sequence and acceptance checks

1. **Independent builder:** migration, shared schemas, authenticated CRUD, library and editor. Verify ownership isolation, field limits and draft concurrency.
2. **Shared runtime and playground:** genuine Gemini calls, bounded execution, persistent run events and surfaced errors. Test with a live configured provider before describing it as end-to-end verified.
3. **Tool registry:** SerpApi search and consented memory retrieval with granular permissions. Test denied tools, invalid arguments, timeouts and output limits.
4. **Templates and publishing:** independent copies, immutable versions and repeatable version pinning. Test edits cannot change published configurations.
5. **Deployments:** enabled/disabled state, same engine as playground, and authenticated invocation. Verify disabled deployments reject new requests.
6. **Monitoring:** run list/detail, failure reasons, latency, provider model and tool events. Distinguish unavailable usage from zero usage.

For the hackathon, complete the builder → real test → publish → deploy → inspect run path before expanding provider or tool coverage. Do not present local-only drafts, simulated responses, or placeholder deployment controls as functioning backend capabilities.

## Configuration and current boundary

Reuse server-side Supabase and Gemini credentials without printing secrets. Add SerpApi and any Snowflake credentials only when their adapters are implemented. `.env.local` stays ignored by Git. Database migrations and live integration setup require separate verification.

This file is an architecture and implementation plan. It does not claim that the standalone Studio, registry, versions or deployments are implemented yet.

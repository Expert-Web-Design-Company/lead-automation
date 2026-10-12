# Lead Automation Platform (Zapier alternative) — project brief

This file briefs Claude Code on OUR project. It lives in `.claude/CLAUDE.md` so it never
conflicts with upstream's root `CLAUDE.md` (Activepieces engineering rules), which Claude
Code also loads. Follow both; where they disagree on our own pieces/features, this file wins.
Owner: TCC Mobile / ABIC USA (noman.chagani@tccmobile.com). Plan date: 12 Oct 2026.

---

## 1. What we are building

A Zapier-style automation tool, focused first on **lead capture**:
ad platforms and forms (Facebook/Instagram, Google Ads, LinkedIn, TikTok, website forms)
→ our platform → **our own CRM**, in seconds, with no lost and no duplicate leads.

The UI must feel like Zapier so non-technical marketers can use it without training:
one **Trigger** step, then **Action** steps, each step with Setup → Configure → Test, then Publish.

## 2. Key decision: fork Activepieces, don't build the engine

- This repo (`Expert-Web-Design-Company/lead-automation`, public) is a GitHub **fork of
  Activepieces** (https://github.com/activepieces/activepieces).
- **Baseline:** upstream v0.92.2, commit `4705ebaf` (12 Oct 2026). Merge upstream monthly:
  `git remote add upstream https://github.com/activepieces/activepieces && git fetch upstream && git merge upstream/main`.
- **Licence:** everything is MIT **except** `packages/ee/` **and** `packages/server/api/src/app/ee/`,
  which are under a commercial licence (`packages/ee/LICENSE`). Do not copy, modify or rely on
  `ee` code unless we buy a licence. Keep all MIT notices.
- `ee` contains: platform, projects, alerts, audit-logs, oauth-apps, global-connections,
  api-keys, scim, secret-managers, signing-key, managed-authn, custom domains. So
  **multi-workspace, custom branding and built-in failure alerts are paid features** — we
  build our own lead-failure alerts (section 5) and must settle licensing before weeks 3–5.
- Activepieces already gives us (MIT): no-code builder, connections/OAuth, webhook triggers,
  queue + auto-retries, versioned flows, run history, Docker self-hosting, 400+ pieces
  (incl. `facebook-leads`, HubSpot, Salesforce, Slack, Webhook).
- **We only build:** our pieces (section 4), a Lead inbox screen, branding, and hardening.
- n8n was rejected: its Sustainable Use License forbids offering it to customers.
- Keep our changes small and isolated (prefer new pieces/packages over editing core files)
  so upstream merges stay easy. Never edit upstream's root `CLAUDE.md` / `AGENTS.md`.
- Fallback if the fork fails the licence/fit check: custom build (Next.js + NestJS +
  PostgreSQL + Redis/BullMQ), ~7 weeks. Do not start this unless told to.

## 3. Local development

- Node.js 22.15+ (or 24), npm 9+. Upstream also installs Bun via `npm run dev`.
- `npm start` (runs `node tools/setup-dev.js` then `npm run dev`) → http://localhost:4200
  (dev login password `12345678`; email is in the Activepieces dev-setup docs).
- Load only the pieces you are working on: `AP_DEV_PIECES=our-crm,google-ads-leads npm start`
- Scaffolding (verified in `package.json`): `npm run create-piece`, `npm run create-action`,
  `npm run create-trigger` (aliases for `npm run cli pieces|actions|triggers create`).
- Before touching server code, read the matching `brain/<area>/` page and `.claude/rules/`
  (entity registration, tenant isolation, edition safety, `safeHttp` for outbound HTTP).
- Production/staging: Docker Compose (`sh tools/deploy.sh`, then
  `docker compose -p activepieces up -d`). Back up `.env` (holds AP_ENCRYPTION_KEY).
  Server minimum 2 vCPU / 4 GB; HTTPS is mandatory (Google and Meta only post to HTTPS).
  If our CRM is on a private network, allow it via `AP_SSRF_ALLOW_LIST`.

## 4. Pieces we build (Phase 1)

All our pieces live in `packages/pieces/custom/` (upstream's folder for private pieces),
written in TypeScript with `@activepieces/pieces-framework`. Pieces must never import
`@activepieces/shared`.

### 4.1 `our-crm` — ACTION "Create or update lead"  (build FIRST)
- Calls our CRM API. Auth: server-side API key (Bearer). Never expose keys to the browser.
- Idempotent upsert keyed on `tenant:source:external_lead_id` (send as Idempotency-Key
  or the CRM's unique-key field). A retry must NEVER create a second CRM lead.
- Load the CRM's field list dynamically for the mapping UI; mark required fields.
- Return CRM record id + status. Treat 400/409/422 as permanent (no retry, surface the
  message); 429/5xx/timeouts as retryable.
- Proposed CRM endpoint (CONFIRM with CRM team, do not assume it exists):
  `POST /api/v1/leads/upsert` → 200/201 with CRM lead id.
- OPEN: CRM API docs + sandbox key are needed. Until then build against a mock CRM
  (base URL is configurable) and say so clearly in the PR.

### 4.2 `google-ads-leads` — TRIGGER "New lead" (webhook, instant) — not in upstream, new piece
Source: https://developers.google.com/google-ads/webhook/docs/implementation
- Google POSTs JSON to our webhook URL; user pastes URL + key into the Google Ads lead form.
- Payload: `lead_id`, `user_column_data[]` (`column_id`, `string_value`), `form_id`,
  `campaign_id`, `adgroup_id`, `creative_id`, `gcl_id`, `google_key`, `is_test`,
  `lead_submit_time`, … Ignore unknown fields (Google adds new ones).
- Verify `google_key` matches the configured key, else reject (4xx).
- Respond **200 with empty JSON `{}`** on success; 4xx = not retried by Google; 5xx = retried.
- Not exactly-once: dedupe on `lead_id`. Flag `is_test` (configurable: skip or pass).
  Trigger-level dedupe (piece store) is best-effort; the hard guarantee is the CRM upsert.
- Normalise `column_id` → friendly names (FULL_NAME, EMAIL, PHONE_NUMBER, …).
- Test with Google's "Send test data" button; HTTP 200 alone does not prove CRM delivery.

### 4.3 Facebook / Instagram Instant Forms — use existing `facebook-leads` piece
Sources: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving
         https://developers.facebook.com/docs/marketing-api/guides/lead-ads/
- Upstream piece is **webhook-based** (`TriggerStrategy.APP_WEBHOOK`), so self-hosting needs
  OUR Meta app (app id/secret + app webhook configured on the server).
- Webhook `leadgen` field gives ids only (`leadgen_id`, `page_id`, `form_id`, `ad_id`,
  `created_time`); fetch fields via Graph API with a long-lived Page token.
- Permissions: `leads_retrieval`, `pages_manage_ads` (+ App Review, then Business
  Verification). Development mode: only users with an app role can read leads.
- Dedupe on `leadgen_id`. Backfill/poll: `GET /<FORM_ID>/leads` with `time_created` filter.
- Check whether the existing piece dedupes/backfills; add it (in our own piece if possible).

### 4.4 `linkedin-lead-gen` — TRIGGER "New lead" (Sprint 2)
Source: https://learn.microsoft.com/en-us/linkedin/marketing/lead-sync/leadsync
- Needs the separate **Lead Sync API** program, scope `r_marketing_leadgen_automation`.
- Subscribe via `POST /rest/leadNotifications` (owner = sponsoredAccount or organization,
  `leadType` SPONSORED/EVENT/COMPANY…). Then fetch `GET /rest/leadFormResponses/{id}`.
- Webhook must pass HMAC-SHA256 validation challenge (enforced since 16 Mar 2026,
  re-checked ~every 2 h) — never rate-limit or block this endpoint.
- Dedupe key: `${leadGenFormResponse}_${occurredAt}` (URN repeats on re-submit).
- API version `202510` sunsets **15 Oct 2026** — use the newest supported `LinkedIn-Version`
  from the start. Test leads: `testLead: true`.

### 4.5 `tiktok-leads` — TRIGGER "New lead" (Sprint 2) — not in upstream, new piece
- TikTok API for Business. Exact lead webhook/endpoint and scopes NOT yet verified —
  check the TikTok developer portal docs before coding; ask the user if blocked.

### 4.6 Already available — just configure/test
Webhook (website forms, generic), Slack / email alerts, HubSpot, Salesforce, Google Sheets.

## 5. Lead inbox screen (our addition to the UI)
One list of every lead across all sources: time, source, campaign/form, name, email, phone,
status (received → delivered / failed), CRM record id, raw payload (PII masked),
delivery attempts, **Resend** button (role-restricted). Filter by source, status, date.
Plus failure alerts (Slack/email) — upstream's alerts module is `ee`, so build our own.
This needs core changes (new entity, API module, web route): keep them in their own
`lead-inbox` module, register the entity in `getEntities()`, filter every query by
`projectId`/`platformId`, and never import from `ee`.

## 6. Field mapping rules
| Source field | CRM field | Rule |
|---|---|---|
| Full name / first+last | full_name | trim; concatenate when split |
| Email | email | lower-case, trim |
| Phone | phone | E.164 when valid; keep raw if unsure |
| Company / clinic | company | pass through |
| Custom question | per-form mapping | by question id |
| Lead id | external_lead_id | immutable dedupe key |
| Platform, campaign, form, ad ids | source, campaign_id, form_id, ad_id | metadata |
| Constant (e.g. channel = Paid Social) | lead_channel | static value |
Auto-suggest matches (email→email, phone_number→phone). Keep unknown source fields for debugging.

## 7. Non-negotiable quality rules
1. **No lost leads:** persist the raw inbound event before replying 200 (verify how the
   upstream webhook handler queues events; don't assume).
2. **No duplicates:** unique key (tenant, source, external_lead_id); idempotent CRM upsert.
3. Retry 429/5xx/timeouts with exponential backoff + jitter + cap; never auto-retry
   permanent auth/validation errors — send to manual review and alert.
4. Encrypt tokens/secrets at rest; mask PII and secrets in logs; tenant isolation on every query.
5. Verify every webhook (Google key, Meta signature, LinkedIn HMAC, shared secret for forms).
6. User-facing errors in plain language ("Facebook access expired for Page X — Reconnect").
7. Every piece ships with tests using recorded real payloads (fixtures in the piece's `test/`).
8. Small, reviewable commits; one feature per branch; never commit secrets or `.env`.

KPIs: 0 lost leads, 0 duplicate CRM records, ad-submit→CRM p95 < 30 s, webhook ack p95 < 1 s,
delivery success after retries ≥ 99.9%, marketer builds a flow in < 5 min.

## 8. Timeline (fast track, started Mon 12 Oct 2026)
| Day / week | Date | Deliverable |
|---|---|---|
| Day 0 | Mon 12 Oct | Meta/LinkedIn/TikTok applications filed; fork running locally + staging |
| Days 1–2 | 13–14 Oct | `our-crm` + `google-ads-leads` pieces; Facebook piece on our Meta app (dev mode); Checkpoint A: test leads reach CRM, no duplicates |
| Days 3–4 | 15–16 Oct | Lead inbox, failure alerts, hardening (load test 50 leads/s, worker-kill test, backup/restore) |
| Day 5 | Mon 19 Oct | **Go-live:** Google Ads + web forms in production; Facebook when Meta approves |
| Week 2 | 19–23 Oct | LinkedIn + TikTok pieces; HubSpot/Salesforce/Slack/Sheets; branches & filters |
| Weeks 3–5 | to Fri 13 Nov | Self-serve signup, multi-workspace, Stripe billing, AI steps (lead scoring, auto-reply) — **blocked on ee licence decision** |
Bridge until platform approvals land: Zapier/Make → our generic webhook trigger.
Deferred: public marketplace, third-party developer SDK.

## 9. Open questions (ask the user, don't guess)
- CRM API docs, sandbox key, upsert/unique-key behaviour, required fields.
- Activepieces licence: we need multi-workspace, branding (and possibly alerts) — all `ee`.
  Buy a licence, or build MIT equivalents ourselves?
- TikTok lead API details and scopes.
- Production hosting provider and domain (e.g. leads.tccmobile.com).

## 10. How to work with me (Claude Code)
- Before coding a feature, state a short plan and the files you will touch.
- Work in this order: our-crm → google-ads-leads → facebook config → lead inbox → hardening
  → linkedin → tiktok.
- After each feature: run lint + tests, show how to test it manually, then commit.
- If something in this file is wrong or outdated, tell the user and propose an edit.

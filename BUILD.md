# VERIQ — BUILD PLAN

Companion to [`VERIQ.md`](./VERIQ.md). That file is the product bible. This file is the order we actually build, what is already running, and what we refuse to build yet.

> Start with the product spine. Do not implement all 77 spec sections.

---

## 1. Current status

| Layer | Status |
|---|---|
| Master spec | [`VERIQ.md`](./VERIQ.md) |
| Production app | [veriq-peach.vercel.app](https://veriq-peach.vercel.app) |
| GitHub | [essendisidney/veriq](https://github.com/essendisidney/veriq) |
| Supabase | project `veriq` (`ursapqvpokkcllupyvto`, eu-west-2) |
| MVP spine | **Shipped** on `main` |
| Phase 2–4 surfaces | **In the working tree**, production build succeeds, not all committed |

The live MVP already answers:

> Connect a company → scan website + public GitHub → produce evidence → score → recommend actions → rescan.

Uncommitted local work extends that spine with the **Truth Layer**: five evidence states, a claim ledger, evidence score vs risk score, decision confidence, Challenge mode, and industry risk packs. VERIQ does not scrape government registries or compete as another KYB database.

Do not start a fifth platform until this expansion is committed, deployed, and used on real Kenyan companies.

---

## 2. Product spine (done — do not rebuild)

```
CREATE ACCOUNT
        ↓
CREATE COMPANY
  name / website / country / industry / GitHub login
        ↓
SCAN
  website + public GitHub + DNS/TLS exposure
        ↓
EVIDENCE
        ↓
RISK ENGINE
        ↓
VERIQ SCORE
        ↓
RECOMMENDATIONS
        ↓
RESCAN → WHAT CHANGED? → SCORE MOVEMENT
```

This is the demo path. Every later feature must feed this path, not replace it.

---

## 3. Build order (spec §78)

Add capabilities in this order. Do not skip ahead to a giant GRC platform.

| Step | Capability | Spec | Code today |
|---|---|---|---|
| 0 | Auth, org, RBAC, RLS | §41–44 | Shipped |
| 1 | Company model | §8–9 | Shipped |
| 2 | Website + GitHub scan | §10–11 | Shipped (public GitHub only) |
| 3 | Evidence-first findings | §12, 24, 28 | Shipped |
| 4 | VERIQ Score | §23 | Shipped |
| 5 | Executive radar | §26, 53–54 | Shipped |
| 6 | Internet exposure | §13 | Working tree (`src/lib/scan/exposure.ts`) |
| 7 | Kenya regulatory map | §14–15, 61.8 | Working tree (`src/lib/regulations/`) |
| 8 | Vendors | §17 | Working tree (`src/lib/vendors/`) |
| 9 | Risk Graph | §21–22 | Working tree (`src/lib/graph/`) |
| 10 | Scenario simulation | §30–31 | Working tree (`src/lib/scenarios/`) |
| 11 | Financial signals | §19 | Working tree (`src/lib/finance/`) — attested, not accounting |
| 12 | AI governance | §18 | Working tree (`src/lib/ai/`) |
| 13 | External world | §20 | Working tree (`src/lib/world/`) |
| 14 | Board / diligence / credit reports | §32–34, 60 | Working tree (`src/lib/reports/`) |
| 15 | VERIQ API | §35, 66 | Working tree + remote migration `veriq_api` |
| 16 | GitHub OAuth (read-only, private repos) | §11, 43 | **Not started** |
| 17 | Cloud account integrations | §64 | **Not started** |
| 18 | LLM reasoning agents | §36–39 | **Not started** — engines are deterministic heuristics |
| 19 | GitLab / Bitbucket / Jira / Slack | §29, 64 | Webhooks only |
| 20 | Name clearance (trademark / domain) | Brand caveat | **Not started — blocking for legal entity** |

---

## 4. What this product is not

Do not position or build VERIQ as:

- A compliance checkbox tool
- A vulnerability scanner
- A GRC system
- An audit management system
- A cybersecurity dashboard
- A lawyer, auditor, regulator, accountant, or certifier (§40)

The question VERIQ answers:

> What could materially hurt this company, why, what evidence proves it, and what should we do next?

---

## 5. Stack (locked for MVP)

| Layer | Choice |
|---|---|
| App | Next.js (App Router) + TypeScript |
| Hosting | Vercel |
| UI | Tailwind CSS |
| Data / Auth / RLS | Supabase (Postgres) |
| Scan runtime | Next.js server actions (no background workers yet) |
| Graph | Computed JSON in `scans.summary`, not Neo4j |
| AI (later) | Specialised agents behind an orchestrator — not a chatbot bolted onto the dashboard |

Dedicated backend services only when a scan, graph, or API path outgrows Edge/server actions.

---

## 6. Tenant model

```
Platform
 └── Organisation
      └── Workspace (the company model)
           ├── Users / memberships
           ├── Assets (vendors, AI systems, finance attestations, API keys, monitoring)
           ├── Domains
           ├── Repositories
           ├── Scans + snapshots
           ├── Risks + evidence + actions
           ├── Scores
           └── Reports
```

MVP roles (subset of spec §42):

- `org_admin`
- `risk_manager`
- `executive`
- `viewer`

Granular roles (security, compliance, legal, board, finance) come after the first paying customers, not before.

---

## 7. Scan contract

Every scan produces a snapshot. Snapshot N is compared to snapshot N−1.

Scan types: `initial` | `daily` | `weekly` | `event` | `on_demand`

Today, scheduled cadence is **session-gated**. VERIQ does not scan in the background. A due scan waits until an authenticated user opens the workspace and runs it. That is intentional until a worker exists.

A completed scan summary should carry:

```ts
{
  exposure,       // internet posture
  regulatory,     // applicable controls + evidence gaps
  vendors,        // detected + declared third parties
  graph,          // nodes + edges
  finance,        // attested concentration / liquidity signals
  ai,             // discovered + declared AI systems
  world,          // external events that matter to this company
  changes         // diff vs previous snapshot
}
```

Findings are stored as rows (`risks`, `evidence`, `actions`, `scores`). Intelligence that is expensive to rebuild lives on `scans.summary`.

---

## 8. Trust model (non-negotiable)

Every claim is one of:

| Status | Meaning |
|---|---|
| OBSERVED | Directly discovered (header, DNS, file, package) |
| INFERRED | Logical conclusion from multiple observations |
| PREDICTED | Projection (scenario / trend) |
| UNKNOWN | Insufficient evidence |

Never show `Risk = 67` without **why**. Never emit a major recommendation without evidence. Never invent financial impact figures.

---

## 9. Score

Dimensions (weights in `scoreFromRisks`):

| Dimension | Weight |
|---|---|
| Cybersecurity | 20% |
| Regulatory | 14% |
| Technology | 14% |
| Data | 12% |
| Operational | 10% |
| Vendor | 8% |
| Financial | 8% |
| Reputation | 8% |
| AI | 6% |

Priority ≈ impact × likelihood × exposure × confidence, later configurable by industry. MVP uses severity bands: CRITICAL / HIGH / MEDIUM / LOW / INFORMATIONAL.

---

## 10. File map

| Path | Role |
|---|---|
| `src/app/(auth)` | Login / signup |
| `src/app/(app)/onboarding` | Create company model |
| `src/app/(app)/dashboard` | Radar — what can hurt us |
| `src/app/(app)/findings` | Evidence-backed risks |
| `src/app/(app)/actions` | What should we do |
| `src/app/(app)/technology` | Exposure + stack |
| `src/app/(app)/repositories` | Code intelligence |
| `src/app/(app)/regulations` | VERIQ Reg |
| `src/app/(app)/vendors` | Third-party risk |
| `src/app/(app)/graph` | Risk Graph |
| `src/app/(app)/scenarios` | VERIQ Sim |
| `src/app/(app)/finance` | Financial signals |
| `src/app/(app)/ai` | AI governance |
| `src/app/(app)/world` | External intelligence |
| `src/app/(app)/changes` | What changed |
| `src/app/(app)/reports` | Board / diligence / credit |
| `src/app/(app)/developers` | API keys |
| `src/app/(app)/integrations` | Webhooks + scan cadence |
| `src/app/api/v1` | VERIQ API |
| `src/lib/scan/engine.ts` | Website + GitHub + risk builder |
| `src/lib/actions/scan.ts` | Orchestrates one scan |
| `supabase/migrations` | Schema + RLS + API RPC |

---

## 11. Schema (MVP tables)

Already in `20260813000000_veriq_mvp`:

`profiles` `organizations` `memberships` `assets` `domains` `repositories` `scans` `risks` `evidence` `actions` `scores` `regulations` `organization_regulations`

API keys live as `assets` with `type = api_key` (hashed). Do not store raw secrets. GitHub access is a public login string today — OAuth tokens, when added, must be short-lived, scoped, and read-only (§43).

---

## 12. VERIQ API (phase 4, already sketched)

```http
GET /api/v1/company/{id}/risk
Authorization: Bearer vq_live_…
```

Returns score dimensions, scanned_at, company identity, and a disclaimer. Banks, insurers, investors, procurement, auditors.

Hardening still required before any external customer uses this:

1. Call the RPC (or tables) with the **service role from the server only**.
2. Revoke `EXECUTE` on `public.veriq_api_risk` from `anon` / `authenticated` so PostgREST cannot be used as a back door.
3. Move `SECURITY DEFINER` logic into a private schema ([advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)).
4. Rate-limit by key.
5. Keep the human-oversight disclaimer on every payload.

Do not ship a public API product until 1–3 are done.

---

## 13. Next sprints

### Sprint 1 — Ship what is already built

- Commit the working-tree expansion as one coherent release.
- Deploy to Vercel.
- Run a scan on 3 real Kenyan companies (fintech, SaaS, NGO).
- Confirm: score, top 10 risks, evidence, actions, rescan delta.

**Done when:** a stranger can sign up, create a company, and get an explainable radar in one sitting.

### Sprint 2 — Make the spine trustworthy

- GitHub OAuth, read-only, no secret storage.
- Distinguish confirmed vs potential vs informational more visibly on finding pages.
- Owner + deadline on every CRITICAL/HIGH action.
- Fix API RPC exposure (service role + revoke anon execute).
- Enable leaked-password protection on Supabase Auth.

**Done when:** a security-conscious founder would connect a real org.

### Sprint 3 — First differentiated features

- Risk Graph as the default explanation of “why this is material.”
- Three canned scenarios that always run: cloud outage, payment rail failure, credential leak.
- Kenya + East Africa regulatory pack only (do not globalise the ontology yet).
- Board PDF that a CEO can forward without editing.

**Done when:** a board pack can be generated from a scan without a consultant.

### Sprint 4 — Distribution

- VERIQ API for one design-partner bank or insurer.
- Due-diligence report for one investor workflow.
- Trademark / domain / company-name clearance for **VERIQ**.

**Done when:** a third party can query a company score with a key, and the name is legally ownable.

---

## 14. Explicitly later

Do not start these until Sprint 3 has paying or design-partner usage:

- AWS / Azure / GCP account linking
- GitLab / Bitbucket
- Jira / Slack ticket creation (webhooks are enough)
- SMS / WhatsApp alerts
- Neo4j or a dedicated graph store
- Full RBAC matrix from spec §42
- Background scan workers / cron
- LLM agents that write findings (heuristics first; agents later must still attach evidence)
- White-label / on-prem
- Replacing accounting systems with finance intelligence

---

## 15. Kenya-first, jurisdiction-abstracted

Phase 1 market is Kenya. The data model must not hardcode Kenya into application logic.

- `organizations.country`
- `regulations.jurisdiction`
- Universal control ontology (`src/lib/regulations/ontology.ts`)
- Jurisdiction maps onto controls, not the other way around

Next countries after Kenya: Uganda, Tanzania, Rwanda — then Nigeria, Ghana, South Africa.

---

## 16. Demo script (always this)

1. Sign up.
2. Create **a Kenyan fintech** with website + GitHub.
3. Wait for the scan.
4. Radar: score, top risks, what changed.
5. Open one CRITICAL finding — show evidence, confidence, recommendation, owner.
6. Risk Graph — show how a vendor or credential connects to production.
7. Scenario: “payment provider unavailable 48 hours.”
8. Board report.
9. (If ready) API `GET /risk` as a bank.

If a feature cannot appear in this script, it is not MVP.

---

## 17. North star test

Ship a change only if it better answers:

> If something went seriously wrong with this company tomorrow, what would most likely cause it, how would it propagate, what would the impact be, and what can we do today to prevent it?

Not:

> Here are 1,482 vulnerabilities.

But:

> These are the five things most likely to materially hurt the business. Here is the evidence. Here is what we recommend. Here is who owns it. Here is what happens if you do nothing.

---

## 18. After this document

| Next | Purpose |
|---|---|
| **Sprint 1 ship** | Commit + deploy the working tree |
| **GTM one-pager** | Who we sell to first in Kenya, price, design partners |
| **Name clearance** | Trademark, domain, company registry |
| **Agent spec** | Only when heuristics are exhausted — Company / Repo / Reg / Risk / Executive agents |

# Denga — Phases 1–2

AI insurance operations platform (formerly "Casefile"). Staff sign in, create a
claim, upload evidence — photos, PDFs, and voicenotes (hashed for integrity,
voicenotes transcribed with an always-visible "unverified" label) — and generate
an underwriter-ready case file with explained, evidence-cited review flags,
PDF export, and a token-gated shareable link.

Live: https://casefile-lemon.vercel.app

## Setup

```bash
npm install
```

Fill in `.env` (already created):

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Neon connection string (neon.tech → your project → Connect). A temporary dev database is currently wired in — it self-deletes within 24h of creation, so swap in Neon before relying on data. |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys (needs a small credit balance). Preferred provider when set. |
| `GEMINI_API_KEY` | aistudio.google.com/apikey (free, no card). Used as fallback when no Anthropic key is set. Note: Google's free tier may use submitted data to improve their models — fine for testing, not for real client claims. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | supabase.com → project → Settings → API. Leave empty to store evidence on local disk (dev only). |
| `AUTH_SECRET` | already generated |

Then:

```bash
npm run db:migrate   # create tables
npm run db:seed      # first tenant + staff login
npm run dev
```

Sign in at http://localhost:3000 with `admin@casefile.local` / `casefile-dev-password`
(change via `SEED_EMAIL` / `SEED_PASSWORD` env vars before seeding, or change it in-app once user management exists).

## What's where

- **Case-file schema (edit to match your broker's fields):** [src/config/caseFileSchema.ts](src/config/caseFileSchema.ts) — the system prompt derives from it ([src/lib/systemPrompt.ts](src/lib/systemPrompt.ts)); keep [src/lib/types.ts](src/lib/types.ts) and [CaseFileDocument.tsx](src/components/CaseFileDocument.tsx) in sync if you add fields
- **Engine:** [src/app/api/claims/[id]/generate/route.ts](src/app/api/claims/%5Bid%5D/generate/route.ts) — one AI call per claim, evidence cited by id, review flags persisted
- **AI providers:** [src/lib/ai](src/lib/ai) — Anthropic (claude-sonnet-5) preferred, Gemini free-tier fallback, behind one interface; selection is automatic from which API key is set
- **Evidence storage interface:** [src/lib/storage](src/lib/storage) — Supabase adapter + local-disk dev fallback, swappable for S3/R2
- **Auth:** Auth.js v5 (JWT, credentials) in [src/lib/auth.ts](src/lib/auth.ts); every API route re-checks session + tenant server-side
- **Audit log:** [src/lib/audit.ts](src/lib/audit.ts) — append-only entries on every state change
- **Database schema:** [prisma/schema.prisma](prisma/schema.prisma)

## Guardrails baked in (do not remove)

- Review flags are explained and evidence-cited; there is no fraud score and no accept/deny signal anywhere
- Share links are gated by unguessable tokens, never open URLs
- Evidence files are SHA-256 hashed at ingestion with uploader + timestamp recorded
- Money will be Decimal-typed with explicit currency when billing arrives (Phase 6)

## Phases

Phase 1 (this) → 2: voicenotes/STT → 3: clients/assets/policies → 4: client portal
→ 5: quoting/underwriting → 6: billing → 7: multi-tenant admin/reporting → 8: hardening.
Build one phase at a time.

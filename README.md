# VERIQ

**Before you trust a company, VERIQ it.**

Don't just verify the company. Verify the story.

Evidence is the product. AI is the engine.

## VERIQ principle

VERIQ does not tell users what to believe. VERIQ shows them what can be proven.

- Every material conclusion must be traceable to evidence.
- Every inference must be labelled as an inference.
- Every uncertainty must be visible.
- Every contradiction must be surfaced.
- Every finding must be capable of validation.
- Every decision must have an explainable basis.

No evidence = no conclusion.

VERIQ is not a better KYB/KYC database. It does not compete with Moody's, Dun & Bradstreet, ComplyAdvantage or Middesk on “more data + AI + monitoring.” It owns the space between what a company says, what the world says, what the evidence says, what can actually be proven, and what decision that supports.

## Documents

| File | What it is |
|---|---|
| [`VERIQ.md`](./VERIQ.md) | Master product specification — vision, category, engines, architecture |
| [`BUILD.md`](./BUILD.md) | Build plan — spine, order, what is shipped, what is next |

## Stack

- Next.js on Vercel
- Supabase (Postgres, Auth, RLS)
- GitHub

## Local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Required env:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Product spine

Company → Scan → Evidence → Claim ledger → Validation → Trust profile (risk · evidence · decision confidence) → Decision

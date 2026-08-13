# VERIQ

Continuous corporate risk intelligence.

**See the risk before it becomes reality.**

Verify. Understand. Predict.

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

Company → GitHub → Scan → Evidence → Risk engine → VERIQ Score → Recommendations → Rescan

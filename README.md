# VERIQ

Continuous corporate risk intelligence.

**See the risk before it becomes reality.**

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

## MVP spine

Company → GitHub → Scan → Evidence → Risk engine → VERIQ Score → Recommendations → Rescan

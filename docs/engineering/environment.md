# Environment variables & secrets

> Part of [`engineering/`](README.md).

Mirrors Budget Tracker's rule exactly: **no API keys or secrets shipped to
the client.** Since this app is a *hosted website* (not a bundled APK), this
matters even more here — anything in client-side code is visible to anyone
who opens dev tools on the live site.

- `web/.env.example` documents every variable by name with a placeholder,
  committed to the repo. `web/.env.local` (gitignored) holds real values
  locally; the hosting provider's dashboard holds them in production.
- **Client-safe** (Supabase's anon key is designed to be public, gated by
  Row Level Security policies — not a secret in the traditional sense, but
  still only ever read from env, never hardcoded):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- **Never client-side**: any Supabase *service role* key, any future
  AI/API-parsing backend key (if Phase 5+ ever needs one — same rule
  Budget Tracker's `aiExtract.js` follows: a backend endpoint holds the
  real key, the client only ever calls that endpoint).

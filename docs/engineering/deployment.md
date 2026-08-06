# Deployment

> Part of [`engineering/`](README.md).

- **Production**: pushes to `main` auto-deploy via Vercel's GitHub
  integration (connect the repo once during Phase 0 setup).
- **Preview**: every PR gets its own preview URL from Vercel automatically
  — use it to sanity-check a change (does the AR button actually work on a
  real phone?) before merging, not just CI green.
- **Rollback**: Vercel keeps every deployment addressable — redeploy a
  previous one from its dashboard if `main` ships something broken. No
  custom rollback tooling needed at this scale.
- **Model file storage** (Supabase Storage) is separate from code
  deployment — uploading a new model doesn't require a redeploy.

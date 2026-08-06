# Git workflow — branches, commits, pushes, PRs

> Part of [`engineering/`](README.md).

- **Branch naming**: `feature/<short-name>` for new work,
  `fix/<short-name>` for bug fixes, matching whatever the task actually is.
  AI-assisted sessions get an auto-generated branch name from the harness
  (e.g. `claude/...`) — that's fine, it's still one feature/fix per branch,
  same rule.
- **One logical unit of work per commit.** Not "one commit per session" —
  if a session builds the IFC loader *and* the scale-preset selector,
  that's two commits, so history stays legible and revertable
  independently.
- **Commit messages**: imperative mood, explain *why* in the body when the
  *what* isn't obvious from the diff (`git log` in this repo so far is the
  reference style — follow it).
- **Push after every commit** (or every small batch, at most a few commits
  behind) — **do not let uncommitted work sit through something risky.**
  This is a direct lesson from
  [`../history/findings.md`](../history/findings.md): the reason this
  whole roadmap exists is that local, uncommitted AR/camera work was lost
  to a crash before it reached GitHub. Don't repeat that pattern — push
  early, push often.
- **PRs**: opened as draft, one per branch, following the repo's
  `PULL_REQUEST_TEMPLATE` if one exists by the time it's needed. Merge only
  after CI is green (see [`quality-gates.md`](quality-gates.md)). Never
  push straight to `main`.
- **Never force-push `main`**, never `--no-verify`, never skip CI to land
  something faster — if CI is red, fix it or explain why in the PR, don't
  route around it.

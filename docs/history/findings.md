# Notable findings and how they changed the plan

> Part of [`history/`](README.md). Cross-session log — a finding can matter
> beyond the session it happened in, unlike the session-by-session narrative
> in [`sessions/`](sessions/).

## Finding: the reported crash isn't reproducible from this repo (Session 1)

**What was found:** the repository contains no camera or AR code at all —
just the unmodified default Android Studio template. The crash the owner
saw locally cannot be diagnosed from what's on GitHub.

**Why it happened (most likely):** work done through Android Studio's
Gemini assistant locally was run and tested on-device but never committed
or pushed before the crash occurred, so it never made it into version
control.

**Impact on the plan:** rather than chase a bug in code that doesn't exist
here, the task became "build the roadmap for what should exist," starting
clean. This is *why* [Session 1](sessions/2026-08-06-session-01.md)
produced a roadmap instead of a bug fix — not a scope-creep accident, a
direct consequence of this finding.

**Standing lesson for anyone working on this repo:** commit and push local
work *before* testing something risky (like a first camera-permission
flow) on-device, specifically so a crash doesn't take uncommitted work down
with it. Nothing in the current plan depends on Android Studio-only local
state — everything from Phase 0 onward should be built and pushed
incrementally for exactly this reason. See
[`engineering/git-workflow.md`](../engineering/git-workflow.md).

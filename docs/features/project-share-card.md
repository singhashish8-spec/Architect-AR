# Feature: project share card (QR + link + details, copy/share actions)

> Part of [`features/`](README.md). Phase 2. Status: **built, unit-tested,
> and checked visually against a real production build for the upload
> form's new field** — the share card component itself (rendered from
> `ProjectView.tsx`, which needs a real live project) has not been
> visually checked in situ, since this dev environment has no live
> Supabase credentials to load a real project through; it is covered by
> component tests that render its real DOM output and check every
> button/link/text renders correctly.

## Summary

The old "QR code for a printed sheet" panel is now a fuller share card:
the QR code, the project's name and an optional free-text description
(filled in once at upload time), the plain link, and four actions —
copy the link, copy a client-ready block for pasting into an email
(with a real clickable link, not just bare text), a native "Share…"
button that hands off to whatever apps are installed (WhatsApp, Mail,
etc.), and a direct WhatsApp share link, plus the original printable QR
download.

## User story

As an architect, I want to send a client a project link that looks like
something worth opening — with the project name and a short blurb, not
just a bare URL — and I want to get it to them with one tap, whether
that's pasting into an email or sharing straight to WhatsApp.

## Requirements

- A project can optionally have a short free-text description, filled in
  once at upload time (`UploadProject.tsx`'s new "Project details"
  field). Blank is fine — nothing about the card requires it.
- The share panel (`components/ProjectShareCard.tsx`, opened from the
  same corner button `ProjectView.tsx` already had) shows: the QR code,
  project name, description (if given), and the plain link.
- **Copy link** — copies just the URL.
- **Copy for email** — copies a client-ready version of the project
  name/description/link, formatted so pasting into an email client
  (Gmail, Outlook, etc.) keeps the link a real clickable one, not bare
  text the email client has to guess is a URL.
- **Share…** — only shown when the browser supports the Web Share API
  (feature-detected; most mobile browsers do, most desktop browsers
  don't) — hands off to the OS's native share sheet, which lists
  whatever's installed (WhatsApp, Mail, Messages, etc.) without this app
  needing to know about any of them individually.
- **Share via WhatsApp** — a direct `wa.me` link with the project
  details pre-filled, shown unconditionally (unlike the button above,
  this works from any browser, including desktop, since it's just a
  regular link WhatsApp Web/the WhatsApp app both understand).
- **Download QR (SVG, for printing)** — unchanged from before this
  feature.

## Technical approach

**Database**: `projects.description` (nullable `text`), added via
`web/supabase/migrations/006_project_description.sql` — see that file
for the exact SQL to run. The project-creation RPC (`create_project()`
at the time, since renamed to `admin_create_project()` — see
[`full-admin-dashboard.md`](full-admin-dashboard.md)) gained an optional
`p_description` parameter (blank/whitespace-only treated the same as
not given, via `nullif(trim(...), '')`); `get_project()`'s return columns
gained `description`. `schema.sql` updated in lockstep for fresh
installs.

**Copy-for-email as real HTML, not just text**: browsers that support
`navigator.clipboard.write()` with `ClipboardItem` can write more than
one representation of the same clipboard content at once —
`utils/projectShareText.ts`'s `buildShareHtml()` builds a small HTML
fragment (`<p><strong>name</strong></p><p>description</p><p><a
href="...">url</a></p>`) written alongside the plain-text version, so an
email client that accepts rich paste (most do) keeps the link real and
clickable. Falls back to `navigator.clipboard.writeText()` (plain text
only) on a browser without `ClipboardItem` support. The description is
HTML-escaped before being embedded, since it's free text the architect
typed in — not because this app is exposed to it again (it doesn't
render untrusted HTML anywhere), but because an unescaped `<`/`&`/`"` in
a client's blurb would otherwise produce broken/mismatched markup in
whatever the client pastes into.

**Share via Web Share API**: `navigator.share({ title, text, url })`,
feature-detected before the button is ever shown — an unsupported
browser gets no button, not an inert one that does nothing when
clicked. The user simply closing the native share sheet raises an
`AbortError`, caught and ignored rather than shown as a failure.

**Share via WhatsApp**: a plain `https://wa.me/?text=<encoded project
details>` link with no phone number — that's the documented pattern for
"let the user pick who to send this to" rather than a specific contact,
opens WhatsApp (installed app on mobile, WhatsApp Web on desktop) with
the message pre-filled and the contact picker open.

## Open questions

- **Not yet verified against a real live project.** `ProjectView.tsx`
  needs a real Supabase-backed project id to render at all; this dev
  environment has no live credentials. The component itself is covered
  by tests that render its actual DOM output and check the QR code,
  name/description/link text, and every button/link, but a real
  in-browser check (does "Copy for email" actually paste as a live link
  in real Gmail, does "Share via WhatsApp" actually open WhatsApp with
  the text filled in) hasn't happened yet — try it once live.
- `navigator.clipboard.write()` requires a secure context (HTTPS) and,
  in some browsers, a real user gesture directly on the click — should
  be fine here since both copy buttons only ever fire from a real click,
  but worth knowing if a copy ever silently fails in a context this
  wasn't tested in.

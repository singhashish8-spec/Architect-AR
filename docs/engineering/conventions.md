# Coding conventions

> Part of [`engineering/`](README.md).

- **Components**: `PascalCase` filenames and export names
  (`ScalePresetSelector.tsx`).
- **Hooks**: `camelCase`, prefixed `use` (`useIfcElementData.ts`).
- **Non-component modules** (services, utils, types): `camelCase`
  filenames (`projectService.ts`), except `types/` files which may be
  named after the domain concept (`Project.ts`).
- **TypeScript**: `strict: true` in `tsconfig.json`, no exceptions. No
  `any` — if a type is genuinely unknown (e.g. raw IFC property values),
  model it as `unknown` and narrow it, don't silence the checker.
- **State management**: React Context + hooks for shared state (current
  project, selected element, active scale preset). No Redux/Zustand/etc.
  unless a real cross-cutting need appears that Context can't handle —
  don't add a state library speculatively.
- **Styling**: co-located CSS Modules (`ComponentName.module.css`) per
  component. No CSS-in-JS runtime library, no global stylesheet sprawl
  beyond a small `index.css` for resets/tokens.
- **Comments**: same policy as this project's docs — write down *why*,
  never *what*. A comment explaining a non-obvious IFC quirk or a Scene
  Viewer platform gotcha is welcome; a comment restating what the next
  line of code does is not.
- **No premature abstraction**: don't build a plugin system, a generic
  "renderer interface," or config-driven anything until a second concrete
  use case actually needs it. Three similar lines beats a speculative
  abstraction — same standard the rest of this project holds to.
- **Error handling**: only at real boundaries — user input, the Supabase
  network calls, IFC/glTF file parsing (files can be malformed). Don't
  wrap internal function calls in try/catch "just in case."

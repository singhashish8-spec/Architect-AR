# Glossary

> Part of [Architect AR docs](README.md). Every domain term used across
> `roadmap/`, `engineering/`, and `features/`, in one place.

- **glTF / GLB** — an open, web-native 3D file format (GLB is the
  single-file binary packaging of glTF). What `<model-viewer>` and
  Three.js/React Three Fiber render.
- **USDZ** — Apple's AR file format; needed for the "View in AR" handoff
  to work on iOS (Quick Look).
- **IFC** (Industry Foundation Classes) — an open BIM data format. Unlike
  glTF, it carries full building-element data: family/type, level,
  materials, dimensions, quantities, classifications. Revit exports to it
  natively.
- **`web-ifc`** — an open-source, WASM-based library that parses IFC files
  directly in a web browser (the engine behind the former IFC.js project,
  now part of That Open Company's `@thatopen/components`).
- **`<model-viewer>`** — a web component from Google, built on Three.js,
  that renders a glTF/GLB model and provides a built-in "View in AR" button
  handing off to the phone's own AR viewer.
- **React Three Fiber (R3F)** — a React renderer for Three.js; used here
  wherever custom control is needed beyond what `<model-viewer>` exposes
  (element picking/raycasting, custom camera paths, section planes).
- **Scene Viewer / Quick Look** — the built-in AR viewers on Android and
  iOS respectively, launched by `<model-viewer>`'s "View in AR" button.
  Handles camera pass-through and world tracking without any custom AR code
  from this project — until Phase 4's custom AR camera view replaces it for
  the walk-through feature specifically.
- **ARCore / ARKit** — Google's and Apple's native AR frameworks,
  respectively. Fuse the camera with the phone's motion sensors
  (accelerometer, gyroscope) for real-world 6DOF position tracking
  (visual-inertial odometry). What Scene Viewer/Quick Look use internally,
  and what Phase 4's custom AR build will use directly.
- **BCF** (BIM Collaboration Format) — an open standard for design-review
  issues/markup tied to specific model elements, able to round-trip into
  tools like Revit/Navisworks. Earmarked for Phase 6.
- **Capacitor** — the framework used (in both this project's Phase 4 plan
  and in Budget Tracker today) to wrap a web app (React/Vite) into a native
  Android/iOS app shell.
- **BaaS** (Backend as a Service) — a hosted backend (auth, database,
  storage) used instead of running a custom server. This project's default
  pick is Supabase — see `engineering/tech-stack.md`.

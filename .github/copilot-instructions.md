# iPhone Duo knolling viewer

Interactive 3D viewer for the iPhone Duo with Assembled, Exploded (initial), and
orthographic Knolling modes. Exactly 25 authored major-component modules;
not a teardown, verified hinge, or complete BOM. See README for the fixed inventory
and illustrative sliding-display mechanics disclosure.

## Stack
- TypeScript, Vite, and three.js. No UI framework.
- npm for package management.
- `.github/mcp.json` configures local Playwright MCP browser tools for Copilot CLI; start the dev server before inspecting the viewer.

## Commands
- `npm install`: install dependencies
- `npm run dev`: start the dev server
- `npm run build`: type-check `src/` with `tsc --noEmit`, then build with Vite
- `npx playwright install chromium`: install the browser needed for tests
- `npm test`: run the Playwright tests
- `npm test -- tests/viewer.spec.ts`: run a single spec file
- `npm test -- tests/viewer.spec.ts --grep "shows the Knolling button and the viewer canvas"`: run the existing smoke test by name

## Architecture
- `src/main.ts` creates the UI and viewer, connects camera actions, and registers Vite HMR cleanup for both.
- `src/ui.ts` owns DOM controls and Help disclosure; `src/scene.ts` owns the renderer, camera, lighting, resize observer, and animation loop. `src/controls.ts` owns OrbitControls, focus-scoped keyboard input, and reduced-motion handling.
- `src/model.ts` defines the typed 25-module registry, endpoint-derived panel/display dimensions, provenance, ratios, and modes.
- `src/parts.ts` builds persistent rear/front/hinge assemblies and merged decorative module geometry, caching shared resources disposed once. `createPhone()` returns `{ assembly, hinge, parts, layouts, dispose }`.
- `src/fold.ts` supplies pure fold targets and one connected finite-radius skinned inner display. `src/transition.ts` is the only hinge/part/articulation writer, driven by elapsed time; interruptions capture displayed poses and bend angle. Duration is session-only, 0–2000 ms, default 600; every request uses the full selected duration. Zero and initial/live reduced motion snap the entire transition.
- `src/framing.ts` coordinates perspective/orthographic cameras, actual layout/sweep framing, projection scale matching, cached aspect-adjusted Exploded return, resize and clipping. Only Knolling locks orbit. Camera input is explicitly suspended during handoff; Reset is camera-only and mode-specific.
- `src/layout.ts` computes independent local `assembled`, `exploded`, and `knolled` snapshots once, converting canonical targets through parent matrices. Full authored orientations precede oriented bounds; the measured positive-gap grid has six columns and 25 occupied cells.
- The scene's one RAF updates transition, controls, clipping, then rendering.
- `createViewer()` returns camera actions (`zoomIn`, `zoomOut`, `resetView`), `setMode`, `toggleKnolling`, `toggleFold`, `setDuration`, `subscribe`, and `dispose()`. `subscribe` immediately emits `ViewStatus` and returns unsubscribe. Folding is Assembled-only; Knolling off returns Exploded.
- `CameraActions` remains camera-only; `ViewerActions` adds `TransitionActions`. `createUI()` returns the viewport container, `connect(actions)`, and `dispose()`. Preserve UI abort/subscription cleanup, viewer RAF/observer/preference/resource cleanup, and HMR teardown.
- `playwright.config.ts` runs Chromium tests and starts Vite at `http://127.0.0.1:5173` with a strict port. An existing server is reused outside CI; traces are retained on failure.

## Conventions
- Scene units are millimeters.
- One mesh per physical component. Name every mesh after its part (for example, `inner-display`).
- Read all dimensions from `src/specs.ts`. No magic numbers.
- The closed body is 84.1 x 117.8 x 11.3 mm, mapped to box width, height, and depth. Camera distances and light positions scale from these specs.
- Keep modules small: scene setup, parts, layout (exploded and knolling), and UI.
- Store independent matrix clones for layouts after updating the part's local matrix; do not recalculate target transforms in the render loop.
- Keep protected `src/specs.ts` unchanged. Derive endpoint envelopes and nominal active display diagonals from it: closed 84.1 × 117.8 × 11.3 mm, open 164.6 × 117.8 × 5.2 mm, inner 7.6 inches, cover 5.4 inches. Internal proportions and sliding display articulation remain illustrative, not verified hardware mechanics; retain that disclosure in UI and README.
- The canvas exposes `role="img"` and an accessible name used by the smoke test; preserve this accessibility contract when changing the viewer.

## Scoped instructions
- Follow `.github/instructions/threejs.instructions.md` for `src/**/*.ts`, including assembly grouping, transitions, and resource disposal.
- Follow `.github/instructions/playwright.instructions.md` for `tests/**/*.spec.ts`, including role-based locators, visible-state assertions, and external HTTP mocking.

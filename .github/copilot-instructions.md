# iPhone Duo knolling viewer

Interactive 3D viewer for the iPhone Duo, intended to support exploded and knolling views.
Renders a reversible schematic two-panel book fold with orbit controls; the Knolling toggle is disabled.
Geometry is illustrative, not verified hardware.

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
- `src/parts.ts` builds named rear/front panels and a persistent left-edge hinge group, sharing geometry/materials disposed once. `createPhone()` returns `{ assembly, hinge, dispose }`.
- `src/fold.ts` owns elapsed-time, reversible hinge playback and discrete state subscriptions. The scene's single RAF updates fold, controls, then rendering. Reduced motion (including live changes) snaps to target.
- `src/framing.ts` derives an aspect-aware home pose enclosing the full sweep. Resize refits home but does not override user orbit/pan; Reset is camera-only.
- `src/layout.ts` snapshots each part's local matrix into `part.userData.layouts.exploded` and `.knolled`. Both are currently identical placeholders.
- `createViewer()` returns camera actions (`zoomIn`, `zoomOut`, `resetView`), `toggleFold`, `subscribeFold`, and `dispose()`. `CameraActions` remains camera-only; `ViewerActions` extends it. `createUI()` returns the viewport container, `connect(actions)`, and `dispose()`. Preserve UI subscription/listener cleanup and viewer RAF/resource cleanup.
- `playwright.config.ts` runs Chromium tests and starts Vite at `http://127.0.0.1:5173` with a strict port. An existing server is reused outside CI; traces are retained on failure.

## Conventions
- Scene units are millimeters.
- One mesh per physical component. Name every mesh after its part (for example, `inner-display`).
- Read all dimensions from `src/specs.ts`. No magic numbers.
- The closed body is 84.1 x 117.8 x 11.3 mm, mapped to box width, height, and depth. Camera distances and light positions scale from these specs.
- Keep modules small: scene setup, parts, layout (exploded and knolling), and UI.
- Store independent matrix clones for layouts after updating the part's local matrix; do not recalculate target transforms in the render loop.
- The canvas exposes `role="img"` and an accessible name used by the smoke test; preserve this accessibility contract when changing the viewer.

## Scoped instructions
- Follow `.github/instructions/threejs.instructions.md` for `src/**/*.ts`, including assembly grouping, transitions, and resource disposal.
- Follow `.github/instructions/playwright.instructions.md` for `tests/**/*.spec.ts`, including role-based locators, visible-state assertions, and external HTTP mocking.

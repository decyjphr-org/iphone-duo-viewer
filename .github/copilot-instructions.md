# iPhone Duo knolling viewer

Interactive 3D viewer for the iPhone Duo, intended to support exploded and knolling views.
Currently renders one closed-body box with orbit controls; the Knolling toggle is an inert placeholder.

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
- `src/main.ts` mounts the DOM UI, passes its viewer container to `createViewer`, and registers Vite HMR cleanup.
- `src/ui.ts` owns DOM controls; `src/scene.ts` owns the renderer, camera, lighting, orbit controls, resize observer, and animation loop.
- `src/parts.ts` builds the phone assembly and owns its geometry/material disposal. `createPhone()` returns `{ assembly, dispose }`.
- `src/layout.ts` snapshots each part's local matrix into `part.userData.layouts.exploded` and `.knolled`. Both are currently identical placeholders.
- `createViewer()` returns a cleanup function that stops rendering, disconnects resizing, disposes controls and phone resources, and removes the canvas. Preserve this lifecycle when adding resources.
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

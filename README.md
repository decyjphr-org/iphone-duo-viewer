# iPhone Duo viewer

An interactive 3D prototype built with TypeScript, Vite, and three.js, without a UI
framework. Inspect a schematic two-panel book fold, with a closed envelope of
**84.1 x 117.8 x 11.3 mm**. Each panel is 84.1 x 117.8 x 5.65 mm.
This is illustrative geometry, not verified hardware or a detailed hinge model.

The viewer supports orbit, pan, zoom, and reset through pointer, touch, and
keyboard controls. Exploded and knolling views are not implemented yet; the
Knolling button is disabled and marked "Coming soon".
The **Open phone** toggle swings the front panel left through 180° around a
vertical left-edge hinge while the rear stays fixed. Click again during motion
to reverse from the displayed angle. The button's pressed state indicates the
requested open target; the live status reports opening, closing, or the endpoint.

## Getting started

Use a supported Node.js release compatible with Vite 8, such as Node.js 22.12 or
newer, npm, and a browser with WebGL 2 support.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The header identifies the current layout as
"Closed view"; the bottom toolbar provides Zoom out, Zoom in, Reset view, and Help.

## Controls

| Action | Mouse / trackpad | Touch | Keyboard |
| --- | --- | --- | --- |
| Rotate | Drag | One-finger drag | Arrow keys |
| Pan | Right-drag | Two-finger drag | Shift + Arrow keys |
| Zoom | Scroll or use the toolbar | Pinch or use the toolbar | `+` / `-` |
| Reset camera | Reset view button | Reset view button | Home |
| Open / close phone | Open phone toggle | Open phone toggle | Tab to toggle, then Space / Enter |

Tab to the viewer to use camera shortcuts; they apply only while the canvas is
focused. The toolbar buttons are also keyboard-accessible. Open Help for shortcut
instructions, and press Escape while focused in the controls to close it.

Hints adapt to the primary pointer type. Camera buttons have at least 44 px touch
targets, and reduced-motion preferences disable orbit inertia and make folding
instant, including when the preference changes during a fold.

Reset view affects only the camera, not the fold. Default/reset framing encloses
the full sweep even on narrow screens, so the closed phone appears smaller.
Resizing refits an untouched home view; otherwise it preserves the current
orbit/pan and updates the saved reset pose for the new aspect ratio.

## Build

```sh
npm run build
```

This type-checks `src/` with `tsc --noEmit`, then creates the production bundle in
`dist/`.

## Tests

Install the Playwright Chromium browser once, then run the browser tests:

```sh
npx playwright install chromium
npm test
```

Run one spec or select the initial visibility test:

```sh
npm test -- tests/viewer.spec.ts
npm test -- tests/viewer.spec.ts --grep "shows the Knolling button and the viewer canvas"
```

Playwright starts Vite at `http://127.0.0.1:5173` with a strict port. Outside CI it
can reuse an existing server at that address; in CI it starts its own. Traces are
retained for failed tests.

Tests exercise the disabled Knolling placeholder, canvas visibility, camera
controls, keyboard interaction, Help disclosure, and mobile hints and touch-target
sizes. Fold tests verify geometry and matrix snapshots numerically, endpoints,
reversal, live reduced motion, all corner projections over the sweep at desktop
and mobile aspects, exact camera reset with pending damping, and cleanup.

## How the viewer fits together

`src/main.ts` creates the DOM UI and viewer, connects camera actions, and registers
cleanup for Vite hot reload.

| Module | Responsibility |
| --- | --- |
| `src/scene.ts` | Renderer, camera, lighting, container resizing, and the render loop |
| `src/controls.ts` | OrbitControls, zoom/reset actions, focus-scoped keyboard input, and reduced-motion handling |
| `src/ui.ts` | Live fold status/toggle, schematic explanation, camera toolbar, hints, Help, and disabled Knolling |
| `src/parts.ts` | Phone assembly, component geometry/materials, and their disposal |
| `src/layout.ts` | Stored local transform matrices for exploded and knolled layouts |
| `src/fold.ts` | Reversible elapsed-time hinge playback and discrete state subscriptions |
| `src/framing.ts` | Aspect-aware camera home enclosing the full swept bounds |
| `src/specs.ts` | Physical dimensions in millimeters |

The scene calls `createPhone()` and renders its assembly. Parts snapshot their
local transforms through `storePartLayouts()`. The two layout snapshots are
independent clones but currently identical placeholders; folding never overwrites
them. A fixed rear mesh and a front mesh under a persistent hinge group share one
geometry/material pair, disposed once by the parts module. The single render loop
updates fold playback, then camera controls, then renders. Full-range folding uses
600 ms smoothstep easing; reversal duration scales with remaining angular distance.

Each physical component has a named mesh within an assembly group. Model resources
are disposed by the parts module, while the viewer disposes rendering and camera
resources. UI listeners have a separate cleanup path.
The UI unsubscribes from fold status on cleanup; viewer disposal cancels its RAF,
disconnects resizing and motion listeners, clears fold subscribers, and releases
resources. No persistence or migration is involved. To roll back this feature,
restore the original single-body model and camera-only UI/viewer interface
together; no stored user data needs conversion.

## Playwright MCP

`.github/mcp.json` configures Playwright MCP for Copilot CLI in this repository.
It runs locally through `npx` with a headless browser and an isolated profile.
Start a new Copilot CLI session in this trusted repository to load it, then use
`/mcp` to check its status. Run `npm run dev` before asking Copilot to inspect the
viewer. MCP is optional and is not needed to run the app or its tests.

## Repository guidance

See [AGENTS.md](AGENTS.md) for links to the repository instructions and focused
guides for three.js work, layout transitions, and Playwright tests.

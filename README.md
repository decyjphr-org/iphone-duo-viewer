# iPhone Duo illustrative viewer

A local TypeScript / Vite / three.js viewer with **Assembled**, **Exploded**
(initial), and **Knolling** modes. No UI framework, runtime downloads, external
assets, new dependencies, or saved user settings.

## Accuracy boundary

This is a recognizable exterior with **25 authored major-component modules**,
**not a teardown, repair sequence, verified hinge, or full hardware BOM**.
Decorative geometry is merged into the corresponding named module. Internals,
relative dimensions, placement, and motion are
illustrative. The registry in `src/model.ts` records their authored provenance
and proportional dimensions; `src/specs.ts` supplies both endpoint envelopes
and display diagonals.

The assembled closed envelope is **84.1 × 117.8 × 11.3 mm**; open is
**164.6 × 117.8 × 5.2 mm**. The continuous inner display's nominal active
rectangle is **7.6 inches** diagonally; the cover display's is **5.4 inches**.
Diagonals refer to bounding rectangles, not rounded-corner contours.
Do not infer hardware accuracy from matching these dimensions.

The inner display is one persistent, connected skinned sheet, flat when open
and bent through a finite-radius arc when closed. The 82.3 mm panels have a
0.9 mm closed gap. The illustrative sheet is 0.09 mm thick, with a 0.495 mm
neutral bend radius and a reserved maximum arc length of about 1.555 mm.
Each half slides by half the arc length during folding; thickness-deep
recesses seat the sheet outside the body gap. U-shaped rims leave the
hinge-facing edge open and clear both active display rectangles. This is
**schematic sliding attachment, not verified hardware mechanics**.

The planning research used Apple's iPhone Duo specifications, Wikipedia, Phone
Repair Guru, Wccftech, and AppleHeadlines for external-envelope/context evidence
only (retrieved October 22, 2026 UTC). None supplied verified internal geometry
or a complete BOM. No external geometry, images, or textures are bundled.
Sample reference PNGs were unavailable for comparison; no reference-image match
is claimed.

### Fixed inventory

| Assembly | Named modules |
| --- | --- |
| Rear (12) | `rear-frame`, `rear-cover`, `inner-display`, `rear-display-support`, `rear-battery`, `logic-board`, `rear-camera-wide`, `rear-camera-ultrawide`, `rear-speaker`, `charging-port-module`, `power-button`, `volume-rocker` |
| Front (10) | `front-frame`, `cover-display`, `front-display-support`, `front-battery`, `front-interconnect-board`, `front-camera`, `front-speaker`, `haptic-module`, `wireless-charge-coil`, `side-button` |
| Hinge (3) | `hinge-spine`, `front-hinge-bracket`, `rear-hinge-bracket` |

## Run

Use Node.js compatible with Vite 8 (for example 22.12+) and a WebGL 2 browser.
With dependencies already present:

```sh
npm run dev
npm run build
npm test
```

For a fresh checkout, install with `npm install`, and, if needed,
`npx playwright install chromium` before testing. These are setup steps, not
runtime network requirements. Build type-checks `src/` with `tsc --noEmit` and
emits a Vite production bundle in `dist/`.

## Modes and controls

- **Exploded** is deterministic and fully open. Layer separation is illustrative.
- **Assembled** alone enables **Open phone**. The requested fold endpoint is
  remembered, initially closed, when leaving/re-entering Assembled. The hinge
  sweeps through 180°; folding can be reversed from the displayed pose.
- **Knolling** arranges all 25 modules exactly once in a six-column, five-row
  grid. Cells use actual oriented geometry bounds (including off-center detail),
  centered on cell axes, with a positive specs-derived gap. Every broad face
  faces the straight-on +Z view, including the spine's authored Y rotation.
  The single flat inner display occupies one larger cell. Toggle it off to
  return to **Exploded**, not Assembled.
- The pressed mode reports the **target**. One polite status reports target,
  last settled mode, fold state, camera availability, and duration errors.
- **Transition duration (ms)** is a native slider, 0–2000 inclusive, default
  600. Every new request/reversal uses that full duration, including camera
  handoff. Edits affect the next request, never active playback. Zero is instant.
  Preferences/settings last only until reload.
- Initial and live reduced motion snap the entire transition, model and camera,
  to its target and disable control damping.

| Action | Assembled / Exploded | Knolling |
| --- | --- | --- |
| Projection | Perspective | Straight-on orthographic, +Y up |
| Mouse drag / one-finger drag | Orbit | Pan; rotation locked |
| Right-drag / two-finger drag | Pan | Pan |
| Wheel / pinch / `+` / `-` / camera buttons | Zoom | Zoom |
| Focused arrow keys | Orbit | Pan |
| Shift + arrows | Pan | Pan |
| Home / Reset view | Camera-only sweep/layout home | Camera-only grid home |

Only the focused canvas receives shortcuts. Help adapts to mode and coarse
pointers; Escape closes Help. Controls have 44 px touch targets and safe-area
spacing. Model and camera share a transition clock. During a mode-camera handoff,
camera input is temporarily suspended with visible accessible status; mode,
fold, and duration inputs remain available. Focus is retained and camera input
automatically resumes at completion, interruption, or reduced-motion snapping.

Perspective orbit/pan/zoom remain enabled in **both** Assembled and Exploded.
Entering Knolling caches the Exploded viewpoint. Exiting restores it with
aspect adjustment. Projection handoffs match image scale at the target plane.
Resize guards zero-size containers, updates aspect and reset framing, and
preserves a user-chosen orbit/pan/relative zoom. Home framing encloses the
assembled hinge sweep, so the closed model is intentionally smaller than the
open model; zoom in to inspect exterior details.

## Implementation and lifecycle

| Module | Responsibility |
| --- | --- |
| `src/model.ts` | Authored inventory, endpoint-derived panel/display dimensions, modes, ratio/provenance metadata |
| `src/parts.ts` | Rounded frames/cavities, inset screens, lens/button/port details; persistent assembly hierarchy; shared resource caches |
| `src/layout.ts` | Parent-aware immutable local assembled/exploded/knolled matrix snapshots, measured grid/bounds, pose helpers |
| `src/fold.ts` | Fold quaternion target and connected finite-radius skinned-sheet articulation, no independent clock |
| `src/transition.ts` | Sole part/hinge/articulation writer; elapsed smoothstep position/scale and quaternion playback; subscriptions and duration validation |
| `src/framing.ts` | Sole camera coordinator; actual layout/sweep framing, clearance path, projection/resize/return/clip policy |
| `src/controls.ts` | One OrbitControls instance, active-camera mappings, focus-scoped keys and live motion preference |
| `src/scene.ts` | Renderer, lights, observer, one RAF: transition → controls → clipping → render |
| `src/ui.ts` | Modes, duration, fold restriction, composed status, disclosure, camera toolbar and Help |
| `src/main.ts` | Connect UI/viewer, accessible initialization error, HMR teardown |
| `src/specs.ts` | Protected endpoint dimensions and display diagonals |

`createPhone()` returns `{ assembly, hinge, parts, layouts, flexible, dispose }`. Rear,
front, and hinge modules stay under persistent assembly groups; the front
assembly stays under `book-hinge`. Knoll targets convert canonical world poses
through inverse parent matrices rather than reparenting.

`createViewer()` returns `ViewerActions` (`zoomIn`, `zoomOut`, `resetView`,
`setMode`, `toggleKnolling`, `toggleFold`, `setDuration`, `subscribe`) plus
`dispose()`. `subscribe(listener)` immediately supplies `ViewStatus` and returns
an unsubscribe function. Status includes `target`, `settled`, `transitioning`,
`requestedOpen`, `fold`, `duration`, `error`, and `cameraBusy`.
`setDuration` rejects nonfinite/out-of-range values with status error and retains
the last valid setting; `setMode` rejects unknown mode names.

Targets/decompositions are cached outside playback. Interruptions capture
displayed poses; exact endpoints are assigned without overwriting snapshots.
The camera suspends OrbitControls damping while it owns playback. No extra RAF
or interval is used. UI disposal aborts listeners and unsubscribes; reconnect
replaces prior action listeners. Viewer disposal cancels RAF, disconnects resize
and preference listeners, disposes controls/controller/renderer, and removes the
canvas. The display skeleton and each unique shared geometry/material are disposed exactly once; mode
switching never allocates a replacement model. HMR tears down both lifecycles.

## Validation

```sh
npm test -- tests/viewer.spec.ts
npm test -- tests/fold.spec.ts
npm test -- tests/layout.spec.ts
python3 .github/hooks/test_guard.py
git --no-pager diff --check
```

Playwright starts strict-port Vite at `http://127.0.0.1:5173`, reuses an existing
server outside CI, and retains failure traces. Tests cover exact inventory,
positive-gap projected AABBs, alignment, parent-aware independent snapshots,
actual skinned-vertex endpoint bounds and diagonals, connected sheet topology,
finite-radius body-following articulation and frame clearance, elapsed
timing/reversal, duration validation, motion preferences,
camera scale/pose/interaction, frustum sampling of actual geometry at desktop,
mobile and landscape sizes, accessibility, and cleanup.

Numeric checks are not visual approval. Chromium desktop/mobile emulation is
not testing on physical devices; human visual approval remains a separate step.
Screenshots do not establish hardware accuracy.

## Repository guidance

See [AGENTS.md](AGENTS.md) for scoped instructions. `.github/mcp.json` optionally
configures local Playwright MCP; start Vite before inspecting the viewer.
No persistence migration is needed to roll back: restore coherent viewer,
test, and documentation changes together, preserving unrelated hook work.

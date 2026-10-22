# Animation and transitions

**Read when:** changing layout snapshots, playback, cameras, or animation cleanup.

## Current implementation and ownership

- `model.ts` defines exactly 25 authored modules and `Mode`:
  `assembled | exploded | knolled`. See README for inventory/accuracy boundaries.
- `parts.ts` creates persistent rear/front/hinge assembly groups; the front
  assembly stays under `book-hinge`. Decorative geometry is merged into modules.
- `layout.ts` computes independent local `assembled`, `exploded`, `knolled`
  `Matrix4` snapshots once after geometry/parents exist. Targets include bounds
  of off-center geometry; the grid is six columns with a positive specs-derived
  gap. Canonical-world targets convert through inverse parent matrices.
- `fold.ts` provides `foldQuaternion(open)`, not an animation loop or writer.
- The single `inner-display` SkinnedMesh is a connected finite-thickness sheet.
  Its material-coordinate columns articulate a finite-radius bend, with
  schematic sliding attachments. The controller captures the current bend
  angle on interruption and drives it on the same clock as the hinge.
  No geometry is rebuilt or layout target recomputed during playback.
- `transition.ts` is the sole part/hinge transform writer. It captures current
  local poses, uses cached target decompositions, smoothstep position/scale
  interpolation and quaternion slerp, then assigns exact endpoints. It never
  mutates saved matrices. The assembled hinge endpoint is composed separately.
- `framing.ts` is the sole camera coordinator. It suspends controls/damping during
  mode handoff, uses a cached clearance path, matches target-plane projection
  scale, and switches to exact straight-on orthographic only in Knolling. Leaving
  restores the cached Exploded pose with aspect adjustment. Perspective orbit is
  retained in both other modes. Reset is camera-only and mode-specific.
- `scene.ts` owns the single RAF: controller update → controls update → clipping
  update → render. No controller/UI RAF or intervals.

## Action and status contract

`ViewerActions` combines camera-only `CameraActions` and `TransitionActions`:
`setMode`, `toggleKnolling`, `toggleFold`, `setDuration`, and `subscribe`.
`subscribe` immediately emits `ViewStatus` and returns unsubscribe.
Status fields: `target`, `settled`, `transitioning`, `requestedOpen`, `fold`,
`duration`, `error`, `cameraBusy`.

- Initial mode Exploded, fully open; remembered assembled fold initially closed.
- Only Assembled folds. Other modes must not overwrite the remembered endpoint.
- Knolling pressed state indicates its target. Toggle off always selects Exploded.
- Duration is finite 0–2000 ms inclusive, default 600. Invalid input sets an
  explicit error without changing the last valid value. UI uses a labeled range.
- Every request/reversal uses the full selected duration, including the camera.
  Editing duration affects only subsequent requests. Zero is instant.
- Interruptions capture the displayed part/hinge/camera poses; never jump back
  to an old start or scale reversal time by remaining distance.
- Initial/live reduced motion finishes the whole transition, including camera.
- One composed polite status distinguishes target from settled and explicitly
  announces temporary camera-input suspension. Preserve focus and restore input.

## Invariants for changes

- Snapshots remain immutable and in the object's persistent parent space.
  Update local matrices before initial cloning. Do not reparent on toggles.
- Cache targets, decompositions, layout bounds, and clearance outside playback.
  Reuse working objects; do not recompute layout targets in the render loop.
- Fit actual geometry and the assembled sweep, guard zero-size containers,
  preserve user view intent on resize, and maintain near/far and zoom limits.
- Do not allocate/dispose model geometry merely to change mode.
- Dispose the sole controller, cancel the latest RAF, disconnect resize/media
  listeners and controls, abort UI listeners/unsubscribe, and dispose every
  unique cached geometry/material and the display skeleton once. HMR tears UI and viewer down together.
- Maintain canvas role/name accessibility and explicit initialization errors.

## Verification

Use `tests/layout.spec.ts` for inventory, independent snapshots, parent-aware
world coverage, broad-face alignment/AABB gaps, actual skinned-vertex endpoint
envelopes, display diagonals/connectivity/body-following/frame clearance and transition-frustum
sampling at desktop/mobile/landscape, camera scale/pose/resize behavior.
Use `tests/fold.spec.ts` for elapsed cadence, exact endpoints, full-duration
interruptions, duration validation, initial/live reduced motion, and cleanup.
`tests/viewer.spec.ts` covers visible mode/status/duration/focus/camera/help/touch
contracts. Numeric tests do not replace human visual approval or establish
teardown accuracy. Follow [three.js](threejs.instructions.md) and
[Playwright](playwright.instructions.md) requirements.

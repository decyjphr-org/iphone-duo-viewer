# Animation and transitions
**When to read:** Changing stored part layouts, implementing exploded/knolling transitions, or modifying the viewer's animation lifecycle.

## Current implementation

- `src/layout.ts` stores layout snapshots; it does not compute distinct target layouts.
- `src/parts.ts` creates the `closed-body` mesh, snapshots it, and adds it to the `iphone-duo` assembly.
- Both saved layouts currently describe the same initial transform.
- `src/scene.ts` continuously renders and calls the camera-control wrapper's `update()`; it does not animate parts.
- `src/controls.ts` owns camera actions, keyboard input, reduced-motion handling, and reset behavior.
- `src/ui.ts` creates a disabled Knolling button with `aria-pressed="false"` alongside working camera controls.
- There is no transition controller, duration, easing function, or assembled-layout snapshot yet.
- Treat the implementation guidance below as requirements for future work, not existing APIs.

## Stored transform contract

The current snapshot operation in `src/layout.ts` is:

```ts
export function storePartLayouts(part: Object3D): void {
  part.updateMatrix();
  part.userData.layouts = {
    exploded: part.matrix.clone(),
    knolled: part.matrix.clone(),
  };
}
```

- These are local matrices, relative to the part's parent, not world-space targets.
- `updateMatrix()` captures the part's current position, rotation, and scale.
- Independent clones prevent changing one target from modifying the other.
- Keep saved targets immutable during playback; interpolate separate working state.
- Do not call this helper on every frame or toggle: it would overwrite both targets with the current pose.
- When distinct layouts are introduced, compute each target once after the part's dimensions and parent are established.
- Keep targets and interpolation endpoints in the same parent coordinate system.
- Reparenting or changing assembly transforms requires reviewing how existing targets are interpreted.
- `userData.layouts` currently has no explicit application-level type; add a narrow type or guard when implementing readers.

## Extending the existing loop

The current loop in `src/scene.ts` is:

```ts
let frame: number;
function animate() {
  controls.update();
  renderer.render(scene, camera);
  frame = requestAnimationFrame(animate);
}
animate();
```

- Add transition updates before rendering in this loop; do not start another loop from the UI.
- Keep `controls.update()` before rendering; orbit damping is enabled unless reduced motion is requested.
- Use elapsed time from animation timestamps rather than frame counts or fixed per-frame increments.
- Capture each part's current pose and transition start time when a new target is selected.
- Decompose target matrices into cached position, quaternion, and scale endpoints outside the hot loop.
- Interpolate position and scale, and use quaternion interpolation for orientation; avoid interpolating matrix entries.
- Apply easing to normalized, clamped progress and write the exact target pose at completion.
- Keep automatic local-matrix updates consistent with the position/quaternion/scale changes.
- Reuse working transform objects instead of allocating them for every part on every frame.
- If a transition is interrupted, start from the currently displayed pose rather than the previous target.

## Layout and UI boundaries

- Keep target calculations in `src/layout.ts`; parts own physical geometry and the scene owns playback.
- Read physical dimensions from `src/specs.ts` and express target translations in millimeters.
- The current closed-body proxy cannot demonstrate separation of internal components.
- Before wiring the toggle, define what the off state restores: closed, assembled, and exploded are not interchangeable.
- Camera buttons already connect through the `CameraActions` interface and `createUI().connect(actions)`; extend that boundary deliberately when adding layout actions.
- Update `aria-pressed` consistently with the chosen toggle semantics once the button becomes functional.
- Leave the existing placeholder inert unless implementing the feature is part of the task.

## Cleanup and verification

- `createViewer()` returns camera actions and `dispose()`; `src/main.ts` disposes both the UI and viewer during HMR.
- Keep cancellation tied to the latest scheduled `frame`; do not leave transition callbacks running after disposal.
- Release any new UI listeners or playback state through the same lifecycle.
- Do not recreate or dispose component geometry/materials merely to change their pose.
- `tests/viewer.spec.ts` checks camera controls and UI behavior; it does not establish that part-layout transitions work.
- For new transition behavior, check endpoints, interrupted/reversed motion, and unchanged stored targets.
- Verify progress is elapsed-time based and playback stops after cleanup.
- Preserve orbit interaction during transitions unless a deliberate interaction change is requested.
- Follow [scene standards](threejs.instructions.md) and [Playwright requirements](playwright.instructions.md) when changing implementation or tests.

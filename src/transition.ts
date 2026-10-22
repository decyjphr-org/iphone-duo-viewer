import { type Group, type Mesh } from 'three';
import { foldQuaternion, type FoldState } from './fold';
import { applyPose, decompose, partLayouts, type Pose } from './layout';
import type { Mode } from './model';
import type { Phone } from './parts';

export interface ViewStatus {
  target: Mode;
  settled: Mode;
  transitioning: boolean;
  requestedOpen: boolean;
  fold: FoldState;
  duration: number;
  error: string;
  cameraBusy: boolean;
}
export interface TransitionActions {
  setMode(mode: Mode): void;
  toggleKnolling(): void;
  toggleFold(): void;
  setDuration(duration: number): void;
  subscribe(listener: (status: ViewStatus) => void): () => void;
}
export const smoothstep = (t: number) => t * t * (3 - 2 * t);
export interface CameraTransition {
  request(mode: Mode, duration: number, now: number): void;
  update(progress: number): void;
  finish(): void;
}
export function createTransitionController(
  phone: Phone, camera?: CameraTransition, clock = () => performance.now(),
) {
  const listeners = new Set<(status: ViewStatus) => void>();
  const targets = new Map(phone.parts.map(part => [
    part, Object.fromEntries(Object.entries(partLayouts(part)).map(([key, value]) => [key, decompose(value)])) as Record<Mode, Pose>,
  ]));
  let target: Mode = 'exploded';
  let settled: Mode = 'exploded';
  let requestedOpen = false;
  let duration = 600;
  let activeDuration = duration;
  let startedAt = 0;
  let active = false;
  let cameraBusy = false;
  let reducedMotion = false;
  let disposed = false;
  let error = '';
  let fromBend = 0;
  let toBend = 0;
  let moving: { object: Group | Mesh; from: Pose; to: Pose }[] = [];
  const status = (): ViewStatus => ({
    target, settled, transitioning: active, requestedOpen, duration, error, cameraBusy,
    fold: active && target === 'assembled' ? (requestedOpen ? 'opening' : 'closing')
      : requestedOpen ? 'open' : 'closed',
  });
  const emit = () => listeners.forEach(listener => listener(status()));
  function finish() {
    moving.forEach(({ object, to }) => applyPose(object, to));
    phone.flexible.articulate(toBend);
    camera?.finish();
    active = false; cameraBusy = false; settled = target;
    emit();
  }
  function request(mode: Mode) {
    if (disposed) return;
    const changed = mode !== target;
    target = mode;
    fromBend = phone.flexible.angle;
    toBend = mode === 'assembled' && !requestedOpen ? Math.PI : 0;
    startedAt = clock();
    activeDuration = reducedMotion ? 0 : duration;
    moving = phone.parts.map(part => {
      part.updateMatrix();
      return { object: part, from: decompose(part.matrix), to: targets.get(part)![mode] };
    });
    phone.hinge.updateMatrix();
    const hingeTarget = decompose(phone.hinge.matrix);
    hingeTarget.quaternion.copy(foldQuaternion(mode !== 'assembled' || requestedOpen));
    moving.push({ object: phone.hinge, from: decompose(phone.hinge.matrix), to: hingeTarget });
    active = true;
    cameraBusy = changed || cameraBusy;
    // Every request, including reversal, recaptures the camera and uses full duration.
    if (cameraBusy) camera?.request(mode, activeDuration, startedAt);
    if (!activeDuration) finish();
    else emit();
  }
  phone.parts.forEach(part => applyPose(part, targets.get(part)!.exploded));
  phone.hinge.quaternion.copy(foldQuaternion(true));
  return {
    setMode(mode: Mode) {
      if (!['assembled', 'exploded', 'knolled'].includes(mode)) throw new Error('Unknown layout');
      request(mode);
    },
    toggleKnolling() { request(target === 'knolled' ? 'exploded' : 'knolled'); },
    toggleFold() {
      if (disposed || target !== 'assembled') return;
      requestedOpen = !requestedOpen; request('assembled');
    },
    setDuration(value: number) {
      if (disposed) return;
      if (!Number.isFinite(value) || value < 0 || value > 2000) {
        error = 'Duration must be a finite number from 0 to 2000 ms.';
      } else { duration = value; error = ''; }
      emit();
    },
    update(now: number) {
      if (disposed || !active) return;
      const progress = Math.max(0, Math.min(1, (now - startedAt) / activeDuration));
      if (progress === 1) { finish(); return; }
      const eased = smoothstep(progress);
      moving.forEach(({ object, from, to }) => {
        object.position.lerpVectors(from.position, to.position, eased);
        object.quaternion.slerpQuaternions(from.quaternion, to.quaternion, eased);
        object.scale.lerpVectors(from.scale, to.scale, eased);
      });
      phone.flexible.articulate(fromBend + (toBend - fromBend) * eased);
      if (cameraBusy) camera?.update(eased);
    },
    setReducedMotion(reduce: boolean) {
      if (disposed) return;
      reducedMotion = reduce;
      if (reduce && active) finish();
    },
    subscribe(listener: (status: ViewStatus) => void) {
      if (disposed) return () => {};
      listeners.add(listener); listener(status());
      return () => { listeners.delete(listener); };
    },
    dispose() { disposed = true; active = false; listeners.clear(); moving = []; },
  };
}

import type { Group } from 'three';
import { bookFold } from './layout';

export type FoldState = 'closed' | 'opening' | 'open' | 'closing';
export interface FoldStatus {
  state: FoldState;
  requestedOpen: boolean;
}
export interface FoldActions {
  toggleFold(): void;
  subscribeFold(listener: (status: FoldStatus) => void): () => void;
}

const durationMs = 600;

// Playback is driven only by the viewer's RAF. Saved layout matrices stay immutable.
export function createFoldController(hinge: Group) {
  let angle = 0;
  let start = 0;
  let target = 0;
  let startedAt = 0;
  let duration = 0;
  let reducedMotion = false;
  let disposed = false;
  let state: FoldState = 'closed';
  const listeners = new Set<(status: FoldStatus) => void>();

  function emit() {
    const status = { state, requestedOpen: target === bookFold.openAngle };
    listeners.forEach((listener) => listener(status));
  }
  function finish() {
    angle = target;
    hinge.rotation.y = -angle;
    state = target === 0 ? 'closed' : 'open';
    emit();
  }

  return {
    toggleFold() {
      if (disposed) return;
      start = angle;
      target = target === 0 ? bookFold.openAngle : 0;
      startedAt = performance.now();
      duration = durationMs * Math.abs(target - start) / bookFold.openAngle;
      if (reducedMotion || duration === 0) finish();
      else {
        state = target === 0 ? 'closing' : 'opening';
        emit();
      }
    },
    update(now: number) {
      if (disposed || (state !== 'opening' && state !== 'closing')) return;
      const progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
      if (progress === 1) finish();
      else {
        const eased = progress * progress * (3 - 2 * progress);
        angle = start + (target - start) * eased;
        hinge.rotation.y = -angle;
      }
    },
    setReducedMotion(reduce: boolean) {
      if (disposed) return;
      reducedMotion = reduce;
      if (reduce && (state === 'opening' || state === 'closing')) finish();
    },
    subscribeFold(listener: (status: FoldStatus) => void) {
      if (disposed) return () => {};
      listeners.add(listener);
      listener({ state, requestedOpen: target === bookFold.openAngle });
      return () => { listeners.delete(listener); };
    },
    dispose() {
      disposed = true;
      listeners.clear();
    },
  };
}

import { MOUSE, TOUCH, type OrthographicCamera, type PerspectiveCamera, type Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type ViewCamera = PerspectiveCamera | OrthographicCamera;
export interface CameraActions { zoomIn(): void; zoomOut(): void; resetView(): void; }
const arrows = new Map<string, readonly [number, number]>([
  ['ArrowLeft', [1, 0]], ['ArrowRight', [-1, 0]], ['ArrowUp', [0, 1]], ['ArrowDown', [0, -1]],
]);
export function createCameraControls(
  camera: ViewCamera, canvas: HTMLCanvasElement, size: number,
  onReducedMotion: (reduce: boolean) => void = () => {},
) {
  const orbit = new OrbitControls(camera, canvas);
  orbit.minDistance = size / 10;
  orbit.maxDistance = size * 100;
  orbit.minZoom = .05; orbit.maxZoom = 20;
  let suspended = false;
  let knolled = false;
  let disposed = false;
  let reset = () => orbit.reset();
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  function flush() {
    // Drain OrbitControls' private damping deltas without applying the remaining
    // inertia to the displayed pose when another owner acquires the camera.
    const position = orbit.object.position.clone();
    const target = orbit.target.clone();
    const damping = orbit.enableDamping;
    orbit.enableDamping = false;
    orbit.update();
    orbit.object.position.copy(position);
    orbit.target.copy(target);
    orbit.update();
    orbit.enableDamping = damping;
  }
  function motion() {
    flush();
    orbit.enableDamping = !preference.matches;
    onReducedMotion(preference.matches);
  }
  motion();
  preference.addEventListener('change', motion);
  const actions: CameraActions = {
    zoomIn() { if (!disposed && !suspended) orbit.dollyIn(.8); },
    zoomOut() { if (!disposed && !suspended) orbit.dollyOut(.8); },
    resetView() { if (!disposed && !suspended) { flush(); reset(); } },
  };
  function keydown(event: KeyboardEvent) {
    if (suspended || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = arrows.get(event.key);
    if (direction) {
      const [x, y] = direction;
      if (knolled || event.shiftKey) orbit.pan(x * 24, y * 24);
      else if (x) orbit.rotateLeft(x * Math.PI / 12);
      else orbit.rotateUp(y * Math.PI / 12);
    } else if (event.key === '+' || event.key === '=') actions.zoomIn();
    else if (event.key === '-') actions.zoomOut();
    else if (event.key === 'Home') actions.resetView();
    else return;
    event.preventDefault();
  }
  const focus = () => canvas.focus({ preventScroll: true });
  canvas.addEventListener('keydown', keydown);
  canvas.addEventListener('pointerdown', focus);
  return {
    ...actions, orbit,
    setReset(callback: () => void) { reset = callback; },
    setSuspended(value: boolean) {
      // Flush only when acquiring ownership; no damping update during playback.
      if (value && !suspended) flush();
      suspended = value; orbit.enabled = !value;
    },
    setCamera(next: ViewCamera, grid: boolean) {
      orbit.object = next;
      knolled = grid;
      orbit.enableRotate = !grid;
      orbit.mouseButtons.LEFT = grid ? MOUSE.PAN : MOUSE.ROTATE;
      orbit.touches.ONE = grid ? TOUCH.PAN : TOUCH.ROTATE;
      orbit.touches.TWO = grid ? TOUCH.DOLLY_PAN : TOUCH.DOLLY_PAN;
    },
    setPose(position: Vector3, target: Vector3) {
      orbit.object.position.copy(position); orbit.target.copy(target);
      orbit.object.lookAt(target); orbit.object.updateMatrixWorld();
    },
    update() { if (!disposed && !suspended) orbit.update(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      preference.removeEventListener('change', motion);
      canvas.removeEventListener('keydown', keydown);
      canvas.removeEventListener('pointerdown', focus);
      orbit.dispose();
    },
  };
}
export type ViewControls = ReturnType<typeof createCameraControls>;

import type { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface CameraActions {
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
}

const zoomScale = 0.8;
const rotationStep = Math.PI / 12;
const panStepPixels = 24;
const arrowDirections = new Map<string, readonly [number, number]>([
  ['ArrowLeft', [1, 0]],
  ['ArrowRight', [-1, 0]],
  ['ArrowUp', [0, 1]],
  ['ArrowDown', [0, -1]],
]);

export function createCameraControls(
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  size: number,
) {
  const orbit = new OrbitControls(camera, canvas);
  orbit.minDistance = size;
  orbit.maxDistance = size * 10;
  orbit.saveState();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function updateMotionPreference() {
    orbit.enableDamping = !reducedMotion.matches;
    orbit.update();
  }
  updateMotionPreference();
  reducedMotion.addEventListener('change', updateMotionPreference);

  const actions: CameraActions = {
    zoomIn: () => orbit.dollyIn(zoomScale),
    zoomOut: () => orbit.dollyOut(zoomScale),
    resetView() {
      // Flush pending damping before restoring the saved camera pose.
      const damping = orbit.enableDamping;
      orbit.enableDamping = false;
      orbit.update();
      orbit.reset();
      orbit.enableDamping = damping;
    },
  };

  function onKeyDown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const direction = arrowDirections.get(event.key);
    if (direction) {
      const [horizontal, vertical] = direction;
      if (event.shiftKey) {
        orbit.pan(horizontal * panStepPixels, vertical * panStepPixels);
      } else if (horizontal !== 0) {
        orbit.rotateLeft(horizontal * rotationStep);
      } else {
        orbit.rotateUp(vertical * rotationStep);
      }
    } else if (event.key === '+' || event.key === '=') {
      actions.zoomIn();
    } else if (event.key === '-') {
      actions.zoomOut();
    } else if (event.key === 'Home') {
      actions.resetView();
    } else {
      return;
    }
    event.preventDefault();
  }

  function focusViewer() {
    canvas.focus({ preventScroll: true });
  }
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('pointerdown', focusViewer);

  return {
    ...actions,
    update: () => orbit.update(),
    dispose() {
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('pointerdown', focusViewer);
      reducedMotion.removeEventListener('change', updateMotionPreference);
      orbit.dispose();
    },
  };
}

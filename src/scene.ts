import {
  Color, DirectionalLight, HemisphereLight, PerspectiveCamera, Scene, WebGLRenderer,
} from 'three';
import { createCameraControls, type CameraActions } from './controls';
import { createPhone } from './parts';
import { dimensions } from './model';
import { createTransitionController, type TransitionActions } from './transition';
import { createCameraCoordinator } from './framing';

export interface ViewerActions extends CameraActions, TransitionActions {}
export function createViewer(container: HTMLElement) {
  const scene = new Scene();
  scene.background = new Color(0x131922);
  const size = dimensions.height;
  const perspective = new PerspectiveCamera(40, 1, size / 100, size * 100);
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '3D view of the exploded illustrative iPhone Duo');
  canvas.setAttribute('aria-describedby', 'viewer-interaction-hint viewer-keyboard-help');
  canvas.tabIndex = 0;
  container.append(canvas);
  const phone = createPhone();
  // One live preference listener; controller is synchronized after construction.
  let transition: ReturnType<typeof createTransitionController> | undefined;
  const controls = createCameraControls(perspective, canvas, size, reduce => transition?.setReducedMotion(reduce));
  const camera = createCameraCoordinator(phone, controls, perspective);
  transition = createTransitionController(phone, camera);
  transition.setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const unsubscribe = transition.subscribe(status => {
    const view = status.target === 'assembled' ? `${status.fold} assembled` : status.target;
    canvas.setAttribute('aria-label', `3D view of the ${view} illustrative iPhone Duo`);
  });
  scene.add(phone.assembly);
  scene.add(new HemisphereLight(0xffffff, 0x63758f, 3));
  const light = new DirectionalLight(0xffffff, 4);
  light.position.set(size, size * 2, size * 3);
  scene.add(light);
  const fill = new DirectionalLight(0x9bbdff, 2);
  fill.position.set(-size, -size, -size * 2);
  scene.add(fill);
  let disposed = false;
  function resize() {
    if (disposed) return;
    const { clientWidth: width, clientHeight: height } = container;
    if (width <= 0 || height <= 0) return;
    camera.resize(width / height);
    renderer.setSize(width, height);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container); resize();
  let frame: number;
  function animate(now: number) {
    if (disposed) return;
    transition!.update(now);
    controls.update();
    camera.updateClipping();
    renderer.render(scene, camera.camera);
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
  return {
    zoomIn: controls.zoomIn, zoomOut: controls.zoomOut, resetView: controls.resetView,
    setMode: transition.setMode, toggleFold: transition.toggleFold,
    toggleKnolling: transition.toggleKnolling, setDuration: transition.setDuration,
    subscribe: transition.subscribe,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame); observer.disconnect(); unsubscribe();
      transition!.dispose(); camera.dispose(); controls.dispose();
      scene.remove(phone.assembly); phone.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}

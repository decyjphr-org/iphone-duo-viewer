import {
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { createCameraControls } from './controls';
import { createPhone } from './parts';
import { closedIPhoneDuo } from './specs';
import { createFoldController, type FoldActions } from './fold';
import type { CameraActions } from './controls';
import { getHomeFrame, sweepRadius } from './framing';

export interface ViewerActions extends CameraActions, FoldActions {}

export function createViewer(container: HTMLElement) {
  const scene = new Scene();
  scene.background = new Color(0x131922);

  const size = Math.max(...Object.values(closedIPhoneDuo));
  const camera = new PerspectiveCamera(40, 1, size / 100, size * 100);
  camera.position.set(size * 1.3, size * 0.8, size * 2);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', '3D view of the closed iPhone Duo');
  renderer.domElement.setAttribute(
    'aria-describedby',
    'viewer-interaction-hint viewer-keyboard-help',
  );
  renderer.domElement.tabIndex = 0;
  container.append(renderer.domElement);

  const phone = createPhone();
  const fold = createFoldController(phone.hinge);
  const controls = createCameraControls(camera, renderer.domElement, size, fold.setReducedMotion);
  const unsubscribeDescription = fold.subscribeFold(({ state }) => {
    const description = state === 'closed' ? 'closed iPhone Duo'
      : `${state} schematic iPhone Duo`;
    renderer.domElement.setAttribute('aria-label', `3D view of the ${description}`);
  });
  scene.add(phone.assembly);
  scene.add(new HemisphereLight(0xffffff, 0x334155, 3));
  const keyLight = new DirectionalLight(0xffffff, 4);
  keyLight.position.set(size, size * 2, size * 3);
  scene.add(keyLight);

  let firstResize = true;
  function resize() {
    const { clientWidth: width, clientHeight: height } = container;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    const home = getHomeFrame(camera);
    camera.far = Math.max(size * 100, home.distance * 3 + sweepRadius);
    camera.updateProjectionMatrix();
    // Refit an untouched home, but preserve an orbit/pan chosen by the user.
    controls.setHome(home.position, home.target, home.distance, firstResize);
    firstResize = false;
    renderer.setSize(width, height);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  let frame: number;
  function animate(now: number) {
    fold.update(now);
    controls.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);

  return {
    zoomIn: controls.zoomIn,
    zoomOut: controls.zoomOut,
    resetView: controls.resetView,
    toggleFold: fold.toggleFold,
    subscribeFold: fold.subscribeFold,
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      unsubscribeDescription();
      fold.dispose();
      controls.dispose();
      scene.remove(phone.assembly);
      phone.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

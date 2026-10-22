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

  const controls = createCameraControls(camera, renderer.domElement, size);

  const phone = createPhone();
  scene.add(phone.assembly);
  scene.add(new HemisphereLight(0xffffff, 0x334155, 3));
  const keyLight = new DirectionalLight(0xffffff, 4);
  keyLight.position.set(size, size * 2, size * 3);
  scene.add(keyLight);

  function resize() {
    const { clientWidth: width, clientHeight: height } = container;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  let frame: number;
  function animate() {
    controls.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  }
  animate();

  return {
    zoomIn: controls.zoomIn,
    zoomOut: controls.zoomOut,
    resetView: controls.resetView,
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.remove(phone.assembly);
      phone.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

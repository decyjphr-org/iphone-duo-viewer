import { PerspectiveCamera, Vector3 } from 'three';
import { bookFold } from './layout';
import { closedIPhoneDuo } from './specs';

// Sphere encloses every panel corner throughout the entire hinge sweep.
const { width, height, depth } = closedIPhoneDuo;
export const sweepRadius = Math.hypot(width, height / 2, depth / 2);
const direction = new Vector3(1.3, 0.8, 2).normalize();

export function getHomeFrame(camera: PerspectiveCamera) {
  const verticalHalfFov = camera.fov * Math.PI / 360;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * camera.aspect);
  const distance = 1.1 * sweepRadius / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov));
  const target = new Vector3(bookFold.hingeX, 0, 0);
  return {
    target,
    position: direction.clone().multiplyScalar(distance).add(target),
    distance,
  };
}

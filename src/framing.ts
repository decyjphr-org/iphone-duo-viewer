import { Box3, OrthographicCamera, PerspectiveCamera, Sphere, Spherical, Vector3 } from 'three';
import { dimensions as d, type Mode } from './model';
import type { Phone } from './parts';
import type { ViewControls } from './controls';

export const sweepRadius = Math.hypot(d.width, d.height / 2, d.depth);
const direction = new Vector3(1.1, .55, 1.6).normalize();
interface Frame { position: Vector3; target: Vector3; distance: number; }
export function getHomeFrame(camera: PerspectiveCamera, bounds?: Box3): Frame {
  const sphere = bounds?.getBoundingSphere(new Sphere())
    ?? new Sphere(new Vector3(-d.width / 2, 0, 0), sweepRadius);
  const vertical = camera.fov * Math.PI / 360;
  const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
  const distance = 1.12 * sphere.radius / Math.sin(Math.min(vertical, horizontal));
  return { target: sphere.center, position: direction.clone().multiplyScalar(distance).add(sphere.center), distance };
}
export function createCameraCoordinator(phone: Phone, controls: ViewControls, perspective: PerspectiveCamera) {
  const orthographic = new OrthographicCamera(-1, 1, 1, -1, perspective.near, perspective.far);
  let activeCamera: PerspectiveCamera | OrthographicCamera = perspective;
  let mode: Mode = 'exploded';
  let busy = false;
  let aspect = 1;
  let savedExploded: { position: Vector3; target: Vector3; aspect: number } | undefined;
  let from: Frame;
  let to: Frame;
  let arc = 0;
  let gridHandoff = false;
  let segmentStart = 0;
  let lastProgress = 0;
  let gridHalfHeight = 1;
  const workingPosition = new Vector3();
  const workingTarget = new Vector3();
  const directionWork = new Vector3();
  const fromDirection = new Spherical();
  const toDirection = new Spherical();
  let azimuthDelta = 0;
  const tan = Math.tan(perspective.fov * Math.PI / 360);
  const bounds = (current: Mode) => phone.layouts.bounds[current];
  function home(current: Mode): Frame {
    if (current === 'assembled') return getHomeFrame(perspective);
    if (current === 'exploded') return getHomeFrame(perspective, bounds(current));
    const box = bounds(current);
    const size = box.getSize(new Vector3());
    gridHalfHeight = Math.max(size.y / 2, size.x / (2 * aspect)) * 1.12;
    const target = box.getCenter(new Vector3());
    const distance = gridHalfHeight / tan;
    return { position: target.clone().add(new Vector3(0, 0, distance)), target, distance };
  }
  function destination(current: Mode): Frame {
    const frame = home(current);
    if (current === 'exploded' && savedExploded) {
      const factor = Math.max(1, 1 / aspect) / Math.max(1, 1 / savedExploded.aspect);
      frame.target = savedExploded.target.clone();
      frame.position = savedExploded.position.clone().sub(frame.target).multiplyScalar(factor).add(frame.target);
      frame.distance = frame.position.distanceTo(frame.target);
    }
    return frame;
  }
  function clearance() {
    return getHomeFrame(perspective, bounds(gridHandoff ? 'knolled' : 'exploded')).distance
      * (gridHandoff ? .25 : .15);
  }
  function cacheDirectionPath() {
    fromDirection.setFromVector3(directionWork.copy(from.position).sub(from.target)).makeSafe();
    toDirection.setFromVector3(directionWork.copy(to.position).sub(to.target)).makeSafe();
    // Unwrap the shortest azimuth, including a deterministic half-turn for rear
    // views. Interpolated polar angles stay away from the Y-up lookAt poles.
    const delta = toDirection.theta - fromDirection.theta;
    azimuthDelta = Math.atan2(Math.sin(delta), Math.cos(delta));
  }
  function projectGrid() {
    orthographic.left = -gridHalfHeight * aspect;
    orthographic.right = gridHalfHeight * aspect;
    orthographic.top = gridHalfHeight; orthographic.bottom = -gridHalfHeight;
    orthographic.zoom = 1;
    orthographic.updateProjectionMatrix();
  }
  function apply(frame: Frame) {
    controls.setPose(frame.position, frame.target);
    activeCamera.updateProjectionMatrix();
  }
  function usePerspective() {
    if (activeCamera === perspective) return;
    const halfHeight = gridHalfHeight / orthographic.zoom;
    const target = controls.orbit.target.clone();
    perspective.zoom = 1;
    perspective.position.copy(target).add(new Vector3(0, 0, halfHeight / tan));
    perspective.lookAt(target);
    activeCamera = perspective;
    controls.setCamera(perspective, false);
    perspective.updateProjectionMatrix(); perspective.updateMatrixWorld();
  }
  function finish() {
    if (!busy) return;
    if (mode === 'knolled') {
      projectGrid();
      activeCamera = orthographic;
      controls.setCamera(orthographic, true);
    }
    apply(to);
    controls.setSuspended(false);
    busy = false;
  }
  function reset() {
    const frame = home(mode);
    if (mode === 'knolled') projectGrid();
    else perspective.zoom = 1;
    apply(frame);
  }
  controls.setReset(reset);
  function resize(nextAspect: number) {
    if (!Number.isFinite(nextAspect) || nextAspect <= 0) return;
    const previousHome = home(mode);
    const atHome = activeCamera.position.distanceTo(previousHome.position) < 1e-7
      && controls.orbit.target.distanceTo(previousHome.target) < 1e-7;
    const oldAspect = aspect;
    aspect = nextAspect; perspective.aspect = aspect;
    perspective.updateProjectionMatrix();
    if (activeCamera === orthographic) {
      home('knolled');
      // Preserve pan and relative zoom; refit scale for the new aspect.
      orthographic.left = -gridHalfHeight * aspect;
      orthographic.right = gridHalfHeight * aspect;
      orthographic.top = gridHalfHeight; orthographic.bottom = -gridHalfHeight;
      orthographic.updateProjectionMatrix();
    } else if (!busy) {
      if (atHome) reset();
      else {
        const target = controls.orbit.target;
        const factor = Math.max(1, 1 / aspect) / Math.max(1, 1 / oldAspect);
        perspective.position.sub(target).multiplyScalar(factor).add(target);
      }
    }
    if (busy) {
      // Preserve the displayed pose and remaining portion of the original clock.
      from = {
        position: perspective.position.clone(), target: controls.orbit.target.clone(),
        distance: perspective.position.distanceTo(controls.orbit.target),
      };
      segmentStart = lastProgress;
      to = destination(mode);
      arc = clearance();
      cacheDirectionPath();
    }
    controls.orbit.maxDistance = Math.max(radius * 20, home(mode).distance * 4);
  }
  reset();
  // Exact, finite depth planes enclose the largest grid and all camera paths.
  const radius = phone.layouts.bounds.knolled.getBoundingSphere(new Sphere()).radius;
  function updateClipping() {
    const distance = activeCamera.position.distanceTo(controls.orbit.target);
    // Keep depth precision useful for inset decorative surfaces at every zoom.
    activeCamera.near = Math.max(d.depth / 10, distance / 20);
    activeCamera.far = Math.max(activeCamera.near * 2, distance + radius * 4);
    activeCamera.updateProjectionMatrix();
  }
  controls.orbit.minDistance = Math.max(d.depth, sweepRadius / 5);
  controls.orbit.maxDistance = radius * 20;
  updateClipping();
  return {
    get camera(): PerspectiveCamera | OrthographicCamera { return activeCamera; },
    get busy() { return busy; },
    resize, updateClipping,
    request(next: Mode, _duration: number, _now: number) {
      if (mode === 'exploded' && !busy) {
        // Save only an Exploded view, never overwrite it with an Assembled pose.
        savedExploded = {
          position: perspective.position.clone(), target: controls.orbit.target.clone(),
          aspect,
        };
      }
      controls.setSuspended(true);
      usePerspective();
      from = {
        position: perspective.position.clone(), target: controls.orbit.target.clone(),
        distance: perspective.position.distanceTo(controls.orbit.target),
      };
      gridHandoff = next === 'knolled' || mode === 'knolled' || (busy && gridHandoff);
      mode = next;
      to = destination(next);
      segmentStart = lastProgress = 0;
      // Normalize perspective zoom without changing image scale at ownership handoff.
      if (perspective.zoom !== 1) {
        from.position.sub(from.target).divideScalar(perspective.zoom).add(from.target);
        from.distance = from.position.distanceTo(from.target);
        perspective.zoom = 1; perspective.updateProjectionMatrix();
      }
      // A cached clearance arc pulls back during layout expansion, no per-frame bounds.
      arc = clearance();
      cacheDirectionPath();
      controls.orbit.maxDistance = Math.max(radius * 20, to.distance * 4);
      busy = true;
    },
    update(progress: number) {
      if (!busy) return;
      lastProgress = progress;
      const remaining = 1 - segmentStart;
      const local = remaining > 0 ? Math.max(0, Math.min(1, (progress - segmentStart) / remaining)) : 1;
      if (local === 0) { apply(from); return; }
      if (local === 1) { apply(to); return; }
      workingTarget.lerpVectors(from.target, to.target, local);
      directionWork.setFromSphericalCoords(1,
        fromDirection.phi + (toDirection.phi - fromDirection.phi) * local,
        fromDirection.theta + azimuthDelta * local);
      // Keep direction unit-length and distance independent: opposing offsets
      // can never cancel at the target. Radius is bounded by the endpoint radii
      // plus cached clearance, with a specs-derived positive safety floor.
      const distance = Math.max(d.depth / 10,
        from.distance + (to.distance - from.distance) * local + arc * 4 * local * (1 - local));
      workingPosition.copy(workingTarget).addScaledVector(directionWork, distance);
      controls.setPose(workingPosition, workingTarget);
    },
    finish,
    dispose() { busy = false; },
  };
}

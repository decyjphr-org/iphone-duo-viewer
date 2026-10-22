import { Box3, Euler, Matrix4, Quaternion, Vector3, type Group, type Mesh } from 'three';
import { dimensions as d, panel, ratios, type Mode, type ModuleDefinition } from './model';

export const bookFold = {
  panelDepth: panel.depth, hingeX: -panel.width / 2, openAngle: Math.PI,
} as const;
export interface Pose {
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
}
export type Layouts = Readonly<Record<Mode, Matrix4>>;
export function decompose(matrix: Matrix4): Pose {
  const pose = { position: new Vector3(), quaternion: new Quaternion(), scale: new Vector3() };
  matrix.decompose(pose.position, pose.quaternion, pose.scale);
  return pose;
}
export function applyPose(object: Group | Mesh, pose: Pose) {
  object.position.copy(pose.position); object.quaternion.copy(pose.quaternion); object.scale.copy(pose.scale);
}
export function partLayouts(part: Mesh): Layouts { return part.userData.layouts as Layouts; }

/** Only called at construction. All targets are local to persistent parents. */
export function computeLayouts(assembly: Group, hinge: Group, parts: Mesh[]) {
  parts.forEach(part => {
    part.updateMatrix();
    part.userData.layouts = { assembled: part.matrix.clone() };
  });
  hinge.rotation.y = -Math.PI;
  assembly.updateMatrixWorld(true);
  const canonicalParents = new Map(parts.map(part => [part, part.parent!.matrixWorld.clone()]));
  const assembledBounds = new Box3().setFromObject(assembly);
  const explodedBounds = new Box3();
  const orientedBounds = parts.map(part => {
    const def = part.userData.definition as ModuleDefinition;
    const rotation = new Matrix4().makeRotationFromEuler(new Euler(...def.knollOrientation));
    return part.geometry.boundingBox!.clone().applyMatrix4(rotation);
  });
  const gap = d.width * ratios.gap;
  const cellWidth = Math.max(...orientedBounds.map(box => box.max.x - box.min.x)) + gap;
  const cellHeight = Math.max(...orientedBounds.map(box => box.max.y - box.min.y)) + gap;
  const knolledBounds = new Box3();
  parts.forEach((part, index) => {
    const def = part.userData.definition as ModuleDefinition;
    const parent = canonicalParents.get(part)!;
    const world = parent.clone().multiply(part.userData.layouts.assembled);
    // Explode along canonical screen normal regardless of front parent's rotation.
    const offset = new Matrix4().makeTranslation(0, 0, def.layer * d.depth * ratios.layer);
    const exploded = parent.clone().invert().multiply(offset.multiply(world));
    const center = orientedBounds[index].getCenter(new Vector3());
    const desired = new Matrix4().compose(
      new Vector3((index % 6 - 2.5) * cellWidth - center.x,
        (2 - Math.floor(index / 6)) * cellHeight - center.y, -center.z),
      new Quaternion().setFromEuler(new Euler(...def.knollOrientation)),
      new Vector3(1, 1, 1),
    );
    const knolled = parent.clone().invert().multiply(desired);
    part.userData.layouts = {
      assembled: part.userData.layouts.assembled,
      exploded: exploded.clone(), knolled: knolled.clone(),
    } satisfies Layouts;
    explodedBounds.union(part.geometry.boundingBox!.clone().applyMatrix4(parent.clone().multiply(exploded)));
    knolledBounds.union(part.geometry.boundingBox!.clone().applyMatrix4(desired));
  });
  hinge.rotation.y = 0;
  assembly.updateMatrixWorld(true);
  return {
    bounds: { assembled: assembledBounds, exploded: explodedBounds, knolled: knolledBounds },
    gap, cellWidth, cellHeight,
  };
}

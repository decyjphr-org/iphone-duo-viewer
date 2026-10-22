import {
  Bone, BufferGeometry, Float32BufferAttribute, Quaternion, Skeleton, SkinnedMesh,
  Uint16BufferAttribute, Vector3, type Material,
} from 'three';
import { bendRadius, display } from './model';

/**
 * A single connected, closed sheet. Each material-coordinate column has one
 * bone; the central columns resolve the finite-radius bend, not two panels
 * hidden behind a hinge. Straight attachments slide by half the reserved arc.
 * This is illustrative kinematics, not a claim about hardware mechanics.
 */
export function createFlexibleDisplay(material: Material) {
  const halfArc = Math.PI * bendRadius / 2;
  const coordinates = [-display.width / 2,
    ...Array.from({ length: 65 }, (_, i) => halfArc * (i / 32 - 1)), display.width / 2];
  const positions: number[] = [], indices: number[] = [], weights: number[] = [], skinIndices: number[] = [];
  coordinates.forEach((s, column) => {
    for (const [y, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      positions.push(s, y * display.height / 2, z * display.thickness / 2);
      skinIndices.push(column, 0, 0, 0); weights.push(1, 0, 0, 0);
    }
    if (column) {
      for (let side = 0; side < 4; side++) {
        const a = (column - 1) * 4 + side, b = (column - 1) * 4 + (side + 1) % 4;
        indices.push(a, b, b + 4, a, b + 4, a + 4);
      }
    }
  });
  const end = (coordinates.length - 1) * 4;
  indices.push(0, 2, 1, 0, 3, 2, end, end + 1, end + 2, end, end + 2, end + 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const mesh = new SkinnedMesh(geometry, material);
  const bones = coordinates.map(s => { const bone = new Bone(); bone.position.x = s; mesh.add(bone); return bone; });
  mesh.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones); mesh.bind(skeleton);
  // Bounds for all layouts are cached separately; do not cull using a stale
  // undeformed geometry sphere while the finite-radius sheet bends.
  mesh.frustumCulled = false;
  let angle = 0;
  function deform(value: number) {
    angle = value;
    const halfBend = bendRadius * value / 2;
    bones.forEach((bone, i) => {
      const s = coordinates[i];
      const theta = Math.max(0, Math.min(value, (halfBend - s) / bendRadius));
      let x = -bendRadius * Math.sin(theta);
      let z = -bendRadius * Math.cos(theta);
      if (s > halfBend) x += s - halfBend;
      else if (s < -halfBend) {
        x += (s + halfBend) * Math.cos(value);
        z -= (s + halfBend) * Math.sin(value);
      }
      bone.position.set(x, 0, z + bendRadius);
      bone.rotation.y = theta;
    });
  }
  // Cache exact bone endpoints once. Playback evaluates only the current
  // constrained bend, never rebuilds geometry or recalculates a target pose.
  const endpoints = [0, Math.PI].map(value => {
    deform(value);
    return bones.map(bone => ({ position: bone.position.clone(), quaternion: bone.quaternion.clone() }));
  });
  function articulate(value: number) {
    const endpoint = value === 0 ? endpoints[0] : value === Math.PI ? endpoints[1] : undefined;
    if (!endpoint) { deform(value); return; }
    angle = value;
    bones.forEach((bone, i) => {
      bone.position.copy(endpoint[i].position); bone.quaternion.copy(endpoint[i].quaternion);
    });
  }
  articulate(0);
  return { mesh, skeleton, articulate, get angle() { return angle; } };
}

// Fold is a target pose, never a second transform writer.
export function foldQuaternion(open: boolean) {
  return new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), open ? -Math.PI : 0);
}
export type FoldState = 'closed' | 'opening' | 'open' | 'closing';

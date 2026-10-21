import type { Object3D } from 'three';

export function storePartLayouts(part: Object3D): void {
  part.updateMatrix();
  part.userData.layouts = {
    exploded: part.matrix.clone(),
    knolled: part.matrix.clone(),
  };
}

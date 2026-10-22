import type { Object3D } from 'three';
import { closedIPhoneDuo } from './specs';

// Schematic book fold, not a verified hardware hinge.
export const bookFold = {
  panelDepth: closedIPhoneDuo.depth / 2,
  hingeX: -closedIPhoneDuo.width / 2,
  rearZ: -closedIPhoneDuo.depth / 4,
  frontX: closedIPhoneDuo.width / 2,
  frontZ: closedIPhoneDuo.depth / 4,
  openAngle: Math.PI,
} as const;

export function storePartLayouts(part: Object3D): void {
  part.updateMatrix();
  part.userData.layouts = {
    exploded: part.matrix.clone(),
    knolled: part.matrix.clone(),
  };
}

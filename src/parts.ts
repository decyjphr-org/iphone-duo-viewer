import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { storePartLayouts } from './layout';
import { closedIPhoneDuo } from './specs';

export function createPhone() {
  const { width, height, depth } = closedIPhoneDuo;
  const geometry = new BoxGeometry(width, height, depth);
  const material = new MeshStandardMaterial({
    color: 0x9aabbc,
    metalness: 0.35,
    roughness: 0.4,
  });
  const body = new Mesh(geometry, material);
  body.name = 'closed-body';
  storePartLayouts(body);

  const assembly = new Group();
  assembly.name = 'iphone-duo';
  assembly.add(body);

  return {
    assembly,
    dispose() {
      assembly.remove(body);
      geometry.dispose();
      material.dispose();
    },
  };
}

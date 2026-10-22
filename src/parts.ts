import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { bookFold, storePartLayouts } from './layout';
import { closedIPhoneDuo } from './specs';

export function createPhone() {
  const { width, height } = closedIPhoneDuo;
  const geometry = new BoxGeometry(width, height, bookFold.panelDepth);
  const material = new MeshStandardMaterial({
    color: 0x9aabbc,
    metalness: 0.35,
    roughness: 0.4,
  });
  const rear = new Mesh(geometry, material);
  rear.name = 'rear-panel';
  rear.position.z = bookFold.rearZ;
  const hinge = new Group();
  hinge.name = 'book-hinge';
  hinge.position.x = bookFold.hingeX;
  const front = new Mesh(geometry, material);
  front.name = 'front-panel';
  front.position.set(bookFold.frontX, 0, bookFold.frontZ);
  hinge.add(front);
  storePartLayouts(rear);
  storePartLayouts(front);
  storePartLayouts(hinge);

  const assembly = new Group();
  assembly.name = 'iphone-duo';
  assembly.add(rear, hinge);

  return {
    assembly,
    hinge,
    dispose() {
      assembly.remove(rear, hinge);
      hinge.remove(front);
      geometry.dispose();
      material.dispose();
    },
  };
}

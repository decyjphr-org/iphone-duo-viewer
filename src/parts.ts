import {
  BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial,
  Path, Shape, TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bendRadius, dimensions as d, display, inventory, panel, ratios, type ModuleDefinition } from './model';
import { bookFold, computeLayouts } from './layout';
import { createFlexibleDisplay } from './fold';

function roundedPath(w: number, h: number, r: number, def?: ModuleDefinition) {
  const path = new Shape();
  path.moveTo(-w / 2 + r, -h / 2);
  if (def?.name === 'rear-frame') {
    const port = inventory.find(module => module.kind === 'port')!;
    const left = (port.center[0] - port.size[0] / 2) * panel.width;
    const right = (port.center[0] + port.size[0] / 2) * panel.width;
    const top = -h / 2 + port.size[1] * d.height / 2;
    path.lineTo(left, -h / 2); path.lineTo(left, top);
    path.lineTo(right, top); path.lineTo(right, -h / 2);
  }
  path.lineTo(w / 2 - r, -h / 2);
  path.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  if (def?.kind === 'frame') {
    inventory.filter(module => module.assembly === def.assembly && module.kind === 'button')
      .sort((a, b) => a.center[1] - b.center[1])
      .forEach(button => {
        const low = (button.center[1] - button.size[1] / 2) * d.height;
        const high = (button.center[1] + button.size[1] / 2) * d.height;
        const inset = w / 2 - button.size[0] * panel.width;
        path.lineTo(w / 2, low); path.lineTo(inset, low);
        path.lineTo(inset, high); path.lineTo(w / 2, high);
      });
  }
  path.lineTo(w / 2, h / 2 - r);
  path.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  path.lineTo(-w / 2 + r, h / 2);
  path.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  path.lineTo(-w / 2, -h / 2 + r);
  path.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return path;
}
function plate(w: number, h: number, depth: number, frame?: ModuleDefinition, cameraCutouts = false) {
  const shape = roundedPath(w, h, Math.min(w, h) * ratios.corner, frame);
  if (frame) {
    const inset = panel.width * ratios.rim;
    // Opposite winding is handled by ShapeUtils during triangulation.
    const hole = roundedPath(w - inset * 2, h - inset * 2, w * ratios.corner);
    shape.holes.push(new Path(hole.getPoints()));
  }
  if (cameraCutouts) {
    for (const y of [.30, .12]) {
      const hole = new Path();
      hole.absellipse(-panel.width * .27, d.height * y, panel.width * .105, d.height * .075, 0, Math.PI * 2);
      shape.holes.push(hole);
    }
  }
  return new ExtrudeGeometry(shape, {
    depth, bevelEnabled: false, curveSegments: 8, steps: 1,
  }).translate(0, 0, -depth / 2);
}

export function createPhone() {
  const assembly = new Group();
  assembly.name = 'iphone-duo';
  const rear = new Group(); rear.name = 'rear-assembly';
  const hinge = new Group(); hinge.name = 'book-hinge'; hinge.position.x = bookFold.hingeX;
  const front = new Group(); front.name = 'front-assembly'; front.position.x = panel.width / 2;
  const spine = new Group(); spine.name = 'hinge-assembly'; spine.position.x = bookFold.hingeX;
  hinge.add(front);
  assembly.add(rear, hinge, spine);

  const geometries = new Map<string, BufferGeometry>();
  const materials = new Map<string, MeshStandardMaterial>();
  const palette: Record<string, number> = {
    metal: 0x9aabba, cover: 0xd1d7db, glass: 0x103c59, screen: 0x4fd1d0,
    battery: 0x303944, board: 0x207b66, gold: 0xbca365, dark: 0x101b2a,
    lens: 0x1b6489, support: 0x718092,
  };
  function material(key: string) {
    if (!materials.has(key)) materials.set(key, new MeshStandardMaterial({
      color: palette[key], metalness: key === 'metal' || key === 'gold' ? .75 : .25,
      roughness: key === 'glass' || key === 'lens' ? .2 : .48,
    }));
    return materials.get(key)!;
  }
  function build(def: ModuleDefinition): { geometry: BufferGeometry; colors: string[] } {
    const [w, h, z] = def.size.map((value, i) => value * [panel.width, d.height, 2 * panel.depth][i]);
    const pieces: BufferGeometry[] = [];
    const colors: string[] = [];
    const add = (geo: BufferGeometry, color: string) => {
      const flat = geo.index ? geo.toNonIndexed() : geo;
      if (flat !== geo) geo.dispose();
      flat.clearGroups();
      pieces.push(flat); colors.push(color);
    };
    const box = (bw: number, bh: number, bz: number, x: number, y: number, zz: number, color: string) =>
      add(new BoxGeometry(bw, bh, bz).translate(x, y, zz), color);
    const outward = def.assembly === 'front' ? 1 : -1;
    if (def.kind === 'frame') {
      // U-shaped rim: the hinge-facing edge is open for the continuous sheet.
      // Both active rectangles fit the recess, including the taller cover.
      const clearance = display.thickness * 2;
      const holeHeight = Math.max(display.height, display.coverHeight) + clearance * 2;
      const railHeight = (h - holeHeight) / 2;
      const innerRight = display.width / 2 - panel.width / 2 + clearance;
      const railWidth = w / 2 - innerRight;
      box(w, railHeight, z, 0, (h - railHeight) / 2, 0, 'metal');
      box(w, railHeight, z, 0, -(h - railHeight) / 2, 0, 'metal');
      box(railWidth, holeHeight, z, (w - railWidth) / 2, 0, 0, 'metal');
    }
    else if (def.kind === 'camera') {
      add(plate(w, h, z), 'dark');
      const radius = Math.min(w, h) * .35;
      add(new TorusGeometry(radius, z * .04, 8, 32).translate(0, 0, outward * z / 2), 'metal');
      add(new CylinderGeometry(radius * .75, radius * .75, z * .05, 32)
        .rotateX(Math.PI / 2).translate(0, 0, outward * z * .51), 'lens');
    } else if (def.kind === 'coil') {
      for (let i = 0; i < 5; i++) {
        add(new TorusGeometry(w * (.23 + i * .05), w * .012, 8, 40), 'gold');
      }
    } else {
      const color = {
        cover: 'cover', display: 'glass', support: 'support', battery: 'battery',
        board: 'board', speaker: 'dark', port: 'metal', button: 'metal', hinge: 'metal',
      }[def.kind];
      add(plate(w, h, z, undefined, def.kind === 'cover'), color);
      if (def.kind === 'display') {
        // Decorative screen islands are merged into this module, not extra meshes.
        const face = def.name.includes('inner') ? -outward : outward;
        for (let i = 0; i < 3; i++) {
          box(w * .72, h * .15, z * .04, 0, h * (-.25 + i * .25), face * z * .58, 'screen');
        }
        box(w * .17, h * .018, z * .06, 0, h * .43, face * z * .58, 'dark');
      } else if (def.kind === 'battery') {
        box(w * .45, h * .08, z * .025, 0, 0, z * .51, 'support');
        box(w * .12, h * .04, z * .03, 0, h * .22, z * .52, 'gold');
      } else if (def.kind === 'board') {
        for (let i = 0; i < 3; i++) box(w * .19, h * .60, z * .08, w * (i - 1) * .29, 0, z * .54, 'metal');
      } else if (def.kind === 'speaker' || def.kind === 'port') {
        box(w * .70, h * .40, z * .04, 0, 0, z * .52, 'gold');
        if (def.kind === 'port') box(w * .70, h * .02, z * .55, 0, -h * .49, 0, 'dark');
      } else if (def.kind === 'cover') {
        // Authored, off-center emblem exercises bounds-aware centering.
        box(w * .12, h * .06, z * .06, w * .08, h * .08, -z * .53, 'metal');
      }
    }
    const geometry = mergeGeometries(pieces, true);
    pieces.forEach(piece => piece.dispose());
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return { geometry, colors };
  }
  const flexible = createFlexibleDisplay(material('glass'));
  geometries.set('inner-display', flexible.mesh.geometry);
  const parts = inventory.map(def => {
    if (def.name === 'inner-display') {
      const part = flexible.mesh;
      part.name = def.name; part.userData.definition = def;
      part.position.set(bookFold.hingeX, 0, -bendRadius);
      rear.add(part);
      return part;
    }
    const key = JSON.stringify([def.kind, def.size, def.assembly === 'front', def.name.includes('inner')]);
    let geometry = geometries.get(key);
    const built = !geometry ? build(def) : undefined;
    if (built) { geometry = built.geometry; geometries.set(key, geometry); }
    const colors = built?.colors ?? geometry!.userData.colors as string[];
    geometry!.userData.colors = colors;
    const part = new Mesh(geometry!, colors.map(material));
    part.name = def.name;
    part.userData.definition = def;
    const [x, y, z] = def.center;
    part.position.set(x * panel.width, y * d.height,
      z * (2 * panel.depth) + (def.assembly === 'hinge' ? 0 : (def.assembly === 'rear' ? -1 : 1) * panel.gap / 2));
    ({ rear, front, hinge: spine }[def.assembly]).add(part);
    return part;
  });
  const layouts = computeLayouts(assembly, hinge, parts);
  let disposed = false;
  return {
    assembly, hinge, parts, layouts, flexible,
    dispose() {
      if (disposed) return;
      disposed = true;
      assembly.clear();
      flexible.skeleton.dispose();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(value => value.dispose());
      geometries.clear(); materials.clear();
    },
  };
}
export type Phone = ReturnType<typeof createPhone>;

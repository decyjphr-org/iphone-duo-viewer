---
name: three.js standards
description: Scene, mesh, and animation conventions for the viewer's three.js code
applyTo: "src/**/*.ts"
---

- Create one `THREE.Group` per assembly and one `THREE.Mesh` per component.
- Set `mesh.name` to the kebab-case part name.
- Store each part's exploded and knolled transforms. Don't recompute them per frame.
- Animate transitions with a single `requestAnimationFrame` loop and easing. No `setInterval`.
- Dispose geometries and materials when you remove meshes.

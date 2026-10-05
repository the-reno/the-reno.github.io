# Basement 3D viewer — simple tools

This version keeps the existing KIRI shell in `room.gltf` and removes project-control behavior from the interface.

The page is designed for three lightweight actions on the real 3D basement:
- Measure two points. Scan-derived values are labeled SCAN; manually confirmed values can be marked VERIFIED.
- Trace a horizontal area in Top view and see approximate square feet.
- Drop a simple note directly on the model. Notes can be edited, moved, resolved/hidden or deleted.

Navigation remains the default interaction. There are no execution steps, task statuses, categories, assignees or workflow dashboards.

The `Project` button is reserved for the original Studio Duo project reference. The page expects `project.pdf` beside the viewer when that reference is added. The existing room scan does not contain detailed joists, pipes or beams, so measurements remain approximate until physically verified.

Local data uses `ronu.basement.simple.v2` in localStorage. Geometry is stored against the current model coordinates.

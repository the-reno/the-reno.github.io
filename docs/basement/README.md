# Basement reference tool

Canonical public source: **`the-reno/the-reno.github.io`, `docs/basement/`**.
GitHub Pages serves `docs/`; `docs/CNAME` sets `ronu.one`. The production path is
`https://ronu.one/basement/`. V2 is reviewed on `basement-simple-tools-v2`, draft
PR #18. Updating that branch does not publish it; merge/deployment require review.

## Use

The existing KIRI shell fills the screen. Drag to orbit, wheel/pinch to zoom and
right-drag/two fingers to pan. Top, 3D and Reset fit the camera. Navigation is the
default; pressing an active tool again, Cancel or Escape returns to it.

- **Measure:** pick A then B. A dimension appears immediately on the model, with
  a SCAN badge and feet/inches rounded to the nearest eighth. Name is optional.
  Enter the physical tape/laser value in feet and inches and press Mark VERIFIED.
  This saves the confirmed length and date, preserving both original scan
  endpoints. Use SCAN returns to the scan value. Select the label to edit/delete.
- **Area:** switches to Top view. Pick corners, then Done (or tap the first corner
  again). Name is optional. The outline follows one horizontal ceiling plane;
  the approximate area is shown in ft². Overlap, crossing outlines and edges
  outside the floor footprint are rejected. Redraw keeps the saved name and ID.
  The unobtrusive total sums the saved areas currently shown.
- **Comment:** tap a model surface, type a note and Save. Select its numbered
  marker to edit, move, resolve/hide or delete. Moving preserves its ID and text
  and saves after the new position is selected. Closing an unsaved note cancels
  it. The temporary Hidden notes panel allows restoring resolved notes.
- **Project:** opens three links to the original Studio Duo floor plan, proposed
  layout and lighting plan. The overlay closes with ×.

The three visibility buttons show/hide annotations. Editors appear only when
creating/selecting an item. There is no permanent sidebar or additional workflow.

## Files and model dependencies

| File            | Purpose                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| `index.html`    | Static controls, import map and reference overlay                          |
| `app.mjs`       | Simple interactions, editors and device persistence                        |
| `viewer.mjs`    | Existing Three.js renderer, camera controls, model picking and annotations |
| `data.mjs`      | V2 schema, geometry, units, validation and one-time migration              |
| `execution.css` | Current interface styles; filename retained to fit the requested structure |
| `room.gltf`     | Unchanged KIRI model, Git blob `5e6b473d4e7a2bdf0ed78af18d80fe12a76feb0b`  |
| `project.pdf`   | Original Studio Duo pages 4–6, extracted without altering page content     |
| `README.md`     | Canonical source, behavior, storage and validation                         |

All model buffers are embedded in `room.gltf`; it requires no additional model
asset files. Three.js and its official addons are pinned to 0.180.0 in the import
map. The shell contains floors/walls, not detailed joists/pipes/beams, so it cannot
supply dimensions for those missing elements. Scan lengths and horizontal areas
are approximate; physically confirm dimensions before proceeding.

`project.pdf` is a lightweight 3-page extract from the supplied 45-page
`ADRIANA_BASEMENT_DUO FINAL.pdf` (Studio Duo, August 2025). PDF pages 1, 2 and 3
correspond to original pages 4, 5 and 6. Only stale in-document menu annotations
were removed; page images/text/content are unchanged and rendered pixel-identical
to those original pages. The full source is retained separately as supplied.
The source's page 36 warns to check all dimensions on site. The reference does
not populate or verify measurements automatically.

The old standalone `navigation.html` and unused `execution.json` were removed
after history/reference inspection and successful V2 navigation tests. Empty V2
data initializes in code. The original model, its renderer and rewritten tests
remain in use.

## Data and migration

Raw model data and annotations are separate. V2 saves under
`ronu.basement.simple.v2` in localStorage:

```js
{
  schemaVersion: 2,
  model: { id: 'kiri-room3-shell-v1', url: './room.gltf', units: 'meters', upAxis: 'Y' },
  measurements: [], // id, name, a, b, derived position, SCAN/VERIFIED; confirmed value/date when verified
  areas: [],        // id, name, polygon points, recomputed squareMeters, derived position
  comments: [],     // exactly id, position, text, resolved
  counters: { comment: 0, measurement: 0, area: 0 }
}
```

Positions use the preserved model's meter coordinates, Y up. Measurements keep
both original endpoints. Areas use X/Z polygon geometry, not a displayed total.
IDs remain stable and deleted IDs are not reused. Data validation recomputes
centers and areas and discards unknown fields rather than copying them forward.

Only when the V2 key is absent, valid data from the old
`ronu.basement.execution.v1` key is migrated once. Geometry, names, note text,
positions and existing physical measurement provenance are preserved; old
control metadata is ignored. All migrated notes start visible/unresolved.
The old key is never changed or deleted. After migration, writes use only V2.
A corrupt V2 record is preserved and saving is blocked in that tab; a clear
message explains that edits are temporary. Browsers denying localStorage also
show an unsaved state. Saving is per browser/device and origin; there is no
cloud sync or import/export interface.

## Duplicate implementation audit

Inspected the three related `the-reno` repositories and their tracked main trees
on 2026-10-05. This public repository has one canonical basement implementation.
`ronu-public` has no basement implementation. `ronu-private` has matching older
model/viewer files at:

- `website/basement/`
- `General/projects/professional-network/hosted/public/basement/`

The private project's `wrangler.toml` binds `./public` as Worker assets and
configures `private.ronu.one`; its Worker passes non-API routes to that asset
binding. The hosted copy therefore participates in a separate configured private
environment. The other private copy cannot safely be excluded as a source or
rollback copy from tracked references alone. Both were retained, with no changes
to private routing or deployment. This audit does not assert that the private
configuration is currently deployed. Neither private location is the canonical
source for public `ronu.one/basement/`.

## Validation

Run the repository checks:

```sh
python3 scripts/check_site.py
node scripts/test_analytics.js
node scripts/test_basement.mjs
```

For real-browser checks, install Playwright with Chromium outside the repository,
then run `node scripts/test_browser.js` and `node scripts/test_basement_browser.cjs`.
Both start/stop their own static servers. The basement test uses the real model
and real mouse/touch events; it does not mock Three.js or the renderer.
Optional environment variables for the basement test:

- `BASEMENT_CHROMIUM_PATH`: alternative compatible Chromium binary.
- `BASEMENT_THREE_PATH`: local copy of exactly Three.js 0.180.0 for offline QA.
- `BASEMENT_SCREENSHOT_DIR`: directory for desktop/mobile/reference/editor images.

The existing validate-site workflow runs static, analytics and basement data
checks on pull requests. Browser checks are also run locally before review.
The data test locks the original model hash and checks embedded dependencies.

## Known limits

This is a shell reference, not a survey of exposed ceiling utilities. Areas are
horizontal projections. Browser-local data does not transfer between phones and
desktops. Automated touch checks cover mobile Chromium emulation; a physical
phone, especially iOS Safari and its keyboard, remains a useful review check.
Many densely packed labels can still overlap after all placement alternatives
are exhausted; visibility toggles reduce clutter.

# Basement reference tool

Canonical public source: **`the-reno/the-reno.github.io`, `docs/basement/`**.
GitHub Pages serves `docs/`; `docs/CNAME` sets `ronu.one`. The production path is
`https://ronu.one/basement/`. Main is the production branch.

## Use

The existing KIRI shell occupies the workspace beside the compact Show panel. Drag to orbit, wheel/pinch to zoom and
right-drag/two fingers to pan. Top, 3D and Reset fit the camera. Navigation is the
default; pressing an active tool again, Cancel or Escape returns to it.

- **Measure:** pick A then B. A dimension appears immediately on the model, with
  a SCAN badge and your selected units. Name is optional.
  Enter the physical tape/laser value in feet/inches or meters and press Mark VERIFIED.
  This saves the confirmed length and date, preserving both original scan
  endpoints. Use SCAN returns to the scan value. Select the label to edit/delete.
- **Area:** switches to Top view. Pick corners, then Done (or tap the first corner
  again). Name is optional. The outline follows one horizontal ceiling plane;
  the approximate area is shown in ft² or m². Overlap, crossing outlines and edges
  outside the floor footprint are rejected. Redraw keeps the saved name and ID.
  The unobtrusive total sums the saved areas currently shown.
- **Comment:** tap a model surface, type a note and Save. Select its numbered
  marker to edit, move, resolve/hide or delete. Moving preserves its ID and text
  and saves after the new position is selected. Closing an unsaved note cancels
  it. The temporary Hidden notes panel allows restoring resolved notes.
- **3D dimensions:** 21 wall segments are organized into **Main room**, **Rear room**
  and **Side room**, matching the three supplied screenshots. Check a group to
  show its walls; expand its name to choose individual lengths. Shared boundary
  walls appear in both adjacent lists but render only once. Deselecting a group
  keeps shared walls needed by another fully selected group. W10 is omitted from
  the displayed model, picking and measurements; the original glTF is unchanged
  and the other wall IDs are not renumbered. Existing W10 view selections are ignored.
  Locate centers the view and marks A/B without dimming other selections.
- **Floor:** shades each of the three groups and shows its approximate area in
  both Top and 3D views, as well as beside its group name. Main room: **641 ft² /
  59.56 m²**; Rear room: **180.2 ft² / 16.74 m²**; Side room: **33.4 ft² / 3.10 m²**.
  The groups partition the original **854.6 ft² / 79.40 m²** footprint. This
  includes walls and stairs and is separate from user-drawn area totals.
- **Lighting plan:** selecting this source immediately reveals its 42 printed
  spacings and offsets in the current Top or 3D camera view. Subsequent individual
  selections are retained when switching views/sources; selecting Lighting plan
  when its list is completely hidden reveals it again. Hide all still clears the
  display, including if the reference is loading. The list is grouped by the
  original drawing's room names. Crowded labels reappear with zoom; Locate brings
  a chosen reference into view. Placement is approximate, not physically verified.
- **Project images:** opens a thumbnail gallery of the existing floor plan,
  proposed layout and lighting sheet, with a full-size image link. No PDF is
  deployed. Close the gallery with × or Escape.
- **Execution → Ceiling:** opens an on-demand materials estimate for a painted
  drywall ceiling. Product photos, Home Depot links, whole-pack quantities,
  reference unit prices and line totals appear together. Adjust the area/waste,
  or use the model footprint or saved drawn areas. The existing unit preference
  applies to the area input. Closing the dialog returns to the model.

The ceiling estimate starts from the approximately 854.6 ft² **floor footprint**,
including walls/stairs, as a provisional ceiling area. It is not a measured
ceiling takeoff. At 10% waste, the seven listed material items total approximately
**$955.25** before tax/delivery, using standard package prices researched at
Home Depot on October 5, 2026. No store was selected; online source snapshots can
be older and local price/availability may differ. Bulk discounts are excluded.
The starting assumption is one painted 5/8-inch drywall layer on suitable
existing wood framing, not a confirmed ceiling design. Quantities and exclusions
are explained in the section; framing, soffits, insulation, access panels,
lighting/utilities, tools/rental and labor remain unpriced.

**Show stays visible:** beside the model on desktop and in a compact dock on phones.
The model viewport leaves room for the scrollable list. Imperial/Metric controls,
**Walls** and **Floor**, and individual dimension checkboxes live in this panel.
There is no Comments visibility button, bottom toolbar or floating whole-floor badge.
**Hide all** clears dimension selections and turns off the floor; **Show all** checks
the active list. Creation tools remain under **Add → Measure / Area / Comment**.
The whole-floor total remains a small number in Show; Floor adds one area label per room.
Locate also reveals a previously hidden measurement. Lighting locations remain
approximate; converted metric values use the original printed dimensions, never
the lengths of their approximate model lines. The original drawing images are
unchanged and retain their printed units.

Imperial lengths use feet/inches rounded to an eighth; metric lengths use meters
rounded to a millimeter. Areas, totals, labels, reference lists and verification
inputs all follow the selected unit system. Switching units never changes model
geometry, scan endpoints, saved tape values or measurement provenance.
Editors appear only when creating/selecting an item; Show remains available alongside them.

## Files and model dependencies

| File                                                             | Purpose                                                                    |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `index.html`                                                     | Static controls, import map and reference overlay                          |
| `app.mjs`                                                        | Simple interactions, editors and device persistence                        |
| `viewer.mjs`                                                     | Existing Three.js renderer, camera controls, model picking and annotations |
| `data.mjs`                                                       | V2 schema, geometry, units, validation and one-time migration              |
| `execution.css`                                                  | Current interface styles; filename retained to fit the requested structure |
| `room.gltf`                                                      | Unchanged KIRI model, Git blob `5e6b473d4e7a2bdf0ed78af18d80fe12a76feb0b`  |
| `room-groups.mjs`                                               | Screenshot wall memberships and nonoverlapping floor partitions            |
| `model-metrics.mjs`                                              | World-space wall segment dimensions and horizontal floor footprint         |
| `project-data.json`                                              | Image descriptions and 42 printed lighting dimensions                      |
| `existing-plan.png`, `proposed-layout.png`, `lighting-sheet.png` | Original Studio Duo sheets 4–6 rendered as images                          |
| `lighting-plan.png`                                              | Detail image of the dimensioned lighting drawing                           |
| `README.md`                                                      | Canonical source, behavior, storage and validation                         |
| `ceiling.mjs`                                                    | Lazy-loaded execution materials dialog, area input and totals              |
| `ceiling-data.mjs`                                               | Sourced product catalogue, calculation assumptions and estimate validation |
| `products/*.jpg`                                                 | Seven original Home Depot product thumbnails for the ceiling list          |

All model buffers are embedded in `room.gltf`; it requires no additional model
asset files. Three.js and its official addons are pinned to 0.180.0 in the import
map. The shell contains floors/walls, not detailed joists/pipes/beams, so it cannot
supply dimensions for those missing elements. Scan lengths and horizontal areas
are approximate; physically confirm dimensions before proceeding.

Project images preserve the three supplied Studio Duo sheets (August 2025).
Only the lighting sheet supplies the 42 fixture spacing labels. References and
computed model metrics never enter or overwrite browser-local annotations.

Model measurements use the loaded geometry after world transforms. Wall length
is the long side of its minimum-area oriented footprint rectangle; height is
its vertical extent. Each numbered wall is a source mesh segment, including
short or overlapping segments. The floor calculation sums unique horizontal
top triangles, excluding bottom and side faces. It does not subtract walls,
stairs or equipment and is not a net usable-area calculation.

Room areas clip the original floor triangles along the shared model wall
centerlines: W17 separates the side room; W22, W09, W19, W18, W20 and W13 define
the stepped main/rear boundary. They do not derive area by multiplying wall
labels, subtract wall thickness, or claim usable/verified floor area. Tests check
that the three partitions remain inside the scan, do not overlap and preserve
the complete original area. Membership and partition data stay separate from
user annotations and the raw model.

Image metadata loads independently after the model is ready. Missing, malformed,
offline or stalled references cannot stop the viewer or its model measurements.

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

View preferences are saved separately in `ronu.basement.view.v2`: units, active
source, group visibility and opt-in `shown` measurement keys (`wall:W06`,
`project:P6-01`, `saved:M01`). Individual choices survive refresh without changing
the V2 annotation schema. Invalid/unavailable preferences fall back to defaults;
the original annotation storage and safe migration behavior are unchanged. When upgrading
from view.v1, units/source are retained but visibility starts with Hide all once.
Subsequent view.v2 selections persist. The old view record is left intact.

Ceiling input preferences use `ronu.basement.ceiling.v1` (square meters and waste
percentage only). The catalogue and prices are versioned source data, not live
retailer quotes. Original source-photo and price URLs are retained on each
product. Materials and photos load only when Execution opens; they do not block
model startup. The estimate never writes to measurement/area/comment records.

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
node scripts/test_basement_metrics.mjs
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

# Garage renovation workspace

Standalone page: `/garage/`. No homepage, section index, sitemap, hosting, or navigation changes are part of this feature. It is public but unlisted, with `noindex,nofollow,noarchive`; this is not access control.

## Files

- `docs/garage/index.html`: four workspace sections and the project brief.
- `docs/garage/workspace.css`: responsive layout and printable brief/checklist.
- `docs/garage/workspace.js`: dependency-free WebGL model, technical SVG floor plan, interactions, and PNG export.
- `docs/garage/concept.jpg`: illustrative design reference.

## Measurement provenance

User-supplied: width 20 ft, depth 21.5 ft, “127 x 226 cm each door”, center post 14 cm. These are not independently verified survey dimensions.

Working assumptions: width/depth are clear internal dimensions; two bays have two leaves each; 127 cm describes a leaf; post is centered; wall height 260 cm; wall thickness 14 cm. Both interpretations of door width can be selected. Pedestrian entry is provisionally 91.44 cm wide by 203.2 cm high (constrained to fit if model dimensions change). Roof shape, member sizing, windows, connections, leaf clearances, material performance, and site conditions have not been established.

The known leaf interpretation gives 254 cm per bay and 43.8 cm side infill on each end of the 609.6 cm frontage. Do not use these inferred dimensions to order or build. Existing materials are schematic, and the earlier original garage photos are not embedded.

## Behavior and boundaries

- 3D orbit/cutaway; orthographic front and plan; camera located inside for the interior view.
- Preset views, zoom, reset, mouse/keyboard/touch controls, door opening, framing visibility, and dimensions.
- Proposed charcoal/timber/light door finishes; existing doors remain schematic timber.
- Editing dimensions rebuilds the model and plan for the current session only. No automatic persistence, task-completion tracking, remote uploads, or browser storage. Print the applied brief to retain a record.
- PNG exports include visible dimension overlays and a concept-only caption.
- The floor plan, reference image, survey form, and execution guide remain available without WebGL.
- Execution is a planning checklist, not structural, electrical, legal, or building-code advice.
- No external font/script requests or new services.

## Image provenance

Created once with built-in image generation, then encoded as a JPEG for page delivery.

Prompt summary: realistic front-left oblique view of an approximately 20-by-21.5-ft detached garage, modern-classic renovation; paired charcoal carriage doors with modest glazed upper panels on the left, retained light-trim center post, right bay infilled with charcoal horizontal siding and a pedestrian entrance; light trim, restrained dark hardware, simple pitched shingle roof, concrete drive, daylight. No people, cars, text, UI, or measurements. It is visual inspiration, not a replica of verified existing conditions. Roof, landscape, and glazing are illustrative. The fixed reference image does not update with interactive model settings.

## Validation

- JavaScript syntax checked.
- Node DOM/WebGL-stub smoke checks cover initialization, both layouts, four views, projection matrices, true interior camera location, hidden plan headers, finishes, opening doors, navigation, measurement validation, print-draft consistency, plan label spacing, and two-finger gestures.
- Repository validator reports only pre-existing CSP/privacy metadata omissions on unrelated pages; no new garage-path errors.
- Live browser rendering/print QA has not been performed in this edit. Stub checks do not validate GPU shader rendering or browser download behavior.

## Next fidelity step

Match original photos and a measured opening survey to the shell; confirm measurement reference faces, door leaf interpretation, post position, heights, windows, and existing framing before developing construction details.

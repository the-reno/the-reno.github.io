# Garage renovation workspace

Standalone page: `/garage/`. No homepage, section index, sitemap or navigation changes. Public but unlisted with `noindex,nofollow,noarchive`; this is not access control.

## Files

- `docs/garage/index.html`: model, design, measurements and front DIY guide.
- `docs/garage/workspace.css`: responsive workspace and printable guide.
- `docs/garage/workspace.js`: dependency-free WebGL model, SVG plan, photo-position overlays and PNG export.
- `docs/garage/concept.jpg`: older AI-generated inspiration, explicitly not the updated geometry.
- `project-docs/GARAGE-FRONT-DIY.md`: source-backed work packages, tools, materials, allowances and release gates.
- `scripts/check_garage.cjs`: dependency-free DOM/WebGL-stub regression test.

## Scope — September 2026 update

Cost-focused front renovation: repair the left paired leaves only where the structural frames are sound; retain the centered front post and existing header; enclose the right bay with matching blue-gray siding and a stock solid insulated steel prehung entrance toward the far right. Entry swing inward is provisional. Existing timber interior, windows and roof remain; no roof/member removal, whole-garage insulation or electrical implementation in this phase.

## Provenance: measurements, observations and assumptions

User-supplied dimensions: 20 ft width, 21.5 ft depth, “127 × 226 cm each door,” center post 14 cm. User subsequently confirms post and windows centered and entry to the right. These are not independent field measurements.

Reviewed photos establish four glazed X-trim carriage leaves, blue-gray exterior/white trim, centered rear window, right-side window, exposed framing, gable roof and lower sloping front roof, and a front interior post/beam arrangement. Photos show deterioration, but do not establish remaining timber strength, slab condition, leak absence, structural capacity or safe fastener locations.

Assumptions explicitly retained:

- Width/depth interpreted as clear internal dimensions; 127 cm interpreted as one leaf (alternate full-bay interpretation remains selectable).
- Wall height 260 cm; wall thickness 14 cm.
- Rear/right windows represented as 30 × 36 in with a 95 cm sill; centered by user instruction. No left opening assumed.
- Roof ridge = wall height + 0.34 × width; main front roof setback 85 cm. Both inferred, not measured pitch/setback.
- Rafter/stud repetition, ties, bracing and internal post/beam location are schematic; no engineered member schedule.
- Far-right nominal 36 × 80 in entrance (may be constrained for alternate dimensions), with an 18 cm schematic right return. Actual jamb depth, rough opening, threshold support, frame/trim dimensions and swing need the selected SKU and site measurements.
- Slab represented as flat; crack cause, slab thickness, slope, drainage and hidden conditions unknown.

Baseline arithmetic: each bay approximately 254 cm; side infill 43.8 cm each; 20 × 21.5 ft floor = 430 sq ft. Existing leaf dimensions do not establish clear openings or final cut sizes.

The model is suitable for preliminary spatial discussion, not a verified structural record or construction drawing. Centered positions do not certify any member's structural role. Infill attachments, wind/bracing requirements and slab adequacy require review.

## Behavior

- Defaults to a complete proposed exterior with roof; existing/proposed layouts, front/interior/plan presets, orbit, zoom, pan, reset and keyboard/touch controls.
- Roof toggle reveals pitched framing; cutaway/inside/plan views hide the roof automatically. Framing toggle includes studs and overhead members. Floor-supported post is not removed by this toggle.
- True wall voids for the centered rear/right windows; side/rear timber retained in both modes.
- Six-pane left carriage doors retain geometry while paint changes. Left leaves swing out; stock right entry swings inward. SVG plan and model share entry/window coordinates.
- Inputs rebuild the model/plan for this session only. No storage or server uploads.
- Print rejects unapplied measurement drafts; execution print expands work packages.
- PNG includes displayed overlays plus planning-only caption. The fixed front diagram and budget are baseline references; they do not recalculate with model dimensions.
- An SVG software renderer preserves interactive geometry/controls without WebGL; its approximate painter-order visibility is a fallback, not a CAD renderer. PNG export is disabled in software mode and the renderer diagnostic is shown. The plan and DIY content also remain available independently.
- No new dependencies, trackers or external service requests. Source links open only on navigation.

## Photo survey

P01–P05 and P08 reviewed; P06/P07/P09 deferred by agreement. X01 is an additional front interior view. No further general photos requested. The original nine standing/aiming positions remain optional reference aids, clearly tagged reviewed or deferred.

Source photos were reviewed in the conversation and are not republished on this public page. Exact camera location/distances are starting references; safe access and required coverage take priority.

## Front DIY guide and budget

The guide gives scoped actions, tools, provisional purchase allowances and done-when gates. It does not release heavy-door joinery, anchor spacing, wind-bracing details or a final cut list from photos. Old paint/siding assessment, local approvals, timber condition, slab attachments and door-SKU instructions are prerequisites to disturbance and ordering.

Materials allowance $1,350–$2,610; tools $150–$350; approximate 7% tax reserve $105–$207; 15% materials contingency $203–$392. Calculated total $1,808–$3,559, rounded planning allowance $1,850–$3,600. Only door price examples were observed online; other lines are estimator allowances. Assumes core tools available and limited repair of sound left frames. Full left-door replacement, abatement/testing, permits/design, structural/slab/drainage repair, paid labor, delivery and interior/thermal/electrical work excluded.

Primary references and detailed scope are in `GARAGE-FRONT-DIY.md` and visible on the execution page.

## Validation

- `node --check docs/garage/workspace.js`.
- `node scripts/check_garage.cjs`: initialization, both layouts, four camera views, finite projection/geometry, true inside camera, roof visibility, right-biased entry, window sizes, openings, navigation, dimension validation, printing state, gestures and photo markers.
- `GARAGE_NO_WEBGL=1 node scripts/check_garage.cjs`: repeat interactions with a forced unavailable WebGL context and assert the software geometry/export status.
- `python scripts/check_site.py`: currently reports only pre-existing CSP/privacy metadata omissions on six unrelated demo routes; no garage reference errors.
- Live desktop browser verified navigation, front SVG plan/diagram, guide expansion, budget and software 3D with cutaway/door controls. The test browser could not initialize WebGL; GPU output and PNG download are not certified by this check. Software exterior mode omits hidden internal framing to avoid painter-order bleed-through. Stub tests do not certify physical accuracy or structural capacity.

## Next release gate

One front-only field survey: clear openings at three heights/widths, diagonals, threshold/driveway levels, right jamb return, left leaf/frame/hinge condition and safe material identification. Select exact entry unit and confirm approvals/attachments before publishing cut sizes or ordering.

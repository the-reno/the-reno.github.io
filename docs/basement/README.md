# Basement ceiling execution

This standalone page uses the existing KIRI shell in `room.gltf`. It does not change the main Ronu navigation, sitemap or pages. The original viewer is retained in `navigation.html`.

The model is in meters, with Y up. Measurements store two unchanged model coordinates and surface anchors. SCAN means a distance derived from the scan. VERIFIED keeps the scan endpoints and separately records a manually confirmed length and timestamp. Moving either endpoint clears verification. The shell is a room scan: it does not contain detailed joists, pipes or beams. Markers document execution observations without implying that those utilities were scanned.

Zones are horizontal ceiling footprints on the wall-top plane, traced in Top view. Areas are approximate plan areas, not a detailed surface-area model. Their sum is the mapped ceiling total; do not assume coverage is complete. Zones cannot cross themselves, overlap, or leave the scanned floor footprint. Shared boundaries are allowed. Geometry and computed square meters are retained for later material calculations.

`execution.json` is the empty data template. Edits remain in localStorage under `ronu.basement.execution.v1`; nothing writes to the public repository or a server. Use **Data → Export JSON** to back up or transfer the complete model-referenced record. **Import JSON** validates the model ID, units, positions, IDs, statuses and geometry, then offers an explicit replacement. Area totals are recomputed. Imported text is rendered with `textContent`. Corrupt saved data is preserved for recovery and is never silently overwritten.

Navigation is the default. Tool → tap creates a comment; it saves automatically. Measure → A → B saves automatically (two geometry clicks are intrinsic to measuring). Areas → corners → Finish saves the polygon; tapping the first corner closes it too. The editors save fields immediately. Drawing drags or multi-touch gestures navigate without placing a point. Escape/Cancel returns to Navigate. Reset also cancels an unfinished drawing. Repositioning a marker/endpoint or redrawing a zone preserves its ID and metadata.

Step selection filters model markers and assigns the selected step to new items. Open includes OPEN and IN PROGRESS comments; Done shows DONE. Measurements start hidden when reopening the page and can be toggled; a new measurement becomes visible. List provides access to hidden or offscreen items.

Local checks:

```bash
node scripts/test_basement.mjs
python scripts/check_site.py
node scripts/test_analytics.js
python -m http.server 8765 --directory docs
```

Browser smoke coverage lives in `scripts/test_basement_browser.cjs`. It requires Playwright and a Chromium build with WebGL. Use `BASEMENT_CHROMIUM_PATH` when Chromium is installed outside Playwright. This test exercises actual canvas taps, drag suppression, mouse/touch navigation, edit/delete, verification, polygons, step/status filtering, persistence, export/import and narrow-screen controls. It never writes to a remote service.

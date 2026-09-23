# Preview section pages — compact articles

Preview: https://ronu.one/preview/?v=20260923-articles1#section/markets

## Refinement — 23 September 2026

The article area is now headed simply **Articles**. The previous **Articles & experiments** heading and redundant article/sample counter are removed from the section landing pages.

Each article is a compact tile with a small orange line icon, its existing title and one short summary. Published entries are full-card links with a small arrow, without an extra Read article label. Large decorative illustrations and metadata labels have been removed from this area. Keyboard focus is visible and reduced-motion preferences are respected.

The collection uses two columns above 780px and one on smaller screens. Only one entry per section is rendered in this layout test; extra articles are not invented to fill the grid. Multi-entry wrapping was tested in memory only.

Triathlon retains Endurance. Science retains The Complexity of Prediction. Their shorter landing-card summaries do not change the article source, reader headings or search metadata. Markets retains its non-clickable sample, explicitly labeled **Layout sample · Not published**. It is not a new article or a publication promise.

Explore, its section carousel, the main-page introductions and impact sentences, all section-title sizes, Maker and its image gallery, the orange/dark/off-white palette, and the existing fonts are unchanged. No modifications to the production homepage or navigation, reader files, source articles, model code, image assets, design lab or wording-review file were made.

## Files

- `docs/preview/articles.css`: compact article grid and tile styling.
- `docs/preview/main-pages.js`: small decorative SVG icons, compact summaries and tile markup; hero rendering unchanged.
- `docs/preview/app.js`: Articles heading and removal of the redundant count.
- `docs/preview/index.html`: matching fallback heading and cache-versioned assets.

Base revision: `79a7f30f162aa30489e8777af382b3b789a8eb0d`.

## Validation and limits

Node syntax checks passed. 198 local Chromium assertions passed, covering widths 320, 390, 768, 1024 and 1440; unchanged hero markup, typography and dimensions; visible icons; compact card heights; overflow; single-entry scope; honest sample labeling; two-column/one-column wrapping with temporary test-only entries; keyboard focus; article opening and return navigation; unchanged Maker gallery markup and image decoding; and Explore carousel navigation. No page-level JavaScript errors were observed.

Direct navigation to the live URL was attempted and blocked by the browser environment (ERR_BLOCKED_BY_ADMINISTRATOR). Tests used in-memory documents assembled from the actual downloaded site CSS and JavaScript, with existing images embedded and actual article bodies supplied through a local fetch fixture. Content Security Policy was removed only from the test fixture; published security metadata is unchanged. These checks are not independent verification of live delivery, cross-browser behavior or numerical model results.

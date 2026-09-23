# Ronu — clean release candidate R1

Preview: https://ronu.one/preview/?v=20260923-ready1#explore

## Scope and status

This candidate applies the final introductions approved in the conversation on 23 September 2026. It is staged at `/preview/`; it does not replace the production homepage or add links on existing pages. Noindex and the existing security metadata remain in place until a separate production rollout is approved.

The existing orange/dark/off-white design, fonts, unnumbered headers, compact article tiles and carousel controls are retained. The main pages follow Topic → impact sentence → introduction → content.

- Explore retains its approved introduction and the four-section carousel. Each slide shows the section's impact sentence and first introductory paragraph; opening it reveals the full text. Slide text is derived, not maintained as a second draft.
- Triathlon displays its three final paragraphs and the existing Endurance article tile.
- Science displays its two final paragraphs and The Complexity of Prediction tile.
- Markets displays its final two paragraphs. With no published article selected, the collection is omitted entirely. No sample, invented article or empty-state panel is displayed.
- Maker displays only its title, impact sentence and image carousel. There is no introduction, description, extra visible heading or image caption. Accessible image descriptions, full-image links, dots, arrows and playback controls remain.

Removed from the interface: design-preview labels, version badges, layout codes, the developer About dialog, accent comparisons, sample cards and reader migration/snapshot commentary. The footer contains the site name, Rafael Renó and Privacy. Source citations inside articles, safety/limitation content, loading errors and essential controls are not removed.

## Editing map

| Change | File |
| --- | --- |
| Main-page text, titles, sentences, navigation order, article selections and image descriptions | `docs/preview/page-content.js` |
| Shared title/paragraph/card/gallery markup | `docs/preview/main-pages.js` |
| Colors, fonts, widths, spacing and responsive sizes | `docs/preview/main-pages.css` |
| Article tiles and carousel styles | `docs/preview/components.css` |
| Shared carousel controls and lifecycle | `docs/preview/carousel.js` |
| Navigation, search and page rendering | `docs/preview/app.js` |
| Article metadata and pinned source paths | `docs/preview/content.js` |
| Article reader behavior | `docs/preview/reader.js` |
| Base/reader styling | `styles.css`, `reader.css`, `theme.css` under `docs/preview/` |

Use blank lines (`\n\n`) inside an `intro` string to separate paragraphs. Empty intro strings stay empty. `SITE.carousel.introParagraphs` controls the number of paragraphs in Explore slides; it is currently 1. The full section page always renders all paragraphs. Text is escaped before insertion into markup.

`SITE.sectionOrder` supplies both navigation and Explore order. Add only existing, reviewed topic IDs to `articleIds`. Empty arrays produce no article collection. Add image paths and meaningful alternative text in `MAKER_GALLERY.images`.

Keep using `project-docs/CONTENT-REVIEW.md` for new proposals and comments. Its older draft blocks are historical input, not instructions to overwrite this final copy. Compare only new edits with the runtime copy and this release baseline. Saving proposals still requires an explicit application request. No automatic publisher or watcher exists.

The obsolete `theme.js` accent-switching script was removed. `theme.css` retains the existing reader palette without test controls. The standalone design lab remains untouched and is not linked or loaded by this candidate.

## Check and integrate

1. Edit the appropriate source file, keeping section/article IDs stable.
2. Run `node --check` on each changed JavaScript file.
3. Run `python scripts/test-preview-structure.py --site-root docs`. Requires Playwright and Chromium; `--screenshots <directory>` writes visual checks.
4. Update changed asset version references in `docs/preview/index.html`.
5. Deploy to the unlinked preview and verify on an ordinary browser. Replacing the existing site remains a separate decision; do not change its homepage or navigation here.

## Verification for R1

Base commit: `da7c98c8ae622699d2c8869883c9caeb7062e59c`.

JavaScript syntax checks and 219 Chromium fixture assertions passed, covering five pages at 320, 390, 768, 1024 and 1440px, exact final paragraphs, absence of test UI, empty Markets handling, all three image assets decoding, section and image navigation, keyboard controls, playback/manual pause, lifecycle cleanup, article loading/return navigation and search. Screenshots were inspected for mobile Triathlon and desktop Explore.

Localhost navigation was blocked by this environment with ERR_BLOCKED_BY_ADMINISTRATOR. Checks used in-memory HTML assembled from the actual site files, embedded existing images and local copies of article bodies. CSP was relaxed only in this fixture, not in the published files. This is not independent live-rendering verification, a whole-site accessibility certification or numerical-model validation. Source article text, model code and image bytes were not changed.

# Preview main pages — unnumbered orange layout

Preview: https://ronu.one/preview/?v=20260923-clean1

## Latest refinement — 23 September 2026

Following the request to remove index numbers and adjust only sizes and proportions, the section numerals have been removed from the shared hero markup. This applies to Triathlon, Science, Markets and Maker, and to all four Explore carousel slides. The old number column is removed at every breakpoint, not merely hidden.

The existing signal orange `#FF7A1A`, dark background, off-white text, monospaced titles, orange emphasis, thin rules and sans-serif body copy are preserved. Titles now lead a single left-aligned column; impact sentences are slightly smaller than titles, with tighter, consistent spacing before the short introduction. Text width is bounded for reading. The article area starts directly below, on the same outer alignment.

Only `docs/preview/main-pages.js`, `docs/preview/main-pages.css`, the preview HTML asset version references/About note, and this guide were changed. Base revision: `95923c39c9903822e86837bfcb4a347f55041d33`.

## Display and content

The design refines L10 / O1 / T04 without section numbers. Main pages follow: topic → approved impact sentence → short introduction → work below. There is no themes row, Browse articles button or separate Why I explore it block. No local filter or grid/list controls are needed for the single example card.

- Explore retains Stay curious, its introduction and the four-section carousel. Its dots, arrows, pause/play, swipe behavior and section links are unchanged.
- Triathlon shows one existing article: Endurance.
- Science shows one existing article: The Complexity of Prediction.
- Markets retains one explicitly labeled, non-clickable layout sample: Pricing the future. It is not a published article.
- Maker retains its impact sentence and existing three-image gallery with captions and controls. Its intentionally blank personal introduction stays blank.

All impact sentences, introductory copy, article selections and image assets remain unchanged from the previous prototype. The existing homepage, navigation, article readers, source articles, numerical models, design-lab alternatives and wording-review file are untouched. No new link to the preview was added. Preview noindex, privacy and security metadata are retained.

## Editing map

`docs/preview/main-pages.js` owns the impact sentences, short introductions, sample article selections and shared hero/card markup. `docs/preview/main-pages.css` owns the landing-page typography, proportions and spacing. The index-prefixed internal class names are retained to avoid unrelated changes; they no longer imply a displayed number.

`docs/preview/content.js` still provides section identities, article metadata and the reader source configuration. Existing section IDs and routes are unchanged. The section-first Explore structure and Maker gallery are preserved.

## Validation of this refinement

JavaScript syntax validation passed. 243 local Chromium fixture checks passed, covering main pages and Explore at widths 320, 390, 500, 768, 1024 and 1440 pixels; absence of number markup and empty number columns; exact impact sentences; title/sentence size hierarchy; one-card selections; no horizontal overflow; gallery image decoding; carousel dots/arrows; article opening and return navigation. No page-level JavaScript errors occurred. Desktop and mobile renders were visually inspected.

The test fixture was assembled from the actual GitHub Pages artifact for the base revision plus the three modified runtime files. The environment blocks browser URL navigation, including localhost. Tests therefore used an in-memory document with CSS/scripts and existing image bytes embedded; the existing article HTML was supplied through a local fetch fixture. CSP was omitted only from that test document; published security metadata is unchanged. These local checks do not independently verify live browser delivery or numerical models.

## Previous implementation

The numbered orange main-page prototype was introduced in commit `95923c39c9903822e86837bfcb4a347f55041d33` after validating L10 / O1 / T04. This refinement removes its numerals while retaining the selected visual style and content boundaries.

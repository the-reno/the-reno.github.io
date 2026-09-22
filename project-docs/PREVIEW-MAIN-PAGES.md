# Preview main pages — selected index layout

Preview: https://ronu.one/preview/?v=20260922-index1

Implemented following the request to update only the main pages after validating the orange index composition. Base repository revision: `6d15964c9559c4eff95f575b001b42dc801a6329`.

## Display

Selected direction: L10 / O1 / T04 — Index, signal orange `#FF7A1A`, technical monospaced display text. The section number retains its contrasting serif face. Body text remains a readable sans serif on the dark background.

Main section pages now follow: topic → approved impact sentence → short introduction → work below. The themes row, Browse articles button and separate Why I explore it block are removed. There are no local filter or grid/list controls for the single example card. Global search and existing article routes remain available.

- Explore retains Stay curious, its introduction, and the four-section carousel with the same selection, pause/play, arrow and swipe controls. Each slide uses the new index composition and opens its section. The large numbers identify sections, not carousel page counts.
- Triathlon shows one existing article: Endurance.
- Science shows one existing article: The Complexity of Prediction.
- Markets shows one explicitly labeled, non-clickable layout sample: Pricing the future. The current catalogue contains no Markets article. This does not create or claim to publish an article.
- Maker retains the three-image gallery with existing assets, captions and controls. The previously blank personal introduction remains blank. Its approved impact sentence replaces the duplicated question block. No fake article is added to Maker.

## Copy and scope

The four approved sentences are retained exactly. Triathlon uses the validated two-sentence introduction from the conversation. Science and Markets use short draft introductions consistent with existing section copy. The current Explore introduction and Maker gallery description are retained.

`docs/preview/main-pages.js` contains the main-page impact sentences, short introductions, single-card selections and their rendering helpers. This is the mapping to use for the new main-page layout when applying later wording proposals. `docs/preview/content.js` still provides section identities, article metadata and the original reader source configuration; it was not rewritten for this change. The user's `project-docs/CONTENT-REVIEW.md` has not been edited.

`docs/preview/main-pages.css` scopes the selected color and main-page presentation to landing mode. Reader mode retains the previous reader styling. The index shell, browse controller and section-carousel markup have been adapted to use these files.

No changes to the existing homepage, its navigation, article source pages, reader implementation, model code, image assets, or design-lab alternatives. No links to the preview were added to existing pages. Preview noindex and security metadata are retained.

## Validation

JavaScript syntax checks passed. All 148 local browser-fixture checks passed, covering four main sections at widths 320, 390, 768 and 1440, exact impact sentences, one-card layout, placeholder labeling, carousel selection, gallery decoding/controls, global search, existing article loading and return navigation. No page-level JavaScript errors occurred in those checks. Static local references in the updated HTML resolve.

The environment blocks browser URL navigation, including localhost. Tests used the actual site scripts and CSS in an in-memory document, with existing image bytes embedded and existing article source HTML supplied locally. CSP was omitted only in this fixture; the published CSP was retained. Those checks are not independent confirmation of live browser delivery or numerical-model behavior.

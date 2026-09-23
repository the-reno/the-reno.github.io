# Ronu preview — editing and structure

Current preview: https://ronu.one/preview/?v=20260923-structure1#explore

## One page structure

Every main page now follows **Topic → impact sentence → short introduction → collection**. Explore uses the same monospaced title, orange emphasis, reading width and spacing as the section pages. It retains “Stay curious.”, the approved introduction, and the four-section carousel. Its slides link to sections, not individual articles.

The collection varies by page: Explore shows sections; Triathlon and Science show one existing article each; Markets shows its explicitly labeled, non-clickable layout sample; Maker keeps the existing three-image gallery. No additional articles, images or personal copy were invented. The intentionally blank Maker introduction stays blank. No section numbers, themes row or Browse articles button return.

## Where to change things

| Change | File | What to edit |
| --- | --- | --- |
| Propose wording or leave comments | `project-docs/CONTENT-REVIEW.md` | Existing Proposed text / Comments blocks. Save and request a review/application in chat. |
| Published main-page wording | `docs/preview/page-content.js` | `MAIN_PAGES`: names, sentence `start`/`end`, introduction and collection kind. No HTML needed. |
| Navigation / Explore order | Same file | `SITE.sectionOrder`. Navigation and carousel use the same order. |
| Which articles appear in a section | Same file | `articleIds`, in display order. Existing IDs are listed in `content.js`. |
| Short landing-card summaries and icons | Same file | `ARTICLE_PREVIEWS`. Reader summaries remain separate deliberately. |
| Gallery images / captions / description | Same file | `MAKER_GALLERY`. Keep meaningful alternative text and existing asset paths. |
| Playback timing | Same file | `SITE.carousel.intervalMs` and `autoplay`. |
| Color / fonts / sizes / spacing | `docs/preview/main-pages.css` | Shared tokens at the top and three responsive breakpoints. |
| Card and carousel appearance | `docs/preview/components.css` | One component definition used across the main pages. |
| Full article metadata and source paths | `docs/preview/content.js` | `TOPICS` and the pinned `SOURCE`. Do not change the source revision just to edit a landing card. |

For example, changing `MAIN_PAGES.science.start` / `.end` updates its section header, Explore slide and search text together. Reordering `SITE.sectionOrder` changes both the main navigation and Explore slides. Adding a published topic ID to `articleIds` creates another compact tile; there is no page-specific HTML to copy.

Comments in the review file remain proposals, not page copy. Saving that Markdown file does not automatically publish or notify the assistant. It is public in GitHub, even though comments are not displayed on the webpage. The user's current wording proposals and comments were not overwritten by this refactor.

## Runtime responsibilities

- `index.html`: shared shell and accessible content slots; script and stylesheet version references.
- `page-content.js`: all main-page copy, section order, card selections and gallery data.
- `content.js`: article catalogue and reader identities derived from the page configuration; obsolete duplicated section introductions removed.
- `main-pages.js`: pure templates for the shared header, article tiles and collections; no editorial copy.
- `carousel.js`: one controller for both Explore and Maker, including dots, arrows, pause/play, swipe, focus handling and cleanup on navigation.
- `app.js`: routing, rendering and search. No hardcoded Explore introduction or separate per-page rendering branches.
- `main-pages.css` / `components.css`: the landing system, replacing the accumulated landing overrides.
- `styles.css`, `reader.css`, `theme.css`, `theme.js`, `reader.js`, `art.js`: existing base/reader styling and article behavior, preserved in this change.

Removed obsolete files after consolidation: `sections.css`, `carousel.css`, `maker-gallery.css`, `articles.css`, and the duplicate `maker-gallery.js` controller. Their active behavior is in the shared files above. Previous descriptions in PREVIEW-MAIN-PAGES.md and PREVIEW-ARTICLES.md describe earlier revisions; use this guide for the current file map.

## Change / check / publish

1. Edit the appropriate data or styling file. Keep page and article IDs stable so existing links still work.
2. Check syntax: `node --check docs/preview/page-content.js` (and each edited JavaScript file).
3. Run `python scripts/test-preview-structure.py --site-root docs` with Playwright and Chromium installed. This is a local fixture test, not a deployment command.
4. Inspect Explore, a section and Maker at phone/desktop sizes. Keep the one-article test scope unless additional articles are explicitly requested.
5. Bump the `?v=` string for each changed runtime file in `index.html`. Publish only changes in the preview, its docs and tests. Check the Pages deployment separately from local rendering.

Source articles, models, images, the production homepage and its navigation, and the design lab are unchanged. The preview stays at `/preview/`, unlinked from existing pages. No automatic publisher, external library, build framework, new font, analytics or background watcher was introduced. Existing security metadata is preserved.

## Validation — 23 September 2026

Base: `19fb2202de622bb6502d40daf46716a9035d2b98`.

JavaScript syntax checks and 232 local Chromium assertions passed. Checks cover five main pages at 320, 390, 768, 1024 and 1440 pixels; one shared header/collection structure; overflow; the existing orange; article scope and sample labeling; real image decoding; keyboard and pointer controls; playback/manual pause; disposal of old carousel listeners/timers; article loading/return links; global search; Escape; and one text edit updating the section header, Explore slide and search together.

The browser environment blocks URL navigation, including the live preview and file URLs. Tests therefore use in-memory HTML assembled from the actual site files, embedded existing image bytes and local copies of existing article bodies. CSP is omitted only in that test fixture. These checks do not establish live delivery, a whole-site accessibility certification or numerical-model accuracy.

Carousel interaction reference: https://www.w3.org/WAI/ARIA/apg/patterns/carousel/

# Ronu — layout, color and typography study

## Open

https://ronu.one/preview/design-lab/

Round 2 adds six layouts, twelve colors, four typography choices and color comparison. The existing L01–L04 layouts and G1/G2/O1/O2/B1/B2 color references remain available.

This is a public, unlinked test page. Only `docs/preview/design-lab/` and this guide are changed. The main website, `/preview/`, articles, models, Maker images and wording-review file are unchanged. No publishing button, repository write, background watcher or automatic application of choices is installed. `noindex` is not access control.

## Choose and identify

Use **Preview**, **Layouts** or **Colors** to see a single combination, compare all ten layouts using the same color, or compare all eighteen colors using the same layout. Typography is held constant across a comparison.

Pick a section or Explore. Comparisons use Triathlon as the labeled sample when Explore is selected. **Try** opens the chosen option at full size. **Phone** tests a narrow container; **Full view** removes the lab controls; Escape returns them. On a phone, **Change options** opens the selectors and **See this combination** returns to the preview.

Four starting combinations are available: Quiet, Technical, Atmospheric and Graphic. These are examples, not approved final designs.

The reference bar and **Copy choice** include a code such as `L06 / G1 / T04 / Science`, layout and color names, the hex value, typography and a shareable URL. The fallback dialog provides selectable text when clipboard access is unavailable.

Example: `/preview/design-lab/?layout=06&color=G1&type=04&page=science`

URL options: `layout=01` through `10`; `color` from the table below; `type=01` through `04`; `page=explore|triathlon|science|markets|maker`; `view=preview|compare|colors`; `screen=fit|phone`; `mode=lab|present`. Existing links without `type` retain the original type pairings. Selections are reflected in the URL, not saved in GitHub or browser storage.

## Layouts

| Reference | Name | Display |
| --- | --- | --- |
| L01 | Editorial | Section first. Sentence underneath. |
| L02 | Statement | Let the sentence lead. |
| L03 | Split | Words and a visual, side by side. |
| L04 | Poster | A bright field. Dark typography. |
| L05 | Minimal (new) | Space, a rule, one clear thought. |
| L06 | Signal (new) | A precise, technical field note. |
| L07 | Outline (new) | An outlined title. A solid idea. |
| L08 | Spotlight (new) | Centered words, a quiet glow. |
| L09 | Duotone (new) | Two panels. Two contrasting roles. |
| L10 | Index (new) | A numbered, magazine-like entry. |

L07 uses a decorative outlined word and a separate solid-text subject label. L08's halo is static and restrained. L04 and L09 use dark typography on bright surfaces. L10's number identifies a section, not a carousel page.

## Typography

| Reference | Name | Scope |
| --- | --- | --- |
| T01 | Original mix | Keep each layout's original type pairing. |
| T02 | Modern sans | Sans-serif display type. |
| T03 | Literary serif | Serif display type. |
| T04 | Technical mono | Monospaced display type. |

Only headline/sentence typography changes; article body copy and interface controls retain their reading styles. System font stacks avoid external font downloads. Available fonts and exact metrics vary by device. No font files are distributed.

## Accent colors

| Reference | Name | Hex | Contrast on #0C0E11 |
| --- | --- | --- | --- |
| G1 | Acid lime | #B8FF3D | 16.02:1 |
| G2 | Neon mint | #35F58B | 13.42:1 |
| G3 | Laser teal | #00F0B5 | 13.01:1 |
| G4 | Highlighter green | #75FF00 | 14.78:1 |
| O1 | Signal orange | #FF7A1A | 7.41:1 |
| O2 | Solar orange | #FFAD32 | 10.38:1 |
| O3 | Vermilion | #FF5C35 | 6.29:1 |
| O4 | Tangerine | #FF9366 | 8.85:1 |
| B1 | Electric blue | #4D9AFF | 6.79:1 |
| B2 | Ice blue | #32D5FF | 11.13:1 |
| B3 | Ultramarine | #7384FF | 5.96:1 |
| B4 | Polar blue | #8EDFFF | 13.02:1 |
| P1 | Ultraviolet | #C880FF | 7.35:1 |
| P2 | Hot pink | #FF6BD6 | 7.66:1 |
| P3 | Neon rose | #FF7597 | 7.59:1 |
| Y1 | Volt yellow | #F2FF40 | 17.63:1 |
| Y2 | Electric gold | #FFDA3D | 14.13:1 |
| N1 | Silver | #F2F4F7 | 17.54:1 |

Ratios use the WCAG sRGB relative-luminance formula for those pairs only. Dark text on a solid accent surface has the same ratio. Other states, subtle borders, decorative outlines and glow are not covered by that number. This is not a whole-site accessibility certification.

## Approved sentences — unchanged

Triathlon: Getting comfortable with discomfort.

Science: Finding patterns within the chaos.

Markets: Pricing the future before it happens.

Maker: What happens when an idea becomes real?

Explore remains a section gateway; its carousel is manual unless Play is selected. Selecting a section or slide pauses playback. Maker retains the three existing image assets and full-image links. Topic links open the existing preview, not rewritten articles.

## Files

`index.html`: lab shell, controls, reference links and copy fallback.

`content.js`: original options, approved sentences, excerpts and image references. Unchanged in round 2.

`alternatives.js`: additional option definitions, starting combinations and six new semantic hero compositions.

`lab.js`: rendering, URL choices, typography, layout/color comparisons, presentation mode and carousels.

`lab.css` and `preview.css`: original control styles and four layouts. Unchanged in round 2.

`alternatives.css`: new layouts, headline type overrides and compact/responsive controls.

`controls.js`: reopening desktop controls after a resize. Unchanged in round 2.

No external fonts, scripts, tracking, package dependencies, credentials or content-fetch requests are introduced. Images are existing same-host files. Production security and privacy metadata are retained.

## References

Original layout studies, not copied templates or endorsements:

- Current Ronu prototype: https://ronu.one/preview/
- Vercel Geist typography: https://vercel.com/geist/typography
- Linear: https://linear.app/
- Stripe accessible colors: https://stripe.com/blog/accessible-color-systems
- W3C contrast explanation: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

## Validation — round 2

656 local browser fixture assertions passed, with no uncaught JavaScript errors. The tests covered all ten layouts, four typography choices and four section sentences at 320, 390, 768 and 1440 pixels; no page or mock-container horizontal overflow was observed. Additional checks covered the option counts, preset selection, copy fallback including typography and URL, ten-layout and eighteen-color comparisons, Try, section-first Explore, carousel navigation, image decoding, full view and Escape. Node syntax checks passed for both changed JavaScript files. All eighteen base color-pair contrast ratios were calculated.

The browser environment blocks URL navigation, including file URLs. The test fixture uses the actual CSS/JavaScript and existing image bytes embedded locally, and removes CSP only in that fixture. The hosted file keeps its CSP and external resource references. Local checks do not verify live delivery, clipboard permissions, URL-state reload persistence or numerical model results. No whole-site validation success is claimed.

Base repository revision: `9f577de6a4af6168e18118212d439f1967efe592`.

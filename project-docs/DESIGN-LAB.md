# Ronu — layout and color study

## Open

https://ronu.one/preview/design-lab/

This is a separate, public, unlinked test page. It does not replace `/preview/` or the existing homepage. No link is added to any existing page. No publishing button, background process or automatic application of choices is installed. The page has noindex metadata, which is not access control.

## How to identify a choice

Choose a layout, an accent and a page. The reference bar shows a code such as `L03 / B1 / Science`. **Copy choice** copies that code, the names, the hexadecimal color and a shareable URL. If the clipboard is unavailable, a dialog provides selectable text. Send the reference back in the design conversation to request a subsequent implementation.

The URL stores the layout, color, section, comparison mode and selected preview width. It does not save anything to the repository. No browser storage is required. Direct-link format:

`/preview/design-lab/?layout=03&color=B1&page=science`

Use **Compare layouts** to compare the same sentence and color across all four compositions. When Explore is selected, comparison cards use Triathlon as the clearly labeled sample. Use **Try** to view a layout, **Phone** for a narrow container, or **Full view** to remove the lab controls. Escape exits full view. On a phone, **Change options** expands the controls.

## Layout references

- L01 — Editorial: section name first, accent-colored serif sentence underneath. Continuation of the approved Ronu typographic direction.
- L02 — Statement: the sentence leads, with the section in a small label.
- L03 — Split: title and sentence beside an abstract visual; stacked on narrow screens.
- L04 — Poster: a bounded bright panel with dark type; the rest of the page remains dark.

References are linked in the page: the current Ronu prototype, Vercel Geist typography, Linear, Stripe's accessible-color article and the W3C contrast explanation. These are reference studies, not copied templates or endorsements.

https://vercel.com/geist/typography
https://linear.app/
https://stripe.com/blog/accessible-color-systems
https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

## Bright accent choices

| ID | Name | Color | Contrast against #0C0E11 |
| --- | --- | --- | --- |
| G1 | Acid lime | #B8FF3D | 16.02:1 |
| G2 | Neon mint | #35F58B | 13.42:1 |
| O1 | Signal orange | #FF7A1A | 7.41:1 |
| O2 | Solar orange | #FFAD32 | 10.38:1 |
| B1 | Electric blue | #4D9AFF | 6.79:1 |
| B2 | Ice blue | #32D5FF | 11.13:1 |

Ratios use the WCAG sRGB relative-luminance formula for these pairs only. On solid-color poster panels, dark #0C0E11 text uses the same contrast ratio. This is not a whole-site accessibility certification.

## Approved sentences

Triathlon: Getting comfortable with discomfort.

Science: Finding patterns within the chaos.

Markets: Pricing the future before it happens.

Maker: What happens when an idea becomes real?

The lab preserves these sentences exactly, changing only their display and emphasis. Supporting paragraphs are excerpts of the current preview; the lab does not migrate or rewrite full articles. Topic links open the current prototype. Explore remains a section gateway, with a manual carousel and optional 8-second playback. Selecting a slide pauses playback. Maker displays the three existing image assets with manual controls and full-image links. The existing preview's own galleries and carousels are not modified.

## Files

`docs/preview/design-lab/index.html` — lab shell, reference links and clipboard fallback.

`docs/preview/design-lab/content.js` — approved sentences, supporting excerpts, options and image paths.

`docs/preview/design-lab/lab.js` — controls, URL state, comparison, presentation mode and carousels.

`docs/preview/design-lab/lab.css` — lab controls and responsive workspace.

`docs/preview/design-lab/preview.css` — four scoped compositions and responsive page previews.

Only existing public image assets are referenced. There are no external fonts, scripts, analytics, package dependencies, credentials or network fetches in the lab. External references open only when selected. JavaScript is required for comparison.

## Validation

Node syntax checks passed. 250 local browser fixture assertions passed, including all approved sentences across four layouts and six colors; section-first Explore; existing image decoding; mobile widths 320/390/768/1440; comparisons; copy fallback with encoded URL; full view and Escape; navigation; and carousel controls/playback. No JavaScript errors were observed during those checks.

The browser environment blocks URL navigation, including localhost and file URLs. Browser tests therefore used an in-memory fixture with the actual CSS and JavaScript embedded, original image bytes embedded as data URLs, and Content Security Policy omitted in that test fixture only. Production CSP remains in index.html. Live page rendering, browser clipboard permissions and reload persistence of URL state require checking through the actual hosted page. Tests do not validate the numerical models linked from the prototype.

Base repository revision: 7940d30724d0eb393972ad2034a516b922389dfa. Existing content-review proposals and previously published files are preserved.

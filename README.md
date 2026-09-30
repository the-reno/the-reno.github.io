# Ronu.one

Static website. GitHub Pages serves `docs/` on the custom domain in `docs/CNAME`.

## Editing

- `docs/page-content.js`: section wording, navigation order, selected article IDs, gallery images and footer.
- `docs/articles/*.json`: article text, headings, formulas and tables.
- `docs/content.js`: article catalogue and JSON version identifiers.
- `docs/main-pages.css`: shared color, typography, dimensions and spacing.
- `docs/components.css`: article cards and carousels.
- `docs/narrative.css`: article layout.
- `scripts/site-shell.html`: shared HTML shell, asset versions and head metadata slots.
- `docs/routes.js`: canonical paths, metadata and compatibility with old hash links.

Keep IDs stable. Increment articleVersion and the affected `?v=` asset references in `scripts/site-shell.html` after edits. Article text is structured data; raw HTML is not executed.

Run `node scripts/build_site.js` after editing content, renderers or the shell. This regenerates `docs/index.html`, `docs/section/*/index.html`, `docs/topic/*/index.html`, and `docs/sitemap.xml` using the browser's own renderers. Commit the generated files with the sources; GitHub Pages serves them directly and needs no rewrite rule or build dependency. Do not edit the generated HTML by hand. When removing an article, also remove its generated directory.

Run `python scripts/check_site.py` to check generated files, static article text, canonical URLs, sitemap, links, syntax and existing integrations. CI runs this check and fails if generated pages are stale. To review locally, run `python -m http.server 8000 --directory docs` and open `http://localhost:8000/`. Open or refresh `/topic/prediction/` and `/topic/sunlight-to-step/` directly; both are full HTML documents even without JavaScript.

For browser integration checks, install Playwright with Chromium in your development environment and run `node scripts/test_browser.js`. Set `RONU_SCREENSHOT_DIR` to save desktop/mobile screenshots. The tests start and stop a local static server and intercept feedback; they do not send live feedback or visit records.

Article and section navigation uses the History API with ordinary crawlable links. Old `#topic/...`, `#section/...`, part anchors, `/preview/` links and historical `.html` URLs retain compatibility. Unknown paths return GitHub Pages' real 404. Spark is retired in the current catalogue, so its old hash still leads to Science; no empty Spark article is generated. Archived experiments and development files are not part of this repository's current file tree.

## Search Console after publication

1. Verify the `ronu.one` Domain property using the DNS TXT value supplied by [Google Search Console](https://support.google.com/webmasters/answer/9008080), if not already verified.
2. After the changes are published and the new URLs respond successfully, [submit the sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) at `https://ronu.one/sitemap.xml`.
3. Use [URL Inspection and Request Indexing](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl) for the homepage and both article URLs. Check the rendered content and Google-selected canonical. Indexing is not guaranteed.

Updating this branch does not publish the site. Merging into the GitHub Pages source branch is a separate deployment step.

## Visitor records

The live site uses page-view records and a private feedback form. Public integration files are `docs/records-config.js`, `docs/visits.js`, `docs/feedback.js`, and `docs/feedback.css`. They send only to `https://ronu-records.rafatreno.workers.dev`; no administrator credential is stored in this repository. Visit records retain page/time, connection IP address, and approximate country/first-level region supplied by Cloudflare. City, postal code and coordinates are not stored. The privacy notice is at `/privacy/`.

# Ronu.one

Static website. GitHub Pages serves `docs/` on the custom domain in `docs/CNAME`.

## Editing

- `docs/page-content.js`: section wording, navigation order, selected article IDs, gallery images and footer.
- `docs/articles/*.json`: article text, headings, formulas and tables.
- `docs/content.js`: article catalogue and JSON version identifiers.
- `docs/main-pages.css`: shared color, typography, dimensions and spacing.
- `docs/components.css`: article cards and carousels.
- `docs/narrative.css`: article layout.

Keep IDs stable. Increment articleVersion and the affected `?v=` asset references in `docs/index.html` after edits. Article text is structured data; raw HTML is not executed.

Run `python scripts/check_site.py` to check files and links. To review locally, run `python -m http.server 8000 --directory docs` and open `http://localhost:8000/`.

The `/preview/` entry now redirects to the live site while preserving article and section hashes. Archived experiments and development files are not part of this repository’s current file tree.

## Visitor records

The live site uses page-view records and a private feedback form. Public integration files are `docs/records-config.js`, `docs/visits.js`, `docs/feedback.js`, and `docs/feedback.css`. They send only to `https://ronu-records.rafatreno.workers.dev`; no administrator credential is stored in this repository. Visit records retain page/time, connection IP address, and approximate country/first-level region supplied by Cloudflare. City, postal code and coordinates are not stored. The privacy notice is at `/privacy/`.

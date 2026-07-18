# Architecture

## Purpose

Ronu is a dependency-light static website. GitHub Pages publishes the contents of `docs/`; no build step, database, or server application is required.

## Publishing boundary

Everything inside `docs/` is public and downloadable. Nothing outside `docs/` is required at runtime.

```text
docs/
├── index.html          Home page and primary navigation
├── CNAME               Custom domain: ronu.one
├── .nojekyll           Disable Jekyll processing
├── robots.txt          Crawler policy
├── privacy/            Public privacy policy
├── Science/            Science index, articles, and simulations
├── Maker/              Maker section
└── triathlon/          Endurance article
```

Existing directory capitalization is retained where it is part of a public URL. New section directories should use lowercase kebab-case. Existing URLs should not be renamed solely for style consistency.

## Growth model

- Add a directory per durable section.
- Give each section an `index.html` landing page.
- Put section-specific assets inside that section.
- Introduce `docs/assets/` only when an asset is shared by two or more sections.
- Keep experiments outside `docs/` until they are ready to publish.
- Avoid frameworks until repeated components or build requirements justify one.


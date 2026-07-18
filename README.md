# Ronu

Source repository for [ronu.one](https://ronu.one), a static personal website hosted with GitHub Pages.

## Repository layout

```text
docs/               Published website only
project-docs/       Architecture, content, deployment, privacy, and testing guidance
scripts/            Local validation tools
.github/workflows/  Automated checks
```

The `docs/` directory is intentionally small. It contains only the pages and assets reachable from the current website, plus required hosting and policy files. Experimental work, source material, spreadsheets, and private data must not be placed there.

## Quick start

```powershell
python -m http.server 8000 --directory docs
python scripts/check_site.py
```

Open `http://127.0.0.1:8000/` to preview the website.

Read [project-docs/CONTENT-GUIDE.md](project-docs/CONTENT-GUIDE.md) before adding content and [project-docs/DEPLOYMENT.md](project-docs/DEPLOYMENT.md) before changing GitHub Pages settings.


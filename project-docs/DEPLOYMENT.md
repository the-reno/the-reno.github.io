# Deployment

## GitHub Pages configuration

- Repository: `the-reno/the-reno.github.io`
- Branch: `main`
- Publishing directory: `/docs`
- Custom domain: `ronu.one`
- HTTPS enforcement: enabled

After this structure is merged, configure **Settings → Pages → Build and deployment** to deploy from the `main` branch and `/docs` folder. Do not change the DNS records or remove `docs/CNAME` during the migration.

## Release procedure

1. Merge a reviewed pull request into `main`.
2. Confirm the Pages deployment succeeds.
3. Check `https://ronu.one/`, `/privacy/`, and all modified routes.
4. Confirm `https://www.ronu.one/` redirects to the apex domain.
5. Roll back by reverting the merge commit if navigation or content is broken.

GitHub Pages source code remains publicly visible because this repository is public. Browser-delivered HTML, CSS, and JavaScript are inspectable regardless of repository visibility.


"""Validate the static GitHub Pages site without third-party dependencies."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "docs"
REQUIRED = ("index.html", "CNAME", ".nojekyll", "robots.txt", "privacy/index.html")
BLOCKED_SUFFIXES = {".bas", ".csv", ".key", ".pem", ".xls", ".xlsx"}
ATTR = re.compile(r"(?:href|src)=[\"']([^\"']+)[\"']", re.IGNORECASE)


def target_for(reference: str, page: Path) -> Path | None:
    parsed = urlparse(reference)
    if parsed.scheme or parsed.netloc or reference.startswith(("#", "mailto:", "tel:")):
        return None
    raw = parsed.path
    if not raw:
        return None
    target = SITE / raw.lstrip("/") if raw.startswith("/") else page.parent / raw
    if raw.endswith("/"):
        target /= "index.html"
    return target.resolve()


def main() -> int:
    errors: list[str] = []
    for relative in REQUIRED:
        if not (SITE / relative).exists():
            errors.append(f"missing required file: docs/{relative}")

    cname = SITE / "CNAME"
    if cname.exists() and cname.read_text(encoding="utf-8").strip() != "ronu.one":
        errors.append("docs/CNAME must contain ronu.one")

    for path in SITE.rglob("*"):
        if path.is_file() and path.suffix.lower() in BLOCKED_SUFFIXES:
            errors.append(f"sensitive or source file type published: {path.relative_to(ROOT)}")

    for page in SITE.rglob("*.html"):
        text = page.read_text(encoding="utf-8")
        if page != SITE / "privacy" / "index.html" and 'rel="privacy-policy"' not in text:
            errors.append(f"privacy-policy metadata missing: {page.relative_to(ROOT)}")
        if "Content-Security-Policy" not in text:
            errors.append(f"Content Security Policy missing: {page.relative_to(ROOT)}")
        for reference in ATTR.findall(text):
            target = target_for(reference, page)
            if target is not None and (SITE not in target.parents and target != SITE):
                errors.append(f"link escapes docs/: {page.relative_to(ROOT)} -> {reference}")
            elif target is not None and not target.exists():
                errors.append(f"broken internal reference: {page.relative_to(ROOT)} -> {reference}")

    if errors:
        print("Site validation failed:")
        print("\n".join(f"- {error}" for error in errors))
        return 1
    print("Site validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())


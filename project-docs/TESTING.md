# Testing

## Automated

Run from the repository root:

```powershell
python scripts/check_site.py
```

The check validates required hosting files, internal links, local scripts and styles, privacy metadata, and accidental publication of sensitive file types.

The GitHub Actions workflow runs the same check on pushes and pull requests.

## Browser acceptance

Preview with:

```powershell
python -m http.server 8000 --directory docs
```

Verify:

- the five-card homepage carousel advances in both directions;
- homepage links reach Triathlon, Prediction, The Spark, Phantom Traffic Jam, and Maker;
- Science index links work;
- both canvas demonstrations initialize;
- `/privacy/` renders;
- mobile and desktop layouts remain readable; and
- the console contains no errors.


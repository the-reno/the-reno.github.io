from __future__ import annotations

import base64
import gzip
from pathlib import Path

folder = Path(__file__).resolve().parent
parts = sorted((folder / "source").glob("Rates_Analysis_Final.bas.gz.b64.part*"))

if not parts:
    raise SystemExit("No VBA source chunks were found in rates-analysis/source.")

encoded = "".join(part.read_text(encoding="ascii").strip() for part in parts)
output = folder / "Rates_Analysis_Final_v2.bas"
output.write_bytes(gzip.decompress(base64.b64decode(encoded)))
print(f"Created {output}")

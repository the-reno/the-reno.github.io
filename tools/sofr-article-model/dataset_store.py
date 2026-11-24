"""Store rate datasets and their observations on the local computer."""

from __future__ import annotations

import os
import secrets
import sqlite3
import sys
from contextlib import closing, contextmanager
from pathlib import Path


NAME_LIMIT = 80
OBSERVATIONS_LIMIT = 2000


def default_dataset_dir() -> Path:
    if sys.platform == "win32":
        parent = Path(os.getenv("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
    elif sys.platform == "darwin":
        parent = Path.home() / "Library" / "Application Support"
    else:
        parent = Path(os.getenv("XDG_DATA_HOME") or Path.home() / ".local" / "share")
    return parent / "Ronu" / "SOFR_Article_Model"


class DatasetStore:
    def __init__(self, directory: Path):
        directory.mkdir(parents=True, exist_ok=True)
        self.path = directory / "datasets.sqlite3"
        with self.connect() as database:
            database.execute("""
                CREATE TABLE IF NOT EXISTS datasets (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    observations TEXT NOT NULL DEFAULT '',
                    filename TEXT,
                    csv_data BLOB
                )
            """)

    @contextmanager
    def connect(self):
        with closing(sqlite3.connect(self.path)) as database, database:
            database.row_factory = sqlite3.Row
            yield database

    def summaries(self) -> dict[str, dict]:
        with self.connect() as database:
            rows = database.execute(
                "SELECT id, name, observations, filename FROM datasets ORDER BY rowid"
            )
            return {entry["id"]: dict(entry) for entry in rows}

    def read_csv(self, dataset_id: str) -> bytes | None:
        with self.connect() as database:
            record = database.execute(
                "SELECT csv_data FROM datasets WHERE id = ?", (dataset_id,)
            ).fetchone()
            return record["csv_data"] if record else None

    def add_csv(self, content: bytes, filename: str) -> str:
        filename = filename.replace("\\", "/").rsplit("/", 1)[-1].strip()[:180] or "Imported rates.csv"
        name = Path(filename).stem.strip()[:NAME_LIMIT] or "Imported rates"
        dataset_id = secrets.token_urlsafe(12)
        with self.connect() as database:
            database.execute(
                "INSERT INTO datasets (id, name, filename, csv_data) VALUES (?, ?, ?, ?)",
                (dataset_id, name, filename, content),
            )
        return dataset_id

    def save_details(self, dataset_id: str, name: str, observations: str):
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > NAME_LIMIT:
            raise ValueError(f"Enter a dataset name up to {NAME_LIMIT} characters.")
        if not isinstance(observations, str) or len(observations) > OBSERVATIONS_LIMIT:
            raise ValueError(f"Keep observations to {OBSERVATIONS_LIMIT:,} characters.")
        with self.connect() as database:
            database.execute("""
                INSERT INTO datasets (id, name, observations) VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    observations = excluded.observations
            """, (dataset_id, name.strip(), observations.strip()))

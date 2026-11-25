"""Save one working rates sheet and its observations on the local computer."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import sys
from contextlib import closing, contextmanager
from pathlib import Path


NAME_LIMIT = 80
OBSERVATIONS_LIMIT = 2000


def clean_details(name: str, observations: str) -> tuple[str, str]:
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > NAME_LIMIT:
        raise ValueError(f"Enter a dataset name up to {NAME_LIMIT} characters.")
    if not isinstance(observations, str) or len(observations) > OBSERVATIONS_LIMIT:
        raise ValueError(f"Keep observations to {OBSERVATIONS_LIMIT:,} characters.")
    return name.strip(), observations.strip()


def record_version(record: dict | None) -> str | None:
    if record is None:
        return None
    details = json.dumps([record["name"], record["observations"], record["filename"]]).encode("utf-8")
    return hashlib.sha256(details + b"\0" + record["csv_data"]).hexdigest()


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

    @staticmethod
    def working_record(database):
        # Open the most recent earlier import until a fixed-template draft is saved.
        row = database.execute("""
            SELECT name, observations, filename, csv_data FROM datasets
            WHERE csv_data IS NOT NULL
            ORDER BY (id = 'working') DESC, rowid DESC LIMIT 1
        """).fetchone()
        return dict(row) if row else None

    def load(self) -> dict | None:
        with self.connect() as database:
            return self.working_record(database)

    def save(self, record: dict, previous_version: str | None):
        with self.connect() as database:
            database.execute("BEGIN IMMEDIATE")
            if record_version(self.working_record(database)) != previous_version:
                raise ValueError("This sheet changed in another window. Reload the draft before saving.")
            database.execute("""
                INSERT INTO datasets (id, name, observations, filename, csv_data)
                VALUES ('working', :name, :observations, :filename, :csv_data)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name, observations = excluded.observations,
                    filename = excluded.filename, csv_data = excluded.csv_data
            """, record)

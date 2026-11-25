"""Keep the last confirmed rate upload on the local computer."""

from __future__ import annotations

import hashlib
import os
import sqlite3
import sys
from contextlib import closing, contextmanager
from pathlib import Path


def record_version(record: dict | None) -> str | None:
    if record is None:
        return None
    return hashlib.sha256(record["filename"].encode("utf-8") + b"\0" + record["csv_data"]).hexdigest()


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
    def confirmed_record(database):
        row = database.execute("""
            SELECT filename, csv_data FROM datasets
            WHERE id = 'confirmed_rates' AND csv_data IS NOT NULL
        """).fetchone()
        return dict(row) if row else None

    def load(self) -> dict | None:
        with self.connect() as database:
            return self.confirmed_record(database)

    def save(self, filename: str, content: bytes, previous_version: str | None):
        record = {"filename": filename, "csv_data": content}
        with self.connect() as database:
            database.execute("BEGIN IMMEDIATE")
            current = self.confirmed_record(database)
            if current == record:
                return
            if record_version(current) != previous_version:
                raise ValueError("Another window confirmed different rates. Reload this page before continuing.")
            database.execute("""
                INSERT INTO datasets (id, name, filename, csv_data)
                VALUES ('confirmed_rates', :filename, :filename, :csv_data)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name, filename = excluded.filename, csv_data = excluded.csv_data
            """, record)

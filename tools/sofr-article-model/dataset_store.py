"""Store rate datasets and their observations on the local computer."""

from __future__ import annotations

import hashlib
import json
import os
import secrets
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


def record_version(record: dict) -> str:
    details = json.dumps([record["name"], record["observations"]]).encode("utf-8")
    return hashlib.sha256(details + b"\0" + (record["csv_data"] or b"")).hexdigest()


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

    def read(self, dataset_id: str) -> dict | None:
        with self.connect() as database:
            record = database.execute(
                "SELECT id, name, observations, filename, csv_data FROM datasets WHERE id = ?", (dataset_id,)
            ).fetchone()
            return dict(record) if record else None

    def add_csv(self, content: bytes, filename: str, name: str | None = None, observations: str = "") -> str:
        filename = filename.replace("\\", "/").rsplit("/", 1)[-1].strip()[:180] or "Imported rates.csv"
        if name is None:
            name = Path(filename).stem.strip()[:NAME_LIMIT] or "Imported rates"
        name, observations = clean_details(name, observations)
        dataset_id = secrets.token_urlsafe(12)
        with self.connect() as database:
            database.execute(
                "INSERT INTO datasets (id, name, observations, filename, csv_data) VALUES (?, ?, ?, ?, ?)",
                (dataset_id, name, observations, filename, content),
            )
        return dataset_id

    def update_csv(self, dataset_id: str, content: bytes, name: str, observations: str, version: str):
        name, observations = clean_details(name, observations)
        with self.connect() as database:
            database.execute("BEGIN IMMEDIATE")
            record = database.execute(
                "SELECT name, observations, csv_data FROM datasets WHERE id = ?", (dataset_id,)
            ).fetchone()
            if record is None or record["csv_data"] is None:
                raise ValueError("Select a saved dataset first.")
            if record_version(record) != version:
                raise ValueError("This dataset changed in another window. Reload it before saving.")
            database.execute(
                "UPDATE datasets SET name = ?, observations = ?, csv_data = ? WHERE id = ?",
                (name, observations, content, dataset_id),
            )

    def save_details(self, dataset_id: str, name: str, observations: str, previous: dict | None = None):
        name, observations = clean_details(name, observations)
        with self.connect() as database:
            if previous is not None:
                database.execute("BEGIN IMMEDIATE")
                current = database.execute(
                    "SELECT name, observations, csv_data FROM datasets WHERE id = ?", (dataset_id,)
                ).fetchone()
                if current is not None and record_version(current) != record_version(previous):
                    raise ValueError("This dataset changed in another window. Reload it before saving.")
            database.execute("""
                INSERT INTO datasets (id, name, observations) VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    observations = excluded.observations
            """, (dataset_id, name, observations))

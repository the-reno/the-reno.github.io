"""Editable CSV sheets and their projection into the SOFR model's five inputs."""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from decimal import Decimal, DecimalException

from sofr_model import TENORS


MODEL_COLUMNS = ("Date", *TENORS)
MAX_COLUMNS = 512
MAX_CELLS = 1_000_000


@dataclass
class RateSheet:
    columns: list[str]
    rows: list[list[str]]

    def __post_init__(self):
        width = len(self.columns)
        if not 1 <= width <= MAX_COLUMNS:
            raise ValueError(f"Use between 1 and {MAX_COLUMNS} spreadsheet columns.")
        if width * (len(self.rows) + 1) > MAX_CELLS:
            raise ValueError("This spreadsheet is too large. Import a smaller range.")
        if any(len(row) != width for row in self.rows):
            raise ValueError("Each row must have one cell per spreadsheet column.")

    @classmethod
    def from_csv(cls, content: bytes) -> RateSheet:
        try:
            decoded = content.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise ValueError("Save the file as a UTF-8 CSV and try again.") from error
        reader = csv.reader(io.StringIO(decoded, newline=""), strict=True)
        try:
            records = [record for record in reader if record]
        except csv.Error as error:
            raise ValueError(f"Check the CSV formatting around row {reader.line_num}.") from error
        if not records:
            raise ValueError("Include a header row in the CSV.")
        # A wider data row can be edited and given a heading in the spreadsheet.
        width = max(map(len, records))
        if width > MAX_COLUMNS or width * len(records) > MAX_CELLS:
            raise ValueError("This spreadsheet is too large. Import a smaller range.")
        columns, *rows = [record + [""] * (width - len(record)) for record in records]
        return cls(columns, rows)

    @classmethod
    def from_payload(cls, payload: dict) -> RateSheet:
        if not isinstance(payload, dict):
            raise ValueError("Supply a spreadsheet to save.")
        columns, rows = payload.get("columns"), payload.get("rows")
        if not isinstance(columns, list) or not isinstance(rows, list):
            raise ValueError("Supply spreadsheet columns and rows.")
        if not all(isinstance(cell, str) for cell in columns):
            raise ValueError("Column headings must be text.")
        if not all(isinstance(row, list) and all(isinstance(cell, str) for cell in row) for row in rows):
            raise ValueError("Spreadsheet cells must be text or numbers entered as text.")
        field_limit = csv.field_size_limit()
        if any(len(cell) > field_limit for cell in columns) or any(
            len(cell) > field_limit for row in rows for cell in row
        ):
            raise ValueError("One or more spreadsheet cells are too long to save as CSV.")
        return cls(columns, rows)

    def to_csv(self) -> bytes:
        return write_csv(self.columns, self.rows)

    def model_csv(self) -> bytes:
        positions = {}
        required = {column.casefold(): column for column in MODEL_COLUMNS}
        for index, column in enumerate(self.columns):
            canonical = required.get(column.strip().casefold())
            if canonical is None:
                continue
            if canonical in positions:
                raise ValueError(f"Keep one column named {canonical} for model calculations.")
            positions[canonical] = index
        missing = [column for column in MODEL_COLUMNS if column not in positions]
        if missing:
            raise ValueError("Add the required columns " + ", ".join(missing) + " to run the model.")

        rows = []
        for index, row in enumerate(self.rows, start=1):
            values = [row[positions[column]].strip() for column in MODEL_COLUMNS]
            if not any(values):
                continue
            for column, value in zip(MODEL_COLUMNS, values, strict=True):
                if not value:
                    raise ValueError(f"Enter a value in row {index}, column {column}.")
            for cell in range(1, len(values)):
                if values[cell].endswith("%"):
                    try:
                        values[cell] = str(Decimal(values[cell][:-1].strip()) / 100)
                    except DecimalException as error:
                        raise ValueError(f"Enter a valid rate in row {index}, column {MODEL_COLUMNS[cell]}.") from error
            rows.append(values)
        return write_csv(MODEL_COLUMNS, rows)


def write_csv(columns, rows) -> bytes:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(columns)
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")

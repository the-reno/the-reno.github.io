"""Import, edit and validate the fixed rate input sheet."""

from __future__ import annotations

import csv
import io
import math
import posixpath
from dataclasses import dataclass
from datetime import date, timedelta
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile

from sofr_model import TENORS, CurvePoint, annual_rate, rate_date


MODEL_COLUMNS = ("Date", *TENORS)
MAX_ROWS = 20_000
MAX_CELL_LENGTH = 128
MAX_XML_BYTES = 16 * 1024 * 1024


def column_positions(headings: list[str], *, allow_missing: bool = False) -> list[int | None]:
    normalized = [heading.strip().casefold() for heading in headings]
    positions = []
    missing = []
    for column in MODEL_COLUMNS:
        indices = [index for index, value in enumerate(normalized) if value == column.casefold()]
        if len(indices) > 1 and not allow_missing:
            raise ValueError(f"Keep one {column} column in the imported file.")
        if not indices:
            missing.append(column)
        positions.append(indices[0] if indices else None)
    if missing and not allow_missing:
        raise ValueError("The file is missing " + ", ".join(missing) + ". Use the rate template headers.")
    return positions


@dataclass
class RateSheet:
    rows: list[list[str]]

    def __post_init__(self):
        if len(self.rows) > MAX_ROWS:
            raise ValueError(f"Use up to {MAX_ROWS:,} rows.")
        if any(len(row) != len(MODEL_COLUMNS) for row in self.rows):
            raise ValueError("Each spreadsheet row needs a date and four rate cells.")
        if any(len(cell) > MAX_CELL_LENGTH for row in self.rows for cell in row):
            raise ValueError(f"Use up to {MAX_CELL_LENGTH} characters in each rate or date cell.")
        while self.rows and not any(value.strip() for value in self.rows[-1]):
            self.rows.pop()

    @classmethod
    def from_csv(cls, content: bytes, *, allow_missing: bool = False) -> RateSheet:
        try:
            decoded = content.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise ValueError("Save the file as a UTF-8 CSV or an Excel workbook.") from error
        reader = csv.reader(io.StringIO(decoded, newline=""), strict=True)
        try:
            headings = next((record for record in reader if any(field.strip() for field in record)), None)
            if headings is None:
                raise ValueError("Include the header row from the rate template.")
            positions = column_positions(headings, allow_missing=allow_missing)
            rows = []
            for record in reader:
                if len(rows) == MAX_ROWS:
                    raise ValueError(f"Use up to {MAX_ROWS:,} rows.")
                rows.append([record[index] if index is not None and index < len(record) else "" for index in positions])
            return cls(rows)
        except csv.Error as error:
            raise ValueError(f"Check the CSV formatting near line {reader.line_num}.") from error

    @classmethod
    def from_payload(cls, payload: dict) -> RateSheet:
        rows = payload.get("rows") if isinstance(payload, dict) else None
        if not isinstance(rows, list) or not all(
            isinstance(row, list) and all(isinstance(cell, str) for cell in row) for row in rows
        ):
            raise ValueError("Supply the spreadsheet rows to save.")
        return cls(rows)

    def to_csv(self) -> bytes:
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(MODEL_COLUMNS)
        writer.writerows(self.rows)
        return output.getvalue().encode("utf-8")

    def to_curve(self) -> list[CurvePoint]:
        points = []
        for index, row in enumerate(self.rows, start=1):
            if not any(value.strip() for value in row):
                continue
            values = []
            for column, raw in zip(MODEL_COLUMNS, row, strict=True):
                try:
                    values.append(rate_date(raw) if column == "Date" else annual_rate(raw))
                except ValueError as error:
                    raise ValueError(f"Row {index}, {column}. {error}") from error
            day, *rates = values
            if points and day <= points[-1].day:
                raise ValueError(f"Row {index}, Date. Use unique dates in ascending order.")
            points.append(CurvePoint(day, tuple(rates)))
        if len(points) < 2:
            raise ValueError("Include at least two dated observations before confirming rates.")
        return points


def spreadsheet_column(address: str) -> int:
    index = 0
    for character in address:
        if not "A" <= character <= "Z":
            break
        index = index * 26 + ord(character) - ord("A") + 1
        if index > 16_384:
            raise ValueError("The workbook contains an invalid column address.")
    return index - 1


def excel_date(raw: str, kind: str, date_1904: bool) -> str:
    if kind == "d":
        return raw.split("T", 1)[0]
    if kind == "n" and raw:
        try:
            serial = math.floor(float(raw))
            if serial < 0 or (not date_1904 and serial == 60):
                return raw
            epoch = date(1904, 1, 1) if date_1904 else date(1899, 12, 30 if serial > 60 else 31)
            return (epoch + timedelta(days=serial)).isoformat()
        except (ValueError, OverflowError):
            return raw
    return raw


def excel_text(element: ET.Element) -> str:
    return "".join(node.text or "" for node in element.findall("{*}t") + element.findall("{*}r/{*}t"))


def workbook_rows(root: ET.Element, strings: list[str], date_1904: bool) -> RateSheet | None:
    positions = None
    rows = []
    last_row = 0
    for ordinal, row in enumerate(root.findall("{*}sheetData/{*}row"), start=1):
        cells = {}
        for offset, cell in enumerate(row.findall("{*}c")):
            index = spreadsheet_column(cell.attrib["r"]) if "r" in cell.attrib else offset
            if index < 0 or (positions is not None and index not in positions):
                continue
            kind = cell.get("t", "n")
            value = cell.findtext("{*}v", default="")
            if kind == "s" and value:
                string_index = int(value)
                if not 0 <= string_index < len(strings):
                    raise ValueError("The workbook has an invalid shared value. Resave it in Excel.")
                value = strings[string_index]
            elif kind == "inlineStr":
                inline = cell.find("{*}is")
                value = excel_text(inline) if inline is not None else ""
            cells[index] = (value, kind)

        if positions is None:
            if ordinal > 30:
                return None
            headings = [cells.get(index, ("", ""))[0] for index in range(max(cells, default=-1) + 1)]
            if {column.casefold() for column in MODEL_COLUMNS} <= {item.strip().casefold() for item in headings}:
                positions = column_positions(headings)
                last_row = int(row.get("r", ordinal))
            continue

        values, types = zip(*(cells.get(index, ("", "")) for index in positions), strict=True)
        if not any(values):
            continue
        current = int(row.get("r", ordinal))
        if current <= last_row:
            raise ValueError("The workbook contains out-of-order rows. Resave it in Excel.")
        if len(rows) + current - last_row > MAX_ROWS:
            raise ValueError(f"Use up to {MAX_ROWS:,} rows in the rate sheet.")
        rows.extend([""] * len(MODEL_COLUMNS) for _ in range(current - last_row - 1))
        rows.append([excel_date(values[0], types[0], date_1904), *values[1:]])
        last_row = current
    return RateSheet(rows) if positions is not None else None


def import_workbook(content: bytes) -> tuple[RateSheet, str]:
    try:
        with ZipFile(io.BytesIO(content)) as archive:
            remaining = MAX_XML_BYTES

            def read_xml(path):
                nonlocal remaining
                item = archive.getinfo(path)
                remaining -= item.file_size
                if remaining < 0:
                    raise ValueError("The workbook is too large. Save the rate sheet in a smaller workbook.")
                return ET.fromstring(archive.read(item))

            workbook = read_xml("xl/workbook.xml")
            properties = workbook.find("{*}workbookPr")
            date_1904 = properties is not None and properties.get("date1904") in ("1", "true")
            relations = {}
            strings = []
            for link in read_xml("xl/_rels/workbook.xml.rels"):
                if link.get("TargetMode") == "External":
                    continue
                target = link.get("Target", "")
                path = posixpath.normpath(target.lstrip("/") if target.startswith("/") else "xl/" + target)
                if not path.startswith("xl/"):
                    continue
                kind = link.get("Type", "").rsplit("/", 1)[-1]
                if kind == "sharedStrings":
                    strings = [excel_text(item) for item in read_xml(path).findall("{*}si")]
                elif kind == "worksheet":
                    relations[link.get("Id")] = path

            sheets = workbook.findall("{*}sheets/{*}sheet")
            sheets.sort(key=lambda sheet: sheet.get("name", "").casefold() != "historical_rates")
            for sheet in sheets:
                link_id = next((value for key, value in sheet.attrib.items() if key.endswith("}id")), None)
                if link_id in relations:
                    result = workbook_rows(read_xml(relations[link_id]), strings, date_1904)
                    if result is not None:
                        return result, sheet.get("name", "")
    except (BadZipFile, ET.ParseError, KeyError, OSError, RuntimeError) as error:
        raise ValueError("Could not read the Excel workbook. Resave it as .xlsx or CSV.") from error
    raise ValueError("No worksheet contains the Date, ON, 1M, 3M and 6M headers.")

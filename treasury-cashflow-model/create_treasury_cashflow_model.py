from datetime import date, timedelta
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo


OUTPUT_FILE = "treasury_cashflow_model.xlsx"


def build_workbook():
    wb = Workbook()
    ws = wb.active
    ws.title = "Cash Flow"

    # Styles
    navy = PatternFill("solid", fgColor="17365D")
    light_blue = PatternFill("solid", fgColor="D9EAF7")
    white_font = Font(color="FFFFFF", bold=True)
    bold_font = Font(bold=True)
    thin = Side(style="thin", color="D9D9D9")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    # Global inputs - matching edited spreadsheet layout
    ws["B3"] = "Start Date"
    ws["C3"] = date(2026, 5, 29)
    ws["B4"] = "End Date"
    ws["C4"] = date(2031, 12, 31)
    ws["B3"].font = bold_font
    ws["B4"].font = bold_font

    # Instrument inputs
    input_rows = {
        "Name": 8,
        "Identifier / CUSIP": 9,
        "Issue Date": 10,
        "Maturity Date": 11,
        "Outstanding": 12,
        "Coupon": 13,
        "Freq. Months": 14,
        "First Coupon Date": 15,
    }

    for label, row in input_rows.items():
        ws.cell(row, 2, label)
        ws.cell(row, 2).font = bold_font
        ws.cell(row, 2).fill = light_blue

    instruments = [
        {
            "name": "Bond A",
            "id": "ID-A",
            "issue": date(2021, 11, 19),
            "maturity": date(2026, 11, 19),
            "outstanding": 500_000_000,
            "coupon": 0.0350,
            "freq_months": 6,
            "first_coupon": date(2022, 5, 19),
        },
        {
            "name": "Bond B",
            "id": "ID-B",
            "issue": date(2022, 9, 15),
            "maturity": date(2027, 9, 15),
            "outstanding": 475_000_000,
            "coupon": 0.0400,
            "freq_months": 6,
            "first_coupon": date(2023, 3, 15),
        },
        {
            "name": "Bond C",
            "id": "ID-C",
            "issue": date(2024, 5, 14),
            "maturity": date(2034, 5, 14),
            "outstanding": 300_000_000,
            "coupon": 0.0550,
            "freq_months": 6,
            "first_coupon": date(2024, 11, 14),
        },
    ]

    start_col = 3
    for i, inst in enumerate(instruments):
        col = start_col + i
        ws.cell(input_rows["Name"], col, inst["name"])
        ws.cell(input_rows["Identifier / CUSIP"], col, inst["id"])
        ws.cell(input_rows["Issue Date"], col, inst["issue"])
        ws.cell(input_rows["Maturity Date"], col, inst["maturity"])
        ws.cell(input_rows["Outstanding"], col, inst["outstanding"])
        ws.cell(input_rows["Coupon"], col, inst["coupon"])
        ws.cell(input_rows["Freq. Months"], col, inst["freq_months"])
        ws.cell(input_rows["First Coupon Date"], col, inst["first_coupon"])

    # Holiday calendar near cash flow grid, as in screenshot
    holiday_col = 7
    ws.cell(21, holiday_col, "Holiday Date")
    ws.cell(21, holiday_col).font = bold_font

    sample_holidays = [
        date(2026, 1, 1),
        date(2026, 1, 19),
        date(2026, 2, 16),
        date(2026, 5, 25),
        date(2026, 7, 3),
        date(2026, 9, 7),
        date(2026, 11, 26),
        date(2026, 12, 25),
    ]
    for r, h in enumerate(sample_holidays, start=22):
        ws.cell(r, holiday_col, h)

    # Cash flow grid
    cf_header_row = 21
    headers = ["Date", "Day Type"] + [inst["name"] for inst in instruments] + ["Total"]
    for c, h in enumerate(headers, start=1):
        ws.cell(cf_header_row, c, h)
        ws.cell(cf_header_row, c).font = white_font
        ws.cell(cf_header_row, c).fill = navy
        ws.cell(cf_header_row, c).alignment = Alignment(horizontal="center")

    start_date = ws["C3"].value
    end_date = ws["C4"].value
    current = start_date
    row = cf_header_row + 1

    while current <= end_date:
        ws.cell(row, 1, current)
        ws.cell(row, 2, f'=IF(COUNTIF($G$22:$G$200,A{row})>0,"HOL",IF(WEEKDAY(A{row},2)>5,"WE","BD"))')

        for i in range(len(instruments)):
            cf_col = 3 + i
            input_col_letter = get_column_letter(3 + i)
            maturity = f"${input_col_letter}$11"
            outstanding = f"${input_col_letter}$12"
            coupon = f"${input_col_letter}$13"
            freq_months = f"${input_col_letter}$14"
            first_coupon = f"${input_col_letter}$15"

            # Simple and auditable formula:
            # 1) No cash flow before first coupon or after maturity.
            # 2) Coupon date when months from first coupon is a multiple of frequency months and day matches.
            # 3) Maturity date adds principal.
            formula = (
                f'=IF(OR(A{row}<{first_coupon},A{row}>{maturity}),0,'
                f'IF(OR('
                f'A{row}={maturity},'
                f'AND(DAY(A{row})=DAY({first_coupon}),'
                f'MOD(DATEDIF({first_coupon},A{row},"m"),{freq_months})=0)'
                f'),'
                f'({outstanding}*{coupon}*{freq_months}/12)'
                f'+IF(A{row}={maturity},{outstanding},0),'
                f'0))'
            )
            ws.cell(row, cf_col, formula)

        total_col = 3 + len(instruments)
        ws.cell(row, total_col, f"=SUM(C{row}:{get_column_letter(total_col-1)}{row})")

        current += timedelta(days=1)
        row += 1

    # Formatting
    widths = {
        "A": 16,
        "B": 16,
        "C": 18,
        "D": 18,
        "E": 18,
        "F": 18,
        "G": 18,
    }
    for col, width in widths.items():
        ws.column_dimensions[col].width = width

    for r in range(1, row):
        for c in range(1, holiday_col + 1):
            ws.cell(r, c).border = border

    for r in range(3, 5):
        ws.cell(r, 3).number_format = "dd-mmm-yyyy"

    for col in range(3, 6):
        ws.cell(10, col).number_format = "dd-mmm-yyyy"
        ws.cell(11, col).number_format = "dd-mmm-yyyy"
        ws.cell(12, col).number_format = "#,##0"
        ws.cell(13, col).number_format = "0.00%"
        ws.cell(15, col).number_format = "dd-mmm-yyyy"

    for r in range(cf_header_row + 1, row):
        ws.cell(r, 1).number_format = "dd-mmm-yyyy"
        for c in range(3, 3 + len(instruments) + 1):
            ws.cell(r, c).number_format = '#,##0;[Red](#,##0);-'

    for r in range(22, 200):
        ws.cell(r, holiday_col).number_format = "dd-mmm-yyyy"

    ws.freeze_panes = "A22"

    # Create a simple Excel table around cash flow section
    last_col = get_column_letter(3 + len(instruments))
    tab = Table(displayName="CashFlowTable", ref=f"A21:{last_col}{row-1}")
    style = TableStyleInfo(name="TableStyleMedium2", showFirstColumn=False, showLastColumn=False, showRowStripes=True, showColumnStripes=False)
    tab.tableStyleInfo = style
    ws.add_table(tab)

    wb.save(OUTPUT_FILE)


if __name__ == "__main__":
    build_workbook()
    print(f"Created: {OUTPUT_FILE}")

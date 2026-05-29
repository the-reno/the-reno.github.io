from datetime import date, timedelta
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


OUTPUT_FILE = "treasury_cashflow_model.xlsx"


def build_workbook():
    wb = Workbook()
    ws = wb.active
    ws.title = "Cash Flow Model"

    header_fill = PatternFill("solid", fgColor="1F4E78")
    input_fill = PatternFill("solid", fgColor="D9EAF7")
    sub_fill = PatternFill("solid", fgColor="E2F0D9")
    white_font = Font(color="FFFFFF", bold=True)
    bold_font = Font(bold=True)
    thin = Side(style="thin", color="D9D9D9")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    ws["A1"] = "Treasury Cash Flow Model"
    ws["A1"].font = Font(bold=True, size=14)

    ws["A3"] = "Start Date"
    ws["B3"] = date(2026, 1, 1)
    ws["A4"] = "End Date"
    ws["B4"] = date(2031, 12, 31)
    ws["A5"] = "Model Rule"
    ws["B5"] = "Cash flow only on coupon and maturity dates"

    for cell in ["A3", "A4", "A5"]:
        ws[cell].font = bold_font

    start_input_row = 8
    instrument_cols = ["B", "C", "D", "E", "F", "G"]

    ws.cell(start_input_row, 1, "Parameter")
    ws.cell(start_input_row, 1).font = white_font
    ws.cell(start_input_row, 1).fill = header_fill

    for i, col in enumerate(instrument_cols, start=1):
        ws[f"{col}{start_input_row}"] = f"Instrument {i}"
        ws[f"{col}{start_input_row}"].font = white_font
        ws[f"{col}{start_input_row}"].fill = header_fill

    parameters = [
        "Name",
        "Identifier / CUSIP",
        "Issue Date",
        "Maturity Date",
        "Outstanding",
        "Coupon",
        "Frequency",
        "Day Count",
    ]

    for r, param in enumerate(parameters, start=start_input_row + 1):
        ws.cell(r, 1, param)
        ws.cell(r, 1).font = bold_font
        ws.cell(r, 1).fill = input_fill

    example_data = {
        "B": ["Bond A", "ID-A", date(2021, 11, 19), date(2026, 11, 19), 500_000_000, 0.0350, 2, 360],
        "C": ["Bond B", "ID-B", date(2022, 9, 15), date(2027, 9, 15), 475_000_000, 0.0400, 2, 360],
        "D": ["Bond C", "ID-C", date(2024, 5, 14), date(2034, 5, 14), 300_000_000, 0.0550, 2, 360],
    }

    for col, values in example_data.items():
        for idx, value in enumerate(values, start=start_input_row + 1):
            ws[f"{col}{idx}"] = value

    holiday_col = "J"
    ws[f"{holiday_col}8"] = "Holiday Calendar"
    ws[f"{holiday_col}8"].font = white_font
    ws[f"{holiday_col}8"].fill = header_fill
    ws[f"{holiday_col}9"] = "Holiday Date"
    ws[f"{holiday_col}9"].font = bold_font
    ws[f"{holiday_col}9"].fill = sub_fill

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

    for i, h in enumerate(sample_holidays, start=10):
        ws[f"{holiday_col}{i}"] = h

    cf_start_row = 22
    cf_headers = [
        "Date",
        "Day Type",
        "Instrument 1",
        "Instrument 2",
        "Instrument 3",
        "Instrument 4",
        "Instrument 5",
        "Instrument 6",
        "Total",
    ]

    for c, h in enumerate(cf_headers, start=1):
        cell = ws.cell(cf_start_row, c, h)
        cell.font = white_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    current = ws["B3"].value
    end_date = ws["B4"].value
    row = cf_start_row + 1

    while current <= end_date:
        ws.cell(row, 1, current)
        ws.cell(row, 2, f'=IF(COUNTIF($J$10:$J$200,A{row})>0,"HOL",IF(WEEKDAY(A{row},2)>5,"WE","BD"))')

        for i, col_num in enumerate(range(3, 9), start=1):
            input_col = get_column_letter(i + 1)
            maturity_cell = f"${input_col}$12"
            outstanding_cell = f"${input_col}$13"
            coupon_cell = f"${input_col}$14"
            frequency_cell = f"${input_col}$15"

            formula = (
                f'=IF(A{row}>{maturity_cell},0,'
                f'IF(OR('
                f'AND({frequency_cell}=2,DAY(A{row})=DAY({maturity_cell}),'
                f'OR(MONTH(A{row})=MONTH({maturity_cell}),'
                f'MONTH(A{row})=MOD(MONTH({maturity_cell})+5,12)+1)),'
                f'AND({frequency_cell}=1,DAY(A{row})=DAY({maturity_cell}),' 
                f'MONTH(A{row})=MONTH({maturity_cell}))'
                f'),'
                f'({outstanding_cell}*{coupon_cell}/{frequency_cell})'
                f'+IF(A{row}={maturity_cell},{outstanding_cell},0),'
                f'0))'
            )
            ws.cell(row, col_num, formula)

        ws.cell(row, 9, f"=SUM(C{row}:H{row})")
        current += timedelta(days=1)
        row += 1

    widths = {"A": 16, "B": 14, "C": 18, "D": 18, "E": 18, "F": 18, "G": 18, "H": 18, "I": 18, "J": 18}
    for col, width in widths.items():
        ws.column_dimensions[col].width = width

    for r in range(1, row):
        for c in range(1, 11):
            ws.cell(r, c).border = border

    for r in range(cf_start_row + 1, row):
        ws.cell(r, 1).number_format = "dd-mmm-yyyy"
        for c in range(3, 10):
            ws.cell(r, c).number_format = '#,##0;[Red](#,##0);-'

    for col in instrument_cols:
        ws[f"{col}11"].number_format = "dd-mmm-yyyy"
        ws[f"{col}12"].number_format = "dd-mmm-yyyy"
        ws[f"{col}13"].number_format = '#,##0'
        ws[f"{col}14"].number_format = "0.00%"

    ws["B3"].number_format = "dd-mmm-yyyy"
    ws["B4"].number_format = "dd-mmm-yyyy"
    for r in range(10, 200):
        ws[f"J{r}"].number_format = "dd-mmm-yyyy"

    ws.freeze_panes = "A23"
    ws["A18"] = "Instructions"
    ws["A18"].font = bold_font
    ws["A19"] = "Update inputs at the top. Add holidays in column J. Cash flows appear only on coupon and maturity dates."
    ws["A20"] = "Use generic instrument names only. Do not include real client or institution names."

    wb.save(OUTPUT_FILE)


if __name__ == "__main__":
    build_workbook()
    print(f"Created: {OUTPUT_FILE}")

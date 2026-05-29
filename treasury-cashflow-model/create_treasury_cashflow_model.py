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

    navy = PatternFill("solid", fgColor="17365D")
    light_blue = PatternFill("solid", fgColor="D9EAF7")
    white_font = Font(color="FFFFFF", bold=True)
    bold_font = Font(bold=True)
    thin = Side(style="thin", color="D9D9D9")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    ws["B3"] = "Start Date"
    ws["C3"] = date(2026, 5, 29)
    ws["B4"] = "End Date"
    ws["C4"] = date(2031, 12, 31)
    ws["B3"].font = bold_font
    ws["B4"].font = bold_font

    input_rows = {
        "Name": 8,
        "Identifier / CUSIP": 9,
        "Issue Date": 10,
        "Maturity Date": 11,
        "Outstanding": 12,
        "Coupon": 13,
        "Coupon Months": 14,
        "Payment Day": 15,
        "Frequency": 16,
    }

    for label, row in input_rows.items():
        ws.cell(row, 2, label)
        ws.cell(row, 2).font = bold_font
        ws.cell(row, 2).fill = light_blue

    instruments = [
        ["Bond A", "ID-A", date(2021, 11, 19), date(2026, 11, 19), 500_000_000, 0.0350, "5,11", 19, 2],
        ["Bond B", "ID-B", date(2022, 9, 15), date(2027, 9, 15), 475_000_000, 0.0400, "3,9", 15, 2],
        ["Bond C", "ID-C", date(2024, 5, 14), date(2034, 5, 14), 300_000_000, 0.0550, "5,11", 14, 2],
    ]

    for col_offset, inst in enumerate(instruments, start=3):
        for idx, value in enumerate(inst, start=8):
            ws.cell(idx, col_offset, value)

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

    cf_header_row = 21
    headers = ["Date", "Day Type"] + [x[0] for x in instruments] + ["Total"]
    for c, h in enumerate(headers, start=1):
        ws.cell(cf_header_row, c, h)
        ws.cell(cf_header_row, c).font = white_font
        ws.cell(cf_header_row, c).fill = navy
        ws.cell(cf_header_row, c).alignment = Alignment(horizontal="center")

    current = ws["C3"].value
    end_date = ws["C4"].value
    row = cf_header_row + 1

    while current <= end_date:
        ws.cell(row, 1, current)
        ws.cell(row, 2, f'=IF(COUNTIF($G$22:$G$200,A{row})>0,"HOL",IF(WEEKDAY(A{row},2)>5,"WE","BD"))')

        for i in range(len(instruments)):
            cf_col = 3 + i
            input_col = get_column_letter(cf_col)

            maturity_date = f"${input_col}$11"
            outstanding = f"${input_col}$12"
            coupon = f"${input_col}$13"
            coupon_months = f"${input_col}$14"
            payment_day = f"${input_col}$15"
            frequency = f"${input_col}$16"

            # Simple rule:
            # Cash flow appears only when:
            # 1) The row is a business day.
            # 2) The month is one of the coupon payment months.
            # 3) The row is the first business day on or after the payment day.
            # 4) The date is on or before maturity.
            # Principal is added on the adjusted maturity settlement date.
            formula = (
                f'=IF($B{row}<>"BD",0,'
                f'IF(A{row}>{maturity_date},0,'
                f'IF(ISNUMBER(SEARCH(","&MONTH(A{row})&",",","&{coupon_months}&",")),'
                f'IF(A{row}=WORKDAY(DATE(YEAR(A{row}),MONTH(A{row}),{payment_day})-1,1,$G$22:$G$200),'
                f'({outstanding}*{coupon}/{frequency})'
                f'+IF(A{row}=WORKDAY({maturity_date}-1,1,$G$22:$G$200),{outstanding},0),'
                f'0),'
                f'IF(A{row}=WORKDAY({maturity_date}-1,1,$G$22:$G$200),{outstanding},0)'
                f')))' 
            )
            ws.cell(row, cf_col, formula)

        total_col = 3 + len(instruments)
        ws.cell(row, total_col, f"=SUM(C{row}:{get_column_letter(total_col-1)}{row})")
        current += timedelta(days=1)
        row += 1

    widths = {"A": 16, "B": 16, "C": 18, "D": 18, "E": 18, "F": 18, "G": 18}
    for col, width in widths.items():
        ws.column_dimensions[col].width = width

    for r in range(1, row):
        for c in range(1, holiday_col + 1):
            ws.cell(r, c).border = border

    ws["C3"].number_format = "dd-mmm-yyyy"
    ws["C4"].number_format = "dd-mmm-yyyy"

    for col in range(3, 6):
        ws.cell(10, col).number_format = "dd-mmm-yyyy"
        ws.cell(11, col).number_format = "dd-mmm-yyyy"
        ws.cell(12, col).number_format = "#,##0"
        ws.cell(13, col).number_format = "0.00%"

    for r in range(cf_header_row + 1, row):
        ws.cell(r, 1).number_format = "dd-mmm-yyyy"
        for c in range(3, 3 + len(instruments) + 1):
            ws.cell(r, c).number_format = '#,##0.00;[Red](#,##0.00);-'

    for r in range(22, 200):
        ws.cell(r, holiday_col).number_format = "dd-mmm-yyyy"

    ws.freeze_panes = "A22"

    last_col = get_column_letter(3 + len(instruments))
    tab = Table(displayName="CashFlowTable", ref=f"A21:{last_col}{row-1}")
    style = TableStyleInfo(name="TableStyleMedium2", showFirstColumn=False, showLastColumn=False, showRowStripes=True, showColumnStripes=False)
    tab.tableStyleInfo = style
    ws.add_table(tab)

    wb.save(OUTPUT_FILE)


if __name__ == "__main__":
    build_workbook()
    print(f"Created: {OUTPUT_FILE}")
